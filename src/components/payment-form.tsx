"use client";

import { useMemo, useState } from "react";
import { recordPayment } from "@/app/actions";
import { money, todayISO } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

type OpenInvoiceOption = {
  invoice_id: string;
  customer_id: string;
  invoice_number: string;
  remaining_balance: number | string;
  customers?: { name?: string | null } | null;
};

type PaymentMethod = "cash" | "bank" | "cheque";

const methodCopy: Record<PaymentMethod, { title: string; reference: string; attachment: string }> = {
  cash: {
    title: "Cash Payment",
    reference: "Receipt Reference",
    attachment: "Receipt Image"
  },
  bank: {
    title: "Bank Payment",
    reference: "Bank Reference",
    attachment: "Bank Receipt Image"
  },
  cheque: {
    title: "Cheque Payment",
    reference: "Cheque Number",
    attachment: "Cheque Image"
  }
};

export function PaymentForm({ customers, openInvoices }: { customers: CustomerOption[]; openInvoices: OpenInvoiceOption[] }) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const filteredInvoices = useMemo(
    () => openInvoices.filter((invoice) => !customerId || invoice.customer_id === customerId),
    [customerId, openInvoices]
  );
  const copy = methodCopy[method];

  return (
    <form action={recordPayment} className="card grid gap-4 p-5">
      <input type="hidden" name="method" value={method} />
      <div className="border-b border-[color:var(--border)] pb-4">
        <h3 className="text-xl font-bold">Record Payment</h3>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{copy.title}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["cash", "bank", "cheque"] as PaymentMethod[]).map((option) => (
          <button
            key={option}
            className={method === option ? "btn" : "btn btn-secondary"}
            type="button"
            onClick={() => setMethod(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="field">
          <label>Customer</label>
          <select className="input" name="customer_id" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Sub-balance</label>
          <select className="input" name="subaccount_id">
            <option value="">Main balance</option>
            {(selectedCustomer?.customer_subaccounts ?? []).map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Apply To Invoice</label>
        <select className="input" name="invoice_id">
          <option value="">Reduce total balance only</option>
          {filteredInvoices.map((invoice) => (
            <option key={invoice.invoice_id} value={invoice.invoice_id}>
              {invoice.invoice_number} - remaining {money(invoice.remaining_balance)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label>Amount</label>
          <input className="input" name="amount" type="number" step="0.01" required />
        </div>
        <div className="field">
          <label>Allocate Amount</label>
          <input className="input" name="allocation_amount" type="number" step="0.01" placeholder="Defaults to amount" />
        </div>
        <div className="field">
          <label>Date</label>
          <input className="input" name="payment_date" type="date" defaultValue={todayISO()} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="field">
          <label>{copy.reference}</label>
          <input className="input" name="reference" required={method === "cheque"} />
        </div>
        {method !== "cash" ? (
          <div className="field">
            <label>Bank Name</label>
            <input className="input" name="bank_name" required={method === "cheque"} />
          </div>
        ) : null}
      </div>

      {method !== "cash" ? (
        <div className="field">
          <label>{copy.attachment}</label>
          <input className="input" name="attachment" type="file" accept="image/*,.pdf" capture="environment" />
        </div>
      ) : null}

      <div className="field">
        <label>Notes</label>
        <textarea className="input" name="notes" rows={2} />
      </div>
      <SubmitButton pendingText="Posting payment...">Post {copy.title}</SubmitButton>
    </form>
  );
}
