import Link from "next/link";
import { Plus } from "lucide-react";
import { createCustomer } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { listCustomers } from "@/lib/data";
import { money } from "@/lib/format";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const params = await searchParams;
  const customers = await listCustomers(params.q);

  return (
    <>
      <PageHeader title="Customers" description="Customer records, sub-balances, templates, and total running balance." />
      {params.error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{params.error}</p> : null}
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form action={createCustomer} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Add Customer</h3>
          <div className="field"><label>Name</label><input className="input" name="name" required /></div>
          <div className="field"><label>Account Code</label><input className="input" name="account_code" /></div>
          <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
          <div className="field"><label>Address</label><textarea className="input" name="address" rows={3} /></div>
          <div className="field"><label>Sub-balances</label><input className="input" name="subaccounts" placeholder="Main, Branch 1, Branch 2" /></div>
          <SubmitButton pendingText="Creating..."><Plus className="h-4 w-4" />Create</SubmitButton>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Balance</th><th>Open</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.customer_id}>
                  <td>{customer.name}</td>
                  <td>{money(customer.balance)}</td>
                  <td><Link className="font-bold text-[color:var(--primary)]" href={`/customers/${customer.customer_id}`}>View</Link></td>
                </tr>
              ))}
              {!customers.length ? <tr><td colSpan={3}>No customers yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
