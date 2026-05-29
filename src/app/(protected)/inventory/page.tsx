import { deleteItem, restoreItem, updateItem } from "@/app/actions";
import { InventoryItemForm } from "@/components/inventory-item-form";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { listArchivedItems, listItems, listSuppliers } from "@/lib/data";
import { money } from "@/lib/format";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const [items, archivedItems, suppliers] = await Promise.all([listItems(params.q), listArchivedItems(params.q), listSuppliers()]);
  const totalValue = items.reduce((total, item) => total + Number(item.current_quantity ?? 0) * Number(item.unit_cost ?? 0), 0);

  return (
    <>
      <PageHeader title="Inventory" description={`Current stock value: ${money(totalValue)}`} />
      {params.error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {params.error}
        </div>
      ) : null}
      {params.success ? (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {params.success}
        </div>
      ) : null}
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <InventoryItemForm suppliers={suppliers} />
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Supplier</th><th>Category</th><th>Qty</th><th>Price</th><th>Cost</th><th>Value</th><th>Edit / Archive</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}<br /><span className="text-sm text-[color:var(--muted-foreground)]">{item.sku}</span></td>
                  <td>{item.suppliers?.name ?? "-"}</td>
                  <td>{item.categories?.name ?? "-"}</td>
                  <td>{item.current_quantity}</td>
                  <td>{money(item.default_price)}</td>
                  <td>{money(item.unit_cost)}</td>
                  <td>{money(Number(item.current_quantity) * Number(item.unit_cost))}</td>
                  <td>
                    <details>
                      <summary className="cursor-pointer font-bold text-[color:var(--primary)]">Edit</summary>
                      <form action={updateItem} className="mt-3 grid min-w-72 gap-2">
                        <input type="hidden" name="item_id" value={item.id} />
                        <input className="input" name="name" defaultValue={item.name} />
                        <input className="input" name="sku" defaultValue={item.sku ?? ""} />
                        <select className="input" name="supplier_id" defaultValue={item.primary_supplier_id ?? ""}>
                          <option value="">No supplier</option>
                          {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
                        </select>
                        <input className="input" name="default_price" type="number" step="0.01" defaultValue={item.default_price} />
                        <input className="input" name="unit_cost" type="number" step="0.01" defaultValue={item.unit_cost} />
                        <input className="input" name="reorder_level" type="number" step="0.01" defaultValue={item.reorder_level} />
                        <SubmitButton className="btn btn-secondary" pendingText="Saving...">Save</SubmitButton>
                      </form>
                      <form action={deleteItem} className="mt-2">
                        <input type="hidden" name="item_id" value={item.id} />
                        <SubmitButton className="btn" pendingText="Archiving...">Archive Item</SubmitButton>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {archivedItems.length ? (
        <section className="mt-5 card table-wrap">
          <table>
            <thead><tr><th>Archived Item</th><th>Supplier</th><th>SKU</th><th>Qty</th><th>Restore</th></tr></thead>
            <tbody>
              {archivedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.suppliers?.name ?? "-"}</td>
                  <td>{item.sku ?? "-"}</td>
                  <td>{item.current_quantity}</td>
                  <td>
                    <form action={restoreItem}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <SubmitButton className="btn btn-secondary" pendingText="Restoring...">Restore</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}
