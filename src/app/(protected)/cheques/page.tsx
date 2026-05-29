import { updateChequeStatus } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { listCheques } from "@/lib/data";
import { money } from "@/lib/format";

export default async function ChequesPage() {
  const cheques = await listCheques();

  return (
    <>
      <PageHeader title="Cheques" description="Cheques remain received until the user marks them redeemed after bank confirmation." />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Received</th><th>Customer</th><th>Cheque</th><th>Bank</th><th>Amount</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            {cheques.map((cheque) => (
              <tr key={cheque.id}>
                <td>{cheque.received_date}</td>
                <td>{cheque.customers?.name}</td>
                <td>{cheque.cheque_number}</td>
                <td>{cheque.bank_name}</td>
                <td>{money(cheque.amount)}</td>
                <td>{cheque.status}</td>
                <td>
                  <form action={updateChequeStatus} className="flex gap-2">
                    <input type="hidden" name="cheque_id" value={cheque.id} />
                    <select className="input" name="status" defaultValue={cheque.status}>
                      <option value="received">Received</option>
                      <option value="redeemed">Redeemed</option>
                      <option value="bounced">Bounced</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button className="btn btn-secondary" type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
            {!cheques.length ? <tr><td colSpan={7}>No cheques yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
