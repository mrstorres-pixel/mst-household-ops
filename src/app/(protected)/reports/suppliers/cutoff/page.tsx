import { addSupplierCutoffRow, deleteSupplierCutoffOverride, hideSupplierCutoffRow } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { getSupplierCutoffReport, listSupplierRows } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

function isISODate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function monthEndDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function cutoffDates(cutoff: string, fallbackDate = todayISO()) {
  const date = isISODate(cutoff) ? cutoff : fallbackDate;
  const [year, month, day] = date.split("-").map(Number);
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : monthEndDay(year, month);
  const toISO = (targetDay: number) => `${year}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
  return {
    startDate: toISO(startDay),
    endDate: toISO(endDay),
    label: `${toISO(startDay)} to ${toISO(endDay)}`
  };
}

export default async function SupplierCutoffPage({
  searchParams
}: {
  searchParams: Promise<{ supplier_id?: string; cutoff?: string; start_date?: string; end_date?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const suppliers = await listSupplierRows();
  const supplierId = params.supplier_id ?? suppliers[0]?.id ?? "";
  const cutoff = params.cutoff ?? todayISO();
  const defaultRange = cutoffDates(cutoff);
  const selectedStartDate = isISODate(params.start_date) ? params.start_date! : defaultRange.startDate;
  const selectedEndDate = isISODate(params.end_date) ? params.end_date! : defaultRange.endDate;
  const startDate = selectedStartDate <= selectedEndDate ? selectedStartDate : selectedEndDate;
  const endDate = selectedStartDate <= selectedEndDate ? selectedEndDate : selectedStartDate;
  const label = `${startDate} to ${endDate}`;
  const report = supplierId ? await getSupplierCutoffReport(supplierId, startDate, endDate) : null;
  const supplierName = report?.supplier?.name ?? suppliers.find((supplier) => supplier.id === supplierId)?.name ?? "";
  const returnPath = `/reports/suppliers/cutoff?supplier_id=${encodeURIComponent(supplierId)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  const blankCounterRows = Math.max(0, 8 - (report?.counterRows.length ?? 0));
  const blankPaymentRows = Math.max(0, 8 - (report?.paymentRows.length ?? 0));

  return (
    <>
      <PageHeader title="Supplier Cutoff Counter" description="15th and month-end supplier invoice counter with cheque payment list." />
      <PageNotice error={params.error} success={params.success} />
      <div className="no-print mb-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
        <form className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
          <div className="field">
            <label>Supplier</label>
            <select className="input" name="supplier_id" defaultValue={supplierId}>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>From</label>
            <input className="input" name="start_date" type="date" defaultValue={startDate} />
          </div>
          <div className="field">
            <label>To</label>
            <input className="input" name="end_date" type="date" defaultValue={endDate} />
          </div>
          <button className="btn" type="submit">View Cutoff</button>
        </form>
        <PrintButton label="Print Cutoff" />
      </div>

      {report ? (
        <section className="no-print mb-5 grid gap-4 lg:grid-cols-2">
          <form action={addSupplierCutoffRow} className="card grid gap-3 p-4 md:grid-cols-4">
            <input type="hidden" name="supplier_id" value={supplierId} />
            <input type="hidden" name="start_date" value={startDate} />
            <input type="hidden" name="end_date" value={endDate} />
            <input type="hidden" name="row_kind" value="counter" />
            <input type="hidden" name="return_path" value={returnPath} />
            <div className="md:col-span-4">
              <h3 className="text-lg font-bold">Add Counter Row</h3>
              <p className="text-sm text-[color:var(--muted-foreground)]">Use this for rows that should appear only on this cutoff report.</p>
            </div>
            <div className="field"><label>Date</label><input className="input" name="row_date" type="date" defaultValue={startDate} /></div>
            <div className="field"><label>DR # / Ref</label><input className="input" name="reference" /></div>
            <div className="field"><label>Delivered</label><input className="input text-right" name="delivered" type="number" step="0.01" /></div>
            <div className="field"><label>Return</label><input className="input text-right" name="returned" type="number" step="0.01" /></div>
            <div className="field"><label>Amount Override</label><input className="input text-right" name="amount" type="number" step="0.01" /></div>
            <div className="flex items-end md:col-span-3"><SubmitButton pendingText="Adding...">Add Counter Row</SubmitButton></div>
          </form>

          <form action={addSupplierCutoffRow} className="card grid gap-3 p-4 md:grid-cols-3">
            <input type="hidden" name="supplier_id" value={supplierId} />
            <input type="hidden" name="start_date" value={startDate} />
            <input type="hidden" name="end_date" value={endDate} />
            <input type="hidden" name="row_kind" value="payment" />
            <input type="hidden" name="return_path" value={returnPath} />
            <div className="md:col-span-3">
              <h3 className="text-lg font-bold">Add Payment Row</h3>
              <p className="text-sm text-[color:var(--muted-foreground)]">Use this for cheque/payment rows that should appear only on this cutoff report.</p>
            </div>
            <div className="field"><label>Cheque Date</label><input className="input" name="row_date" type="date" defaultValue={startDate} /></div>
            <div className="field"><label>Cheque No.</label><input className="input" name="reference" /></div>
            <div className="field"><label>Amount</label><input className="input text-right" name="amount" type="number" step="0.01" /></div>
            <div className="flex items-end md:col-span-3"><SubmitButton pendingText="Adding...">Add Payment Row</SubmitButton></div>
          </form>

          {report.hiddenRows.length ? (
            <div className="card p-4 lg:col-span-2">
              <h3 className="text-lg font-bold">Removed From This Cutoff</h3>
              <div className="mt-3 grid gap-2">
                {report.hiddenRows.map((row) => (
                  <form action={deleteSupplierCutoffOverride} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] p-3" key={String(row.id)}>
                    <input type="hidden" name="override_id" value={String(row.id)} />
                    <input type="hidden" name="return_path" value={returnPath} />
                    <span className="text-sm font-semibold">{String(row.row_kind)} - {String(row.row_date ?? "")} - {String(row.reference ?? row.source_key ?? "")}</span>
                    <SubmitButton className="btn btn-secondary" pendingText="Restoring...">Restore</SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

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
                    <th className="no-print border border-black p-2 text-center text-base italic text-black normal-case">Action</th>
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
                      <td className="no-print border border-black p-2 text-center">
                        <form action={row.is_manual ? deleteSupplierCutoffOverride : hideSupplierCutoffRow}>
                          <input type="hidden" name="supplier_id" value={supplierId} />
                          <input type="hidden" name="start_date" value={startDate} />
                          <input type="hidden" name="end_date" value={endDate} />
                          <input type="hidden" name="row_kind" value="counter" />
                          <input type="hidden" name="source_key" value={String(row.source_key ?? "")} />
                          <input type="hidden" name="override_id" value={String(row.override_id ?? "")} />
                          <input type="hidden" name="row_date" value={String(row.date ?? "")} />
                          <input type="hidden" name="reference" value={String(row.reference ?? "")} />
                          <input type="hidden" name="delivered" value={String(row.delivered ?? 0)} />
                          <input type="hidden" name="returned" value={String(row.returned ?? 0)} />
                          <input type="hidden" name="amount" value={String(row.amount ?? 0)} />
                          <input type="hidden" name="return_path" value={returnPath} />
                          <SubmitButton className="btn btn-secondary" pendingText="Removing...">Remove</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: blankCounterRows }).map((_, index) => (
                    <tr key={`blank-counter-${index}`}>
                      <td className="h-9 border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="border border-black p-2" />
                      <td className="no-print border border-black p-2" />
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-black p-2" />
                    <td className="border border-black p-2" />
                    <td className="border border-black bg-yellow-300 p-2 text-right font-bold italic text-red-600" colSpan={2}>TOTAL</td>
                    <td className="border border-black bg-yellow-300 p-2 text-right font-bold italic text-red-600">{money(report.invoiceTotal)}</td>
                    <td className="no-print border border-black p-2" />
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
                    <th className="no-print border-b border-black p-2 text-center text-base italic text-black normal-case">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentRows.map((payment) => (
                    <tr key={payment.id}>
                      <td className="h-9 p-2 text-center font-bold italic">{payment.payment_date}</td>
                      <td className="p-2 text-center font-bold italic">{payment.reference ?? payment.notes ?? "-"}</td>
                      <td className="p-2 text-right font-bold italic">{money(payment.amount)}</td>
                      <td className="no-print p-2 text-center">
                        <form action={payment.is_manual ? deleteSupplierCutoffOverride : hideSupplierCutoffRow}>
                          <input type="hidden" name="supplier_id" value={supplierId} />
                          <input type="hidden" name="start_date" value={startDate} />
                          <input type="hidden" name="end_date" value={endDate} />
                          <input type="hidden" name="row_kind" value="payment" />
                          <input type="hidden" name="source_key" value={String(payment.source_key ?? "")} />
                          <input type="hidden" name="override_id" value={String(payment.override_id ?? "")} />
                          <input type="hidden" name="row_date" value={String(payment.payment_date ?? "")} />
                          <input type="hidden" name="reference" value={String(payment.reference ?? payment.notes ?? "")} />
                          <input type="hidden" name="amount" value={String(payment.amount ?? 0)} />
                          <input type="hidden" name="return_path" value={returnPath} />
                          <SubmitButton className="btn btn-secondary" pendingText="Removing...">Remove</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: blankPaymentRows }).map((_, index) => (
                    <tr key={`blank-payment-${index}`}>
                      <td className="h-9 p-2" />
                      <td className="p-2" />
                      <td className="p-2" />
                      <td className="no-print p-2" />
                    </tr>
                  ))}
                  <tr>
                    <td className="border-t border-black p-2" />
                    <td className="border-t border-black p-2 text-center font-bold italic">TOTAL</td>
                    <td className="border-t border-black p-2 text-right font-bold italic">{report.paymentTotal ? money(report.paymentTotal) : "-"}</td>
                    <td className="no-print border-t border-black p-2" />
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
