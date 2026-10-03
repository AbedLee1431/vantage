import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <p className="text-5xl font-bold text-brand-950">404</p>
      <p className="text-sm text-slate-600">
        This page doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/dashboard" className={buttonClasses({ variant: "secondary" })}>
        Go to dashboard
      </Link>
    </div>
  );
}
