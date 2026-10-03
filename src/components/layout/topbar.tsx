import { LogOut, Search } from "lucide-react";
import Link from "next/link";
import { ProvenanceBadge } from "@/components/ui/badge";
import { logoutAction } from "@/modules/auth/actions";
import { requireOrg } from "@/server/db/tenant";
import { getEntitlements } from "@/server/billing/subscriptions";

export async function Topbar() {
  const { user, organization, organizationId } = await requireOrg();
  let planLabel = "Free";
  try {
    const ent = await getEntitlements(organizationId);
    planLabel = ent.planName;
  } catch {
    // Billing summary never blocks navigation.
  }
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <p className="hidden truncate text-sm font-medium text-slate-900 lg:block">
          {organization.name}
        </p>
        <ProvenanceBadge provenance="demo" />
        <Link
          href="/billing"
          className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 hover:bg-slate-200 sm:inline"
          title="View plan and usage"
        >
          {planLabel}
        </Link>
      </div>
      <form
        action="/search"
        method="get"
        role="search"
        className="hidden min-w-0 flex-1 max-w-md sm:block"
      >
        <label htmlFor="topbar-search" className="sr-only">
          Search products, stores, advertisers, competitors
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="topbar-search"
            name="q"
            type="search"
            placeholder="Search products, stores…"
            autoComplete="off"
            className="block w-full rounded-md border-0 bg-slate-100 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-accent-600"
          />
        </div>
      </form>
      <div className="flex shrink-0 items-center gap-3">
        <p className="hidden max-w-48 truncate text-sm text-slate-500 md:block" title={user.email}>
          {user.name ?? user.email}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
