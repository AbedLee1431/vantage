import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "block w-full rounded-md border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-inset ring-slate-300",
        "focus:ring-2 focus:ring-inset focus:ring-accent-600 sm:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
