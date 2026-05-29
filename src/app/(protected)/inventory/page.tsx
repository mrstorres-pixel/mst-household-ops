import { createItem } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { listItems } from "@/lib/data";
import { money } from "@/lib/format";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const items = await listItems(params.q);
  const totalValue = items.reduce((total, item) => total + Number(item.current_quantity ?? 0) * Number(item.unit_cost ?? 0), 0);

  return (
    <>
      <PageHeader title="Inventory" description={`Current stock value: ${money(totalValue)}`} />
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form action={createItem} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Add Item</h3>
          <div className="field"><label>Name</label><input className="input" name="name" required /></div>
          <div className="field"><label>SKU</label><input className="input" name="sku" /></div>
          <div className="field"><label>Category</label><input className="input" name="category" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label>Default Price</label><input className="input" name="default_price" type="number" step="0.01" /></div>
            <div className="field"><label>Unit Cost</label><input className="input" name="unit_cost" type="number" step="0.01" /></div>
            <div className="field"><label>Quantity</label><input className="input" name="current_quantity" type="number" step="0.01" /></div>
            <div className="field"><label>Reorder</label><input className="input" name="reorder_level" type="number" step="0.01" /></div>
          </div>
          <button className="btn" type="submit">Save Item</button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Price</th><th>Cost</th><th>Value</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}<br /><span className="text-sm text-[color:var(--muted-foreground)]">{item.sku}</span></td>
                  <td>{item.categories?.name ?? "-"}</td>
                  <td>{item.current_quantity}</td>
                  <td>{money(item.default_price)}</td>
                  <td>{money(item.unit_cost)}</td>
                  <td>{money(Number(item.current_quantity) * Number(item.unit_cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
