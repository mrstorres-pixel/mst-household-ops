import { recordPayment } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { listCustomerRows, listOpenInvoices, listPayments } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

export default async function PaymentsPage() {
  const [customerRows, payments, openInvoices] = await Promise.all([listCustomerRows(), listPayments(), listOpenInvoices()]);
  const customers = customerRows as CustomerOption[];

  return (
    <>
      <PageHeader title="Payments" description="Record cash, bank, and cheque payments against customer balances." />
      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form action={recordPayment} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Record Payment</h3>
          <div className="field"><label>Customer</label><select className="input" name="customer_id">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>
          <div className="field"><label>Sub-balance</label><select className="input" name="subaccount_id"><option value="">None</option>{customers.flatMap((customer) => (customer.customer_subaccounts ?? []).map((sub) => <option key={sub.id} value={sub.id}>{customer.name}: {sub.name}</option>))}</select></div>
          <div className="field">
            <label>Apply To Invoice</label>
            <select className="input" name="invoice_id">
              <option value="">Reduce total balance only</option>
              {openInvoices.map((invoice) => (
                <option key={invoice.invoice_id} value={invoice.invoice_id}>
                  {invoice.invoice_number} - {invoice.customers?.name} - remaining {money(invoice.remaining_balance)}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>Method</label><select className="input" name="method"><option value="cash">Cash</option><option value="bank">Bank</option><option value="cheque">Cheque</option></select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required /></div>
            <div className="field"><label>Allocate Amount</label><input className="input" name="allocation_amount" type="number" step="0.01" placeholder="Defaults to amount" /></div>
            <div className="field"><label>Date</label><input className="input" name="payment_date" type="date" defaultValue={todayISO()} /></div>
          </div>
          <div className="field"><label>Reference / Cheque No.</label><input className="input" name="reference" /></div>
          <div className="field"><label>Bank Name</label><input className="input" name="bank_name" /></div>
          <div className="field"><label>Cheque / Receipt Image</label><input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" /></div>
          <div className="field"><label>Notes</label><textarea className="input" name="notes" rows={2} /></div>
          <SubmitButton pendingText="Posting payment...">Post Payment</SubmitButton>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Amount</th><th>Applied Invoice</th><th>Attachment</th><th>Reference</th></tr></thead>
            <tbody>
              {payments.map((payment) => {
                const allocation = payment.payment_allocations?.[0];
                return (
                  <tr key={payment.id}>
                    <td>{payment.payment_date}</td><td>{payment.customers?.name}</td><td>{payment.method}</td><td>{money(payment.amount)}</td>
                    <td>{allocation?.invoices?.invoice_number ? `${allocation.invoices.invoice_number} (${money(allocation.amount)})` : "-"}</td>
                    <td>{payment.app_files?.id ? <a className="font-bold text-[color:var(--primary)]" href={`/attachments/${payment.app_files.id}`} target="_blank">View</a> : "-"}</td>
                    <td>{payment.reference}</td>
                  </tr>
                );
              })}
              {!payments.length ? <tr><td colSpan={7}>No payments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
