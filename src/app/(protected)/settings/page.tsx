import { updateSettings } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getSettings } from "@/lib/data";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader title="Settings" description="Business defaults used by invoices and reports." />
      <form action={updateSettings} className="card grid max-w-xl gap-4 p-5">
        <div className="field"><label>Business Name</label><input className="input" name="business_name" defaultValue={settings.business_name} /></div>
        <div className="field"><label>Currency</label><input className="input" name="currency" defaultValue={settings.currency} /></div>
        <div className="field"><label>Timezone</label><input className="input" name="timezone" defaultValue={settings.timezone} /></div>
        <SubmitButton pendingText="Saving settings...">Save Settings</SubmitButton>
      </form>
    </>
  );
}
