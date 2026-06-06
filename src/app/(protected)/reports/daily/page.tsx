import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { StatCard } from "@/components/stat-card";
import { getDailyReport } from "@/lib/data";
import { money, todayISO } from "@/lib/format";
import { Banknote, Boxes, ReceiptText, RotateCcw, Truck, WalletCards } from "lucide-react";

function relationName(value: unknown) {
  if (Array.isArray(value)) return String(value[0]?.name ?? "");
  if (value && typeof value === "object" && "name" in value) return String(value.name ?? "");
  return "";
}

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const date = params.date ?? todayISO();
  const report = await getDailyReport(date);

  return (
    <>
      <PageHeader title="Daily Transactions" description="Invoices, payments, cash flow, expenses, cheque activity, stock value, and supplier movement." />
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <form className="flex max-w-sm gap-2">
          <input className="input" name="date" type="date" defaultValue={date} />
          <button className="btn" type="submit">View</button>
        </form>
        <PrintButton label="Print Daily Report" />
      </div>
      <header className="mb-5 hidden text-center print:block">
        <h1 className="text-2xl font-bold">MST HOUSEHOLD GOODS TRADING</h1>
        <p className="mt-2 font-bold">Daily Transactions · {date}</p>
      </header>
      {report ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Invoices" value={money(report.invoiceTotal)} icon={ReceiptText} />
          <StatCard title="Payments" value={money(report.paymentTotal)} icon={WalletCards} />
          <StatCard title="Cash Flow" value={money(report.cashFlow)} detail="Cash sales minus expenses" icon={Banknote} />
          <StatCard title="Stock Value" value={money(report.stockValue)} icon={Boxes} />
          <StatCard title="Returns" value={money(report.returnsTotal)} icon={RotateCcw} />
          <StatCard title="Damages" value={money(report.damagesTotal)} icon={RotateCcw} />
          <StatCard title="Cheque Received" value={money(report.chequesReceived)} icon={WalletCards} />
          <StatCard title="Supplier Activity" value={money(report.purchasesTotal - report.supplierPaymentsTotal)} detail="Purchases minus payments" icon={Truck} />
        </div>
      ) : (
        <p>No report data. Configure Supabase first.</p>
      )}
      {report ? (
        <div className="mt-6 grid gap-5">
          <section className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4"><h3 className="font-bold">Customer Invoices</h3></div>
            <table>
              <thead><tr><th>Customer</th><th>Invoice No.</th><th>Total</th></tr></thead>
              <tbody>
                {report.invoiceRows.map((row) => <tr key={row.invoice_number}><td>{relationName(row.customers)}</td><td>{row.invoice_number}</td><td>{money(row.total)}</td></tr>)}
                {!report.invoiceRows.length ? <tr><td colSpan={3}>No customer invoices for this date.</td></tr> : null}
              </tbody>
            </table>
          </section>
          <section className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4"><h3 className="font-bold">Customer Payments</h3></div>
            <table>
              <thead><tr><th>Customer</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
              <tbody>
                {report.paymentRows.map((row, index) => <tr key={`${row.reference ?? row.method}-${index}`}><td>{relationName(row.customers)}</td><td>{row.method}</td><td>{row.reference}</td><td>{money(row.amount)}</td></tr>)}
                {!report.paymentRows.length ? <tr><td colSpan={4}>No customer payments for this date.</td></tr> : null}
              </tbody>
            </table>
          </section>
          <section className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4"><h3 className="font-bold">Supplier Invoices</h3></div>
            <table>
              <thead><tr><th>Supplier</th><th>Invoice No.</th><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
              <tbody>
                {report.purchaseRows.map((row, index) => <tr key={`${row.supplier_invoice_number ?? "supplier"}-${index}`}><td>{relationName(row.suppliers)}</td><td>{row.supplier_invoice_number}</td><td>{relationName(row.items)}</td><td>{row.quantity}</td><td>{money(row.total)}</td></tr>)}
                {!report.purchaseRows.length ? <tr><td colSpan={5}>No supplier invoices for this date.</td></tr> : null}
              </tbody>
            </table>
          </section>
          <section className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4"><h3 className="font-bold">Supplier Returns / Damage / Credits</h3></div>
            <table>
              <thead><tr><th>Supplier</th><th>Type</th><th>Item</th><th>Amount Deducted</th><th>Reason</th></tr></thead>
              <tbody>
                {report.supplierAdjustmentRows.map((row, index) => <tr key={`${row.adjustment_type}-${index}`}><td>{relationName(row.suppliers)}</td><td>{row.adjustment_type}</td><td>{relationName(row.items) || "-"}</td><td>{money(row.amount)}</td><td>{row.reason}</td></tr>)}
                {!report.supplierAdjustmentRows.length ? <tr><td colSpan={5}>No supplier returns or damages for this date.</td></tr> : null}
              </tbody>
            </table>
          </section>
          <section className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4"><h3 className="font-bold">Damage / Return Deductions</h3></div>
            <table>
              <thead><tr><th>Customer</th><th>Supplier</th><th>Item</th><th>Balance Deduction</th><th>Reason</th></tr></thead>
              <tbody>
                {report.damageRows.map((row, index) => <tr key={`${row.reason ?? "damage"}-${index}`}><td>{relationName(row.customers) || "-"}</td><td>{relationName(row.suppliers) || "-"}</td><td>{relationName(row.items)}</td><td>{money(row.balance_credit)}</td><td>{row.reason}</td></tr>)}
                {!report.damageRows.length ? <tr><td colSpan={5}>No damage or return deductions for this date.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </>
  );
}
