import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteCustomerInvoice } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getInvoice } from "@/lib/data";
import { money } from "@/lib/format";

export default async function PrintInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const data = await getInvoice(id);
  if (!data) notFound();
  const deductionsTotal = Number(data.invoice.returns_total ?? 0);
  const returnsOnly = query.print === "returns";
  const returnRows = data.deductions.length
    ? data.deductions
    : returnsOnly && deductionsTotal > 0
      ? [{
          type: "return",
          item_id: null,
          item_name: "Return items",
          quantity: null,
          unit_price: 0,
          charge: 0,
          amount: deductionsTotal,
          reason: "Detailed return items were not saved for this invoice.",
          sort_order: 0
        }]
      : [];

  return (
    <main className="mx-auto max-w-4xl bg-white p-8">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[color:var(--muted-foreground)]">
        <span>{returnsOnly ? "Use your browser print command to print or save only the return section." : "Use your browser print command to print or save this invoice."}</span>
        <div className="flex flex-wrap gap-2">
          {returnsOnly ? (
            <Link className="btn btn-secondary" href={`/invoices/${id}/print`}>Full Invoice</Link>
          ) : (
            <Link className="btn btn-secondary" href={`/invoices/${id}/print?print=returns`}>Print Returns Only</Link>
          )}
          <Link className="btn btn-secondary" href={`/invoices/${id}/edit`}>Edit Invoice</Link>
          <form action={deleteCustomerInvoice}>
            <input type="hidden" name="invoice_id" value={id} />
            <ConfirmSubmitButton pendingText="Deleting..." title="Delete invoice?" message="This removes the invoice, reverses related stock movement, and logs the deletion. Use this only for mistaken or duplicate invoices." confirmLabel="Delete Invoice">Delete Invoice</ConfirmSubmitButton>
          </form>
        </div>
      </div>
      <header className="flex justify-between border-b border-black pb-5">
        <div>
          <h1 className="text-3xl font-bold">MST Household</h1>
          <p>Merchandising Goods</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">{returnsOnly ? "Return Slip" : "Invoice"}</p>
          <p>{data.invoice.invoice_number}</p>
          <p>{data.invoice.invoice_date}</p>
        </div>
      </header>
      <section className="my-6">
        <p className="font-bold">Bill To</p>
        <p>{data.invoice.customers?.name}</p>
        <p>{data.invoice.customers?.address}</p>
        <p>{data.invoice.customers?.phone}</p>
        {data.invoice.app_files?.id ? (
          <p className="mt-3 no-print"><a className="font-bold text-[color:var(--primary)]" href={`/attachments/${data.invoice.app_files.id}`} target="_blank">View invoice attachment</a></p>
        ) : null}
      </section>
      {!returnsOnly ? (
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}><td>{line.description}</td><td>{line.quantity}</td><td>{money(line.unit_price)}</td><td>{money(line.line_total)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {returnRows.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-bold">Returns</h2>
          <table>
            <thead><tr><th>Stock</th><th>Item / Description</th><th>Qty</th><th>Unit Price</th><th>Charge</th><th>Deduction</th></tr></thead>
            <tbody>
              {returnRows.map((deduction, index) => (
                <tr key={`${deduction.type}-${deduction.item_id ?? "manual"}-${index}`}>
                  <td>{deduction.type === "damage" ? "Bad stock" : "Good stock"}</td>
                  <td>
                    <p>{deduction.item_name ?? deduction.reason}</p>
                    {deduction.item_name && deduction.reason ? <p className="text-sm text-[color:var(--muted-foreground)]">{deduction.reason}</p> : null}
                  </td>
                  <td>{Number(deduction.quantity ?? 0) || ""}</td>
                  <td>{Number(deduction.unit_price ?? 0) ? money(deduction.unit_price) : ""}</td>
                  <td>{Number(deduction.charge ?? 0) ? money(deduction.charge) : ""}</td>
                  <td>-{money(deduction.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <div className="mt-6 flex justify-end">
        <div className="w-72 border-t border-black pt-3 text-right">
          {returnsOnly ? (
            <div className="mb-3 grid gap-1 text-sm">
              <p className="flex justify-between gap-4"><span>Total returns</span><span>{money(deductionsTotal)}</span></p>
            </div>
          ) : deductionsTotal > 0 ? (
            <div className="mb-3 grid gap-1 text-sm">
              <p className="flex justify-between gap-4"><span>Subtotal</span><span>{money(data.invoice.subtotal)}</span></p>
              <p className="flex justify-between gap-4"><span>Return deductions</span><span>-{money(deductionsTotal)}</span></p>
            </div>
          ) : null}
          <p className="text-sm uppercase">{returnsOnly ? "Return Amount" : "Total Amount"}</p>
          <p className="text-3xl font-bold">{money(returnsOnly ? deductionsTotal : data.invoice.total)}</p>
        </div>
      </div>
    </main>
  );
}
