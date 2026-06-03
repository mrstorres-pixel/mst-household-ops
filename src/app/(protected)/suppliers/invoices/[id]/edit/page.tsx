import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSupplierInvoice, updateSupplierInvoice } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { getSupplierInvoice } from "@/lib/data";
import { money } from "@/lib/format";

export default async function EditSupplierInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const data = await getSupplierInvoice(id);
  if (!data) notFound();
  const invoice = data.invoice;
  const invoiceLabel = invoice.supplier_invoice_number ?? invoice.id.slice(0, 8);

  return (
    <>
      <PageHeader title={`Edit Supplier Invoice ${invoiceLabel}`} description="Correct a supplier invoice line. Quantity changes post stock corrections automatically." />
      <PageNotice error={notices.error} success={notices.success} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="btn btn-secondary" href={`/suppliers/invoices/${id}`}>Back to Details</Link>
        <Link className="btn btn-secondary" href="/suppliers">Back to Suppliers</Link>
        <form action={deleteSupplierInvoice}>
          <input type="hidden" name="purchase_order_id" value={id} />
          <ConfirmSubmitButton pendingText="Deleting..." title="Delete supplier invoice?" message="This deletes all item lines under this supplier invoice number, reverses related stock movement, removes linked supplier payments/adjustments, and logs the deletion." confirmLabel="Delete Supplier Invoice">Delete Supplier Invoice</ConfirmSubmitButton>
        </form>
      </div>

      <form action={updateSupplierInvoice} className="grid gap-5">
        <input type="hidden" name="purchase_order_id" value={id} />
        <section className="card p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <p><strong>Supplier</strong><br />{invoice.suppliers?.name}</p>
            <p><strong>Item</strong><br />{invoice.items?.name}</p>
            <p><strong>Current Line Total</strong><br />{money(invoice.total)}</p>
            <p><strong>Grouped Invoice Total</strong><br />{money(data.invoiceTotal)}</p>
          </div>
        </section>

        <section className="card grid gap-4 p-5 md:grid-cols-2">
          <div className="field">
            <label>Supplier Invoice No.</label>
            <input className="input" name="supplier_invoice_number" defaultValue={invoice.supplier_invoice_number ?? ""} />
          </div>
          <div className="field">
            <label>Invoice Date</label>
            <input className="input" name="order_date" type="date" defaultValue={invoice.order_date} />
          </div>
          <div className="field">
            <label>Qty</label>
            <input className="input" name="quantity" type="number" step="0.01" min="0.01" defaultValue={invoice.quantity} />
          </div>
          <div className="field">
            <label>Unit Cost</label>
            <input className="input" name="unit_cost" type="number" step="0.01" min="0" defaultValue={invoice.unit_cost} />
          </div>
        </section>

        <div>
          <SubmitButton pendingText="Saving supplier invoice...">Save Supplier Invoice</SubmitButton>
        </div>
      </form>
    </>
  );
}
