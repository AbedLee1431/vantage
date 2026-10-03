"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { JobStatusPill } from "@/components/ai/evidence";

/**
 * Gap-analysis trigger: POST → process → poll → refresh the list (opportunities
 * persist as rows, so completion means revalidating, not rendering one object).
 */
export function OpportunityAnalyzeButton({ providerLabel }: { providerLabel: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "working" | "error">("idle");
  const [status, setStatus] = useState("queued");
  const [message, setMessage] = useState("");

  async function poll(jobId: string, attempt = 0): Promise<void> {
    if (attempt > 60) {
      setMessage("Timed out waiting. Please refresh the page.");
      setPhase("error");
      return;
    }
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) {
      setMessage("Could not check job status.");
      setPhase("error");
      return;
    }
    const data = (await res.json()) as { job?: { status?: string; error?: string | null } };
    const s = data.job?.status ?? "queued";
    if (s === "done") {
      router.refresh();
      setPhase("idle");
      return;
    }
    if (s === "failed") {
      setMessage(data.job?.error ?? "Analysis failed.");
      setPhase("error");
      return;
    }
    setStatus(s);
    setTimeout(() => void poll(jobId, attempt + 1), 1500);
  }

  async function start(): Promise<void> {
    setPhase("working");
    setStatus("queued");
    setMessage("");
    let res: Response;
    try {
      res = await fetch("/api/ai/opportunities/analyze", { method: "POST" });
    } catch {
      setMessage("Network error requesting analysis.");
      setPhase("error");
      return;
    }
    if (res.status === 429) {
      setMessage("Too many requests. Please try again later.");
      setPhase("error");
      return;
    }
    if (!res.ok) {
      setMessage("Analysis request failed.");
      setPhase("error");
      return;
    }
    const data = (await res.json()) as { jobId?: string };
    if (!data.jobId) {
      setMessage("Analysis request returned no job.");
      setPhase("error");
      return;
    }
    try {
      await fetch("/api/jobs/process", { method: "POST" });
    } catch {
      // Cron or a later poll may still complete it.
    }
    await poll(data.jobId);
  }

  if (phase === "error") {
    return (
      <ErrorState title="Gap analysis failed" description={message} onRetry={() => void start()} />
    );
  }

  if (phase === "working") {
    return (
      <div className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <JobStatusPill status={status} />
          <span className="text-sm text-slate-600">Scanning products, ads, and reviews…</span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  return (
    <Button onClick={() => void start()} variant="secondary">
      <Sparkles className="h-4 w-4" aria-hidden /> Analyze opportunities · {providerLabel}
    </Button>
  );
}
