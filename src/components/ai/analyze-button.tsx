"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisViewer, type AnalysisView } from "./analysis-viewer";
import { JobStatusPill } from "./evidence";

type State =
  | { phase: "idle" }
  | { phase: "working"; jobId: string; status: string }
  | { phase: "done"; analysis: AnalysisView; cached: boolean }
  | { phase: "error"; message: string };

type AnalysisPayload = {
  cached?: boolean;
  analysisId?: string;
  analysis?: AnalysisView;
  jobId?: string;
  error?: { message?: string };
};

/**
 * Request → (process) → poll → render loop for persisted AI analyses.
 * Works identically for Demo (instant) and live providers (slow polls).
 * For review summaries, pass kind="review_summary" with requestBody scope.
 */
export function AnalyzeButton({
  kind,
  targetId,
  targetName,
  targetUrl,
  analyzeUrl,
  providerLabel,
  requestBody,
}: {
  kind: "ad" | "competitor" | "review_summary";
  targetId: string;
  targetName: string;
  targetUrl: string;
  analyzeUrl: string;
  providerLabel: string;
  requestBody?: Record<string, unknown>;
}) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function poll(jobId: string, attempt = 0): Promise<void> {
    if (!mounted.current) return;
    if (attempt > 60) {
      setState({ phase: "error", message: "Timed out waiting for analysis. Please retry." });
      return;
    }
    let res: Response;
    try {
      res = await fetch(`/api/jobs/${jobId}`);
    } catch {
      setState({ phase: "error", message: "Network error while checking analysis status." });
      return;
    }
    if (!res.ok) {
      setState({ phase: "error", message: "Could not check analysis status." });
      return;
    }
    const data = (await res.json()) as {
      job?: { status?: string; error?: string | null };
      analysis?: AnalysisView;
    };
    const status = data.job?.status ?? "queued";
    if (status === "done" && data.analysis) {
      const analysis: AnalysisView = { ...data.analysis, targetName, targetUrl, cached: false };
      if (mounted.current) setState({ phase: "done", analysis, cached: false });
      return;
    }
    if (status === "failed") {
      if (mounted.current) {
        setState({ phase: "error", message: data.job?.error ?? "Analysis failed." });
      }
      return;
    }
    if (mounted.current) setState({ phase: "working", jobId, status });
    setTimeout(() => void poll(jobId, attempt + 1), 1500);
  }

  async function start(force = false): Promise<void> {
    setState({ phase: "working", jobId: "", status: "queued" });
    // Competitor analyses address the store in the body; ad analyses in the URL.
    // Review summaries take an optional scope (productId/storeId) or run org-wide.
    const body: Record<string, unknown> = {
      ...(kind === "competitor" ? { storeId: targetId } : {}),
      ...(requestBody ?? {}),
      ...(force ? { force: true } : {}),
    };
    let res: Response;
    try {
      res = await fetch(analyzeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setState({ phase: "error", message: "Network error requesting analysis." });
      return;
    }
    if (res.status === 429) {
      setState({ phase: "error", message: "Too many analysis requests. Please try again later." });
      return;
    }
    let data: AnalysisPayload;
    try {
      data = (await res.json()) as AnalysisPayload;
    } catch {
      setState({ phase: "error", message: "Invalid response requesting analysis." });
      return;
    }
    if (!res.ok) {
      setState({ phase: "error", message: data.error?.message ?? "Analysis request failed." });
      return;
    }
    if (data.cached && data.analysis) {
      const analysis: AnalysisView = { ...data.analysis, targetName, targetUrl, cached: true };
      setState({ phase: "done", analysis, cached: true });
      return;
    }
    if (!data.jobId) {
      setState({ phase: "error", message: "Analysis request returned no job." });
      return;
    }
    // Trigger processing, then poll for completion.
    try {
      await fetch("/api/jobs/process", { method: "POST" });
    } catch {
      // Processing may still happen via cron; polling will reveal it.
    }
    setState({ phase: "working", jobId: data.jobId, status: "queued" });
    await poll(data.jobId);
  }

  if (state.phase === "done") {
    return (
      <div className="space-y-3">
        <AnalysisViewer analysis={state.analysis} />
        <button
          type="button"
          onClick={() => void start(true)}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
        >
          Re-analyze (bypass cache)
        </button>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <ErrorState
        title="Analysis failed"
        description={state.message}
        onRetry={() => void start()}
      />
    );
  }

  if (state.phase === "working") {
    return (
      <div className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <JobStatusPill status={state.status} />
          <span className="text-sm text-slate-600">
            {kind === "ad"
              ? "Analyzing creative…"
              : kind === "competitor"
                ? "Analyzing competitor…"
                : "Summarizing reviews…"}
          </span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <p className="text-xs text-slate-400">Results persist and are reused on repeat requests.</p>
      </div>
    );
  }

  return (
    <Button onClick={() => void start()} variant="secondary">
      <Sparkles className="h-4 w-4" aria-hidden />
      {kind === "ad"
        ? "Analyze with AI"
        : kind === "competitor"
          ? "Analyze competitor"
          : "Summarize pain points"}{" "}
      · {providerLabel}
    </Button>
  );
}
