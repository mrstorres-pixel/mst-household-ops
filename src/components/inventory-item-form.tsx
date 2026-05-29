"use client";

import { useEffect, useMemo, useState } from "react";
import { createItem } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { normalizeSku } from "@/lib/sku";

type SupplierOption = {
  supplier_id: string;
  name: string;
};

export function InventoryItemForm({ suppliers }: { suppliers: SupplierOption[] }) {
  const [sku, setSku] = useState("");
  const [message, setMessage] = useState("");
  const normalizedSku = useMemo(() => normalizeSku(sku), [sku]);

  useEffect(() => {
    let cancelled = false;
    if (!normalizedSku) {
      window.setTimeout(() => {
        if (!cancelled) setMessage("");
      }, 0);
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/inventory/sku-check?sku=${encodeURIComponent(normalizedSku)}`);
      const result = await response.json();
      if (cancelled) return;

      if (!result.ok) {
        setMessage(result.message ?? "Could not check SKU.");
        return;
      }

      if (result.exists) {
        const state = result.item?.is_active ? "active" : "archived";
        setMessage(`SKU ${normalizedSku} is already used by ${state} item "${result.item?.name}".`);
      } else {
        setMessage(`SKU will save as ${normalizedSku}.`);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [normalizedSku]);

  return (
    <form action={createItem} className="card grid gap-4 p-5">
      <h3 className="text-xl font-bold">Add Item</h3>
      <p className="text-sm text-[color:var(--muted-foreground)]">
        SKUs are normalized to uppercase with single spaces. Duplicate active or archived SKUs are flagged before saving.
      </p>
      <div className="field"><label>Name</label><input className="input" name="name" required /></div>
      <div className="field">
        <label>SKU</label>
        <input className="input" name="sku" value={sku} onChange={(event) => setSku(event.target.value)} />
        {message ? <p className={`text-sm font-semibold ${message.includes("already used") ? "text-red-700" : "text-green-700"}`}>{message}</p> : null}
      </div>
      <div className="field">
        <label>Supplier</label>
        <select className="input" name="supplier_id">
          <option value="">No supplier</option>
          {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Category</label><input className="input" name="category" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field"><label>Default Price</label><input className="input" name="default_price" type="number" step="0.01" min="0" /></div>
        <div className="field"><label>Unit Cost</label><input className="input" name="unit_cost" type="number" step="0.01" min="0" /></div>
        <div className="field"><label>Quantity</label><input className="input" name="current_quantity" type="number" step="0.01" /></div>
        <div className="field"><label>Reorder</label><input className="input" name="reorder_level" type="number" step="0.01" min="0" /></div>
      </div>
      <SubmitButton pendingText="Saving item...">Save Item</SubmitButton>
    </form>
  );
}
