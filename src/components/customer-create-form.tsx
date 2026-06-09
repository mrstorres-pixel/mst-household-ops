"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createCustomer } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function CustomerCreateForm() {
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
      <button className="btn" type="button" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" /> Add Customer
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-customer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
              <div>
                <h3 id="add-customer-title" className="text-xl font-bold">Add Customer</h3>
                <p className="text-sm text-[color:var(--muted-foreground)]">Create the account and optional sub-balances.</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)} aria-label="Close add customer window">
                Close
              </button>
            </div>
            <form action={createCustomer} className="grid gap-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="field md:col-span-2"><label>Name</label><input className="input" name="name" autoFocus required /></div>
                <div className="field"><label>Account Code</label><input className="input" name="account_code" /></div>
                <div className="field"><label>Phone</label><input className="input" name="phone" /></div>
                <div className="field md:col-span-2"><label>Address</label><textarea className="input" name="address" rows={3} /></div>
                <div className="field md:col-span-2"><label>Sub-balances</label><input className="input" name="subaccounts" placeholder="Main, Branch 1, Branch 2" /></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-4">
                <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(false)}>Cancel</button>
                <SubmitButton pendingText="Creating...">Create Customer</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
