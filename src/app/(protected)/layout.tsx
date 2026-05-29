import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseEnv } from "@/lib/config";
import { getProfile } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) {
    return (
      <AppShell>
        <SetupRequired />
      </AppShell>
    );
  }

  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <AppShell userEmail={profile.email} role={profile.role}>
      {children}
    </AppShell>
  );
}
