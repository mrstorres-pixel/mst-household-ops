import { createSupplier, recordSupplierPayment, recordSupplierPurchase } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { listItems, listSuppliers } from "@/lib/data";
import { money } from "@/lib/format";

export default async function SuppliersPage() {
  const [suppliers, items] = await Promise.all([listSuppliers(), listItems()]);

  return (
    <>
      <PageHeader title="Suppliers" description="Supplier list, purchases to order/receive, and payable balances." />
      <div className="grid gap-5 xl:grid-cols-[340px_340px_1fr]">
        <form action={createSupplier} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Add Supplier</h3>
          <div className="field"><label>Name</label><input className="input" name="name" required /></div>
          <div className="field"><label>Contact</label><input className="input" name="contact_name" /></div>
          <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
          <div className="field"><label>Address</label><textarea className="input" name="address" rows={2} /></div>
          <button className="btn" type="submit">Save Supplier</button>
        </form>
        <section className="grid gap-5">
          <form action={recordSupplierPurchase} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Receive Stock</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Item</label><select className="input" name="item_id">{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Qty</label><input className="input" name="quantity" type="number" step="0.01" /></div>
              <div className="field"><label>Unit Cost</label><input className="input" name="unit_cost" type="number" step="0.01" /></div>
            </div>
            <button className="btn" type="submit">Post Purchase</button>
          </form>
          <form action={recordSupplierPayment} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Supplier Payment</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" /></div>
            <div className="field"><label>Reference</label><input className="input" name="reference" /></div>
            <button className="btn" type="submit">Record Payment</button>
          </form>
        </section>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Supplier</th><th>Balance</th></tr></thead>
            <tbody>
              {suppliers.map((supplier) => <tr key={supplier.supplier_id}><td>{supplier.name}</td><td>{money(supplier.balance)}</td></tr>)}
              {!suppliers.length ? <tr><td colSpan={2}>No suppliers yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
