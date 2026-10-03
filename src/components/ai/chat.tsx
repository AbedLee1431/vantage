"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { EvidenceRef } from "@/lib/ai";
import { cn } from "@/lib/utils";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  refs?: EvidenceRef[];
  pending?: boolean;
};

const SUGGESTIONS = [
  "Summarize the biggest customer complaints",
  "What advertising angles are appearing repeatedly?",
  "Compare Nordwind Outdoors and Lumen Skincare",
  "What changed recently?",
  "Find emerging skincare opportunities",
];

function Sources({ refs }: { refs?: EvidenceRef[] }) {
  if (!refs || refs.length === 0) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-700">
        Sources ({refs.length})
      </summary>
      <ul className="mt-1 space-y-0.5 text-slate-500">
        {refs.map((r, i) => (
          <li key={`${r.type}-${r.id}-${i}`}>
            <Badge className="mr-1.5 bg-slate-100 text-slate-600 ring-slate-500/20">{r.type}</Badge>
            {r.label} <span className="font-mono text-slate-400">({r.id.slice(0, 8)}…)</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Chat({
  initialConversationId,
  initialMessages,
  conversations,
  providerLabel,
  isDemo,
}: {
  initialConversationId: string | null;
  initialMessages: ChatMsg[];
  conversations: { id: string; title: string }[];
  providerLabel: string;
  isDemo: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [history, setHistory] = useState(conversations);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const nextId = (prefix: string): string => {
    idCounter.current += 1;
    return `${prefix}-${idCounter.current}`;
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setStreaming(true);
    const userMsg: ChatMsg = { id: nextId("u"), role: "user", content: trimmed };
    const pendingId = nextId("a");
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "assistant", content: "", pending: true },
    ]);
    setInput("");

    let res: Response;
    try {
      res = await fetch("/api/ai/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setError("Network error. Please try again.");
      setStreaming(false);
      return;
    }
    if (res.status === 429) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setError("Too many messages. Please try again later.");
      setStreaming(false);
      return;
    }
    if (!res.ok || !res.body) {
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      setError("The analyst could not be reached.");
      setStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part
            .trim()
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          let event: {
            token?: string;
            done?: boolean;
            error?: string;
            conversationId?: string;
            messageId?: string;
            refs?: EvidenceRef[];
          };
          try {
            event = JSON.parse(line.slice(5).trim()) as typeof event;
          } catch {
            continue;
          }
          if (typeof event.token === "string") {
            fullText += event.token;
            const snapshot = fullText;
            setMessages((prev) =>
              prev.map((m) => (m.id === pendingId ? { ...m, content: snapshot } : m)),
            );
          } else if (event.done) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? {
                      ...m,
                      id: event.messageId ?? m.id,
                      content: fullText,
                      refs: event.refs ?? [],
                      pending: false,
                    }
                  : m,
              ),
            );
            if (event.conversationId && event.conversationId !== conversationId) {
              setConversationId(event.conversationId);
              setHistory((prev) => [
                { id: event.conversationId as string, title: trimmed.slice(0, 60) },
                ...prev,
              ]);
              router.replace(`/analyst?c=${event.conversationId}`);
            }
          } else if (typeof event.error === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? { ...m, content: `Analysis failed: ${event.error}`, pending: false }
                  : m,
              ),
            );
          }
        }
      }
    } finally {
      reader.releaseLock();
      setStreaming(false);
    }
  }

  async function switchConversation(id: string): Promise<void> {
    if (id === conversationId || streaming) return;
    setError(null);
    const res = await fetch(`/api/ai/conversations/${id}`);
    if (!res.ok) {
      setError("Could not load that conversation.");
      return;
    }
    const data = (await res.json()) as {
      conversation: {
        id: string;
        messages: {
          id: string;
          role: "user" | "assistant";
          content: string;
          evidence: EvidenceRef[] | null;
        }[];
      };
    };
    setConversationId(data.conversation.id);
    setMessages(
      data.conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        refs: m.evidence ?? [],
      })),
    );
    router.replace(`/analyst?c=${id}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardContent>
          <button
            type="button"
            onClick={() => {
              setConversationId(null);
              setMessages([]);
              setError(null);
              router.replace("/analyst");
            }}
            className="mb-2 w-full rounded-md bg-brand-950 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            New chat
          </button>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">No conversations yet.</p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {history.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void switchConversation(c.id)}
                    className={cn(
                      "block w-full truncate rounded px-2 py-1.5 text-left text-sm",
                      c.id === conversationId
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {messages.length === 0 ? (
          <EmptyState
            title={`Ask the analyst ${isDemo ? "(Demo AI)" : ""}`}
            description="Grounded in your workspace data. Try one of these:"
          />
        ) : null}
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={streaming}
                className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3" aria-live="polite">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-3",
                  m.role === "user" ? "bg-brand-950 text-white" : "bg-white ring-1 ring-slate-200",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="mb-1">
                    <ProvenanceBadge provenance={isDemo ? "demo" : "ai"} />
                  </div>
                ) : null}
                <p
                  className={cn(
                    "whitespace-pre-wrap text-sm",
                    m.role === "user" ? "" : "text-slate-800",
                  )}
                >
                  {m.content}
                  {m.pending && !m.content ? (
                    <span className="animate-pulse">Thinking…</span>
                  ) : null}
                </p>
                {m.role === "assistant" && !m.pending ? <Sources refs={m.refs} /> : null}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
          >
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <label htmlFor="analyst-input" className="sr-only">
            Ask the analyst
          </label>
          <input
            id="analyst-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, competitors, ads, trends…"
            autoComplete="off"
            maxLength={2000}
            disabled={streaming}
            className="block w-full rounded-md border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-accent-600 sm:text-sm disabled:opacity-50"
          />
          <Button type="submit" disabled={streaming || !input.trim()} aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </form>
        <p className="text-xs text-slate-400">
          {providerLabel}. Answers cite workspace records; missing data is stated, never invented.
        </p>
      </div>
    </div>
  );
}
