import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, HandCoins, Landmark, ReceiptText, TrendingUp } from "lucide-react";
import { DashboardWidgetControls } from "@/components/dashboard-widget-controls";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { dashboardOperations, dashboardTotals } from "@/lib/data";
import { money } from "@/lib/format";

function relationName(value: unknown) {
  if (Array.isArray(value)) return String(value[0]?.name ?? "");
  if (value && typeof value === "object" && "name" in value) return String(value.name ?? "");
  return "";
}

export default async function DashboardPage() {
  const [totals, operations] = await Promise.all([dashboardTotals(), dashboardOperations()]);
  const cashFlow = totals.todayCash - totals.todayExpenses;
  const alertCount = operations.lowStock.length + operations.bouncedCheques.length;
  const dashboardWidgets = [
    { id: "scorecards", title: "Top Metrics" },
    { id: "attention", title: "Needs Attention" },
    { id: "open-invoices", title: "Open Customer Invoices" },
    { id: "supplier-bills", title: "Recent Supplier Bills" },
    { id: "fast-actions", title: "Fast Actions" }
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily operating view for balances, stock value, cash flow, and supplier exposure."
      />
      <DashboardWidgetControls initialWidgets={dashboardWidgets} />
      <section className="grid gap-5 xl:grid-cols-2">
        <div data-dashboard-widget="scorecards" data-dashboard-title="Top Metrics" className="grid gap-4 md:grid-cols-2 xl:col-span-2 xl:grid-cols-5">
          <StatCard title="Customer Balance" value={money(totals.customerBalance)} detail="Total receivables" icon={HandCoins} />
          <StatCard title="Supplier Balance" value={money(totals.supplierBalance)} detail="Outstanding payables" icon={Landmark} />
          <StatCard title="Stock Value" value={money(totals.stockValue)} detail="Qty x unit cost" icon={Boxes} />
          <StatCard title="Today Cash Sales" value={money(totals.todayCash)} detail="Physical store cash" icon={Banknote} />
          <StatCard title="Cash Flow" value={money(cashFlow)} detail="Cash sales minus expenses" icon={TrendingUp} />
        </div>

        <div data-dashboard-widget="attention" data-dashboard-title="Needs Attention" className="card table-wrap">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] p-4">
            <div>
              <h3 className="text-xl font-bold">Needs Attention</h3>
              <p className="text-sm text-[color:var(--muted-foreground)]">Low stock and cheque problems that can affect daily posting.</p>
            </div>
            <StatusBadge tone={alertCount ? "danger" : "good"}>{alertCount ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Clear"}</StatusBadge>
          </div>
          <table>
            <thead><tr><th>Area</th><th>Record</th><th>Status</th><th>Open</th></tr></thead>
            <tbody>
              {operations.lowStock.map((item) => (
                <tr key={`stock-${item.id}`}>
                  <td><AlertTriangle className="inline h-4 w-4 text-[color:var(--accent)]" /> Stock</td>
                  <td>{item.name}<br /><span className="text-xs text-[color:var(--muted-foreground)]">{item.sku ?? "No SKU"}</span></td>
                  <td><StatusBadge tone="warning">{item.current_quantity} left</StatusBadge></td>
                  <td><Link className="font-bold text-[color:var(--primary)]" href={`/inventory/${item.id}`}>Open</Link></td>
                </tr>
              ))}
              {operations.bouncedCheques.map((cheque) => (
                <tr key={`cheque-${cheque.id}`}>
                  <td><AlertTriangle className="inline h-4 w-4 text-[color:var(--danger)]" /> Cheque</td>
                  <td>{cheque.cheque_number ?? "No cheque no."}<br /><span className="text-xs text-[color:var(--muted-foreground)]">{relationName(cheque.customers)}</span></td>
                  <td><StatusBadge tone="danger">{cheque.status}</StatusBadge></td>
                  <td><Link className="font-bold text-[color:var(--primary)]" href="/cheques">Open</Link></td>
                </tr>
              ))}
              {!alertCount ? <tr><td colSpan={4}>No urgent stock or cheque alerts.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div data-dashboard-widget="open-invoices" data-dashboard-title="Open Customer Invoices" className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4">
              <h3 className="font-bold">Open Customer Invoices</h3>
            </div>
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Balance</th></tr></thead>
              <tbody>
                {operations.openInvoices.map((invoice) => (
                  <tr key={invoice.invoice_id}>
                    <td><Link className="font-bold text-[color:var(--primary)]" href={`/invoices/${invoice.invoice_id}/print`}>{invoice.invoice_number}</Link></td>
                    <td>{relationName(invoice.customers)}</td>
                    <td>{money(invoice.remaining_balance)}</td>
                  </tr>
                ))}
                {!operations.openInvoices.length ? <tr><td colSpan={3}>No open invoices found.</td></tr> : null}
              </tbody>
            </table>
        </div>
        <div data-dashboard-widget="supplier-bills" data-dashboard-title="Recent Supplier Bills" className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4">
              <h3 className="font-bold">Recent Supplier Bills</h3>
            </div>
            <table>
              <thead><tr><th>DR / Invoice</th><th>Supplier</th><th>Total</th></tr></thead>
              <tbody>
                {operations.recentSupplierInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><Link className="font-bold text-[color:var(--primary)]" href={`/suppliers/invoices/${invoice.id}`}>{invoice.supplier_invoice_number ?? String(invoice.id).slice(0, 8)}</Link></td>
                    <td>{invoice.supplier_name}</td>
                    <td>{money(invoice.total)}</td>
                  </tr>
                ))}
                {!operations.recentSupplierInvoices.length ? <tr><td colSpan={3}>No supplier bills found.</td></tr> : null}
              </tbody>
            </table>
        </div>

        <section data-dashboard-widget="fast-actions" data-dashboard-title="Fast Actions" className="card p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Fast Actions</h3>
            <p className="text-sm text-[color:var(--muted-foreground)]">Common daily workflows.</p>
          </div>
          <ReceiptText className="h-5 w-5 text-[color:var(--primary)]" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Link className="btn" href="/invoices/new">New Invoice</Link>
          <Link className="btn btn-secondary" href="/payments">Record Payment</Link>
          <Link className="btn btn-secondary" href="/suppliers">Post Supplier Bill</Link>
          <Link className="btn btn-secondary" href="/reports/suppliers/cutoff">Supplier Cutoff</Link>
        </div>
      </section>
      </section>
    </>
  );
}
