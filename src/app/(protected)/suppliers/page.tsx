import Link from "next/link";
import { createSupplier, deleteSupplier, deleteSupplierInvoice, recordSupplierAdjustment, recordSupplierOpeningBalance, recordSupplierPayment, recordSupplierPurchase, updateSupplier } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { SupplierInvoiceDeductions } from "@/components/supplier-invoice-deductions";
import { SupplierInvoiceLines } from "@/components/supplier-invoice-lines";
import { listItems, listSupplierAdjustments, listSupplierInvoices, listSupplierPayments, listSupplierRows, listSuppliers } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; supplier_id?: string; date_from?: string; date_to?: string }> }) {
  const params = await searchParams;
  const activityFilters = { supplierId: params.supplier_id, dateFrom: params.date_from, dateTo: params.date_to };
  const [suppliers, supplierRows, items, adjustments, supplierInvoices, supplierPayments] = await Promise.all([
    listSuppliers(),
    listSupplierRows(),
    listItems(),
    listSupplierAdjustments(activityFilters),
    listSupplierInvoices(activityFilters),
    listSupplierPayments(activityFilters)
  ]);
  const supplierBalanceTotal = suppliers.reduce((sum, supplier) => sum + Number(supplier.balance ?? 0), 0);
  const recentInvoiceTotal = supplierInvoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0);
  const recentAdjustmentTotal = adjustments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const recentPaymentTotal = supplierPayments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return (
    <>
      <PageHeader title="Suppliers" description="Supplier invoices, payable balances, payments, and after-invoice adjustments." />
      <PageNotice error={params.error} success={params.success} />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Active Suppliers</p>
          <p className="mt-2 text-xl font-bold md:text-2xl">{suppliers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Total Payable</p>
          <p className="mt-2 break-words text-xl font-bold md:text-2xl">{money(supplierBalanceTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Recent Credits / Deductions</p>
          <p className="mt-2 break-words text-xl font-bold md:text-2xl">{money(recentAdjustmentTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Recent Payments</p>
          <p className="mt-2 break-words text-xl font-bold md:text-2xl">{money(recentPaymentTotal)}</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form action={recordSupplierPurchase} className="card grid gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] pb-4">
            <div>
              <h3 className="text-xl font-bold">Post Supplier Invoice</h3>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Use this for received supplier bills, stock-in items, and same-invoice returns, damage, or credits.</p>
            </div>
            <StatusBadge tone={recentInvoiceTotal > 0 ? "good" : "neutral"}>Recent posted {money(recentInvoiceTotal)}</StatusBadge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="field md:col-span-1">
              <label>Supplier</label>
              <select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select>
            </div>
            <div className="field">
              <label>Supplier Invoice No.</label>
              <input className="input" name="supplier_invoice_number" />
            </div>
            <div className="field">
              <label>Invoice Date</label>
              <input className="input" name="order_date" type="date" defaultValue={todayISO()} />
            </div>
          </div>
          <SupplierInvoiceLines items={items} />
          <SupplierInvoiceDeductions items={items} />
          <div className="sticky-actions -mx-5 -mb-5 px-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="field">
              <label>Invoice Image / Attachment</label>
              <input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" />
            </div>
            <SubmitButton pendingText="Posting supplier invoice...">Post Supplier Invoice</SubmitButton>
            </div>
          </div>
        </form>

        <aside className="grid content-start gap-5">
          <section className="card">
            <div className="border-b border-[color:var(--border)] p-4">
              <h3 className="font-bold">Supplier Balances</h3>
            </div>
            <div className="supplier-balance-list">
              {suppliers.slice(0, 16).map((supplier) => (
                <div className="supplier-balance-row" key={supplier.supplier_id}>
                  <span>{supplier.name}</span>
                  <strong>{money(supplier.balance)}</strong>
                </div>
              ))}
              {!suppliers.length ? <p className="p-4 text-sm text-[color:var(--muted-foreground)]">No suppliers yet.</p> : null}
            </div>
          </section>

          <details className="card p-5">
            <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Add Supplier</summary>
            <form action={createSupplier} className="mt-4 grid gap-3">
              <div className="field"><label>Name</label><input className="input" name="name" required /></div>
              <div className="field"><label>Contact</label><input className="input" name="contact_name" /></div>
              <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
              <div className="field"><label>Address</label><textarea className="input" name="address" rows={2} /></div>
              <SubmitButton pendingText="Saving supplier...">Save Supplier</SubmitButton>
            </form>
          </details>
        </aside>
      </section>

      <section className="mt-5 grid gap-5">
        <form data-save-filters="suppliers" className="card grid gap-3 p-4 md:grid-cols-[1.3fr_1fr_1fr_auto_auto] md:items-end">
          <div className="field">
            <label>Supplier</label>
            <select className="input" name="supplier_id" defaultValue={params.supplier_id ?? ""}>
              <option value="">All suppliers</option>
              {supplierRows.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>From</label>
            <input className="input" name="date_from" type="date" defaultValue={params.date_from ?? ""} />
          </div>
          <div className="field">
            <label>To</label>
            <input className="input" name="date_to" type="date" defaultValue={params.date_to ?? ""} />
          </div>
          <button className="btn" type="submit">Apply</button>
          <Link data-clear-saved-filter="suppliers" className="btn btn-secondary" href="/suppliers">Clear</Link>
        </form>
        <details className="card activity-section" open>
          <summary>
            <span>Recent Supplier Invoices</span>
            <StatusBadge tone={supplierInvoices.length ? "good" : "neutral"}>{supplierInvoices.length} rows</StatusBadge>
          </summary>
          <div className="table-wrap bounded-table">
            <table className="compact-table">
              <thead><tr><th>Date</th><th>Invoice</th><th>Supplier</th><th>Item</th><th>Total</th><th>Details</th><th>Action</th></tr></thead>
              <tbody>
                {supplierInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="cell-date">{invoice.order_date}</td>
                    <td className="cell-ref">{invoice.supplier_invoice_number ?? invoice.id.slice(0, 8)}</td>
                    <td className="cell-name">{invoice.suppliers?.name}</td>
                    <td className="cell-item"><StatusBadge tone={Number(invoice.line_count ?? 1) > 1 ? "neutral" : "good"}>{invoice.items?.name}</StatusBadge></td>
                    <td className="cell-money font-bold">{money(invoice.total)}</td>
                    <td className="cell-action"><Link className="font-bold text-[color:var(--primary)]" href={`/suppliers/invoices/${invoice.id}`}>Details</Link></td>
                    <td className="cell-action">
                      <div className="flex flex-nowrap gap-2">
                        <Link className="btn btn-secondary" href={`/suppliers/invoices/${invoice.id}/edit`}>Edit</Link>
                        <form action={deleteSupplierInvoice}>
                          <input type="hidden" name="purchase_order_id" value={invoice.id} />
                          <ConfirmSubmitButton pendingText="Deleting..." title="Delete supplier invoice?" message={`This deletes ${invoice.line_count ?? 1} item line${Number(invoice.line_count ?? 1) === 1 ? "" : "s"} under this supplier invoice/DR number, reverses stock movement, removes linked payments/adjustments, and logs the deletion.`} confirmLabel="Delete Supplier Invoice">Delete</ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!supplierInvoices.length ? <tr><td colSpan={7}>No supplier invoices found for this filter.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </details>

        <details className="card activity-section">
          <summary>
            <span>Recent Supplier Deductions</span>
            <StatusBadge tone={adjustments.length ? "warning" : "neutral"}>{adjustments.length} rows</StatusBadge>
          </summary>
          <div className="table-wrap bounded-table">
            <table className="compact-table">
              <thead><tr><th>Date</th><th>Supplier</th><th>Type</th><th>Item</th><th>Amount</th></tr></thead>
              <tbody>
                {adjustments.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-date">{row.adjustment_date}</td>
                    <td className="cell-name">{row.suppliers?.name}</td>
                    <td className="cell-ref"><StatusBadge tone={row.adjustment_type === "damage" ? "danger" : row.adjustment_type === "credit" ? "neutral" : "warning"}>{row.adjustment_type}</StatusBadge></td>
                    <td className="cell-item">{row.items?.name ?? "-"}</td>
                    <td className="cell-money font-bold">{money(row.amount)}</td>
                  </tr>
                ))}
                {!adjustments.length ? <tr><td colSpan={5}>No supplier deductions found for this filter.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </details>

        <details className="card activity-section">
          <summary>
            <span>Supplier Payment History</span>
            <StatusBadge tone={supplierPayments.length ? "good" : "neutral"}>{supplierPayments.length} rows</StatusBadge>
          </summary>
          <div className="table-wrap bounded-table">
            <table className="compact-table">
              <thead><tr><th>Date</th><th>Supplier</th><th>Reference</th><th>Invoice / DR</th><th>Amount</th><th>Notes</th></tr></thead>
              <tbody>
                {supplierPayments.map((payment) => {
                  const invoiceLabel = payment.purchase_orders?.supplier_invoice_number ?? (payment.purchase_orders?.id ? String(payment.purchase_orders.id).slice(0, 8) : "Total balance");
                  return (
                    <tr key={payment.id}>
                      <td className="cell-date">{payment.payment_date}</td>
                      <td className="cell-name">{payment.suppliers?.name}</td>
                      <td className="cell-ref">{payment.reference ?? "-"}</td>
                      <td className="cell-ref">{invoiceLabel}</td>
                      <td className="cell-money font-bold">{money(payment.amount)}</td>
                      <td className="cell-item">{payment.notes ?? "-"}</td>
                    </tr>
                  );
                })}
                {!supplierPayments.length ? <tr><td colSpan={6}>No supplier payments found for this filter.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mt-5 card p-5">
        <div className="mb-4">
          <h3 className="text-xl font-bold">Supplier Maintenance</h3>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Use these for payments, old balances, supplier profile edits, and deductions that were not entered with an invoice.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <details className="border border-[color:var(--border)] p-4">
            <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Record Supplier Payment</summary>
            <form action={recordSupplierPayment} className="mt-4 grid gap-3">
              <div className="field"><label>Supplier</label><select className="input" name="supplier_id">{suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}</select></div>
              <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" /></div>
              <div className="field"><label>Date</label><input className="input" name="payment_date" type="date" defaultValue={todayISO()} /></div>
              <div className="field"><label>Reference</label><input className="input" name="reference" /></div>
              <div className="field"><label>Notes</label><textarea className="input" name="notes" rows={2} /></div>
              <SubmitButton pendingText="Recording payment...">Record Payment</SubmitButton>
            </form>
          </details>

          <details className="border border-[color:var(--border)] p-4">
            <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Old / Opening Supplier Balance</summary>
            <form action={recordSupplierOpeningBalance} className="mt-4 grid gap-3">
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
          </details>

          <details className="border border-[color:var(--border)] p-4">
            <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Separate Supplier Return / Damage / Credit</summary>
            <form action={recordSupplierAdjustment} className="mt-4 grid gap-3">
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
              <SubmitButton pendingText="Recording adjustment...">Record Separate Adjustment</SubmitButton>
            </form>
          </details>

          <details className="border border-[color:var(--border)] p-4">
            <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Edit Supplier Directory</summary>
            <div className="mt-4 table-wrap">
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
          </details>
        </div>
      </section>
    </>
  );
}
