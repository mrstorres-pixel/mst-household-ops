"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";

type ItemOption = {
  id: string;
  name: string;
  sku?: string | null;
  unit_cost?: number | string | null;
};

type Line = {
  itemId: string;
  quantity: string;
  unitCost: string;
};

const emptyLine = (index: number): Line => ({
  itemId: "",
  quantity: index === 0 ? "1" : "",
  unitCost: ""
});

export function SupplierInvoiceLines({ items }: { items: ItemOption[] }) {
  const [lines, setLines] = useState<Line[]>(Array.from({ length: 5 }, (_, index) => emptyLine(index)));

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0),
    [lines]
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((option) => option.id === itemId);
    updateLine(index, {
      itemId,
      unitCost: item?.unit_cost ? String(item.unit_cost) : ""
    });
  }

  return (
    <section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Qty</th><th>Item</th><th>Unit Cost</th><th>Total</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineTotal = Number(line.quantity || 0) * Number(line.unitCost || 0);
              return (
                <tr key={index}>
                  <td>
                    <input className="input" name="quantity" type="number" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                  </td>
                  <td>
                    <select className="input" name="item_id" required={index === 0} value={line.itemId} onChange={(event) => selectItem(index, event.target.value)}>
                      <option value="">Select item</option>
                      {items.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.sku ?? "no SKU"}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="input" name="unit_cost" type="number" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} />
                  </td>
                  <td className="font-bold">{money(lineTotal)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3} className="text-right font-bold">Supplier Invoice Total</td>
              <td className="font-bold">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="p-4">
        <button className="btn btn-secondary" type="button" onClick={() => setLines((current) => [...current, emptyLine(current.length)])}>
          Add another item
        </button>
      </div>
    </section>
  );
}
