import Link from "next/link";
import {
  Banknote,
  Boxes,
  ClipboardList,
  Gauge,
  HandCoins,
  Landmark,
  PackageSearch,
  ReceiptText,
  Search,
  Settings,
  Truck,
  Users
} from "lucide-react";
import { signOut } from "@/app/actions";

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
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="no-print sticky top-0 z-30 border-b border-[color:var(--border)] bg-[#20231f] text-white shadow-lg shadow-black/10 lg:h-screen lg:border-b-0">
        <div className="flex items-start justify-between gap-4 p-4 lg:block lg:p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[#c9c6bb]">Operations</p>
            <h1 className="mt-1 text-xl font-bold lg:text-2xl">MST Household</h1>
            <p className="mt-2 max-w-[13rem] truncate text-sm text-[#d8d5ca]">{userEmail ?? "Supabase setup required"}</p>
            {role ? <p className="mt-1 text-xs uppercase text-[#d8d5ca]">{role}</p> : null}
          </div>
          {userEmail ? (
            <form action={signOut} className="lg:hidden">
              <button className="btn btn-secondary min-h-9 px-3 text-xs" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:grid lg:overflow-visible lg:pb-5">
          {nav.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#f7f7f4] hover:bg-white/10 lg:gap-3"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          {userEmail ? (
            <form action={signOut} className="mt-3 hidden lg:block">
              <button className="btn btn-secondary w-full" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-5 md:px-7 md:py-7">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
