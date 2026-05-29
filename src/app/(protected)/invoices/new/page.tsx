import { createInvoice } from "@/app/actions";
import { InvoiceLines } from "@/components/invoice-lines";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { listCustomerRows, listItems } from "@/lib/data";
import { todayISO } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

export default async function NewInvoicePage() {
  const [customerRows, items] = await Promise.all([listCustomerRows(), listItems()]);
  const customers = customerRows as CustomerOption[];

  return (
    <>
      <PageHeader title="New Invoice" description="Post itemized sales to customer balances and inventory movements." />
      <form action={createInvoice} className="grid gap-5">
        <section className="card grid gap-4 p-5 md:grid-cols-3">
          <div className="field">
            <label>Customer</label>
            <select className="input" name="customer_id" required>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sub-balance</label>
            <select className="input" name="subaccount_id">
              <option value="">None</option>
              {customers.flatMap((customer) => (customer.customer_subaccounts ?? []).map((sub) => (
                <option key={sub.id} value={sub.id}>{customer.name}: {sub.name}</option>
              )))}
            </select>
          </div>
          <div className="field">
            <label>Invoice Date</label>
            <input className="input" name="invoice_date" type="date" defaultValue={todayISO()} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-3">
            <input name="cash_sale" type="checkbox" />
            Count this invoice as physical in-store cash sale
          </label>
          <div className="field md:col-span-3">
            <label>Notes</label>
            <textarea className="input" name="notes" rows={2} />
          </div>
          <div className="field md:col-span-3">
            <label>Invoice Image / Attachment</label>
            <input className="input" name="attachment" type="file" accept="image/*,.pdf" />
          </div>
        </section>

        <InvoiceLines items={items} />
        <div><SubmitButton pendingText="Posting invoice...">Post and Print Invoice</SubmitButton></div>
      </form>
    </>
  );
}
