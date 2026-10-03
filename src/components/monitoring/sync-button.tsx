"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { JobStatusPill } from "@/components/ai/evidence";

/**
 * Manual sync trigger: POST → process → poll → refresh. Detects genuinely new
 * rows since the last sync; on static demo data it honestly reports no changes.
 */
export function SyncButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "working" | "done" | "error">("idle");
  const [status, setStatus] = useState("queued");
  const [message, setMessage] = useState("");

  async function poll(jobId: string, attempt = 0): Promise<void> {
    if (attempt > 40) {
      setMessage("Timed out waiting for sync. Please refresh the page.");
      setPhase("error");
      return;
    }
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) {
      setMessage("Could not check sync status.");
      setPhase("error");
      return;
    }
    const data = (await res.json()) as { job?: { status?: string; error?: string | null } };
    const s = data.job?.status ?? "queued";
    if (s === "done") {
      router.refresh();
      setPhase("done");
      return;
    }
    if (s === "failed") {
      setMessage(data.job?.error ?? "Sync failed.");
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
      res = await fetch("/api/monitoring/sync", { method: "POST" });
    } catch {
      setMessage("Network error requesting sync.");
      setPhase("error");
      return;
    }
    if (res.status === 429) {
      setMessage("Too many syncs. Please try again later.");
      setPhase("error");
      return;
    }
    if (!res.ok) {
      setMessage("Sync request failed.");
      setPhase("error");
      return;
    }
    const data = (await res.json()) as { jobId?: string };
    if (!data.jobId) {
      setMessage("Sync request returned no job.");
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
    return <ErrorState title="Sync failed" description={message} onRetry={() => void start()} />;
  }

  if (phase === "working") {
    return (
      <div className="space-y-2 rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <JobStatusPill status={status} />
          <span className="text-sm text-slate-600">Scanning for new products, ads, reviews…</span>
        </div>
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <p className="text-sm text-slate-700">Sync complete — timeline refreshed.</p>
        <button
          type="button"
          onClick={() => void start()}
          className="text-sm font-medium text-accent-700 hover:underline"
        >
          Sync again
        </button>
      </div>
    );
  }

  return (
    <Button onClick={() => void start()} variant="secondary">
      <RefreshCw className="h-4 w-4" aria-hidden /> Sync now
    </Button>
  );
}
