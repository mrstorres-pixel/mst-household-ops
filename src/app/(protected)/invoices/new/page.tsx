import { createInvoice } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { listCustomerRows, listItems } from "@/lib/data";
import { todayISO } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

export default async function NewInvoicePage() {
  const [customerRows, items] = await Promise.all([listCustomerRows(), listItems()]);
  const customers = customerRows as CustomerOption[];

  return (
    <>
      <PageHeader title="New Invoice" description="Post itemized sales to customer balances and inventory movements." />
      <form action={createInvoice} className="grid gap-5">
        <section className="card grid gap-4 p-5 md:grid-cols-3">
          <div className="field">
            <label>Customer</label>
            <select className="input" name="customer_id" required>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sub-balance</label>
            <select className="input" name="subaccount_id">
              <option value="">None</option>
              {customers.flatMap((customer) => (customer.customer_subaccounts ?? []).map((sub) => (
                <option key={sub.id} value={sub.id}>{customer.name}: {sub.name}</option>
              )))}
            </select>
          </div>
          <div className="field">
            <label>Invoice Date</label>
            <input className="input" name="invoice_date" type="date" defaultValue={todayISO()} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-3">
            <input name="cash_sale" type="checkbox" />
            Count this invoice as physical in-store cash sale
          </label>
          <div className="field md:col-span-3">
            <label>Notes</label>
            <textarea className="input" name="notes" rows={2} />
          </div>
        </section>

        <section className="card table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th></tr></thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((index) => (
                <tr key={index}>
                  <td>
                    <select className="input" name="item_id" required={index === 0}>
                      <option value="">Select item</option>
                      {items.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.sku ?? "no SKU"}</option>)}
                    </select>
                  </td>
                  <td><input className="input" name="description" placeholder="Description" /></td>
                  <td><input className="input" name="quantity" type="number" step="0.01" defaultValue={index === 0 ? "1" : ""} /></td>
                  <td><input className="input" name="unit_price" type="number" step="0.01" defaultValue="" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div><button className="btn" type="submit">Post and Print Invoice</button></div>
      </form>
    </>
  );
}
