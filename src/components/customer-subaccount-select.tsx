"use client";

import { useMemo, useState } from "react";

type CustomerOption = {
  id: string;
  name: string;
  customer_subaccounts?: Array<{ id: string; name: string }>;
};

export function CustomerSubaccountSelect({
  customers,
  initialCustomerId = "",
  initialSubaccountId = ""
}: {
  customers: CustomerOption[];
  initialCustomerId?: string | null;
  initialSubaccountId?: string | null;
}) {
  const fallbackCustomerId = initialCustomerId || customers[0]?.id || "";
  const [customerId, setCustomerId] = useState(fallbackCustomerId);
  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === customerId), [customerId, customers]);
  const subaccounts = selectedCustomer?.customer_subaccounts ?? [];
  const subaccountBelongsToCustomer = subaccounts.some((subaccount) => subaccount.id === initialSubaccountId);

  return (
    <>
      <div className="field">
        <label>Customer</label>
        <select className="input" name="customer_id" value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Sub-balance</label>
        <select className="input" name="subaccount_id" key={customerId} defaultValue={subaccountBelongsToCustomer ? initialSubaccountId ?? "" : ""}>
          <option value="">None</option>
          {subaccounts.map((subaccount) => <option key={subaccount.id} value={subaccount.id}>{subaccount.name}</option>)}
        </select>
      </div>
    </>
  );
}
