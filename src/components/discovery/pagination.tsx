import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { withSearchParams } from "@/lib/url";

export function Pagination({
  path,
  searchParams,
  page,
  totalPages,
  total,
}: {
  path: string;
  searchParams: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
  total: number;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-sm text-slate-500" role="status">
        {total} {total === 1 ? "result" : "results"}
      </p>
    );
  }

  // Compact page window around the current page.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const numbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i).filter(
    (n) => n >= 1 && n <= totalPages,
  );

  const linkClass = (active: boolean) =>
    cn(
      "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium",
      active
        ? "bg-brand-950 text-white"
        : "text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    );

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2">
      <p className="mr-2 text-sm text-slate-500" role="status">
        {total} {total === 1 ? "result" : "results"} · Page {page} of {totalPages}
      </p>
      {page > 1 ? (
        <Link
          href={withSearchParams(path, searchParams, { page: page - 1 })}
          className={linkClass(false)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
      {numbers.map((n) => (
        <Link
          key={n}
          href={withSearchParams(path, searchParams, { page: n })}
          className={linkClass(n === page)}
          aria-label={`Page ${n}`}
          aria-current={n === page ? "page" : undefined}
        >
          {n}
        </Link>
      ))}
      {page < totalPages ? (
        <Link
          href={withSearchParams(path, searchParams, { page: page + 1 })}
          className={linkClass(false)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
