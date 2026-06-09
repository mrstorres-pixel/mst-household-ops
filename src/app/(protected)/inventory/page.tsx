import Link from "next/link";
import { adjustItemQuantity, deleteItem, permanentlyDeleteItem, restoreItem, updateItem } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InventoryBulkImportForm } from "@/components/inventory-bulk-import-form";
import { InventoryItemForm } from "@/components/inventory-item-form";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { listArchivedItems, listCategories, listInventoryItems, listSupplierRows, listSuppliers, type InventoryFilterStatus, type InventorySortKey } from "@/lib/data";
import { money } from "@/lib/format";

type InventorySearchParams = {
  q?: string;
  category?: string;
  supplier?: string;
  status?: InventoryFilterStatus;
  sort?: InventorySortKey;
  dir?: "asc" | "desc";
  page?: string;
  pageSize?: string;
  error?: string;
  success?: string;
};

const statusOptions: Array<{ value: InventoryFilterStatus; label: string }> = [
  { value: "all", label: "All active" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "missing_sku", label: "Missing SKU" },
  { value: "no_supplier", label: "No supplier" },
  { value: "no_category", label: "No category" },
  { value: "missing_cost", label: "Missing cost" }
];

function stockStatus(item: { current_quantity?: number | string | null; reorder_level?: number | string | null; sku?: string | null; unit_cost?: number | string | null }) {
  const quantity = Number(item.current_quantity ?? 0);
  const reorder = Number(item.reorder_level ?? 0);
  const cost = Number(item.unit_cost ?? 0);
  if (quantity <= 0) return { label: "Out", tone: "danger" as const };
  if (reorder > 0 && quantity <= reorder) return { label: "Low", tone: "warning" as const };
  if (!item.sku) return { label: "No SKU", tone: "neutral" as const };
  if (cost <= 0) return { label: "No Cost", tone: "neutral" as const };
  return { label: "In Stock", tone: "good" as const };
}

function makeHref(params: InventorySearchParams, updates: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !["error", "success"].includes(key)) next.set(key, String(value));
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `/inventory?${query}` : "/inventory";
}

function SortLink({ label, sortKey, params }: { label: string; sortKey: InventorySortKey; params: InventorySearchParams }) {
  const active = params.sort === sortKey || (!params.sort && sortKey === "name");
  const nextDir = active && params.dir !== "desc" ? "desc" : "asc";
  const marker = active ? (params.dir === "desc" ? " ↓" : " ↑") : "";
  return (
    <Link className="font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]" href={makeHref(params, { sort: sortKey, dir: nextDir, page: 1 })}>
      {label}{marker}
    </Link>
  );
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<InventorySearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize ?? 25)));
  const status = params.status ?? "all";
  const sort = params.sort ?? "name";
  const dir = params.dir ?? "asc";
  const [inventory, archivedItems, suppliers, supplierRows, categories] = await Promise.all([
    listInventoryItems({
      q: params.q,
      categoryId: params.category,
      supplierId: params.supplier,
      status,
      sort,
      direction: dir,
      page,
      pageSize
    }),
    listArchivedItems(params.q),
    listSuppliers(),
    listSupplierRows(),
    listCategories()
  ]);
  const totalValue = inventory.items.reduce((total, item) => total + Number(item.current_quantity ?? 0) * Number(item.unit_cost ?? 0), 0);
  const start = inventory.total ? (inventory.page - 1) * inventory.pageSize + 1 : 0;
  const end = Math.min(inventory.total, inventory.page * inventory.pageSize);

  return (
    <>
      <PageHeader title="Inventory" description={`Showing ${start}-${end} of ${inventory.total} items. Page stock value: ${money(totalValue)}`} />
      <PageNotice error={params.error} success={params.success} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <form className="grid flex-1 gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(150px,1fr)_110px_auto]">
          <input className="input" name="q" placeholder="Search item or SKU" defaultValue={params.q ?? ""} />
          <select className="input" name="category" defaultValue={params.category ?? ""}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="input" name="supplier" defaultValue={params.supplier ?? ""}>
            <option value="">All suppliers</option>
            {supplierRows.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select className="input" name="status" defaultValue={status}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input" name="pageSize" defaultValue={String(pageSize)}>
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size}/page</option>)}
          </select>
          <button className="btn" type="submit">Filter</button>
        </form>
        <div className="flex gap-2">
          <InventoryBulkImportForm />
          <InventoryItemForm suppliers={suppliers} />
        </div>
      </div>
      <section>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th><SortLink label="Item" sortKey="name" params={params} /></th>
                <th><SortLink label="Supplier" sortKey="supplier" params={params} /></th>
                <th><SortLink label="Category" sortKey="category" params={params} /></th>
                <th>Status</th>
                <th><SortLink label="Qty" sortKey="quantity" params={params} /></th>
                <th><SortLink label="Price" sortKey="price" params={params} /></th>
                <th><SortLink label="Cost" sortKey="cost" params={params} /></th>
                <th><SortLink label="Value" sortKey="value" params={params} /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.items.map((item) => {
                const statusBadge = stockStatus(item);
                return (
                  <tr key={item.id}>
                    <td>
                      <Link className="font-bold text-[color:var(--primary)]" href={`/inventory/${item.id}`}>{item.name}</Link>
                      <br /><span className="text-sm text-[color:var(--muted-foreground)]">{item.sku || "No SKU"}</span>
                    </td>
                    <td>{item.suppliers?.name ?? "-"}</td>
                    <td>{item.categories?.name ?? "-"}</td>
                    <td><StatusBadge tone={statusBadge.tone}>{statusBadge.label}</StatusBadge></td>
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
                          <input className="input" name="category" defaultValue={item.categories?.name ?? ""} placeholder="Category" />
                          <input className="input" name="default_price" type="number" step="0.01" defaultValue={item.default_price} />
                          <input className="input" name="unit_cost" type="number" step="0.01" defaultValue={item.unit_cost} />
                          <input className="input" name="reorder_level" type="number" step="0.01" defaultValue={item.reorder_level} />
                          <SubmitButton className="btn btn-secondary" pendingText="Saving...">Save</SubmitButton>
                        </form>
                        <form action={adjustItemQuantity} className="mt-3 grid min-w-72 gap-2 border-t border-[color:var(--border)] pt-3">
                          <input type="hidden" name="item_id" value={item.id} />
                          <label className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Set Stock Qty</label>
                          <input className="input" name="new_quantity" type="number" step="0.01" min="0" defaultValue={item.current_quantity} />
                          <input className="input" name="reason" placeholder="Reason / stock count note" defaultValue="Manual stock count correction" />
                          <SubmitButton className="btn btn-secondary" pendingText="Adjusting...">Adjust Stock</SubmitButton>
                        </form>
                        <form action={deleteItem} className="mt-2">
                          <input type="hidden" name="item_id" value={item.id} />
                          <ConfirmSubmitButton className="btn btn-warning" pendingText="Archiving..." title="Archive item?" message="This hides the item from active inventory lists while keeping its history." confirmLabel="Archive Item">Archive Item</ConfirmSubmitButton>
                        </form>
                        <form action={permanentlyDeleteItem} className="mt-2">
                          <input type="hidden" name="item_id" value={item.id} />
                          <ConfirmSubmitButton pendingText="Deleting..." title="Permanently delete item?" message="Use permanent delete only for mistaken items with no history. If this item has invoices, stock movements, damages, or supplier records, archive it instead." confirmLabel="Permanent Delete">Permanent Delete</ConfirmSubmitButton>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!inventory.items.length ? <tr><td colSpan={9}>No inventory items match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--muted-foreground)]">Page {inventory.page} of {inventory.pageCount}</p>
          <div className="flex gap-2">
            <Link className="btn btn-secondary" href={makeHref(params, { page: Math.max(1, inventory.page - 1) })}>Previous</Link>
            <Link className="btn btn-secondary" href={makeHref(params, { page: Math.min(inventory.pageCount, inventory.page + 1) })}>Next</Link>
          </div>
        </div>
      </section>
      {archivedItems.length ? (
        <section className="mt-5 card table-wrap">
          <table>
            <thead><tr><th>Archived Item</th><th>Supplier</th><th>SKU</th><th>Qty</th><th>Actions</th></tr></thead>
            <tbody>
              {archivedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.suppliers?.name ?? "-"}</td>
                  <td>{item.sku ?? "-"}</td>
                  <td>{item.current_quantity}</td>
                  <td>
                    <form action={restoreItem} className="mb-2">
                      <input type="hidden" name="item_id" value={item.id} />
                      <SubmitButton className="btn btn-secondary" pendingText="Restoring...">Restore</SubmitButton>
                    </form>
                    <form action={permanentlyDeleteItem}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <ConfirmSubmitButton pendingText="Deleting..." title="Permanently delete item?" message="Use permanent delete only for mistaken items with no history. If this item has invoices, stock movements, damages, or supplier records, keep it archived." confirmLabel="Permanent Delete">Permanent Delete</ConfirmSubmitButton>
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
