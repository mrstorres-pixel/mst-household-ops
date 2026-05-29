import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/data";
import { money } from "@/lib/format";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInvoice(id);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl bg-white p-8">
      <div className="no-print mb-5 flex justify-end text-sm font-semibold text-[color:var(--muted-foreground)]">
        Use your browser print command to print or save this invoice.
      </div>
      <header className="flex justify-between border-b border-black pb-5">
        <div>
          <h1 className="text-3xl font-bold">MST Household</h1>
          <p>Merchandising Goods</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">Invoice</p>
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
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          {data.lines.map((line) => (
            <tr key={line.id}><td>{line.description}</td><td>{line.quantity}</td><td>{money(line.unit_price)}</td><td>{money(line.line_total)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 flex justify-end">
        <div className="w-64 border-t border-black pt-3 text-right">
          <p className="text-sm uppercase">Total Amount</p>
          <p className="text-3xl font-bold">{money(data.invoice.total)}</p>
        </div>
      </div>
    </main>
  );
}
