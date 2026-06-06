"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";

type ItemOption = {
  id: string;
  name: string;
  sku?: string | null;
};

type DeductionLine = {
  id: string;
  type: "return" | "damage" | "credit";
  itemId: string;
  quantity: string;
  amount: string;
  reason: string;
};

type InitialDeductionLine = {
  id?: string | null;
  adjustment_type?: "return" | "damage" | "credit" | string | null;
  item_id?: string | null;
  quantity?: number | string | null;
  amount?: number | string | null;
  reason?: string | null;
};

const emptyLine = (): DeductionLine => ({
  id: "",
  type: "return",
  itemId: "",
  quantity: "",
  amount: "",
  reason: ""
});

function hydrateLine(line: InitialDeductionLine): DeductionLine {
  const type = line.adjustment_type === "damage" || line.adjustment_type === "credit" ? line.adjustment_type : "return";
  return {
    id: line.id ?? "",
    type,
    itemId: line.item_id ?? "",
    quantity: line.quantity === null || line.quantity === undefined ? "" : String(line.quantity),
    amount: line.amount === null || line.amount === undefined ? "" : String(line.amount),
    reason: line.reason ?? ""
  };
}

export function SupplierInvoiceDeductions({ items, initialLines }: { items: ItemOption[]; initialLines?: InitialDeductionLine[] }) {
  const [lines, setLines] = useState<DeductionLine[]>(() => initialLines?.length ? initialLines.map(hydrateLine) : [emptyLine()]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0), [lines]);

  function updateLine(index: number, patch: Partial<DeductionLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? [emptyLine()] : current.filter((_, lineIndex) => lineIndex !== index));
  }

  return (
    <section className="border-t border-[color:var(--border)] pt-4">
      <div className="mb-3">
        <h4 className="font-bold">Supplier Returns / Damage / Credits</h4>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Type</th><th>Item</th><th>Qty</th><th>Deduction Amount</th><th>Reason</th><th>Action</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <input type="hidden" name="supplier_deduction_id" value={line.id} />
                  <select className="input" name="supplier_deduction_type" value={line.type} onChange={(event) => updateLine(index, { type: event.target.value as DeductionLine["type"] })}>
                    <option value="return">Return</option>
                    <option value="damage">Damage</option>
                    <option value="credit">Credit</option>
                  </select>
                </td>
                <td>
                  <select className="input" name="supplier_deduction_item_id" value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value })}>
                    <option value="">No item</option>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.sku ?? "no SKU"}</option>)}
                  </select>
                </td>
                <td><input className="input" name="supplier_deduction_quantity" type="number" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></td>
                <td><input className="input" name="supplier_deduction_amount" type="number" step="0.01" value={line.amount} onChange={(event) => updateLine(index, { amount: event.target.value })} /></td>
                <td><input className="input" name="supplier_deduction_reason" value={line.reason} onChange={(event) => updateLine(index, { reason: event.target.value })} /></td>
                <td>
                  <button className="btn btn-danger btn-secondary" type="button" onClick={() => removeLine(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="text-right font-bold">Total Deductions</td>
              <td className="font-bold">{money(total)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4">
        <button className="btn btn-secondary" type="button" onClick={() => setLines((current) => [...current, emptyLine()])}>
          Add deduction
        </button>
      </div>
    </section>
  );
}
