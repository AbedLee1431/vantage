import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { SaveButton } from "@/components/discovery/save-button";
import { formatDate, formatDurationDays } from "@/lib/format";
import { getAdvertiser } from "@/modules/ads/queries";
import { getSaveState } from "@/modules/watchlists/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const advertiser = await getAdvertiser(id);
  return { title: advertiser ? advertiser.name : "Advertiser not found" };
}

export default async function AdvertiserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const advertiser = await getAdvertiser(id);
  if (!advertiser) notFound();
  const { saved } = await getSaveState("advertiser", id);

  const active = advertiser.ads.filter((a) => a.status === "active").length;

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
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{advertiser.name}</h1>
            <ProvenanceBadge provenance={advertiser.provenance} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {advertiser.platform}
            {advertiser.store ? (
              <>
                {" "}
                ·{" "}
                <Link
                  href={`/stores/${advertiser.store.id}`}
                  className="font-medium text-accent-700 hover:underline"
                >
                  {advertiser.store.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <SaveButton itemType="advertiser" refId={advertiser.id} initialSaved={saved} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total ads", value: advertiser.adCount },
          { label: "Active now", value: active },
          { label: "Formats used", value: new Set(advertiser.ads.map((a) => a.format)).size },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">{s.value}</p>
              <p className="mt-1 text-xs text-slate-400">Observed · demo data</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ads ({advertiser.adCount})</CardTitle>
          <CardDescription>Everything observed from this advertiser</CardDescription>
        </CardHeader>
        <CardContent>
          {advertiser.ads.length === 0 ? (
            <EmptyState
              title="No ads"
              description="No ads are associated with this advertiser yet."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {advertiser.ads.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ads/${a.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {a.format} · {formatDate(a.firstSeen)} · {formatDurationDays(a.durationDays)}
                    </p>
                  </div>
                  <Badge
                    className={
                      a.status === "active"
                        ? "shrink-0 bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                        : "shrink-0 bg-slate-100 text-slate-600 ring-slate-500/20"
                    }
                  >
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
