import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "./button";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg bg-white px-6 py-10 text-center ring-1 ring-slate-200",
        className,
      )}
    >
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem continues, contact support.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg bg-white px-6 py-10 text-center ring-1 ring-red-200",
        className,
      )}
    >
      <TriangleAlert className="h-8 w-8 text-red-400" aria-hidden />
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
