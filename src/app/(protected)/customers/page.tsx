import Link from "next/link";
import { CustomerBulkImportForm } from "@/components/customer-bulk-import-form";
import { CustomerCreateForm } from "@/components/customer-create-form";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { StatusBadge } from "@/components/status-badge";
import { listCustomerDirectory, type CustomerFilterStatus, type CustomerSortKey } from "@/lib/data";
import { money } from "@/lib/format";

type CustomerSearchParams = {
  q?: string;
  status?: CustomerFilterStatus;
  sort?: CustomerSortKey;
  dir?: "asc" | "desc";
  page?: string;
  pageSize?: string;
  error?: string;
  success?: string;
};

const statusOptions: Array<{ value: CustomerFilterStatus; label: string }> = [
  { value: "all", label: "All active" },
  { value: "with_balance", label: "With balance" },
  { value: "zero_balance", label: "Zero balance" },
  { value: "credit_balance", label: "Credit balance" }
];

function makeHref(params: CustomerSearchParams, updates: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !["error", "success"].includes(key)) next.set(key, String(value));
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `/customers?${query}` : "/customers";
}

function SortLink({ label, sortKey, params }: { label: string; sortKey: CustomerSortKey; params: CustomerSearchParams }) {
  const active = params.sort === sortKey || (!params.sort && sortKey === "name");
  const nextDir = active && params.dir !== "desc" ? "desc" : "asc";
  const marker = active ? (params.dir === "desc" ? " ↓" : " ↑") : "";
  return (
    <Link className="font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]" href={makeHref(params, { sort: sortKey, dir: nextDir, page: 1 })}>
      {label}{marker}
    </Link>
  );
}

function balanceBadge(balance: number) {
  if (balance > 0) return { label: "Receivable", tone: "warning" as const };
  if (balance < 0) return { label: "Credit", tone: "neutral" as const };
  return { label: "Clear", tone: "good" as const };
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<CustomerSearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize ?? 25)));
  const directory = await listCustomerDirectory({
    q: params.q,
    status: params.status ?? "all",
    sort: params.sort ?? "name",
    direction: params.dir ?? "asc",
    page,
    pageSize
  });
  const start = directory.total ? (directory.page - 1) * directory.pageSize + 1 : 0;
  const end = Math.min(directory.total, directory.page * directory.pageSize);
  const pageBalance = directory.customers.reduce((total, customer) => total + Number(customer.balance ?? 0), 0);

  return (
    <>
      <PageHeader title="Customers" description={`Showing ${start}-${end} of ${directory.total} customers. Page balance: ${money(pageBalance)}`} />
      <PageNotice error={params.error} success={params.success} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <form className="grid flex-1 gap-3 md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_110px_auto]">
          <input className="input" name="q" placeholder="Search customer name" defaultValue={params.q ?? ""} />
          <select className="input" name="status" defaultValue={params.status ?? "all"}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input" name="pageSize" defaultValue={String(pageSize)}>
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size}/page</option>)}
          </select>
          <button className="btn" type="submit">Filter</button>
        </form>
        <div className="flex gap-2">
          <CustomerBulkImportForm />
          <CustomerCreateForm />
        </div>
      </div>
      <section>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th><SortLink label="Customer" sortKey="name" params={params} /></th>
                <th>Status</th>
                <th><SortLink label="Balance" sortKey="balance" params={params} /></th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {directory.customers.map((customer) => {
                const balance = Number(customer.balance ?? 0);
                const badge = balanceBadge(balance);
                return (
                  <tr key={customer.customer_id}>
                    <td><Link className="font-bold text-[color:var(--primary)]" href={`/customers/${customer.customer_id}`}>{customer.name}</Link></td>
                    <td><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></td>
                    <td>{money(balance)}</td>
                    <td><Link className="font-bold text-[color:var(--primary)]" href={`/customers/${customer.customer_id}`}>View Details</Link></td>
                  </tr>
                );
              })}
              {!directory.customers.length ? <tr><td colSpan={4}>No customers match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--muted-foreground)]">Page {directory.page} of {directory.pageCount}</p>
          <div className="flex gap-2">
            <Link className="btn btn-secondary" href={makeHref(params, { page: Math.max(1, directory.page - 1) })}>Previous</Link>
            <Link className="btn btn-secondary" href={makeHref(params, { page: Math.min(directory.pageCount, directory.page + 1) })}>Next</Link>
          </div>
        </div>
      </section>
    </>
  );
}
