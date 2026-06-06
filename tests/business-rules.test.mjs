import assert from "node:assert/strict";
import test from "node:test";
import { businessDateISO } from "../src/lib/format.ts";
import {
  chequeBalanceEntry,
  projectedStockShortages,
  shouldBlockInvoiceDeleteForPayments
} from "../src/lib/business-rules.ts";

test("businessDateISO uses the Manila business date", () => {
  assert.equal(businessDateISO(new Date("2026-06-05T18:00:00.000Z")), "2026-06-06");
});

test("projectedStockShortages combines deltas before checking stock", () => {
  const shortages = projectedStockShortages(
    [{ item_id: "item-a", name: "Item A", current_quantity: 5 }],
    [
      { item_id: "item-a", quantity_delta: -8 },
      { item_id: "item-a", quantity_delta: 3 }
    ]
  );
  assert.equal(shortages.length, 0);
});

test("projectedStockShortages reports negative projected stock", () => {
  const shortages = projectedStockShortages(
    [{ item_id: "item-a", name: "Item A", current_quantity: 2 }],
    [{ item_id: "item-a", quantity_delta: -3 }]
  );
  assert.deepEqual(shortages[0], {
    item_id: "item-a",
    name: "Item A",
    current_quantity: 2,
    projected_quantity: -1
  });
});

test("chequeBalanceEntry reverses bounced cheque credits and reinstates restored cheques", () => {
  assert.deepEqual(chequeBalanceEntry("received", "bounced", 1200), {
    debit: 1200,
    credit: 0,
    entryType: "cheque_bounced"
  });
  assert.deepEqual(chequeBalanceEntry("bounced", "received", 1200), {
    debit: 0,
    credit: 1200,
    entryType: "cheque_reinstated"
  });
  assert.equal(chequeBalanceEntry("bounced", "cancelled", 1200), null);
});

test("invoice deletion is blocked when non-cash-sale payments are allocated", () => {
  assert.equal(
    shouldBlockInvoiceDeleteForPayments([{ amount: 500, payments: { method: "cash", reference: "MST-1" } }], "MST-1"),
    false
  );
  assert.equal(
    shouldBlockInvoiceDeleteForPayments([{ amount: 500, payments: { method: "bank", reference: "DEP-1" } }], "MST-1"),
    true
  );
});
