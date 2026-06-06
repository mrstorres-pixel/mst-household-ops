import { Camera, ReceiptText } from "lucide-react";
import { createInvoice } from "@/app/actions";
import { InvoiceDeductions } from "@/components/invoice-deductions";
import { InvoiceLines } from "@/components/invoice-lines";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { listCustomerRows, listItems } from "@/lib/data";
import { todayISO } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer_id?: string; subaccount_id?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const [customerRows, items] = await Promise.all([listCustomerRows(), listItems()]);
  const customers = customerRows as CustomerOption[];

  return (
    <>
      <PageHeader title="New Invoice" description="Post itemized sales to customer balances and inventory movements." />
      <PageNotice error={params.error} success={params.success} />
      <form action={createInvoice} className="grid gap-5">
        <section className="card grid gap-4 p-5 md:grid-cols-3">
          <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] pb-4">
            <div>
              <h3 className="text-xl font-bold">Customer and Receipt</h3>
              <p className="text-sm text-[color:var(--muted-foreground)]">Choose the account first, then encode items in the same order as the manual receipt.</p>
            </div>
            <ReceiptText className="h-5 w-5 text-[color:var(--primary)]" />
          </div>
          <div className="field">
            <label>Customer</label>
            <select className="input" name="customer_id" defaultValue={params.customer_id ?? ""} required>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sub-balance</label>
            <select className="input" name="subaccount_id" defaultValue={params.subaccount_id ?? ""}>
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
            <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
              <input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" />
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--muted-foreground)]"><Camera className="h-4 w-4" /> Optional</span>
            </div>
          </div>
        </section>

        <InvoiceLines items={items} />
        <InvoiceDeductions items={items} />
        <div className="sticky-actions no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">Posting checks stock, records customer balance, and opens the print view.</p>
            <SubmitButton pendingText="Posting invoice...">Post and Print Invoice</SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}
