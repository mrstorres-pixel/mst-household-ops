import Link from "next/link";
import { createSupplier, deleteSupplier, recordSupplierAdjustment, recordSupplierOpeningBalance, recordSupplierPayment, recordSupplierPurchase, updateSupplier } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { listItems, listSupplierAdjustments, listSupplierInvoices, listSupplierRows, listSuppliers } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  const [suppliers, supplierRows, items, adjustments, supplierInvoices] = await Promise.all([listSuppliers(), listSupplierRows(), listItems(), listSupplierAdjustments(), listSupplierInvoices()]);

  return (
    <>
      <PageHeader title="Suppliers" description="Supplier list, purchases to order/receive, and payable balances." />
      <PageNotice error={params.error} success={params.success} />
      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createSupplier} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Add Supplier</h3>
          <div className="field"><label>Name</label><input className="input" name="name" required /></div>
          <div className="field"><label>Contact</label><input className="input" name="contact_name" /></div>
          <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
          <div className="field"><label>Address</label><textarea className="input" name="address" rows={2} /></div>
          <SubmitButton pendingText="Saving supplier...">Save Supplier</SubmitButton>
        </form>
        <form action={recordSupplierPurchase} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Supplier Invoice</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Supplier Invoice No.</label><input className="input" name="supplier_invoice_number" /></div>
            <div className="field"><label>Item</label><select className="input" name="item_id">{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Qty</label><input className="input" name="quantity" type="number" step="0.01" /></div>
              <div className="field"><label>Unit Cost</label><input className="input" name="unit_cost" type="number" step="0.01" /></div>
            </div>
            <div className="field"><label>Invoice Image / Attachment</label><input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" /></div>
            <SubmitButton pendingText="Posting supplier invoice...">Post Supplier Invoice</SubmitButton>
        </form>
        <form action={recordSupplierPayment} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Supplier Payment</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" /></div>
            <div className="field"><label>Reference</label><input className="input" name="reference" /></div>
            <SubmitButton pendingText="Recording payment...">Record Payment</SubmitButton>
        </form>
        <form action={recordSupplierOpeningBalance} className="card grid gap-4 p-5">
            <h3 className="text-xl font-bold">Old / Opening Supplier Balance</h3>
            <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
            <div className="field">
              <label>Balance Type</label>
              <select className="input" name="direction" defaultValue="we_owe_supplier">
                <option value="we_owe_supplier">We owe supplier</option>
                <option value="supplier_credit">Supplier credit / deduct payable</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required /></div>
              <div className="field"><label>Date</label><input className="input" name="adjustment_date" type="date" defaultValue={todayISO()} /></div>
            </div>
            <div className="field"><label>Notes</label><textarea className="input" name="notes" rows={2} placeholder="Old payable balance, previous supplier statement, etc." /></div>
            <SubmitButton className="btn btn-secondary" pendingText="Saving balance...">Save Opening Balance</SubmitButton>
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
            <div className="field"><label>Attachment</label><input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" /></div>
            <div className="field"><label>Reason</label><textarea className="input" name="reason" rows={2} /></div>
            <SubmitButton pendingText="Recording adjustment...">Record Adjustment</SubmitButton>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Supplier</th><th>Balance</th><th>Edit / Delete</th></tr></thead>
            <tbody>
              {suppliers.map((supplier) => {
                const row = supplierRows.find((supplierRow) => supplierRow.id === supplier.supplier_id);
                return (
                  <tr key={supplier.supplier_id}>
                    <td>{supplier.name}</td>
                    <td>{money(supplier.balance)}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Edit</summary>
                        <form action={updateSupplier} className="mt-3 grid min-w-72 gap-2">
                          <input type="hidden" name="supplier_id" value={supplier.supplier_id} />
                          <input className="input" name="name" defaultValue={row?.name ?? supplier.name} />
                          <input className="input" name="contact_name" defaultValue={row?.contact_name ?? ""} />
                          <input className="input" name="phone" defaultValue={row?.phone ?? ""} />
                          <textarea className="input" name="address" rows={2} defaultValue={row?.address ?? ""} />
                          <SubmitButton className="btn btn-secondary" pendingText="Saving...">Save</SubmitButton>
                        </form>
                        <form action={deleteSupplier} className="mt-2">
                          <input type="hidden" name="supplier_id" value={supplier.supplier_id} />
                          <ConfirmSubmitButton pendingText="Deleting..." title="Delete supplier?" message="This hides the supplier from active supplier lists while keeping purchase and payment history." confirmLabel="Delete Supplier">Delete</ConfirmSubmitButton>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!suppliers.length ? <tr><td colSpan={3}>No suppliers yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <section className="mt-5 card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Supplier Invoice</th><th>Supplier</th><th>Item</th><th>Total</th><th>Attachment</th><th>Open</th></tr></thead>
          <tbody>
            {supplierInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.order_date}</td>
                <td>{invoice.supplier_invoice_number ?? invoice.id.slice(0, 8)}</td>
                <td>{invoice.suppliers?.name}</td>
                <td>{invoice.items?.name}</td>
                <td>{money(invoice.total)}</td>
                <td>{invoice.app_files?.id ? <a className="font-bold text-[color:var(--primary)]" href={`/attachments/${invoice.app_files.id}`} target="_blank">View</a> : "-"}</td>
                <td><Link className="font-bold text-[color:var(--primary)]" href={`/suppliers/invoices/${invoice.id}`}>Details</Link></td>
              </tr>
            ))}
            {!supplierInvoices.length ? <tr><td colSpan={7}>No supplier invoices yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
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
