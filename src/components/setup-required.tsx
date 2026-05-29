import { PageHeader } from "@/components/page-header";

export function SetupRequired() {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <PageHeader
        title="Connect Supabase"
        description="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then run the migration in Supabase. The app is scaffolded and ready for live data."
      />
      <div className="card p-5">
        <p className="font-semibold">Expected environment variables</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-[#20231f] p-4 text-sm text-white">
          NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY{"\n"}SUPABASE_SERVICE_ROLE_KEY
        </pre>
      </div>
    </div>
  );
}
