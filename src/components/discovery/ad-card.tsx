import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { formatDate, formatDurationDays } from "@/lib/format";

export type AdCardItem = {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  durationDays: number;
  firstSeen: Date;
  advertiserName: string;
  storeName: string | null;
  provenance: "demo" | "mock" | "estimated" | "calculated" | "external" | "ai" | "user";
};

export function AdCard({ ad }: { ad: AdCardItem }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
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
          <Badge className="bg-slate-100 text-slate-700 ring-slate-500/20">{ad.platform}</Badge>
          <Badge className="bg-slate-100 text-slate-700 ring-slate-500/20">{ad.format}</Badge>
        </div>
        <Link href={`/ads/${ad.id}`} className="mt-2 block hover:underline">
          <span className="text-base font-semibold text-slate-900">{ad.title}</span>
        </Link>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {ad.advertiserName}
          {ad.storeName ? ` · ${ad.storeName}` : ""}
        </p>
        <p className="mt-2 text-xs tabular-nums text-slate-400">
          {formatDate(ad.firstSeen)} · {formatDurationDays(ad.durationDays)}
        </p>
      </CardContent>
    </Card>
  );
}
