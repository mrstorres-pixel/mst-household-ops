import Link from "next/link";
import { notFound } from "next/navigation";
import { adjustItemQuantity, deleteItem, permanentlyDeleteItem, updateItem } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { getInventoryItem, listSuppliers } from "@/lib/data";
import { money } from "@/lib/format";

function statusBadge(item: { current_quantity?: number | string | null; reorder_level?: number | string | null }) {
  const quantity = Number(item.current_quantity ?? 0);
  const reorder = Number(item.reorder_level ?? 0);
  if (quantity <= 0) return { label: "Out of Stock", tone: "danger" as const };
  if (reorder > 0 && quantity <= reorder) return { label: "Low Stock", tone: "warning" as const };
  return { label: "In Stock", tone: "good" as const };
}

export default async function InventoryItemDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, notices] = await Promise.all([params, searchParams]);
  const [data, suppliers] = await Promise.all([getInventoryItem(id), listSuppliers()]);
  if (!data) notFound();

  const item = data.item;
  const badge = statusBadge(item);
  const stockValue = Number(item.current_quantity ?? 0) * Number(item.unit_cost ?? 0);
  const hasVisibleHistory = Boolean(data.movements.length || data.invoiceItems.length || data.purchases.length || data.damages.length);

  return (
    <>
      <PageHeader title={item.name} description={`${item.sku || "No SKU"} · Stock value ${money(stockValue)}`} />
      <PageNotice error={notices.error} success={notices.success} />
      <div className="mb-5">
        <Link className="btn btn-secondary" href="/inventory">Back to Inventory</Link>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-5">
          <div className="card p-5">
            <div className="grid gap-4 md:grid-cols-4">
              <p><strong>Status</strong><br /><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></p>
              <p><strong>Quantity</strong><br />{item.current_quantity}</p>
              <p><strong>Unit Cost</strong><br />{money(item.unit_cost)}</p>
              <p><strong>Stock Value</strong><br />{money(stockValue)}</p>
              <p><strong>Price</strong><br />{money(item.default_price)}</p>
              <p><strong>Reorder Level</strong><br />{item.reorder_level}</p>
              <p><strong>Category</strong><br />{item.categories?.name ?? "-"}</p>
              <p><strong>Supplier</strong><br />{item.suppliers?.name ?? "-"}</p>
            </div>
          </div>

          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Movement</th><th>Qty Change</th><th>Cost</th><th>Reference</th><th>Notes</th></tr></thead>
              <tbody>
                {data.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.movement_date}</td>
                    <td>{movement.movement_type}</td>
                    <td>{movement.quantity_delta}</td>
                    <td>{money(movement.unit_cost)}</td>
                    <td>{movement.reference_type ?? "-"}</td>
                    <td>{movement.notes}</td>
                  </tr>
                ))}
                {!data.movements.length ? <tr><td colSpan={6}>No stock movements recorded.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
              <tbody>
                {data.invoiceItems.map((line) => (
                  <tr key={line.id}>
                    <td>{line.invoices?.invoice_date}</td>
                    <td>{line.invoices?.invoice_number}</td>
                    <td>{line.invoices?.customers?.name}</td>
                    <td>{line.quantity}</td>
                    <td>{money(line.unit_price)}</td>
                    <td>{money(line.line_total)}</td>
                  </tr>
                ))}
                {!data.invoiceItems.length ? <tr><td colSpan={6}>No customer invoice usage yet.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead>
              <tbody>
                {data.purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.order_date}</td>
                    <td>{purchase.suppliers?.name}</td>
                    <td><Link className="font-bold text-[color:var(--primary)]" href={`/suppliers/invoices/${purchase.id}`}>{purchase.supplier_invoice_number ?? purchase.id.slice(0, 8)}</Link></td>
                    <td>{purchase.quantity}</td>
                    <td>{money(purchase.unit_cost)}</td>
                    <td>{money(purchase.total)}</td>
                  </tr>
                ))}
                {!data.purchases.length ? <tr><td colSpan={6}>No supplier invoice history yet.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="card table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Customer</th><th>Supplier</th><th>Qty</th><th>Deduction</th><th>Reason</th></tr></thead>
              <tbody>
                {data.damages.map((damage) => (
                  <tr key={damage.id}>
                    <td>{damage.damage_date}</td>
                    <td>{damage.customers?.name ?? "-"}</td>
                    <td>{damage.suppliers?.name ?? "-"}</td>
                    <td>{damage.quantity}</td>
                    <td>{money(damage.balance_credit)}</td>
                    <td>{damage.reason}</td>
                  </tr>
                ))}
                {!data.damages.length ? <tr><td colSpan={6}>No damage or return records yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <form action={updateItem} className="card grid gap-3 p-5">
            <h3 className="text-xl font-bold">Edit Item</h3>
            <input type="hidden" name="item_id" value={item.id} />
            <div className="field"><label>Name</label><input className="input" name="name" defaultValue={item.name} /></div>
            <div className="field"><label>SKU</label><input className="input" name="sku" defaultValue={item.sku ?? ""} /></div>
            <div className="field">
              <label>Supplier</label>
              <select className="input" name="supplier_id" defaultValue={item.primary_supplier_id ?? ""}>
                <option value="">No supplier</option>
                {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Category</label><input className="input" name="category" defaultValue={item.categories?.name ?? ""} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label>Price</label><input className="input" name="default_price" type="number" step="0.01" defaultValue={item.default_price} /></div>
              <div className="field"><label>Cost</label><input className="input" name="unit_cost" type="number" step="0.01" defaultValue={item.unit_cost} /></div>
            </div>
            <div className="field"><label>Reorder Level</label><input className="input" name="reorder_level" type="number" step="0.01" defaultValue={item.reorder_level} /></div>
            <SubmitButton className="btn btn-secondary" pendingText="Saving...">Save Item</SubmitButton>
          </form>

          <form action={adjustItemQuantity} className="card grid gap-3 p-5">
            <h3 className="text-xl font-bold">Set Stock Count</h3>
            <input type="hidden" name="item_id" value={item.id} />
            <div className="field"><label>Counted Quantity</label><input className="input" name="new_quantity" type="number" step="0.01" min="0" defaultValue={item.current_quantity} /></div>
            <div className="field"><label>Reason</label><textarea className="input" name="reason" rows={2} defaultValue="Manual stock count correction" /></div>
            <SubmitButton className="btn btn-secondary" pendingText="Adjusting...">Adjust Stock</SubmitButton>
          </form>

          <div className="card grid gap-3 p-5">
            <h3 className="text-xl font-bold">Archive / Delete</h3>
            <form action={deleteItem}>
              <input type="hidden" name="item_id" value={item.id} />
              <ConfirmSubmitButton className="btn btn-warning" pendingText="Archiving..." title="Archive item?" message="This hides the item from active inventory lists while keeping its history." confirmLabel="Archive Item">Archive Item</ConfirmSubmitButton>
            </form>
            {hasVisibleHistory ? (
              <p className="text-sm font-semibold text-[color:var(--muted-foreground)]">Permanent delete is disabled because this item has transaction history. Archive it to hide it from active inventory.</p>
            ) : (
              <form action={permanentlyDeleteItem}>
                <input type="hidden" name="item_id" value={item.id} />
                <ConfirmSubmitButton pendingText="Deleting..." title="Permanently delete item?" message="This cannot be undone. Use permanent delete only for items that were created by mistake and have no history." confirmLabel="Permanent Delete">Permanent Delete</ConfirmSubmitButton>
              </form>
            )}
          </div>
        </aside>
      </section>
    </>
  );
}
