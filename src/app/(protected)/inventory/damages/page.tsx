import { recordDamage } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { listCustomerRows, listDamages, listItems, listSuppliers } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function DamagesPage() {
  const [items, damages, customers, suppliers] = await Promise.all([listItems(), listDamages(), listCustomerRows(), listSuppliers()]);

  return (
    <>
      <PageHeader title="Damage Records" description="Separate stock damage log with inventory deduction." />
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form action={recordDamage} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Record Damage / Return</h3>
          <div className="field"><label>Item</label><select className="input" name="item_id">{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field">
            <label>Deduct From Customer Balance</label>
            <select className="input" name="customer_id">
              <option value="">No customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Deduct From Supplier Balance</label>
            <select className="input" name="supplier_id">
              <option value="">No supplier</option>
              {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Quantity</label><input className="input" name="quantity" type="number" step="0.01" required /></div>
          <div className="field"><label>Estimated Cost</label><input className="input" name="estimated_cost" type="number" step="0.01" /></div>
          <div className="field"><label>Balance Deduction Amount</label><input className="input" name="balance_credit" type="number" step="0.01" /></div>
          <div className="field"><label>Date</label><input className="input" name="damage_date" type="date" defaultValue={todayISO()} /></div>
          <div className="field"><label>Reason</label><textarea className="input" name="reason" rows={3} /></div>
          <SubmitButton pendingText="Recording...">Record Damage / Return</SubmitButton>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Item</th><th>Customer</th><th>Supplier</th><th>Qty</th><th>Balance Deduction</th><th>Reason</th></tr></thead>
            <tbody>
              {damages.map((row) => (
                <tr key={row.id}><td>{row.damage_date}</td><td>{row.items?.name}</td><td>{row.customers?.name ?? "-"}</td><td>{row.suppliers?.name ?? "-"}</td><td>{row.quantity}</td><td>{money(row.balance_credit)}</td><td>{row.reason}</td></tr>
              ))}
              {!damages.length ? <tr><td colSpan={7}>No damage records.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
