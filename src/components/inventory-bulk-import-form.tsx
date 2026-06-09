"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { bulkImportInventoryItems } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function InventoryBulkImportForm() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(true)}>
        <Upload className="h-4 w-4" /> Bulk Import
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-inventory-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <h3 id="bulk-inventory-title" className="text-xl font-bold">Bulk Import Inventory</h3>
                <p className="text-sm text-[color:var(--muted-foreground)]">Paste one item per line. Missing SKU, cost, price, or quantity can be left blank.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)} aria-label="Close bulk import window">
                Close
              </button>
            </div>
            <form action={bulkImportInventoryItems} className="grid gap-4 p-5">
              <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)] p-3 text-sm text-[color:var(--muted-foreground)]">
                <p className="font-bold text-[color:var(--foreground)]">Supported formats</p>
                <p><code>BRAND - SKU - ITEM NAME | CAPITAL | PRICE | QTY | CATEGORY</code></p>
                <p><code>ITEM NAME | CAPITAL | PRICE | QTY | CATEGORY</code></p>
                <p><code>ITEM NAME | SKU | CAPITAL | PRICE | QTY | CATEGORY | SUPPLIER</code></p>
              </div>
              <div className="field">
                <label>Inventory Rows</label>
                <textarea
                  className="input min-h-96 font-mono text-sm"
                  name="items"
                  autoFocus
                  placeholder={"MICROMATIC - MAP 208B - MICROMATIC ITEM | 850 | 1200 | 5 | ELECTRIC FAN\nTRIFOLD MAKAPAL 36 | 1000 | 1400 | 2 | FOAM\nTRIFOLD MAKAPAL 48 | | 1600 | 1"}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-4">
                <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
                <SubmitButton pendingText="Importing...">Import Inventory</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
