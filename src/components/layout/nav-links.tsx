"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Bot,
  CreditCard,
  FileText,
  HeartHandshake,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  Package,
  Settings,
  Store,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavLink = { href: string; label: string; icon: typeof LayoutDashboard };

export const navSections: { label: string | null; links: NavLink[] }[] = [
  { label: null, links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Discover",
    links: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/stores", label: "Stores", icon: Store },
      { href: "/ads", label: "Ads", icon: Megaphone },
      { href: "/trends", label: "Trends", icon: TrendingUp },
    ],
  },
  {
    label: "Monitor",
    links: [{ href: "/watchlists", label: "Watchlists", icon: Bookmark }],
  },
  {
    label: "Research",
    links: [
      { href: "/competitors", label: "Competitors", icon: Target },
      { href: "/opportunities", label: "Opportunities", icon: Lightbulb },
      { href: "/customer-intelligence", label: "Customers", icon: HeartHandshake },
    ],
  },
  {
    label: "AI",
    links: [
      { href: "/analyst", label: "AI Analyst", icon: Bot },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      {navSections.map((section) => (
        <div key={section.label ?? "main"}>
          {section.label ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
          ) : null}
          <nav aria-label={section.label ?? "Primary"} className="space-y-1">
            {section.links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

/** Horizontal nav for small screens (the sidebar is desktop-only). */
export function MobileNavLinks() {
  const pathname = usePathname();
  const all = navSections.flatMap((s) => s.links);
  return (
    <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-3 py-2">
      {all.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              active ? "bg-brand-950 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
