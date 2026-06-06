import { PageHeader } from "@/components/page-header";
import { getSupplierCutoffReport, listSupplierRows } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

function cutoffDates(cutoff: string, fallbackDate = todayISO()) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(cutoff) ? new Date(`${cutoff}T00:00:00`) : new Date(`${fallbackDate}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : new Date(year, month + 1, 0).getDate();
  const toISO = (date: Date) => date.toISOString().slice(0, 10);
  return {
    startDate: toISO(new Date(year, month, startDay)),
    endDate: toISO(new Date(year, month, endDay)),
    label: `${toISO(new Date(year, month, startDay))} to ${toISO(new Date(year, month, endDay))}`
  };
}

export default async function SupplierCutoffPage({
  searchParams
}: {
  searchParams: Promise<{ supplier_id?: string; cutoff?: string }>;
}) {
  const params = await searchParams;
  const suppliers = await listSupplierRows();
  const supplierId = params.supplier_id ?? suppliers[0]?.id ?? "";
  const cutoff = params.cutoff ?? todayISO();
  const { startDate, endDate, label } = cutoffDates(cutoff);
  const report = supplierId ? await getSupplierCutoffReport(supplierId, startDate, endDate) : null;
  const supplierName = report?.supplier?.name ?? suppliers.find((supplier) => supplier.id === supplierId)?.name ?? "";
  const blankCounterRows = Math.max(0, 8 - (report?.counterRows.length ?? 0));
  const blankPaymentRows = Math.max(0, 8 - (report?.paymentRows.length ?? 0));

  return (
    <>
      <PageHeader title="Supplier Cutoff Counter" description="15th and month-end supplier invoice counter with cheque payment list." />
      <form className="no-print mb-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_auto]">
        <select className="input" name="supplier_id" defaultValue={supplierId}>
          {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
        </select>
        <input className="input" name="cutoff" type="date" defaultValue={cutoff} />
        <button className="btn" type="submit">View Cutoff</button>
      </form>

      {!supplierId ? <p>No suppliers yet.</p> : null}
      {report ? (
        <main className="mx-auto max-w-7xl bg-white p-5 text-black print:max-w-none print:p-0">
          <header className="mb-8 text-center font-bold italic">
            <h1 className="text-2xl">MST HOUSEHOLD GOODS TRADING</h1>
            <p className="mt-3 text-lg text-orange-600">7 PALIGUI APALIT PAMPANGA</p>
            <p className="mt-3 text-sm not-italic text-[color:var(--muted-foreground)]">{label}</p>
          </header>

          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="border-b border-black py-2 text-center font-bold italic">
                <p className="text-xl">COUNTER</p>
                <p className="mt-2 text-xl text-orange-600">{supplierName.toUpperCase()}</p>
              </div>
              <table className="mt-8 border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-black p-2 text-center text-base italic text-black normal-case">Date Delivered</th>
                    <th className="border border-black p-2 text-center text-base italic text-black normal-case">DR #</th>
                    <th className="border border-black p-2 text-center text-base italic text-black normal-case">DELIVERED</th>
                    <th className="border border-black p-2 text-center text-base italic text-black normal-case">RETURN</th>
                    <th className="border border-black p-2 text-center text-base italic text-black normal-case">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.counterRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border border-black p-2 text-center font-bold italic">{row.date}</td>
                      <td className="border border-black p-2 text-center font-bold italic">{row.reference}</td>
                      <td className="border border-black p-2 text-right italic">{row.delivered ? money(row.delivered) : ""}</td>
                      <td className="border border-black p-2 text-right italic">{row.returned ? money(row.returned) : ""}</td>
                      <td className="border border-black p-2 text-right font-bold italic">{money(row.amount)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: blankCounterRows }).map((_, index) => (
                    <tr key={`blank-counter-${index}`}>
                      <td className="h-9 border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="border border-black p-2" />
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-black p-2" />
                    <td className="border border-black p-2" />
                    <td className="border border-black bg-yellow-300 p-2 text-right font-bold italic text-red-600" colSpan={2}>TOTAL</td>
                    <td className="border border-black bg-yellow-300 p-2 text-right font-bold italic text-red-600">{money(report.invoiceTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="border-b border-black py-2 text-center font-bold italic">
                <p className="text-xl">COUNTER</p>
                <p className="mt-2 text-xl text-orange-600">PAYMENTS</p>
              </div>
              <table className="mt-8 border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-black p-2 text-center text-base italic text-black normal-case">CHEQUE DATE</th>
                    <th className="border-b border-black p-2 text-center text-base italic text-black normal-case">CHEQUE NO.</th>
                    <th className="border-b border-black p-2 text-center text-base italic text-black normal-case">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentRows.map((payment) => (
                    <tr key={payment.id}>
                      <td className="h-9 p-2 text-center font-bold italic">{payment.payment_date}</td>
                      <td className="p-2 text-center font-bold italic">{payment.reference ?? payment.notes ?? "-"}</td>
                      <td className="p-2 text-right font-bold italic">{money(payment.amount)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: blankPaymentRows }).map((_, index) => (
                    <tr key={`blank-payment-${index}`}>
                      <td className="h-9 p-2" />
                      <td className="p-2" />
                      <td className="p-2" />
                    </tr>
                  ))}
                  <tr>
                    <td className="border-t border-black p-2" />
                    <td className="border-t border-black p-2 text-center font-bold italic">TOTAL</td>
                    <td className="border-t border-black p-2 text-right font-bold italic">{report.paymentTotal ? money(report.paymentTotal) : "-"}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-12 grid gap-3 text-lg font-bold">
                <p className="grid grid-cols-[140px_1fr] gap-4"><span>PREPARED BY</span><span className="border-b border-black">&nbsp;</span></p>
                <p className="grid grid-cols-[140px_1fr] gap-4"><span>RECEIVED BY</span><span className="border-b border-black">&nbsp;</span></p>
              </div>
              <div className="mt-8 border-t border-black pt-3 text-right font-bold">
                <p>Remaining: {money(report.remaining)}</p>
              </div>
            </div>
          </section>
        </main>
      ) : null}
    </>
  );
}
