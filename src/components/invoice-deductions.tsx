"use client";

import { useCallback, useMemo, useState } from "react";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

type ItemOption = {
  id: string;
  name: string;
  sku?: string | null;
  default_price?: number | string | null;
};

type DeductionLine = {
  stockCondition: "good" | "bad";
  itemId: string;
  quantity: string;
  charge: string;
  reason: string;
};

type InitialDeductionLine = {
  type?: "return" | "damage" | string | null;
  item_id?: string | null;
  item_default_price?: number | string | null;
  quantity?: number | string | null;
  amount?: number | string | null;
  reason?: string | null;
};

const emptyLine = (): DeductionLine => ({
  stockCondition: "good",
  itemId: "",
  quantity: "",
  charge: "",
  reason: ""
});

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hydrateLine(line: InitialDeductionLine, itemPriceById: Map<string, number>): DeductionLine {
  const quantity = asNumber(line.quantity);
  const amount = asNumber(line.amount);
  const itemPrice = asNumber(line.item_default_price) || itemPriceById.get(line.item_id ?? "") || 0;
  const charge = quantity > 0 ? Math.max(0, amount / quantity - itemPrice) : amount;
  return {
    stockCondition: line.type === "damage" ? "bad" : "good",
    itemId: line.item_id ?? "",
    quantity: line.quantity === null || line.quantity === undefined ? "" : String(line.quantity),
    charge: charge ? String(Number(charge.toFixed(2))) : "",
    reason: line.reason ?? ""
  };
}

export function InvoiceDeductions({ items, initialLines }: { items: ItemOption[]; initialLines?: InitialDeductionLine[] }) {
  const itemPriceById = useMemo(() => new Map(items.map((item) => [item.id, asNumber(item.default_price)])), [items]);
  const [lines, setLines] = useState<DeductionLine[]>(() => initialLines?.length ? initialLines.map((line) => hydrateLine(line, itemPriceById)) : [emptyLine()]);
  const lineTotal = useCallback((line: DeductionLine) => {
    const quantity = Number(line.quantity || 0);
    const charge = Number(line.charge || 0);
    const unitPrice = itemPriceById.get(line.itemId) ?? 0;
    return quantity > 0 ? quantity * (unitPrice + charge) : charge;
  }, [itemPriceById]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines, lineTotal]);

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
            <tr><th>Stock</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Charge</th><th>Total Return</th><th>Reason</th><th>Action</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const unitPrice = itemPriceById.get(line.itemId) ?? 0;
              const returnTotal = lineTotal(line);
              return (
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
                <td>
                  <input className="input" value={unitPrice ? unitPrice.toFixed(2) : ""} readOnly aria-label="Return unit price" />
                  <input type="hidden" name="deduction_amount" value={returnTotal ? returnTotal.toFixed(2) : ""} />
                </td>
                <td><input className="input" name="deduction_charge" type="number" step="0.01" value={line.charge} onChange={(event) => updateLine(index, { charge: event.target.value })} /></td>
                <td className="font-bold">{money(returnTotal)}</td>
                <td><input className="input" name="deduction_reason" value={line.reason} onChange={(event) => updateLine(index, { reason: event.target.value })} /></td>
                <td>
                  <button className="btn btn-danger btn-secondary" type="button" onClick={() => removeLine(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            );})}
            <tr>
              <td colSpan={5} className="text-right font-bold">Total Returns</td>
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
