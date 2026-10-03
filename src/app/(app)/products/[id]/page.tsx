import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/badge";
import { SaveButton } from "@/components/discovery/save-button";
import { AddToList } from "@/components/discovery/add-to-list";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProduct } from "@/modules/discovery/queries";
import { getSaveState } from "@/modules/watchlists/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product ? product.name : "Product not found" };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const { saved } = await getSaveState("product", id);

  const facts: [string, string][] = [
    ["Category", product.category],
    ["Price", formatCurrency(product.price, product.currency)],
    ["Store", product.store.name],
    ["First seen", formatDate(product.firstSeen)],
    ["Last seen", formatDate(product.lastSeen)],
    [
      "Reviews",
      product.reviewCount === 0
        ? "None yet"
        : `${product.reviewCount} (avg ${product.avgRating?.toFixed(1) ?? "—"}) · calculated`,
    ],
    ["Ads from this store", `${product.storeAdCount} · observed`],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All products
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{product.name}</h1>
            <ProvenanceBadge provenance={product.provenance} />
            {product.isNew ? (
              <span className="inline-flex items-center rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
                New
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              href={`/stores/${product.store.id}`}
              className="font-medium text-accent-700 hover:underline"
            >
              {product.store.name}
            </Link>{" "}
            · {product.store.domain}
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          <SaveButton itemType="product" refId={product.id} initialSaved={saved} />
          <AddToList itemType="product" refId={product.id} />
        </div>
      </div>

      {product.description ? (
        <p className="max-w-3xl text-slate-700">{product.description}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-slate-100">
              {facts.map(([label, value]) => (
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
              {product.tags.length > 0 ? (
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-sm text-slate-500">Tags</dt>
                  <dd className="text-right text-sm text-slate-900">{product.tags.join(" · ")}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:underline"
            >
              Open product page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <div>
              <Link
                href={`/customer-intelligence?productId=${product.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:underline"
              >
                View customer reviews
              </Link>
            </div>
            <p className="text-xs text-slate-400">
              No image in the demo dataset — the image slot is intentionally empty, not broken.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
