import {
  Banknote,
  Boxes,
  ClipboardList,
  Gauge,
  HandCoins,
  Landmark,
  Menu,
  PackageSearch,
  ReceiptText,
  Search,
  Settings,
  Truck,
  Users
} from "lucide-react";
import { signOut } from "@/app/actions";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/search", label: "Search", icon: Search },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices/new", label: "New Invoice", icon: ReceiptText },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory/damages", label: "Damages", icon: PackageSearch },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/payments", label: "Payments", icon: HandCoins },
  { href: "/cheques", label: "Cheques", icon: Landmark },
  { href: "/expenses", label: "Expenses", icon: Banknote },
  { href: "/reports/daily", label: "Daily Report", icon: ClipboardList },
  { href: "/reports/cutoff", label: "Cutoff Report", icon: ClipboardList },
  { href: "/reports/suppliers/cutoff", label: "Supplier Cutoff", icon: ClipboardList },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings }
];

type AppShellProps = {
  children: React.ReactNode;
  userEmail?: string;
  role?: string;
};

export function AppShell({ children, userEmail, role }: AppShellProps) {
  const quickNav = nav.filter((item) => ["/dashboard", "/search", "/invoices/new"].includes(item.href));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[color:var(--card)] focus:px-4 focus:py-2 focus:font-bold focus:text-[color:var(--primary)]" href="#main-content">
        Skip to content
      </a>
      <aside className="no-print sticky top-0 z-30 border-b border-[color:var(--border)] bg-[#20231f] text-white shadow-lg shadow-black/10 lg:h-screen lg:border-b-0">
        <div className="flex items-start justify-between gap-4 p-4 lg:block lg:p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[#c9c6bb]">Operations</p>
            <h1 className="mt-1 text-xl font-bold lg:text-2xl">MST Household</h1>
            <p className="mt-2 max-w-[13rem] truncate text-sm text-[#d8d5ca]">{userEmail ?? "Supabase setup required"}</p>
            {role ? <p className="mt-1 text-xs uppercase text-[#d8d5ca]">{role}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2 lg:hidden">
            <ThemeToggle compact />
            {userEmail ? (
              <form action={signOut}>
                <button className="btn btn-secondary min-h-9 px-3 text-xs" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 px-3 pb-4 lg:hidden">
          <div className="grid grid-cols-3 gap-2">
            {quickNav.map((item) => (
              <NavLink
                href={item.href}
                key={item.href}
                label={item.label}
                icon={item.icon}
                variant="quick"
              />
            ))}
          </div>
          <details className="mobile-menu rounded-lg border border-white/10 bg-white/5">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 text-sm font-bold">
              <span className="inline-flex items-center gap-2"><Menu className="h-4 w-4" aria-hidden="true" /> All Sections</span>
              <span className="text-xs uppercase text-[#c9c6bb]">Open</span>
            </summary>
            <nav className="grid gap-1 border-t border-white/10 p-2">
              {nav.map((item) => (
                <NavLink
                  href={item.href}
                  key={item.href}
                  label={item.label}
                  icon={item.icon}
                  variant="mobile"
                />
              ))}
            </nav>
          </details>
        </div>
        <nav className="hidden gap-1 px-3 pb-5 lg:grid">
          {nav.map((item) => (
            <NavLink
              href={item.href}
              key={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
          <div className="mt-3">
            <ThemeToggle />
          </div>
          {userEmail ? (
            <form action={signOut} className="mt-3">
              <button className="btn btn-secondary w-full" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </nav>
      </aside>
      <main id="main-content" className="min-w-0 px-4 py-5 md:px-7 md:py-7">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-1 border-t border-[color:var(--border)] bg-[color:var(--bottom-nav)] px-2 py-2 shadow-2xl backdrop-blur lg:hidden">
        {quickNav.map((item) => (
          <NavLink href={item.href} key={item.href} label={item.label} icon={item.icon} variant="bottom" />
        ))}
      </nav>
    </div>
  );
}
