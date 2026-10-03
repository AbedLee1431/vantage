import type { Metadata } from "next";
import { getAccount } from "@/modules/account/queries";
import { ProfileForm, WorkspaceForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, organization } = await getAccount();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-brand-950">Settings</h1>
      <ProfileForm name={user.name} email={user.email} />
      <WorkspaceForm name={organization.name} />
    </div>
  );
}
