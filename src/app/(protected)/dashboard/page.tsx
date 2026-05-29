import { Banknote, Boxes, HandCoins, Landmark, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { dashboardTotals } from "@/lib/data";
import { money } from "@/lib/format";

export default async function DashboardPage() {
  const totals = await dashboardTotals();
  const cashFlow = totals.todayCash - totals.todayExpenses;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily operating view for balances, stock value, cash flow, and supplier exposure."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Customer Balance" value={money(totals.customerBalance)} detail="Total receivables" icon={HandCoins} />
        <StatCard title="Supplier Balance" value={money(totals.supplierBalance)} detail="Outstanding payables" icon={Landmark} />
        <StatCard title="Stock Value" value={money(totals.stockValue)} detail="Qty x unit cost" icon={Boxes} />
        <StatCard title="Today Cash Sales" value={money(totals.todayCash)} detail="Physical store cash" icon={Banknote} />
        <StatCard title="Cash Flow" value={money(cashFlow)} detail="Cash sales minus expenses" icon={TrendingUp} />
      </div>
      <section className="mt-6 card p-5">
        <h3 className="text-xl font-bold">Operating Rules</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <p className="rounded-lg bg-[color:var(--muted)] p-4 text-sm">Invoices, charges, returns, payments, and replacements post to the customer ledger.</p>
          <p className="rounded-lg bg-[color:var(--muted)] p-4 text-sm">Inventory quantity changes only through inventory movement rows.</p>
          <p className="rounded-lg bg-[color:var(--muted)] p-4 text-sm">Cutoff reports use customer balances minus supplier balances plus current stock value.</p>
        </div>
      </section>
    </>
  );
}
