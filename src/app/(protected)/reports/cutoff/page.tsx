import { saveCutoffSummary } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { StatCard } from "@/components/stat-card";
import { SubmitButton } from "@/components/submit-button";
import { getCutoffReport } from "@/lib/data";
import { money, monthEndISO } from "@/lib/format";
import { Boxes, ClipboardList, HandCoins, Landmark, Scale } from "lucide-react";

export default async function CutoffReportPage({ searchParams }: { searchParams: Promise<{ date?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const date = params.date ?? monthEndISO();
  const report = await getCutoffReport(date);

  return (
    <>
      <PageHeader title="Cutoff Balance Summary" description="15th and month-end net position: customer balances minus supplier balances plus stock value." />
      <PageNotice error={params.error} success={params.success} />
      <form className="mb-5 grid max-w-lg gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="field">
          <label>As Of Date</label>
          <input className="input" name="date" type="date" defaultValue={date} />
        </div>
        <button className="btn" type="submit">View Cutoff</button>
      </form>
      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Customer Balance" value={money(report.customerBalance)} icon={HandCoins} />
            <StatCard title="Supplier Balance" value={money(report.supplierBalance)} icon={Landmark} />
            <StatCard title="Stock Value" value={money(report.stockValue)} icon={Boxes} />
            <StatCard title="Net Position" value={money(report.netPosition)} icon={Scale} />
          </div>

          <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_24rem]">
            <div className="card table-wrap">
              <div className="border-b border-[color:var(--border)] p-4">
                <h3 className="font-bold">Cutoff Sources Through {date}</h3>
              </div>
              <table>
                <thead><tr><th>Part</th><th>Included Records</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr><td>Customer ledger</td><td>{report.sourceCounts.customerEntries}</td><td className="font-bold">{money(report.customerBalance)}</td></tr>
                  <tr><td>Customer opening balances</td><td>Included in customer ledger</td><td>{money(report.components.customerOpeningBalance)}</td></tr>
                  <tr><td>Supplier invoices</td><td>{report.sourceCounts.supplierInvoices}</td><td>{money(report.components.supplierPurchases)}</td></tr>
                  <tr><td>Supplier payments</td><td>{report.sourceCounts.supplierPayments}</td><td>-{money(report.components.supplierPaid)}</td></tr>
                  <tr><td>Supplier returns / credits</td><td>{report.sourceCounts.supplierAdjustments}</td><td>-{money(report.components.supplierAdjusted)}</td></tr>
                  <tr><td>Supplier opening credits</td><td>Included in supplier returns / credits</td><td>-{money(report.components.supplierOpeningBalance)}</td></tr>
                  <tr><td>Stock movements</td><td>{report.sourceCounts.stockMovements} movements / {report.sourceCounts.stockItems} items</td><td>{money(report.stockValue)}</td></tr>
                </tbody>
              </table>
            </div>

            <aside className="grid content-start gap-4">
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <ClipboardList className="mt-1 h-5 w-5 text-[color:var(--primary)]" aria-hidden="true" />
                  <div>
                    <h3 className="font-bold">Official Saved Summary</h3>
                    {report.saved ? (
                      <div className="mt-3 grid gap-2 text-sm">
                        <p className="flex justify-between gap-3"><span>Customer</span><strong>{money(report.saved.customer_balance_total)}</strong></p>
                        <p className="flex justify-between gap-3"><span>Supplier</span><strong>{money(report.saved.supplier_balance_total)}</strong></p>
                        <p className="flex justify-between gap-3"><span>Stock</span><strong>{money(report.saved.stock_value)}</strong></p>
                        <p className="flex justify-between gap-3 border-t border-[color:var(--border)] pt-2"><span>Net</span><strong>{money(report.saved.net_position)}</strong></p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">No official summary has been saved for this date yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <form action={saveCutoffSummary} className="card grid gap-3 p-4">
                <input type="hidden" name="cutoff_date" value={date} />
                <input type="hidden" name="customer_balance_total" value={report.customerBalance} />
                <input type="hidden" name="supplier_balance_total" value={report.supplierBalance} />
                <input type="hidden" name="stock_value" value={report.stockValue} />
                <input type="hidden" name="return_path" value={`/reports/cutoff?date=${encodeURIComponent(date)}`} />
                <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">Save the current as-of totals as the official cutoff snapshot for this date.</p>
                <SubmitButton pendingText="Saving...">{report.saved ? "Update Saved Summary" : "Save Official Summary"}</SubmitButton>
              </form>
            </aside>
          </section>

        </>
      ) : (
        <p>No report data. Configure Supabase first.</p>
      )}
    </>
  );
}
