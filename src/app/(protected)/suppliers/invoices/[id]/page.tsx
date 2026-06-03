import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteSupplierInvoice, recordSupplierAdjustment, recordSupplierPayment } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { getSupplierInvoice } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function SupplierInvoiceDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const notices = await searchParams;
  const data = await getSupplierInvoice(id);
  if (!data) notFound();
  const invoice = data.invoice;
  const invoiceLabel = invoice.supplier_invoice_number ?? invoice.id.slice(0, 8);

  return (
    <>
      <PageHeader
        title={`Supplier Invoice ${invoiceLabel}`}
        description={`${invoice.suppliers?.name ?? "Supplier"} balance on this invoice number: ${money(data.remaining)}`}
      />
      <PageNotice error={notices.error} success={notices.success} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="btn btn-secondary" href={`/suppliers/invoices/${invoice.id}/edit`}>Edit Invoice Line</Link>
        <Link className="btn btn-secondary" href="/suppliers">Back to Suppliers</Link>
        <form action={deleteSupplierInvoice}>
          <input type="hidden" name="purchase_order_id" value={invoice.id} />
          <ConfirmSubmitButton pendingText="Deleting..." title="Delete supplier invoice?" message="This deletes all item lines under this supplier invoice number, reverses related stock movement, removes linked supplier payments/adjustments, and logs the deletion." confirmLabel="Delete Supplier Invoice">Delete Supplier Invoice</ConfirmSubmitButton>
        </form>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="grid gap-5">
          <div className="card p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <p><strong>Supplier:</strong><br />{invoice.suppliers?.name}</p>
              <p><strong>Date:</strong><br />{invoice.order_date}</p>
              <p><strong>Invoice Total:</strong><br />{money(data.invoiceTotal)}</p>
              <p><strong>Remaining:</strong><br />{money(data.remaining)}</p>
              <p><strong>Payments:</strong><br />{money(data.paid)}</p>
              <p><strong>Returns / Credits:</strong><br />{money(data.adjusted)}</p>
              <p><strong>Line Count:</strong><br />{data.relatedLines.length}</p>
              <p><strong>Attachment:</strong><br />{invoice.app_files?.id ? "Available" : "-"}</p>
            </div>
            {invoice.app_files?.id ? (
              <a className="btn btn-secondary mt-4" href={`/attachments/${invoice.app_files.id}`} target="_blank">View attachment</a>
            ) : null}
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Edit</th></tr></thead>
              <tbody>
                {data.relatedLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.items?.name}</td>
                    <td>{line.quantity}</td>
                    <td>{money(line.unit_cost)}</td>
                    <td>{money(line.total)}</td>
                    <td><Link className="font-bold text-[color:var(--primary)]" href={`/suppliers/invoices/${line.id}/edit`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Reference</th><th>Amount</th><th>Notes</th></tr></thead>
              <tbody>
                {data.payments.map((payment) => <tr key={payment.id}><td>{payment.payment_date}</td><td>{payment.reference}</td><td>{money(payment.amount)}</td><td>{payment.notes}</td></tr>)}
                {!data.payments.length ? <tr><td colSpan={4}>No payments allocated to this supplier invoice.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Amount</th><th>Attachment</th><th>Reason</th></tr></thead>
              <tbody>
                {data.adjustments.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td>{adjustment.adjustment_date}</td><td>{adjustment.adjustment_type}</td><td>{adjustment.items?.name ?? "-"}</td><td>{money(adjustment.amount)}</td>
                    <td>{adjustment.app_files?.id ? <a className="font-bold text-[color:var(--primary)]" href={`/attachments/${adjustment.app_files.id}`} target="_blank">View</a> : "-"}</td>
                    <td>{adjustment.reason}</td>
                  </tr>
                ))}
                {!data.adjustments.length ? <tr><td colSpan={6}>No returns, damages, or credits for this supplier invoice.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="grid gap-5">
          <form action={recordSupplierPayment} className="card grid gap-4 p-5">
            <input type="hidden" name="supplier_id" value={invoice.supplier_id} />
            <input type="hidden" name="purchase_order_id" value={invoice.id} />
            <h3 className="text-xl font-bold">Apply Payment</h3>
            <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required /></div>
            <div className="field"><label>Reference</label><input className="input" name="reference" /></div>
            <div className="field"><label>Notes</label><textarea className="input" name="notes" rows={2} /></div>
            <SubmitButton pendingText="Recording...">Record Payment</SubmitButton>
          </form>
          <form action={recordSupplierAdjustment} className="card grid gap-4 p-5">
            <input type="hidden" name="supplier_id" value={invoice.supplier_id} />
            <input type="hidden" name="purchase_order_id" value={invoice.id} />
            <input type="hidden" name="item_id" value={invoice.item_id} />
            <h3 className="text-xl font-bold">Return / Damage / Credit</h3>
            <div className="field"><label>Type</label><select className="input" name="adjustment_type"><option value="return">Return</option><option value="damage">Damage</option><option value="credit">Credit</option></select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Qty</label><input className="input" name="quantity" type="number" step="0.01" /></div>
              <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" /></div>
            </div>
            <div className="field"><label>Date</label><input className="input" name="adjustment_date" type="date" defaultValue={todayISO()} /></div>
            <div className="field"><label>Attachment</label><input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" /></div>
            <div className="field"><label>Reason</label><textarea className="input" name="reason" rows={2} /></div>
            <SubmitButton pendingText="Recording...">Record Adjustment</SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}
