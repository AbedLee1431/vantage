import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/badge";

export type StoreCardItem = {
  id: string;
  name: string;
  domain: string;
  category: string;
  country: string;
  platform: string;
  productCount: number;
  provenance: "demo" | "mock" | "estimated" | "calculated" | "external" | "ai" | "user";
};

export function StoreCard({ store }: { store: StoreCardItem }) {
  return (
    <Card>
      <CardContent>
        <ProvenanceBadge provenance={store.provenance} />
        <Link href={`/stores/${store.id}`} className="mt-2 block hover:underline">
          <span className="text-base font-semibold text-slate-900">{store.name}</span>
        </Link>
        <p className="mt-0.5 truncate text-sm text-slate-500">{store.domain}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span>{store.category}</span>
          <span aria-hidden>·</span>
          <span>{store.country}</span>
          <span aria-hidden>·</span>
          <span>{store.platform}</span>
        </div>
        <p className="mt-1 text-sm font-medium tabular-nums text-slate-900">
          {store.productCount} {store.productCount === 1 ? "product" : "products"}
        </p>
      </CardContent>
    </Card>
  );
}
