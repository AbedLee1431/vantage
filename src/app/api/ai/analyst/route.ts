import { NextRequest } from "next/server";
import { ANALYST_SYSTEM } from "@/server/ai/prompts";
import { analystMessageSchema } from "@/lib/validation";
import { apiContext, apiError, checkApiRateLimit, isResponse } from "@/server/api";
import { AIConfigurationError, getAIProvider } from "@/server/ai/providers";
import { OverQuotaError, recordUsage, requireUsageQuota } from "@/server/billing/subscriptions";
import { callTool, toolDefinitions } from "@/server/ai/tools";
import { createTenantClient } from "@/server/db/tenant";
import { sanitizeError } from "@/server/jobs/handlers";
import type { ChatMessage } from "@/lib/ai";

/**
 * Analyst chat (streaming SSE: `data: {"token"}` chunks, then `data: {"done"}`).
 * Persists the user message before streaming and the assistant reply (with tool
 * calls) after. Provider failures stream an error event AND persist a failed
 * notice so history stays coherent.
 */
export async function POST(req: NextRequest) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return apiError("validation", "Invalid request.", 400);
  }
  const parsed = analystMessageSchema.safeParse(body);
  if (!parsed.success) return apiError("validation", "Message is required.", 400);

  const limited = await checkApiRateLimit(ctx.organizationId, "ai:analyst", 30, 3_600_000);
  if (limited) return limited;

  try {
    await requireUsageQuota(ctx.organizationId, "ai_analysis");
  } catch (error) {
    if (error instanceof OverQuotaError) {
      return apiError("over_quota", `${error.message} Visit /billing to upgrade.`, 429);
    }
    throw error;
  }
  await recordUsage(ctx.organizationId, "ai_analysis");

  const db = createTenantClient(ctx.organizationId);
  const { message, conversationId: requestedId } = parsed.data;

  let conversationId = requestedId;
  if (conversationId) {
    const existing = await db.aiConversation.findUnique({ where: { id: conversationId } });
    if (!existing) return apiError("not_found", "Conversation not found.", 404);
  } else {
    const created = await db.aiConversation.create({
      data: { organizationId: ctx.organizationId, title: message.slice(0, 60) },
    });
    conversationId = created.id;
  }

  await db.aiMessage.create({
    data: {
      conversationId,
      organizationId: ctx.organizationId,
      role: "user",
      content: message,
      provenance: "user",
    },
  });
  await db.aiConversation.update({ where: { id: conversationId }, data: {} });

  const history = await db.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const messages: ChatMessage[] = [
    { role: "system", content: ANALYST_SYSTEM },
    ...history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  let provider;
  try {
    provider = getAIProvider();
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return apiError("ai_configuration", error.message, 500);
    }
    throw error;
  }
  const providerName = provider.name;
  const organizationId = ctx.organizationId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const result = await provider.chat({
          messages,
          tools: toolDefinitions(),
          callTool: (name, args) => callTool(organizationId, name, args),
          onToken: (token) => send({ token, conversationId }),
        });
        const saved = await db.aiMessage.create({
          data: {
            conversationId: conversationId as string,
            organizationId,
            role: "assistant",
            content: result.text,
            toolCalls: result.toolCalls as unknown as object,
            evidence: ((result.refs ?? []) as unknown as object[]).length
              ? (result.refs as unknown as object)
              : undefined,
            provenance: providerName === "demo" ? "demo" : "ai",
          },
        });
        await db.aiConversation.update({ where: { id: conversationId }, data: {} });
        send({ done: true, conversationId, messageId: saved.id, refs: result.refs ?? [] });
      } catch (error) {
        const reason = sanitizeError(error);
        const failed = await db.aiMessage.create({
          data: {
            conversationId: conversationId as string,
            organizationId,
            role: "assistant",
            content: `Analysis failed (${reason}). Please try again — no data was fabricated.`,
            provenance: providerName === "demo" ? "demo" : "ai",
          },
        });
        send({ error: reason, conversationId, messageId: failed.id });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
