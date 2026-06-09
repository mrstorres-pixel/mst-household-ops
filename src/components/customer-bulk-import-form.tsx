"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { bulkImportCustomers } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function CustomerBulkImportForm() {
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
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-customer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <h3 id="bulk-customer-title" className="text-xl font-bold">Bulk Import Customers</h3>
                <p className="text-sm text-[color:var(--muted-foreground)]">Paste one customer name per line. Existing exact-name matches are skipped.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)} aria-label="Close bulk import window">
                Close
              </button>
            </div>
            <form action={bulkImportCustomers} className="grid gap-4 p-5">
              <div className="field">
                <label>Customer Names</label>
                <textarea className="input min-h-80" name="names" autoFocus required />
              </div>
              <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-4">
                <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
                <SubmitButton pendingText="Importing...">Import Customers</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
