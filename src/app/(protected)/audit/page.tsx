import { PageHeader } from "@/components/page-header";
import { listAuditLogs } from "@/lib/data";

export default async function AuditPage() {
  const logs = await listAuditLogs();

  return (
    <>
      <PageHeader title="Audit Log" description="Tracks important creates, edits, deletes, and status changes." />
      <section className="card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Record</th><th>Summary</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.actor_email ?? "-"}</td>
                <td>{log.action}</td>
                <td>{log.entity_type}</td>
                <td>{log.summary}</td>
              </tr>
            ))}
            {!logs.length ? <tr><td colSpan={5}>No audit activity yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
