import type { ReactNode } from "react";
import { MarketingNav } from "@/components/layout/marketing";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <main className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">{children}</main>
    </div>
  );
}
