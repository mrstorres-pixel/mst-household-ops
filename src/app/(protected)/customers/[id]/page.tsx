import { notFound } from "next/navigation";
import { addCustomerSubaccount, removeCustomerSubaccount, saveCustomerTemplate, updateCustomer } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getCustomer, listItems } from "@/lib/data";
import { money } from "@/lib/format";

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const data = await getCustomer(id);
  const items = await listItems();
  if (!data?.customer) notFound();
  const balance = data.ledger.reduce((total, row) => total + Number(row.debit ?? 0) - Number(row.credit ?? 0), 0);
  const invoiceTotal = data.invoices.reduce((total, row) => total + Number(row.total ?? 0), 0);
  const paymentTotal = data.payments.reduce((total, row) => total + Number(row.amount ?? 0), 0);

  return (
    <>
      <PageHeader title={data.customer.name} description={`Customer balance: ${money(balance)}`} />
      {query.error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</p> : null}
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <section className="card p-4"><p className="text-sm font-semibold text-[color:var(--muted-foreground)]">Recent Invoice Total</p><p className="mt-2 text-2xl font-bold">{money(invoiceTotal)}</p></section>
        <section className="card p-4"><p className="text-sm font-semibold text-[color:var(--muted-foreground)]">Recent Payments</p><p className="mt-2 text-2xl font-bold">{money(paymentTotal)}</p></section>
        <section className="card p-4"><p className="text-sm font-semibold text-[color:var(--muted-foreground)]">Phone</p><p className="mt-2 text-lg font-bold">{data.customer.phone ?? "-"}</p></section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <section className="grid gap-5">
          <form action={updateCustomer} className="card grid gap-4 p-5">
            <input type="hidden" name="customer_id" value={id} />
            <h3 className="text-xl font-bold">Customer Details</h3>
            <div className="field"><label>Name</label><input className="input" name="name" defaultValue={data.customer.name} required /></div>
            <div className="field"><label>Account Code</label><input className="input" name="account_code" defaultValue={data.customer.account_code ?? ""} /></div>
            <div className="field"><label>Phone</label><input className="input" name="phone" defaultValue={data.customer.phone ?? ""} /></div>
            <div className="field"><label>Address</label><textarea className="input" name="address" rows={3} defaultValue={data.customer.address ?? ""} /></div>
            <div className="field"><label>Notes</label><textarea className="input" name="notes" rows={3} defaultValue={data.customer.notes ?? ""} /></div>
            <SubmitButton pendingText="Saving customer...">Save Customer</SubmitButton>
          </form>
          <div className="card p-5">
            <h3 className="text-xl font-bold">Sub-balances</h3>
            <div className="mt-4 grid gap-2">
              {data.subaccounts.map((sub) => (
                <div className="grid gap-2 rounded-lg bg-[color:var(--muted)] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={sub.subaccount_id}>
                  <span>{sub.name}</span><strong>{money(sub.balance)}</strong>
                  <form action={removeCustomerSubaccount}>
                    <input type="hidden" name="customer_id" value={id} />
                    <input type="hidden" name="subaccount_id" value={sub.subaccount_id} />
                    <SubmitButton className="btn btn-secondary" pendingText="Removing...">Remove</SubmitButton>
                  </form>
                </div>
              ))}
              {!data.subaccounts.length ? <p className="text-sm text-[color:var(--muted-foreground)]">No sub-balances.</p> : null}
            </div>
            <form action={addCustomerSubaccount} className="mt-4 flex gap-2">
              <input type="hidden" name="customer_id" value={id} />
              <input className="input" name="name" placeholder="New sub-balance name" />
              <SubmitButton pendingText="Adding...">Add</SubmitButton>
            </form>
          </div>
          <form action={saveCustomerTemplate} className="card grid gap-4 p-5">
            <input type="hidden" name="customer_id" value={id} />
            <h3 className="text-xl font-bold">Customer Default Items</h3>
            <p className="text-sm text-[color:var(--muted-foreground)]">These are saved commonly purchased items for this customer. They are used as a quick reference when preparing repeat invoices.</p>
            <div className="field">
              <label>Item</label>
              <select className="input" name="item_id" required>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Qty</label><input className="input" name="quantity" type="number" step="0.01" defaultValue="1" /></div>
              <div className="field"><label>Price</label><input className="input" name="price" type="number" step="0.01" defaultValue="0" /></div>
            </div>
            <SubmitButton pendingText="Saving template...">Save Template</SubmitButton>
          </form>
        </section>
        <section className="grid gap-5">
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Default Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                {data.template.map((row) => (
                  <tr key={row.id}>
                    <td>{row.items?.name}</td><td>{row.quantity}</td><td>{money(row.price)}</td><td>{money(Number(row.quantity) * Number(row.price))}</td>
                  </tr>
                ))}
                {!data.template.length ? <tr><td colSpan={4}>No template items yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Invoice</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {data.invoices.map((row) => <tr key={row.invoice_number}><td>{row.invoice_date}</td><td>{row.invoice_number}</td><td>{row.status}</td><td>{money(row.total)}</td></tr>)}
                {!data.invoices.length ? <tr><td colSpan={4}>No invoices yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
              <tbody>
                {data.payments.map((row, index) => <tr key={`${row.reference ?? row.method}-${index}`}><td>{row.payment_date}</td><td>{row.method}</td><td>{row.reference}</td><td>{money(row.amount)}</td></tr>)}
                {!data.payments.length ? <tr><td colSpan={4}>No payments yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
              <tbody>
                {data.ledger.map((row) => (
                  <tr key={row.id}>
                    <td>{row.entry_date}</td><td>{row.entry_type}</td><td>{row.description}</td><td>{money(row.debit)}</td><td>{money(row.credit)}</td>
                  </tr>
                ))}
                {!data.ledger.length ? <tr><td colSpan={5}>No ledger entries yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
