import { recordDamage } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { listDamages, listItems } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function DamagesPage() {
  const [items, damages] = await Promise.all([listItems(), listDamages()]);

  return (
    <>
      <PageHeader title="Damage Records" description="Separate stock damage log with inventory deduction." />
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form action={recordDamage} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Record Damage</h3>
          <div className="field"><label>Item</label><select className="input" name="item_id">{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Quantity</label><input className="input" name="quantity" type="number" step="0.01" required /></div>
          <div className="field"><label>Estimated Cost</label><input className="input" name="estimated_cost" type="number" step="0.01" /></div>
          <div className="field"><label>Date</label><input className="input" name="damage_date" type="date" defaultValue={todayISO()} /></div>
          <div className="field"><label>Reason</label><textarea className="input" name="reason" rows={3} /></div>
          <button className="btn" type="submit">Record Damage</button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Cost</th><th>Reason</th></tr></thead>
            <tbody>
              {damages.map((row) => (
                <tr key={row.id}><td>{row.damage_date}</td><td>{row.items?.name}</td><td>{row.quantity}</td><td>{money(row.estimated_cost)}</td><td>{row.reason}</td></tr>
              ))}
              {!damages.length ? <tr><td colSpan={5}>No damage records.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
