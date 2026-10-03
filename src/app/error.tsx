"use client";

import { ErrorState } from "@/components/ui/states";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <ErrorState
        title="Something went wrong"
        description={
          error.message || "Please try again. If the problem continues, contact support."
        }
        onRetry={reset}
      />
    </div>
  );
}
