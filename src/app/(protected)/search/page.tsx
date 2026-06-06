import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { globalSearch } from "@/lib/data";
import { money } from "@/lib/format";

function relationName(value: unknown) {
  if (Array.isArray(value)) return String(value[0]?.name ?? "");
  if (value && typeof value === "object" && "name" in value) return String(value.name ?? "");
  return "";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q ?? "";
  const results = await globalSearch(q);

  return (
    <>
      <PageHeader title="Global Search" description="Find customers, suppliers, items, invoices, cheques, and receipt references." />
      <form className="mb-5 flex max-w-2xl gap-2">
        <input className="input" name="q" defaultValue={q} placeholder="Search name, SKU, invoice, cheque, reference..." />
        <button className="btn" type="submit">Search</button>
      </form>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card table-wrap"><table><thead><tr><th>Customers</th><th>Code</th><th>Open</th></tr></thead><tbody>{results.customers.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.account_code}</td><td><Link className="font-bold text-[color:var(--primary)]" href={`/customers/${row.id}`}>View</Link></td></tr>)}{!results.customers.length ? <tr><td colSpan={3}>No customers found.</td></tr> : null}</tbody></table></section>
        <section className="card table-wrap"><table><thead><tr><th>Suppliers</th><th>Contact</th><th>Open</th></tr></thead><tbody>{results.suppliers.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.contact_name ?? row.phone}</td><td><Link className="font-bold text-[color:var(--primary)]" href="/suppliers">View</Link></td></tr>)}{!results.suppliers.length ? <tr><td colSpan={3}>No suppliers found.</td></tr> : null}</tbody></table></section>
        <section className="card table-wrap"><table><thead><tr><th>Items</th><th>SKU</th><th>Stock</th></tr></thead><tbody>{results.items.map((row) => {
          const low = Number(row.reorder_level ?? 0) > 0 && Number(row.current_quantity ?? 0) <= Number(row.reorder_level ?? 0);
          return <tr key={row.id}><td><Link className="font-bold text-[color:var(--primary)]" href={`/inventory/${row.id}`}>{row.name}</Link></td><td>{row.sku}</td><td><StatusBadge tone={low ? "warning" : "good"}>{row.current_quantity ?? 0}</StatusBadge></td></tr>;
        })}{!results.items.length ? <tr><td colSpan={3}>No items found.</td></tr> : null}</tbody></table></section>
        <section className="card table-wrap"><table><thead><tr><th>Customer Invoices</th><th>Customer</th><th>Total</th></tr></thead><tbody>{results.invoices.map((row) => <tr key={row.id}><td><Link className="font-bold text-[color:var(--primary)]" href={`/invoices/${row.id}/print`}>{row.invoice_number}</Link></td><td>{relationName(row.customers)}</td><td>{money(row.total)}</td></tr>)}{!results.invoices.length ? <tr><td colSpan={3}>No invoices found.</td></tr> : null}</tbody></table></section>
        <section className="card table-wrap"><table><thead><tr><th>Supplier DR / Invoice</th><th>Supplier</th><th>Total</th></tr></thead><tbody>{results.supplierInvoices.map((row) => <tr key={row.id}><td><Link className="font-bold text-[color:var(--primary)]" href={`/suppliers/invoices/${row.id}`}>{row.supplier_invoice_number ?? String(row.id).slice(0, 8)}</Link></td><td>{row.supplier_name}</td><td>{money(row.total)}</td></tr>)}{!results.supplierInvoices.length ? <tr><td colSpan={3}>No supplier DR/invoice found.</td></tr> : null}</tbody></table></section>
        <section className="card table-wrap"><table><thead><tr><th>Cheques</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead><tbody>{results.cheques.map((row) => <tr key={row.id}><td>{row.cheque_number}</td><td>{relationName(row.customers)}</td><td><StatusBadge tone={row.status === "bounced" || row.status === "cancelled" ? "danger" : row.status === "redeemed" ? "good" : "warning"}>{row.status}</StatusBadge></td><td>{money(row.amount)}</td></tr>)}{!results.cheques.length ? <tr><td colSpan={4}>No cheques found.</td></tr> : null}</tbody></table></section>
        <section className="card table-wrap"><table><thead><tr><th>Payment Ref</th><th>Customer</th><th>Method</th><th>Amount</th></tr></thead><tbody>{results.payments.map((row) => <tr key={row.id}><td>{row.reference}</td><td>{relationName(row.customers)}</td><td>{row.method}</td><td>{money(row.amount)}</td></tr>)}{!results.payments.length ? <tr><td colSpan={4}>No payment references found.</td></tr> : null}</tbody></table></section>
      </div>
    </>
  );
}
