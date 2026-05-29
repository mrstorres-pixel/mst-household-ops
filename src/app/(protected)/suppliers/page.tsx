import { createSupplier, recordSupplierAdjustment, recordSupplierPayment, recordSupplierPurchase } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { listItems, listSupplierAdjustments, listSuppliers } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function SuppliersPage() {
  const [suppliers, items, adjustments] = await Promise.all([listSuppliers(), listItems(), listSupplierAdjustments()]);

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
          <SubmitButton pendingText="Saving supplier...">Save Supplier</SubmitButton>
        </form>
        <section className="grid gap-5">
          <form action={recordSupplierPurchase} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Supplier Invoice</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Supplier Invoice No.</label><input className="input" name="supplier_invoice_number" /></div>
            <div className="field"><label>Item</label><select className="input" name="item_id">{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Qty</label><input className="input" name="quantity" type="number" step="0.01" /></div>
              <div className="field"><label>Unit Cost</label><input className="input" name="unit_cost" type="number" step="0.01" /></div>
            </div>
            <div className="field"><label>Invoice Image / Attachment</label><input className="input" name="attachment" type="file" accept="image/*,.pdf" /></div>
            <SubmitButton pendingText="Posting supplier invoice...">Post Supplier Invoice</SubmitButton>
          </form>
          <form action={recordSupplierPayment} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Supplier Payment</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" /></div>
            <div className="field"><label>Reference</label><input className="input" name="reference" /></div>
            <SubmitButton pendingText="Recording payment...">Record Payment</SubmitButton>
          </form>
          <form action={recordSupplierAdjustment} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Supplier Return / Damage</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Type</label><select className="input" name="adjustment_type"><option value="return">Return</option><option value="damage">Damage</option><option value="credit">Credit</option></select></div>
            <div className="field"><label>Item</label><select className="input" name="item_id"><option value="">No item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Qty</label><input className="input" name="quantity" type="number" step="0.01" /></div>
              <div className="field"><label>Amount Deducted</label><input className="input" name="amount" type="number" step="0.01" /></div>
            </div>
            <div className="field"><label>Date</label><input className="input" name="adjustment_date" type="date" defaultValue={todayISO()} /></div>
            <div className="field"><label>Attachment</label><input className="input" name="attachment" type="file" accept="image/*,.pdf" /></div>
            <div className="field"><label>Reason</label><textarea className="input" name="reason" rows={2} /></div>
            <SubmitButton pendingText="Recording adjustment...">Record Adjustment</SubmitButton>
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
      <section className="mt-5 card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Supplier</th><th>Type</th><th>Item</th><th>Amount Deducted</th><th>Reason</th></tr></thead>
          <tbody>
            {adjustments.map((row) => <tr key={row.id}><td>{row.adjustment_date}</td><td>{row.suppliers?.name}</td><td>{row.adjustment_type}</td><td>{row.items?.name ?? "-"}</td><td>{money(row.amount)}</td><td>{row.reason}</td></tr>)}
            {!adjustments.length ? <tr><td colSpan={6}>No supplier returns or damages yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
