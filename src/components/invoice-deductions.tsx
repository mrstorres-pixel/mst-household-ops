"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

type ItemOption = {
  id: string;
  name: string;
  sku?: string | null;
};

type DeductionLine = {
  stockCondition: "good" | "bad";
  itemId: string;
  quantity: string;
  amount: string;
  reason: string;
};

type InitialDeductionLine = {
  type?: "return" | "damage" | string | null;
  item_id?: string | null;
  quantity?: number | string | null;
  amount?: number | string | null;
  reason?: string | null;
};

const emptyLine = (): DeductionLine => ({
  stockCondition: "good",
  itemId: "",
  quantity: "",
  amount: "",
  reason: ""
});

function hydrateLine(line: InitialDeductionLine): DeductionLine {
  return {
    stockCondition: line.type === "damage" ? "bad" : "good",
    itemId: line.item_id ?? "",
    quantity: line.quantity === null || line.quantity === undefined ? "" : String(line.quantity),
    amount: line.amount === null || line.amount === undefined ? "" : String(line.amount),
    reason: line.reason ?? ""
  };
}

export function InvoiceDeductions({ items, initialLines }: { items: ItemOption[]; initialLines?: InitialDeductionLine[] }) {
  const [lines, setLines] = useState<DeductionLine[]>(() => initialLines?.length ? initialLines.map(hydrateLine) : [emptyLine()]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0), [lines]);

  function updateLine(index: number, patch: Partial<DeductionLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? [emptyLine()] : current.filter((_, lineIndex) => lineIndex !== index));
  }

  return (
    <section className="card">
      <div className="border-b border-[color:var(--border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Returns</h3>
            <p className="text-sm text-[color:var(--muted-foreground)]">Good stock returns go back to sellable inventory. Bad stock is tracked as damage/supplier issue.</p>
          </div>
          <StatusBadge tone={total > 0 ? "warning" : "neutral"}>{money(total)}</StatusBadge>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Stock</th><th>Item</th><th>Qty</th><th>Deduction Amount</th><th>Reason</th><th>Action</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <input type="hidden" name="deduction_type" value={line.stockCondition === "good" ? "return" : "damage"} />
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      name="deduction_good_stock"
                      type="checkbox"
                      value="on"
                      checked={line.stockCondition === "good"}
                      onChange={(event) => updateLine(index, { stockCondition: event.target.checked ? "good" : "bad" })}
                    />
                    {line.stockCondition === "good" ? "Good stock" : "Bad stock"}
                  </label>
                  <p className="mt-1">
                    <StatusBadge tone={line.stockCondition === "good" ? "good" : "danger"}>
                      {line.stockCondition === "good" ? "Adds to stock" : "No stock add"}
                    </StatusBadge>
                  </p>
                </td>
                <td>
                  <select className="input" name="deduction_item_id" value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value })}>
                    <option value="">No item</option>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.sku ?? "no SKU"}</option>)}
                  </select>
                </td>
                <td><input className="input" name="deduction_quantity" type="number" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></td>
                <td><input className="input" name="deduction_amount" type="number" step="0.01" value={line.amount} onChange={(event) => updateLine(index, { amount: event.target.value })} /></td>
                <td><input className="input" name="deduction_reason" value={line.reason} onChange={(event) => updateLine(index, { reason: event.target.value })} /></td>
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
