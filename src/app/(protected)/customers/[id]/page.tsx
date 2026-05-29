import { notFound } from "next/navigation";
import { saveCustomerTemplate } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { getCustomer, listItems } from "@/lib/data";
import { money } from "@/lib/format";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCustomer(id);
  const items = await listItems();
  if (!data?.customer) notFound();
  const balance = data.ledger.reduce((total, row) => total + Number(row.debit ?? 0) - Number(row.credit ?? 0), 0);

  return (
    <>
      <PageHeader title={data.customer.name} description={`Customer balance: ${money(balance)}`} />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="grid gap-5">
          <div className="card p-5">
            <h3 className="text-xl font-bold">Sub-balances</h3>
            <div className="mt-4 grid gap-2">
              {data.subaccounts.map((sub) => (
                <div className="flex justify-between rounded-lg bg-[color:var(--muted)] p-3" key={sub.subaccount_id}>
                  <span>{sub.name}</span><strong>{money(sub.balance)}</strong>
                </div>
              ))}
              {!data.subaccounts.length ? <p className="text-sm text-[color:var(--muted-foreground)]">No sub-balances.</p> : null}
            </div>
          </div>
          <form action={saveCustomerTemplate} className="card grid gap-4 p-5">
            <input type="hidden" name="customer_id" value={id} />
            <h3 className="text-xl font-bold">Add Template Item</h3>
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
              <thead><tr><th>Template Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
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
