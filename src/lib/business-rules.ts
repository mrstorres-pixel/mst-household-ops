export type StockLevel = {
  item_id: string;
  name: string;
  current_quantity: number;
};

export type StockDelta = {
  item_id: string;
  quantity_delta: number;
};

export function projectedStockShortages(levels: StockLevel[], deltas: StockDelta[]) {
  const totals = new Map<string, number>();
  for (const delta of deltas) {
    totals.set(delta.item_id, (totals.get(delta.item_id) ?? 0) + Number(delta.quantity_delta ?? 0));
  }

  return levels
    .map((level) => {
      const current = Number(level.current_quantity ?? 0);
      const projected = current + (totals.get(level.item_id) ?? 0);
      return { ...level, projected_quantity: projected };
    })
    .filter((level) => level.projected_quantity < 0);
}

export function shouldBlockInvoiceDeleteForPayments(
  allocations: Array<{
    amount?: number | string | null;
    payments?: { method?: string | null; reference?: string | null } | Array<{ method?: string | null; reference?: string | null }> | null;
  }>,
  invoiceNumber: string
) {
  return allocations.some((allocation) => {
    const payment = Array.isArray(allocation.payments) ? allocation.payments[0] : allocation.payments;
    return !(payment?.method === "cash" && payment.reference === invoiceNumber);
  });
}

export function chequeBalanceEntry(previousStatus: string | null | undefined, nextStatus: string, amount: number) {
  const reversalStatuses = new Set(["bounced", "cancelled"]);
  const wasReversed = reversalStatuses.has(String(previousStatus ?? ""));
  const willBeReversed = reversalStatuses.has(nextStatus);
  if (!wasReversed && willBeReversed) return { debit: amount, credit: 0, entryType: `cheque_${nextStatus}` };
  if (wasReversed && !willBeReversed) return { debit: 0, credit: amount, entryType: "cheque_reinstated" };
  return null;
}
