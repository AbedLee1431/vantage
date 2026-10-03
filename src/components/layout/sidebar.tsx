import Link from "next/link";
import { brand } from "@/lib/brand";
import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight text-brand-950">
          {brand.name}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>
      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs leading-relaxed text-slate-400">
          Usage and plan status live under Billing.
        </p>
      </div>
    </aside>
  );
}
