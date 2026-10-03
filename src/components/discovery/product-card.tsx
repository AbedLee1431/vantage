import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

export type ProductCardItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  storeName: string;
  tags: string[];
  isNew: boolean;
  provenance: "demo" | "mock" | "estimated" | "calculated" | "external" | "ai" | "user";
};

export function ProductCard({ product }: { product: ProductCardItem }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <ProvenanceBadge provenance={product.provenance} />
          {product.isNew ? (
            <span className="inline-flex items-center rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
              New
            </span>
          ) : null}
        </div>
        <Link href={`/products/${product.id}`} className="mt-2 block hover:underline">
          <span className="text-base font-semibold text-slate-900">{product.name}</span>
        </Link>
        <p className="mt-0.5 text-sm text-slate-500">
          {product.storeName} · {product.category}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold tabular-nums text-brand-950">
            {formatCurrency(product.price, product.currency)}
          </span>
          {product.tags.length > 0 ? (
            <span className="truncate text-xs text-slate-400">{product.tags.join(" · ")}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
