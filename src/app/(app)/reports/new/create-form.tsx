"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { JobStatusPill } from "@/components/ai/evidence";

const TYPES = [
  { value: "competitor", label: "Competitor report", needs: "store" },
  { value: "product", label: "Product intelligence", needs: "product" },
  { value: "advertising", label: "Advertising report", needs: "optional-advertiser" },
  { value: "customer", label: "Customer intelligence", needs: "optional-scope" },
  { value: "trends", label: "Market trends", needs: "none" },
  { value: "monitoring", label: "Monitoring report", needs: "none" },
  { value: "combined", label: "Combined intelligence", needs: "none" },
] as const;

/**
 * Report creation: pick a type (+ target), POST to enqueue, process, poll the
 * job, then navigate to the finished report. Reruns always create new history.
 */
export function ReportCreateForm({
  stores,
  products,
  advertisers,
}: {
  stores: { id: string; name: string }[];
  products: { id: string; name: string }[];
  advertisers: { id: string; name: string; platform: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<string>("combined");
  const [phase, setPhase] = useState<"idle" | "working" | "error">("idle");
  const [status, setStatus] = useState("queued");
  const [message, setMessage] = useState("");

  const needs = TYPES.find((t) => t.value === type)?.needs ?? "none";

  async function submit(formData: FormData): Promise<void> {
    setPhase("working");
    setStatus("queued");
    setMessage("");
    const body: Record<string, unknown> = { type };
    for (const key of ["storeId", "productId", "advertiserId", "platform"]) {
      const value = formData.get(key);
      if (typeof value === "string" && value) body[key] = value;
    }
    let res: Response;
    try {
      res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setMessage("Network error creating report.");
      setPhase("error");
      return;
    }
    if (res.status === 429) {
      setMessage("Too many reports. Please try again later.");
      setPhase("error");
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setMessage(data.error?.message ?? "Report request failed.");
      setPhase("error");
      return;
    }
    const data = (await res.json()) as { jobId?: string; reportId?: string };
    if (!data.jobId || !data.reportId) {
      setMessage("Report request returned no job.");
      setPhase("error");
      return;
    }
    try {
      await fetch("/api/jobs/process", { method: "POST" });
    } catch {
      // Cron or a later poll may still complete it.
    }
    // Poll until done, then open the report.
    const reportId = data.reportId;
    const pollUntilDone = async (jobId: string, attempt = 0): Promise<void> => {
      if (attempt > 60) {
        setMessage("Timed out waiting. Check history — the report may still complete.");
        setPhase("error");
        return;
      }
      const pollRes = await fetch(`/api/jobs/${jobId}`);
      if (!pollRes.ok) {
        setMessage("Could not check report status.");
        setPhase("error");
        return;
      }
      const pollData = (await pollRes.json()) as {
        job?: { status?: string; error?: string | null };
      };
      const s = pollData.job?.status ?? "queued";
      if (s === "done") {
        router.push(`/reports/${reportId}`);
        return;
      }
      if (s === "failed") {
        setMessage(pollData.job?.error ?? "Report generation failed.");
        setPhase("error");
        return;
      }
      setStatus(s);
      setTimeout(() => void pollUntilDone(jobId, attempt + 1), 1500);
    };
    await pollUntilDone(data.jobId);
  }

  if (phase === "error") {
    return (
      <ErrorState title="Report failed" description={message} onRetry={() => setPhase("idle")} />
    );
  }

  if (phase === "working") {
    return (
      <div className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <JobStatusPill status={status} />
          <span className="text-sm text-slate-600">Assembling sections and summary…</span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  return (
    <form
      action={(formData: FormData) => {
        void submit(formData);
      }}
      className="max-w-xl space-y-4"
    >
      <Field label="Report type" htmlFor="report-type">
        <Select id="report-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      {needs === "store" ? (
        <Field label="Store" htmlFor="storeId">
          <Select id="storeId" name="storeId" required defaultValue="">
            <option value="" disabled>
              Choose a store…
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {needs === "product" ? (
        <Field label="Product" htmlFor="productId">
          <Select id="productId" name="productId" required defaultValue="">
            <option value="" disabled>
              Choose a product…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {needs === "optional-advertiser" ? (
        <>
          <Field label="Advertiser (optional)" htmlFor="advertiserId">
            <Select id="advertiserId" name="advertiserId" defaultValue="">
              <option value="">All advertisers</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.platform}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Platform (optional)" htmlFor="platform">
            <Input id="platform" name="platform" placeholder="e.g. Meta" autoComplete="off" />
          </Field>
        </>
      ) : null}
      {needs === "optional-scope" ? (
        <>
          <Field label="Product scope (optional)" htmlFor="productId">
            <Select id="productId" name="productId" defaultValue="">
              <option value="">Whole workspace</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Store scope (optional)" htmlFor="storeId">
            <Select id="storeId" name="storeId" defaultValue="">
              <option value="">Whole workspace</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : null}
      <Button type="submit">
        <FileText className="h-4 w-4" aria-hidden /> Generate report
      </Button>
      <p className="text-xs text-slate-400">
        Runs as a background job; large scopes may take a minute. Reruns create new history entries.
      </p>
    </form>
  );
}
