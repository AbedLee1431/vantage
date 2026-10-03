import { NextResponse } from "next/server";
import { apiContext, isResponse } from "@/server/api";
import { listConversations } from "@/modules/ai/queries";

export async function GET() {
  const ctx = await apiContext();
  if (isResponse(ctx)) return ctx;
  return NextResponse.json({ conversations: await listConversations() });
}
