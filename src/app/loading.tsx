import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-48" />
    </div>
  );
}
