import Link from "next/link";
import { brand } from "@/lib/brand";
import { buttonClasses } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand-950">
          {brand.name}
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </Link>
          <Link href="/register" className={buttonClasses({ size: "sm" })}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-950">{brand.name}</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">{brand.tagline}</p>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Product
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>
                  <Link href="/pricing" className="hover:text-slate-900 hover:underline">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-slate-900 hover:underline">
                    Get started
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-slate-900 hover:underline">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Legal</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>
                  <span className="text-slate-400">Privacy (coming soon)</span>
                </li>
                <li>
                  <span className="text-slate-400">Terms (coming soon)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            {brand.legalName} · {brand.supportEmail} · Demo data only — not real market data.
          </p>
        </div>
      </div>
    </footer>
  );
}
