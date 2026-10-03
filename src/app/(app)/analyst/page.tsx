import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chat, type ChatMsg } from "@/components/ai/chat";
import { getAIStatus } from "@/server/ai/providers";
import { getAiUsage, getConversation, listConversations } from "@/modules/ai/queries";
import { getBillingSummary } from "@/server/billing/subscriptions";
import { toEvidenceRefs } from "@/lib/ai";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Analyst" };

export default async function AnalystPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const params = await searchParams;
  const status = getAIStatus();
  const [usage, conversations, billing] = await Promise.all([
    getAiUsage(),
    listConversations(),
    getBillingSummary(),
  ]);

  let initialMessages: ChatMsg[] = [];
  let activeId: string | null = null;
  if (typeof params.c === "string" && params.c) {
    const conversation = await getConversation(params.c);
    if (conversation) {
      activeId = conversation.id;
      initialMessages = conversation.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        refs: toEvidenceRefs(m.evidence),
      }));
    }
  }

  const statusStyle =
    status.active === "live"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
      : status.active === "misconfigured"
        ? "bg-red-50 text-red-700 ring-red-600/20"
        : "bg-demo-100 text-demo-700 ring-demo-600/20";

  const aiUsage = billing.entitlements.usage.ai_analysis ?? 0;
  const aiLimit = billing.entitlements.limits.ai_analysis;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">AI Analyst</h1>
        <Badge className={cn(statusStyle)}>
          {status.active === "live"
            ? `Live · ${status.model}`
            : status.active === "misconfigured"
              ? "Misconfigured"
              : "Demo AI"}
        </Badge>
      </div>
      <p className="max-w-3xl text-sm text-slate-600">{status.message}</p>

      <Card>
        <CardContent>
          <p className="text-sm text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">
              {aiUsage} / {aiLimit}
            </span>{" "}
            analyses used this {billing.entitlements.period} ({billing.entitlements.planName}) ·{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {usage.chatMessagesThisMonth}
            </span>{" "}
            chat messages
          </p>
        </CardContent>
      </Card>

      <Chat
        initialConversationId={activeId}
        initialMessages={initialMessages}
        conversations={conversations}
        providerLabel={status.active === "live" ? `Live · ${status.model}` : "Demo AI"}
        isDemo={status.active !== "live"}
      />
    </div>
  );
}
