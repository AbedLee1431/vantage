import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteReportAction } from "@/modules/reports/actions";
import { getReport } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Delete report" };

export default async function DeleteReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Delete report?</h1>
      <Card>
        <CardHeader>
          <CardTitle>{report.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            This permanently removes the snapshot. The underlying products, ads, reviews, and
            analyses stay untouched — a fresh report regenerates from current data anytime.
          </p>
          <div className="flex gap-2">
            <form action={deleteReportAction}>
              <input type="hidden" name="id" value={report.id} />
              <SubmitButton variant="danger" pendingLabel="Deleting…">
                Delete permanently
              </SubmitButton>
            </form>
            <Link
              href={`/reports/${report.id}`}
              className="inline-flex h-10 items-center rounded-md bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
