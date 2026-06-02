import { notFound } from "next/navigation";
import { addCustomerSubaccount, deleteCustomer, recordCustomerOpeningBalance, removeCustomerSubaccount, saveCustomerTemplate, updateCustomer } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { getCustomer, listItems } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
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
      <PageNotice error={query.error} success={query.success} />
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
          <form action={deleteCustomer} className="card grid gap-3 border-red-200 p-5">
            <input type="hidden" name="customer_id" value={id} />
            <h3 className="text-xl font-bold text-red-700">Delete Customer</h3>
            <p className="text-sm text-[color:var(--muted-foreground)]">This hides the customer from active lists while keeping historical invoices and ledger records intact.</p>
            <ConfirmSubmitButton pendingText="Deleting..." title="Delete customer?" message="This hides the customer from active lists. Historical invoices, payments, and ledger records are kept." confirmLabel="Delete Customer">Delete Customer</ConfirmSubmitButton>
          </form>
          <form action={recordCustomerOpeningBalance} className="card grid gap-4 p-5">
            <input type="hidden" name="customer_id" value={id} />
            <h3 className="text-xl font-bold">Old / Opening Balance</h3>
            <div className="field">
              <label>Balance Type</label>
              <select className="input" name="direction" defaultValue="customer_owes">
                <option value="customer_owes">Customer owes us</option>
                <option value="customer_credit">Customer has credit</option>
              </select>
            </div>
            <div className="field">
              <label>Sub-balance</label>
              <select className="input" name="subaccount_id">
                <option value="">Main / no sub-balance</option>
                {data.subaccounts.map((sub) => <option key={sub.subaccount_id} value={sub.subaccount_id}>{sub.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required /></div>
              <div className="field"><label>Date</label><input className="input" name="entry_date" type="date" defaultValue={todayISO()} /></div>
            </div>
            <div className="field"><label>Notes</label><textarea className="input" name="notes" rows={2} placeholder="Old account balance, previous ledger, etc." /></div>
            <SubmitButton className="btn btn-secondary" pendingText="Saving balance...">Save Opening Balance</SubmitButton>
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
                    <ConfirmSubmitButton className="btn btn-warning" pendingText="Removing..." title="Remove sub-balance?" message="Only zero-balance sub-balances can be removed. This removes the sub-balance from this customer profile." confirmLabel="Remove">Remove</ConfirmSubmitButton>
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
