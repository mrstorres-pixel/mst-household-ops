import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { PaymentForm } from "@/components/payment-form";
import { StatusBadge } from "@/components/status-badge";
import { listCustomerRows, listOpenInvoices, listPayments } from "@/lib/data";
import { money } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

function methodBadge(method: string) {
  const tone = method === "cash" ? "good" : method === "cheque" ? "warning" : "neutral";
  return <StatusBadge tone={tone}>{method}</StatusBadge>;
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; method?: string; date_from?: string; date_to?: string }> }) {
  const params = await searchParams;
  const [customerRows, payments, openInvoices] = await Promise.all([listCustomerRows(), listPayments(), listOpenInvoices()]);
  const customers = customerRows as CustomerOption[];
  const q = (params.q ?? "").trim().toLowerCase();
  const method = params.method ?? "all";
  const filteredPayments = payments.filter((payment) => {
    const haystack = `${payment.customers?.name ?? ""} ${payment.reference ?? ""} ${payment.method ?? ""}`.toLowerCase();
    const matchesSearch = !q || haystack.includes(q);
    const matchesMethod = method === "all" || payment.method === method;
    const matchesFrom = !params.date_from || String(payment.payment_date ?? "") >= params.date_from;
    const matchesTo = !params.date_to || String(payment.payment_date ?? "") <= params.date_to;
    return matchesSearch && matchesMethod && matchesFrom && matchesTo;
  });
  const paymentTotal = filteredPayments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const cashTotal = filteredPayments.filter((row) => row.method === "cash").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const bankTotal = filteredPayments.filter((row) => row.method === "bank").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const chequeTotal = filteredPayments.filter((row) => row.method === "cheque").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const openInvoiceTotal = openInvoices.reduce((sum, row) => sum + Number(row.remaining_balance ?? 0), 0);

  return (
    <>
      <PageHeader title="Payments" description="Record cash, bank, and cheque payments against customer balances." />
      <PageNotice error={params.error} success={params.success} />

      <section className="mb-5 grid gap-3 md:grid-cols-5">
        <div className="card p-4"><p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Recent Payments</p><p className="mt-2 text-2xl font-bold">{money(paymentTotal)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Cash</p><p className="mt-2 text-2xl font-bold">{money(cashTotal)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Bank</p><p className="mt-2 text-2xl font-bold">{money(bankTotal)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Cheque</p><p className="mt-2 text-2xl font-bold">{money(chequeTotal)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">Open Invoices</p><p className="mt-2 text-2xl font-bold">{money(openInvoiceTotal)}</p></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <PaymentForm customers={customers} openInvoices={openInvoices} />

        <div className="grid content-start gap-5">
          <form className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-white p-4 md:grid-cols-[minmax(180px,1fr)_140px_140px_140px_auto]">
            <div className="field">
              <label>Search</label>
              <input className="input" name="q" defaultValue={params.q ?? ""} placeholder="Customer or reference" />
            </div>
            <div className="field">
              <label>Method</label>
              <select className="input" name="method" defaultValue={method}>
                <option value="all">All</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="field"><label>From</label><input className="input" name="date_from" type="date" defaultValue={params.date_from ?? ""} /></div>
            <div className="field"><label>To</label><input className="input" name="date_to" type="date" defaultValue={params.date_to ?? ""} /></div>
            <div className="flex items-end"><button className="btn w-full" type="submit">Filter</button></div>
          </form>

          <section className="card table-wrap">
            <div className="border-b border-[color:var(--border)] p-4">
              <h3 className="font-bold">Payment History</h3>
            </div>
            <table>
              <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Amount</th><th>Applied Invoice</th><th>Attachment</th><th>Reference</th></tr></thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const allocation = payment.payment_allocations?.[0];
                  return (
                    <tr key={payment.id}>
                      <td>{payment.payment_date}</td>
                      <td><Link className="font-bold text-[color:var(--primary)]" href={`/customers/${payment.customer_id}`}>{payment.customers?.name}</Link></td>
                      <td>{methodBadge(payment.method)}</td>
                      <td className="font-bold">{money(payment.amount)}</td>
                      <td>{allocation?.invoices?.invoice_number ? `${allocation.invoices.invoice_number} - ${money(allocation.amount)}` : "Total balance"}</td>
                      <td>{payment.app_files?.id ? <a className="btn btn-secondary" href={`/attachments/${payment.app_files.id}`} target="_blank">View</a> : "-"}</td>
                      <td>{payment.reference ?? "-"}</td>
                    </tr>
                  );
                })}
                {!filteredPayments.length ? <tr><td colSpan={7}>No payments match these filters.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </>
  );
}
