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
  const [isOpen, setIsOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [message, setMessage] = useState("");
  const normalizedSku = useMemo(() => normalizeSku(sku), [sku]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

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
    <>
      <button className="btn" type="button" onClick={() => setIsOpen(true)}>
        Add Item
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-item-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <h3 id="add-item-title" className="text-xl font-bold">Add Item</h3>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  SKUs are checked before saving.
                </p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)} aria-label="Close add item window">
                Close
              </button>
            </div>
            <form action={createItem} className="grid gap-4 p-5">
              <div className="field"><label>Name</label><input className="input" name="name" autoFocus required /></div>
              <div className="field">
                <label>SKU</label>
                <input className="input" name="sku" value={sku} onChange={(event) => setSku(event.target.value)} />
                {message ? <p className={`text-sm font-semibold ${message.includes("already used") ? "text-[color:var(--danger-strong)]" : "text-[color:var(--success-strong)]"}`}>{message}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="field">
                  <label>Supplier</label>
                  <select className="input" name="supplier_id">
                    <option value="">No supplier</option>
                    {suppliers.map((supplier) => <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Category</label><input className="input" name="category" /></div>
                <div className="field"><label>Default Price</label><input className="input" name="default_price" type="number" step="0.01" min="0" /></div>
                <div className="field"><label>Unit Cost</label><input className="input" name="unit_cost" type="number" step="0.01" min="0" /></div>
                <div className="field"><label>Quantity</label><input className="input" name="current_quantity" type="number" step="0.01" min="0" /></div>
                <div className="field"><label>Reorder</label><input className="input" name="reorder_level" type="number" step="0.01" min="0" /></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-4">
                <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
                <SubmitButton pendingText="Saving item...">Save Item</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
