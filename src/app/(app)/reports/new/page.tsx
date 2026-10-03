import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportTargets } from "@/modules/reports/queries";
import { ReportCreateForm } from "./create-form";

export const metadata: Metadata = { title: "New report" };

export default async function NewReportPage() {
  const { stores, products, advertisers } = await getReportTargets();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">New report</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configure</CardTitle>
          <CardDescription>
            Snapshots freeze data at generation time; reruns create new history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportCreateForm stores={stores} products={products} advertisers={advertisers} />
        </CardContent>
      </Card>
    </div>
  );
}
