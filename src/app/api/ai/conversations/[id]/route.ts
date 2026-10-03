import { NextResponse } from "next/server";
import { apiContext, apiError, isResponse } from "@/server/api";
import { getConversation } from "@/modules/ai/queries";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return apiError("not_found", "Conversation not found.", 404);
  return NextResponse.json({ conversation });
}
