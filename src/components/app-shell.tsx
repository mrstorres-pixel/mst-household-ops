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
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print border-b border-[color:var(--border)] bg-[#20231f] text-white lg:min-h-screen lg:border-b-0">
        <div className="p-5">
          <p className="text-xs font-bold uppercase text-[#c9c6bb]">Operations</p>
          <h1 className="mt-1 text-2xl font-bold">MST Household</h1>
          <p className="mt-2 text-sm text-[#d8d5ca]">{userEmail ?? "Supabase setup required"}</p>
          {role ? <p className="mt-1 text-xs uppercase text-[#d8d5ca]">{role}</p> : null}
        </div>
        <nav className="grid gap-1 px-3 pb-5">
          {nav.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-[#f7f7f4] hover:bg-white/10"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          {userEmail ? (
            <form action={signOut} className="mt-3">
              <button className="btn btn-secondary w-full" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </nav>
      </aside>
      <main className="min-w-0 p-4 md:p-7">{children}</main>
    </div>
  );
}
