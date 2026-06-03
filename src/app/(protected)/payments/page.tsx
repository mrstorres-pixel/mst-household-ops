import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { PaymentForm } from "@/components/payment-form";
import { listCustomerRows, listOpenInvoices, listPayments } from "@/lib/data";
import { money } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

function methodBadge(method: string) {
  const styles: Record<string, string> = {
    cash: "border-green-200 bg-green-50 text-green-800",
    bank: "border-blue-200 bg-blue-50 text-blue-800",
    cheque: "border-amber-200 bg-amber-50 text-amber-800"
  };
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold uppercase ${styles[method] ?? "border-[color:var(--border)] bg-[color:var(--muted)]"}`}>{method}</span>;
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  const [customerRows, payments, openInvoices] = await Promise.all([listCustomerRows(), listPayments(), listOpenInvoices()]);
  const customers = customerRows as CustomerOption[];
  const paymentTotal = payments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const cashTotal = payments.filter((row) => row.method === "cash").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const bankTotal = payments.filter((row) => row.method === "bank").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const chequeTotal = payments.filter((row) => row.method === "cheque").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
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

        <section className="card table-wrap">
          <div className="border-b border-[color:var(--border)] p-4">
            <h3 className="font-bold">Recent Payment History</h3>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Amount</th><th>Applied Invoice</th><th>Attachment</th><th>Reference</th></tr></thead>
            <tbody>
              {payments.map((payment) => {
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
              {!payments.length ? <tr><td colSpan={7}>No payments yet. Use the payment form to record the first cash, bank, or cheque payment.</td></tr> : null}
            </tbody>
          </table>
        </section>
      </section>
    </>
  );
}
