import { saveCutoffSummary } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { getCutoffReport } from "@/lib/data";
import { money, monthEndISO } from "@/lib/format";
import { Boxes, HandCoins, Landmark, Scale } from "lucide-react";

export default async function CutoffReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const date = params.date ?? monthEndISO();
  const report = await getCutoffReport(date);

  return (
    <>
      <PageHeader title="Cutoff Balance Summary" description="15th and month-end net position: customer balances minus supplier balances plus stock value." />
      <form className="mb-5 flex max-w-sm gap-2">
        <input className="input" name="date" type="date" defaultValue={date} />
        <button className="btn" type="submit">View</button>
      </form>
      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Customer Balance" value={money(report.customerBalance)} icon={HandCoins} />
            <StatCard title="Supplier Balance" value={money(report.supplierBalance)} icon={Landmark} />
            <StatCard title="Stock Value" value={money(report.stockValue)} icon={Boxes} />
            <StatCard title="Net Position" value={money(report.netPosition)} icon={Scale} />
          </div>
          <form action={saveCutoffSummary} className="mt-5">
            <input type="hidden" name="cutoff_date" value={date} />
            <input type="hidden" name="customer_balance_total" value={report.customerBalance} />
            <input type="hidden" name="supplier_balance_total" value={report.supplierBalance} />
            <input type="hidden" name="stock_value" value={report.stockValue} />
            <button className="btn" type="submit">{report.saved ? "Update Saved Summary" : "Save Official Summary"}</button>
          </form>
        </>
      ) : (
        <p>No report data. Configure Supabase first.</p>
      )}
    </>
  );
}
