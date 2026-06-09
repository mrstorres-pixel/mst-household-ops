"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

type ItemOption = {
  id: string;
  name: string;
  sku?: string | null;
  default_price?: number | string | null;
  current_quantity?: number | string | null;
  reorder_level?: number | string | null;
};

type Line = {
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type InitialLine = {
  item_id?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
};

const emptyLine = (index: number): Line => ({
  itemId: "",
  description: "",
  quantity: index === 0 ? "1" : "",
  unitPrice: ""
});

function hydrateLine(line: InitialLine): Line {
  return {
    itemId: line.item_id ?? "",
    description: line.description ?? "",
    quantity: line.quantity === null || line.quantity === undefined ? "" : String(line.quantity),
    unitPrice: line.unit_price === null || line.unit_price === undefined ? "" : String(line.unit_price)
  };
}

export function InvoiceLines({ items, initialLines, initialRowCount = 5 }: { items: ItemOption[]; initialLines?: InitialLine[]; initialRowCount?: number }) {
  const [lines, setLines] = useState<Line[]>(() => {
    if (initialLines?.length) return initialLines.map(hydrateLine);
    return Array.from({ length: initialRowCount }, (_, index) => emptyLine(index));
  });

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0),
    [lines]
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function selectItem(index: number, itemId: string) {
    const item = items.find((option) => option.id === itemId);
    updateLine(index, {
      itemId,
      description: item?.name ?? "",
      unitPrice: item?.default_price ? String(item.default_price) : ""
    });
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? [emptyLine(0)] : current.filter((_, lineIndex) => lineIndex !== index));
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] p-4">
        <div>
          <h3 className="text-xl font-bold">Invoice Items</h3>
          <p className="text-sm text-[color:var(--muted-foreground)]">Available stock is shown while encoding. Rows that exceed stock are blocked when posting.</p>
        </div>
        <StatusBadge tone={total > 0 ? "good" : "neutral"}>{money(total)}</StatusBadge>
      </div>
      <div className="table-wrap">
        <table className="min-w-[1040px]">
          <colgroup>
            <col className="w-28" />
            <col className="w-[22rem]" />
            <col className="w-36" />
            <col />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr><th>Qty</th><th>Item</th><th>Stock</th><th>Description</th><th>Unit Price</th><th>Total</th><th>Action</th></tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
              const selectedItem = items.find((item) => item.id === line.itemId);
              const available = Number(selectedItem?.current_quantity ?? 0);
              const quantity = Number(line.quantity || 0);
              const isShort = Boolean(selectedItem && quantity > available);
              return (
                <tr key={index}>
                  <td>
                    <input className="input text-right" name="quantity" type="number" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                  </td>
                  <td>
                    <select className="input" name="item_id" required={index === 0} value={line.itemId} onChange={(event) => selectItem(index, event.target.value)}>
                      <option value="">Select item</option>
                      {items.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.sku ?? "no SKU"}</option>)}
                    </select>
                  </td>
                  <td>
                    {selectedItem ? (
                      <div className="grid gap-1">
                        <StatusBadge tone={isShort ? "danger" : available <= Number(selectedItem.reorder_level ?? -1) ? "warning" : "good"}>
                          {available} available
                        </StatusBadge>
                        {isShort ? <span className="text-xs font-bold text-[color:var(--danger)]">Not enough stock</span> : null}
                      </div>
                    ) : "-"}
                  </td>
                  <td>
                    <input className="input" name="description" value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
                  </td>
                  <td>
                    <input className="input text-right" name="unit_price" type="number" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} />
                  </td>
                  <td className="text-right font-bold">{money(lineTotal)}</td>
                  <td>
                    <button className="btn btn-danger btn-secondary" type="button" onClick={() => removeLine(index)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="text-right font-bold">Invoice Total</td>
              <td className="font-bold">{money(total)}</td>
              <td />
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
