import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { SaveButton } from "@/components/discovery/save-button";
import { AnalyzeButton } from "@/components/ai/analyze-button";
import { formatDate, formatDurationDays } from "@/lib/format";
import { getAd } from "@/modules/ads/queries";
import { getSaveState } from "@/modules/watchlists/queries";
import { getAIStatus } from "@/server/ai/providers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ad = await getAd(id);
  return { title: ad ? ad.title : "Ad not found" };
}

export default async function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await getAd(id);
  if (!ad) notFound();
  const [{ saved }, status] = await Promise.all([
    getSaveState("advertiser", ad.advertiser.id),
    Promise.resolve(getAIStatus()),
  ]);
  const providerLabel = status.active === "live" ? `Live · ${status.model}` : "Demo AI";

  const meta: [string, string][] = [
    ["Platform", ad.platform],
    ["Format", ad.format],
    ["Status", ad.status],
    ["First seen", formatDate(ad.firstSeen)],
    ["Last seen", formatDate(ad.lastSeen)],
    ["Run duration", `${formatDurationDays(ad.durationDays)} · calculated`],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/ads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All ads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{ad.title}</h1>
            <ProvenanceBadge provenance={ad.provenance} />
            <Badge
              className={
                ad.status === "active"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-600 ring-slate-500/20"
              }
            >
              {ad.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              href={`/advertisers/${ad.advertiser.id}`}
              className="font-medium text-accent-700 hover:underline"
            >
              {ad.advertiser.name}
            </Link>{" "}
            · {ad.platform}
            {ad.store ? (
              <>
                {" "}
                ·{" "}
                <Link
                  href={`/stores/${ad.store.id}`}
                  className="font-medium text-accent-700 hover:underline"
                >
                  {ad.store.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <SaveButton itemType="advertiser" refId={ad.advertiser.id} initialSaved={saved} />
      </div>

      <AnalyzeButton
        kind="ad"
        targetId={ad.id}
        targetName={ad.title}
        targetUrl={`/ads/${ad.id}`}
        analyzeUrl={`/api/ai/ads/${ad.id}/analyze`}
        providerLabel={providerLabel}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Creative</CardTitle>
            <CardDescription>Observed copy and calls to action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm text-slate-400">
                No creative file in the demo dataset — copy below is the complete record, not a
                preview of missing media.
              </p>
            </div>
            {ad.primaryText ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Primary text
                </p>
                <p className="mt-1 text-sm text-slate-800">{ad.primaryText}</p>
              </div>
            ) : null}
            {ad.headline ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Headline
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{ad.headline}</p>
              </div>
            ) : null}
            {ad.cta ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">CTA</p>
                <p className="mt-1">
                  <span className="inline-flex items-center rounded-md bg-brand-950 px-3 py-1.5 text-sm font-medium text-white">
                    {ad.cta}
                  </span>
                </p>
              </div>
            ) : null}
            {ad.destinationUrl ? (
              <a
                href={ad.destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:underline"
              >
                Open destination <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-slate-100">
                {meta.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                  >
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="text-right text-sm font-medium tabular-nums text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-slate-900">Performance unknown</p>
              <p className="mt-1 text-sm text-slate-500">
                The demo dataset carries no spend, impression, or conversion metrics, so nothing
                here says whether this ad worked. AI analysis of hooks and angles arrives in Phase
                4.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
