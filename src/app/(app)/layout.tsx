import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MobileNavLinks } from "@/components/layout/nav-links";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { tenantDb } from "@/server/db/tenant";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

/** Authenticated application shell (defense in depth behind the proxy). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  try {
    await tenantDb();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="md:pl-60">
        <Topbar />
        <div className="border-b border-slate-200 bg-white md:hidden">
          <MobileNavLinks />
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
