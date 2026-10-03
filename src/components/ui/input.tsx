import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const hintId = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={hintId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "block w-full rounded-md border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-inset",
        invalid
          ? "ring-red-500 focus:ring-2 focus:ring-inset focus:ring-red-600"
          : "ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-accent-600",
        "sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
