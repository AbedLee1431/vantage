import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { getResetTokenStatus } from "@/modules/auth/queries";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { valid } = await getResetTokenStatus(token);

  if (!valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link invalid or expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            This reset link is invalid, already used, or older than one hour. Please request a new
            one.
          </p>
          <Link href="/forgot-password" className={buttonClasses({ variant: "secondary" })}>
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <ResetForm token={token} />;
}
