import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { getDailyReport } from "@/lib/data";
import { money, todayISO } from "@/lib/format";
import { Banknote, Boxes, ReceiptText, RotateCcw, Truck, WalletCards } from "lucide-react";

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const date = params.date ?? todayISO();
  const report = await getDailyReport(date);

  return (
    <>
      <PageHeader title="Daily Transactions" description="Invoices, payments, cash flow, expenses, cheque activity, stock value, and supplier movement." />
      <form className="mb-5 flex max-w-sm gap-2">
        <input className="input" name="date" type="date" defaultValue={date} />
        <button className="btn" type="submit">View</button>
      </form>
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
    </>
  );
}
