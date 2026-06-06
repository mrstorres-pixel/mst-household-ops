import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCustomerInvoice, updatePostedInvoice } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvoiceDeductions } from "@/components/invoice-deductions";
import { InvoiceLines } from "@/components/invoice-lines";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { getInvoice, listItems } from "@/lib/data";
import { money } from "@/lib/format";

export default async function EditInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, notices, items] = await Promise.all([params, searchParams, listItems()]);
  const data = await getInvoice(id);
  if (!data) notFound();

  return (
    <>
      <PageHeader title={`Edit Invoice ${data.invoice.invoice_number}`} description="Edit this invoice like you are making it: add or remove items, update prices, and manage good-stock or bad-stock returns in one place." />
      <PageNotice error={notices.error} success={notices.success} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="btn btn-secondary" href={`/invoices/${id}/print`}>Back to Print View</Link>
        <Link className="btn btn-secondary" href={`/customers/${data.invoice.customer_id}`}>Open Customer</Link>
        <form action={deleteCustomerInvoice}>
          <input type="hidden" name="invoice_id" value={id} />
          <ConfirmSubmitButton pendingText="Deleting..." title="Delete invoice?" message="This removes the invoice, reverses related stock movement, and logs the deletion. Use this only for mistaken or duplicate invoices." confirmLabel="Delete Invoice">Delete Invoice</ConfirmSubmitButton>
        </form>
      </div>
      <form action={updatePostedInvoice} className="grid gap-5">
        <input type="hidden" name="invoice_id" value={id} />
        <section className="card grid gap-4 p-5 md:grid-cols-3">
          <p><strong>Customer</strong><br />{data.invoice.customers?.name}</p>
          <p><strong>Current Total</strong><br />{money(data.invoice.total)}</p>
          <p><strong>Current Deductions</strong><br />{money(data.invoice.returns_total)}</p>
          <div className="field">
            <label>Invoice Date</label>
            <input className="input" name="invoice_date" type="date" defaultValue={data.invoice.invoice_date} />
          </div>
          <div className="field md:col-span-2">
            <label>Notes</label>
            <textarea className="input" name="notes" rows={2} defaultValue={data.invoice.notes ?? ""} />
          </div>
        </section>

        <InvoiceLines items={items} initialLines={data.lines} initialRowCount={data.lines.length || 1} />
        <InvoiceDeductions items={items} initialLines={data.deductions} />

        <div>
          <SubmitButton pendingText="Saving invoice...">Save Invoice Changes</SubmitButton>
        </div>
      </form>
    </>
  );
}
