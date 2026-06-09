import { signIn } from "@/app/actions";
import { hasSupabaseEnv } from "@/lib/config";
import { SetupRequired } from "@/components/setup-required";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (!hasSupabaseEnv()) return <SetupRequired />;

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="card w-full max-w-sm p-6">
        <p className="text-sm font-bold uppercase text-[color:var(--muted-foreground)]">MST Household</p>
        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>
        {params.error ? <p className="notice-error mt-3 rounded-lg p-3 text-sm">{params.error}</p> : null}
        <form action={signIn} className="mt-6 grid gap-4">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" required />
          </div>
          <button className="btn" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
