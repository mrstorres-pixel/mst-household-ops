import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePostedInvoice } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { getInvoice } from "@/lib/data";
import { money } from "@/lib/format";

export default async function EditInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const data = await getInvoice(id);
  if (!data) notFound();

  return (
    <>
      <PageHeader title={`Edit Invoice ${data.invoice.invoice_number}`} description="Correct existing invoice line quantities, prices, and descriptions." />
      <PageNotice error={notices.error} success={notices.success} />
      <div className="mb-5 flex gap-2">
        <Link className="btn btn-secondary" href={`/invoices/${id}/print`}>Back to Print View</Link>
        <Link className="btn btn-secondary" href={`/customers/${data.invoice.customer_id}`}>Open Customer</Link>
      </div>
      <form action={updatePostedInvoice} className="grid gap-5">
        <input type="hidden" name="invoice_id" value={id} />
        <section className="card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <p><strong>Customer</strong><br />{data.invoice.customers?.name}</p>
            <p><strong>Date</strong><br />{data.invoice.invoice_date}</p>
            <p><strong>Current Total</strong><br />{money(data.invoice.total)}</p>
          </div>
        </section>
        <section className="card table-wrap">
          <table>
            <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Current Total</th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <input type="hidden" name="line_id" value={line.id} />
                    <input className="input" name="description" defaultValue={line.description} />
                  </td>
                  <td><input className="input" name="quantity" type="number" step="0.01" min="0.01" defaultValue={line.quantity} /></td>
                  <td><input className="input" name="unit_price" type="number" step="0.01" min="0" defaultValue={line.unit_price} /></td>
                  <td className="font-bold">{money(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div>
          <SubmitButton pendingText="Saving invoice...">Save Invoice Corrections</SubmitButton>
        </div>
      </form>
    </>
  );
}
