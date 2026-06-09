import Link from "next/link";
import { deleteCheque, updateChequeStatus } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { listCheques } from "@/lib/data";
import { money } from "@/lib/format";

type ChequeStatus = "received" | "redeemed" | "bounced" | "cancelled";

function statusBadge(status: string) {
  const tone = status === "redeemed" ? "good" : status === "bounced" ? "danger" : status === "cancelled" ? "neutral" : "warning";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function StatusAction({ chequeId, status, children, className = "btn btn-secondary" }: { chequeId: string; status: ChequeStatus; children: React.ReactNode; className?: string }) {
  return (
    <form action={updateChequeStatus}>
      <input type="hidden" name="cheque_id" value={chequeId} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton className={className} pendingText="Saving...">{children}</SubmitButton>
    </form>
  );
}

export default async function ChequesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; status?: string; q?: string; date_from?: string; date_to?: string }> }) {
  const params = await searchParams;
  const cheques = await listCheques();
  const q = (params.q ?? "").trim().toLowerCase();
  const status = params.status ?? "all";
  const filtered = cheques.filter((cheque) => {
    const text = `${cheque.customers?.name ?? ""} ${cheque.cheque_number ?? ""} ${cheque.bank_name ?? ""}`.toLowerCase();
    const matchesSearch = !q || text.includes(q);
    const matchesStatus = status === "all" || cheque.status === status;
    const matchesFrom = !params.date_from || String(cheque.received_date ?? "") >= params.date_from;
    const matchesTo = !params.date_to || String(cheque.received_date ?? "") <= params.date_to;
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });
  const statusTotal = (target: ChequeStatus) => cheques.filter((cheque) => cheque.status === target).reduce((sum, cheque) => sum + Number(cheque.amount ?? 0), 0);
  const statusCount = (target: ChequeStatus) => cheques.filter((cheque) => cheque.status === target).length;

  return (
    <>
      <PageHeader title="Cheques" description="Track received cheques until bank confirmation, redemption, bounce, or cancellation." />
      <PageNotice error={params.error} success={params.success} />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        {(["received", "redeemed", "bounced", "cancelled"] as ChequeStatus[]).map((item) => (
          <div className="card p-4" key={item}>
            <p className="text-xs font-bold uppercase text-[color:var(--muted-foreground)]">{item}</p>
            <p className="mt-2 text-2xl font-bold">{money(statusTotal(item))}</p>
            <p className="text-sm text-[color:var(--muted-foreground)]">{statusCount(item)} cheque{statusCount(item) === 1 ? "" : "s"}</p>
          </div>
        ))}
      </section>

      <form data-save-filters="cheques" className="mb-5 grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-4 md:grid-cols-[minmax(180px,1.2fr)_minmax(150px,0.8fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)_auto_auto]">
        <div className="field">
          <label>Search</label>
          <input className="input" name="q" placeholder="Customer, cheque, bank" defaultValue={params.q ?? ""} />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="input" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="received">Received</option>
            <option value="redeemed">Redeemed</option>
            <option value="bounced">Bounced</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="field">
          <label>From</label>
          <input className="input" name="date_from" type="date" defaultValue={params.date_from ?? ""} />
        </div>
        <div className="field">
          <label>To</label>
          <input className="input" name="date_to" type="date" defaultValue={params.date_to ?? ""} />
        </div>
        <div className="flex items-end">
          <button className="btn w-full" type="submit">Filter</button>
        </div>
        <div className="flex items-end">
          <Link data-clear-saved-filter="cheques" className="btn btn-secondary w-full" href="/cheques">Clear</Link>
        </div>
      </form>

      <section className="card table-wrap">
        <div className="border-b border-[color:var(--border)] p-4">
          <h3 className="font-bold">Cheque Register</h3>
        </div>
        <table>
          <thead><tr><th>Received</th><th>Customer</th><th>Cheque</th><th>Bank</th><th>Amount</th><th>Status</th><th>Attachment</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((cheque) => (
              <tr key={cheque.id}>
                <td>{cheque.received_date}</td>
                <td><Link className="font-bold text-[color:var(--primary)]" href={`/customers/${cheque.customer_id}`}>{cheque.customers?.name}</Link></td>
                <td>{cheque.cheque_number ?? "-"}</td>
                <td>{cheque.bank_name ?? "-"}</td>
                <td className="font-bold">{money(cheque.amount)}</td>
                <td>{statusBadge(cheque.status)}</td>
                <td>{cheque.app_files?.id ? <a className="btn btn-secondary" href={`/attachments/${cheque.app_files.id}`} target="_blank">View</a> : "-"}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {cheque.status !== "redeemed" ? <StatusAction chequeId={cheque.id} status="redeemed">Mark Redeemed</StatusAction> : null}
                    {cheque.status !== "bounced" ? <StatusAction chequeId={cheque.id} status="bounced" className="btn btn-warning">Mark Bounced</StatusAction> : null}
                    {cheque.status !== "cancelled" ? <StatusAction chequeId={cheque.id} status="cancelled" className="btn btn-secondary">Cancel</StatusAction> : null}
                    <form action={deleteCheque}>
                      <input type="hidden" name="cheque_id" value={cheque.id} />
                      <ConfirmSubmitButton pendingText="Deleting..." title="Delete cheque record?" message="This removes the cheque tracking record. Use status changes for received, redeemed, bounced, or cancelled cheques when possible." confirmLabel="Delete Cheque">Delete</ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? <tr><td colSpan={8}>No cheques match these filters. Record cheque payments from the Payments page.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
