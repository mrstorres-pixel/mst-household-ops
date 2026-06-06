import { unstable_noStore as noStore } from "next/cache";
import { hasSupabaseEnv } from "@/lib/config";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type Row = Record<string, unknown>;

function isMissingColumnError(error: { message?: string; code?: string; details?: string } | null) {
  const message = [error?.message, error?.details, error?.code].filter(Boolean).join(" ").toLowerCase();
  return error?.code === "PGRST204" || message.includes("schema cache") || (message.includes("column") && message.includes("does not exist"));
}

export type InventorySortKey = "name" | "sku" | "supplier" | "category" | "quantity" | "price" | "cost" | "value";
export type InventoryFilterStatus = "all" | "in_stock" | "low_stock" | "out_of_stock" | "missing_sku" | "no_supplier" | "no_category" | "missing_cost";
export type CustomerSortKey = "name" | "balance";
export type CustomerFilterStatus = "all" | "with_balance" | "zero_balance" | "credit_balance";

export type InventoryListOptions = {
  q?: string;
  categoryId?: string;
  supplierId?: string;
  status?: InventoryFilterStatus;
  sort?: InventorySortKey;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type CustomerDirectoryOptions = {
  q?: string;
  status?: CustomerFilterStatus;
  sort?: CustomerSortKey;
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type SupplierInvoiceSummary = {
  [key: string]: unknown;
  id: string;
  supplier_id: string;
  supplier_invoice_number?: string | null;
  order_date: string;
  total: number;
  line_count: number;
  item_names: unknown[];
  items?: { name?: string | null; sku?: string | null };
  suppliers?: { name?: string | null };
};

function groupSupplierInvoiceRows(rows: Row[]) {
  const grouped = new Map<string, SupplierInvoiceSummary>();
  for (const row of rows) {
    const invoiceNumber = String(row.supplier_invoice_number ?? "").trim();
    const key = invoiceNumber ? `${row.supplier_id}:${invoiceNumber}` : String(row.id);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...row,
        id: String(row.id),
        supplier_id: String(row.supplier_id),
        order_date: String(row.order_date ?? ""),
        total: Number(row.total ?? 0),
        line_count: 1,
        item_names: [(row.items as Row | null | undefined)?.name].filter(Boolean)
      });
      continue;
    }

    existing.total = Number(existing.total ?? 0) + Number(row.total ?? 0);
    existing.line_count = Number(existing.line_count ?? 1) + 1;
    existing.order_date = String(row.order_date ?? "") > String(existing.order_date ?? "") ? String(row.order_date ?? "") : existing.order_date;
    const rawItemName = (row.items as Row | null | undefined)?.name;
    const itemName = rawItemName ? String(rawItemName) : null;
    if (itemName && Array.isArray(existing.item_names) && !existing.item_names.includes(itemName)) {
      existing.item_names.push(itemName);
    }
    existing.items = {
      name: Number(existing.line_count ?? 1) > 1 ? `${existing.line_count} items` : itemName ?? String((existing.items as Row | null | undefined)?.name ?? ""),
      sku: null
    };
  }

  return Array.from(grouped.values()).sort((first, second) => String(second.order_date ?? "").localeCompare(String(first.order_date ?? "")));
}

export async function getProfile() {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (existing) return existing;

  const { data: countRows } = await supabase.from("profiles").select("id").limit(1);
  const role = countRows?.length ? "staff" : "admin";
  const { data } = await supabase
    .from("profiles")
    .insert({
      id: userData.user.id,
      email: userData.user.email ?? "",
      role
    })
    .select("*")
    .maybeSingle();

  return data ?? { id: userData.user.id, email: userData.user.email, role, full_name: "" };
}

export async function listCustomers(search?: string) {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  let query = supabase.from("customer_balances").select("*").order("name");
  if (search) query = query.ilike("name", `%${search}%`);
  const { data } = await query;
  return data ?? [];
}

export async function listCustomerDirectory(options: CustomerDirectoryOptions = {}) {
  noStore();
  const page = Math.max(1, Number(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(options.pageSize ?? 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const direction = options.direction === "desc" ? "desc" : "asc";

  if (!hasSupabaseEnv()) {
    return { customers: [], total: 0, page, pageSize, pageCount: 1 };
  }

  const supabase = await createClient();
  let query = supabase.from("customer_balances").select("*", { count: "exact" });
  if (options.q) query = query.ilike("name", `%${options.q}%`);

  switch (options.status) {
    case "with_balance":
      query = query.gt("balance", 0);
      break;
    case "zero_balance":
      query = query.eq("balance", 0);
      break;
    case "credit_balance":
      query = query.lt("balance", 0);
      break;
  }

  if (options.sort === "balance") {
    query = query.order("balance", { ascending: direction === "asc" }).order("name");
  } else {
    query = query.order("name", { ascending: direction === "asc" });
  }

  const { data, count } = await query.range(from, to);
  const customers = data ?? [];
  const total = count ?? customers.length;
  return { customers, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomer(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const [{ data: customer }, { data: subaccounts }, { data: template }, { data: ledger }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("customer_subaccount_balances").select("*").eq("customer_id", id).order("name"),
    supabase
      .from("customer_item_templates")
      .select("*, items(name, sku, default_price)")
      .eq("customer_id", id)
      .order("created_at"),
    supabase
      .from("customer_ledger_entries")
      .select("*")
      .eq("customer_id", id)
      .order("entry_date", { ascending: false })
      .limit(50),
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total, status")
      .eq("customer_id", id)
      .order("invoice_date", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("payment_date, method, amount, reference")
      .eq("customer_id", id)
      .order("payment_date", { ascending: false })
      .limit(20)
  ]);
  return { customer, subaccounts: subaccounts ?? [], template: template ?? [], ledger: ledger ?? [], invoices: invoices ?? [], payments: payments ?? [] };
}

export async function listItems(search?: string) {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("*, categories(name), suppliers(name)")
    .eq("is_active", true)
    .order("name");
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  const { data } = await query;
  return data ?? [];
}

export async function listArchivedItems(search?: string) {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("*, categories(name), suppliers(name)")
    .eq("is_active", false)
    .order("name");
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  const { data } = await query;
  return data ?? [];
}

export async function listInventoryItems(options: InventoryListOptions = {}) {
  noStore();
  const page = Math.max(1, Number(options.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(options.pageSize ?? 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = options.sort ?? "name";
  const direction = options.direction === "desc" ? "desc" : "asc";
  const pageInMemory = sort === "value" || options.status === "low_stock";

  if (!hasSupabaseEnv()) {
    return { items: [], total: 0, page, pageSize, pageCount: 1 };
  }

  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("*, categories(name), suppliers(name)", { count: "exact" })
    .eq("is_active", true);

  if (options.q) query = query.or(`name.ilike.%${options.q}%,sku.ilike.%${options.q}%`);
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.supplierId) query = query.eq("primary_supplier_id", options.supplierId);

  switch (options.status) {
    case "in_stock":
      query = query.gt("current_quantity", 0);
      break;
    case "out_of_stock":
      query = query.lte("current_quantity", 0);
      break;
    case "missing_sku":
      query = query.or("sku.is.null,sku.eq.");
      break;
    case "no_supplier":
      query = query.is("primary_supplier_id", null);
      break;
    case "no_category":
      query = query.is("category_id", null);
      break;
    case "missing_cost":
      query = query.lte("unit_cost", 0);
      break;
  }

  if (sort === "supplier") {
    query = query.order("name", { ascending: direction === "asc", referencedTable: "suppliers" }).order("name");
  } else if (sort === "category") {
    query = query.order("name", { ascending: direction === "asc", referencedTable: "categories" }).order("name");
  } else if (sort === "quantity") {
    query = query.order("current_quantity", { ascending: direction === "asc" }).order("name");
  } else if (sort === "price") {
    query = query.order("default_price", { ascending: direction === "asc" }).order("name");
  } else if (sort === "cost") {
    query = query.order("unit_cost", { ascending: direction === "asc" }).order("name");
  } else if (sort === "sku") {
    query = query.order("sku", { ascending: direction === "asc", nullsFirst: false }).order("name");
  } else {
    query = query.order("name", { ascending: direction === "asc" });
  }

  const { data, count } = await (pageInMemory ? query : query.range(from, to));
  let items = data ?? [];
  if (options.status === "low_stock") {
    items = items.filter((item) => {
      const quantity = Number(item.current_quantity ?? 0);
      const reorder = Number(item.reorder_level ?? 0);
      return quantity > 0 && reorder > 0 && quantity <= reorder;
    });
  }
  if (sort === "value") {
    items = [...items].sort((first, second) => {
      const firstValue = Number(first.current_quantity ?? 0) * Number(first.unit_cost ?? 0);
      const secondValue = Number(second.current_quantity ?? 0) * Number(second.unit_cost ?? 0);
      return direction === "asc" ? firstValue - secondValue : secondValue - firstValue;
    });
  }

  const total = pageInMemory ? items.length : count ?? items.length;
  const pagedItems = pageInMemory ? items.slice(from, to + 1) : items;
  return { items: pagedItems, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getInventoryItem(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const [{ data: item }, { data: movements }, { data: invoiceItems }, { data: purchases }, { data: damages }] = await Promise.all([
    supabase.from("items").select("*, categories(name), suppliers(name)").eq("id", id).maybeSingle(),
    supabase.from("inventory_movements").select("*").eq("item_id", id).order("movement_date", { ascending: false }).limit(100),
    supabase
      .from("invoice_items")
      .select("*, invoices(invoice_number, invoice_date, customers(name))")
      .eq("item_id", id)
      .order("id", { ascending: false })
      .limit(50),
    supabase
      .from("purchase_orders")
      .select("*, suppliers(name), app_files(id, file_name)")
      .eq("item_id", id)
      .order("order_date", { ascending: false })
      .limit(50),
    supabase
      .from("damage_records")
      .select("*, customers(name), suppliers(name)")
      .eq("item_id", id)
      .order("damage_date", { ascending: false })
      .limit(50)
  ]);
  if (!item) return null;
  return {
    item,
    movements: movements ?? [],
    invoiceItems: invoiceItems ?? [],
    purchases: purchases ?? [],
    damages: damages ?? []
  };
}

export async function listCategories() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("name");
  return data ?? [];
}

export async function listCustomerRows() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*, customer_subaccounts(*)").eq("is_active", true).order("name");
  return data ?? [];
}

export async function listSuppliers() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("supplier_balances").select("*").order("name");
  return data ?? [];
}

export async function listSupplierRows() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("*").eq("is_active", true).order("name");
  return data ?? [];
}

export async function listSupplierAdjustments() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_adjustments")
    .select("*, suppliers(name), items(name, sku)")
    .order("adjustment_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function listSupplierInvoices() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_invoice_summaries")
    .select("*")
    .order("order_date", { ascending: false })
    .limit(100);
  if (!error && data) {
    return data.map((row) => ({
      ...row,
      supplier_id: row.supplier_id,
      supplier_invoice_number: row.supplier_invoice_number,
      total: Number(row.total ?? 0),
      line_count: Number(row.line_count ?? 1),
      suppliers: { name: row.supplier_name },
      items: { name: Number(row.line_count ?? 1) > 1 ? `${row.line_count} items` : row.item_name, sku: null },
      item_names: row.item_names ?? []
    }));
  }

  const { data: fallbackData } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(name), items(name, sku), app_files(id, file_name)")
    .order("order_date", { ascending: false })
    .limit(100);
  return groupSupplierInvoiceRows(fallbackData ?? []);
}

export async function getInvoice(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*, customers(name, address, phone), app_files(id, file_name)").eq("id", id).maybeSingle();
  if (!invoice) return null;

  let linesResult = await supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order").order("id");
  if (linesResult.error && isMissingColumnError(linesResult.error)) {
    linesResult = await supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id");
  }

  let returnsResult = await supabase.from("returns").select("*, items(name, sku)").eq("invoice_id", id).order("sort_order").order("created_at");
  if (returnsResult.error && isMissingColumnError(returnsResult.error)) {
    returnsResult = await supabase.from("returns").select("*, items(name, sku)").eq("invoice_id", id).order("created_at");
  }

  const invoiceDamages = await supabase
    .from("damage_records")
    .select("*, items(name, sku)")
    .eq("invoice_id", id)
    .order("sort_order")
    .order("created_at");
  const invoiceDamageRows = invoiceDamages.error && isMissingColumnError(invoiceDamages.error) ? [] : invoiceDamages.data ?? [];

  const { data: legacyDamages } = await supabase
    .from("damage_records")
    .select("*, items(name, sku)")
    .eq("customer_id", invoice.customer_id)
    .ilike("reason", `${invoice.invoice_number}:%`)
    .order("created_at");

  const damagesById = new Map<string, Row>();
  for (const row of [...invoiceDamageRows, ...(legacyDamages ?? [])]) {
    damagesById.set(String(row.id), row);
  }
  const damages = Array.from(damagesById.values());
  const deductions = [
    ...(returnsResult.data ?? []).map((row, index) => ({
      type: "return",
      item_id: row.item_id,
      item_name: row.items?.name ?? null,
      item_sku: row.items?.sku ?? null,
      quantity: row.quantity,
      amount: row.amount,
      reason: row.reason ?? "",
      sort_order: Number(row.sort_order ?? index)
    })),
    ...damages.map((row, index) => ({
      type: "damage",
      item_id: row.item_id,
      item_name: (row.items as Row | null | undefined)?.name ?? null,
      item_sku: (row.items as Row | null | undefined)?.sku ?? null,
      quantity: row.quantity,
      amount: row.balance_credit ?? row.estimated_cost,
      reason: String(row.reason ?? "").replace(`${invoice.invoice_number}:`, "").trim(),
      sort_order: Number(row.sort_order ?? index)
    }))
  ].sort((first, second) => Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0));
  return { invoice, lines: linesResult.data ?? [], returns: returnsResult.data ?? [], damages, deductions };
}

export async function listPayments() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, customers(id, name), customer_subaccounts(name), app_files(id, file_name), payment_allocations(amount, invoices(id, invoice_number))")
    .order("payment_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function listOpenInvoices() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_payment_status")
    .select("*, customers(name)")
    .gt("remaining_balance", 0)
    .order("invoice_date", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function dashboardTotals() {
  noStore();
  if (!hasSupabaseEnv()) {
    return { customerBalance: 0, supplierBalance: 0, stockValue: 0, todayCash: 0, todayExpenses: 0 };
  }
  const supabase = await createClient();
  const today = todayISO();
  const [customers, suppliers, stock, cash, expenses] = await Promise.all([
    supabase.from("customer_balances").select("balance"),
    supabase.from("supplier_balances").select("balance"),
    supabase.from("inventory_stock_value").select("stock_value").maybeSingle(),
    supabase.from("cash_sales").select("amount").eq("sale_date", today),
    supabase.from("expenses").select("amount").eq("expense_date", today)
  ]);

  const sum = (rows?: Row[] | null, key = "amount") => (rows ?? []).reduce((total, row) => total + Number(row[key] ?? 0), 0);

  return {
    customerBalance: sum(customers.data, "balance"),
    supplierBalance: sum(suppliers.data, "balance"),
    stockValue: Number(stock.data?.stock_value ?? 0),
    todayCash: sum(cash.data),
    todayExpenses: sum(expenses.data)
  };
}

export async function dashboardOperations() {
  noStore();
  if (!hasSupabaseEnv()) {
    return {
      lowStock: [],
      openInvoices: [],
      activeCheques: [],
      bouncedCheques: [],
      recentSupplierInvoices: [],
      recentAudit: []
    };
  }
  const supabase = await createClient();
  const [lowStock, openInvoices, activeCheques, bouncedCheques, recentSupplierInvoices, recentAudit] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, sku, current_quantity, reorder_level")
      .eq("is_active", true)
      .gt("reorder_level", 0)
      .order("current_quantity")
      .limit(12),
    supabase
      .from("invoice_payment_status")
      .select("invoice_id, invoice_number, invoice_date, total, remaining_balance, customers(name)")
      .gt("remaining_balance", 0)
      .order("invoice_date", { ascending: false })
      .limit(8),
    supabase
      .from("cheques")
      .select("id, cheque_number, amount, received_date, redeemed_date, status, customers(name)")
      .in("status", ["received", "redeemed"])
      .order("received_date", { ascending: false })
      .limit(8),
    supabase
      .from("cheques")
      .select("id, cheque_number, amount, received_date, status, customers(name)")
      .in("status", ["bounced", "cancelled"])
      .order("received_date", { ascending: false })
      .limit(8),
    supabase
      .from("supplier_invoice_summaries")
      .select("*")
      .order("order_date", { ascending: false })
      .limit(8),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, summary, actor_email, created_at")
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  return {
    lowStock: (lowStock.data ?? []).filter((item) => Number(item.current_quantity ?? 0) <= Number(item.reorder_level ?? 0)),
    openInvoices: openInvoices.data ?? [],
    activeCheques: activeCheques.data ?? [],
    bouncedCheques: bouncedCheques.data ?? [],
    recentSupplierInvoices: recentSupplierInvoices.error ? [] : recentSupplierInvoices.data ?? [],
    recentAudit: recentAudit.data ?? []
  };
}

export async function listCheques() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("cheques")
    .select("*, customers(id, name), app_files(id, file_name)")
    .order("received_date", { ascending: false });
  return data ?? [];
}

export async function getSupplierInvoice(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(*), items(name, sku), app_files(id, file_name)")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) return null;

  let relatedQuery = supabase
    .from("purchase_orders")
    .select("*, suppliers(*), items(name, sku), app_files(id, file_name)")
    .eq("supplier_id", invoice.supplier_id)
    .order("created_at");
  if (invoice.supplier_invoice_number) {
    relatedQuery = relatedQuery.eq("supplier_invoice_number", invoice.supplier_invoice_number);
  } else {
    relatedQuery = relatedQuery.eq("id", id);
  }

  const { data: relatedLines } = await relatedQuery;
  const purchaseIds = (relatedLines?.length ? relatedLines : [invoice]).map((line) => String(line.id));
  const [{ data: payments }, { data: adjustments }] = await Promise.all([
    supabase
      .from("supplier_payments")
      .select("*")
      .in("purchase_order_id", purchaseIds)
      .order("payment_date", { ascending: false }),
    supabase
      .from("supplier_adjustments")
      .select("*, items(name, sku), app_files(id, file_name)")
      .in("purchase_order_id", purchaseIds)
      .order("adjustment_date", { ascending: false })
  ]);
  const paid = (payments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const adjusted = (adjustments ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const invoiceTotal = (relatedLines ?? [invoice]).reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  return {
    invoice,
    relatedLines: relatedLines ?? [invoice],
    invoiceTotal,
    paid,
    adjusted,
    payments: payments ?? [],
    adjustments: adjustments ?? [],
    remaining: invoiceTotal - paid - adjusted
  };
}

export async function listExpenses() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(100);
  return data ?? [];
}

export async function listDamages() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("damage_records")
    .select("*, items(name, sku), customers(name), suppliers(name)")
    .order("damage_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getDailyReport(date: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const [invoices, payments, cash, expenses, returns, damages, cheques, purchases, supplierPayments, supplierAdjustments, stock] =
    await Promise.all([
      supabase.from("invoices").select("invoice_number, invoice_date, total, customers(name)").eq("invoice_date", date),
      supabase.from("payments").select("amount, method, reference, customers(name)").eq("payment_date", date),
      supabase.from("cash_sales").select("amount").eq("sale_date", date),
      supabase.from("expenses").select("amount").eq("expense_date", date),
      supabase.from("returns").select("amount, customers(name), items(name)").eq("return_date", date),
      supabase.from("damage_records").select("estimated_cost, balance_credit, reason, customers(name), suppliers(name), items(name)").eq("damage_date", date),
      supabase.from("cheques").select("amount, status, cheque_number, bank_name, customers(name)").or(`received_date.eq.${date},redeemed_date.eq.${date}`),
      supabase.from("purchase_orders").select("supplier_invoice_number, total, quantity, suppliers(name), items(name)").eq("order_date", date),
      supabase.from("supplier_payments").select("amount, reference, suppliers(name)").eq("payment_date", date),
      supabase.from("supplier_adjustments").select("amount, adjustment_type, reason, suppliers(name), items(name)").eq("adjustment_date", date),
      supabase.from("inventory_stock_value").select("stock_value").maybeSingle()
    ]);
  const sum = (rows?: Row[] | null, key = "amount") => (rows ?? []).reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const cashTotal = sum(cash.data);
  const expensesTotal = sum(expenses.data);
  return {
    invoiceTotal: sum(invoices.data, "total"),
    paymentTotal: sum(payments.data),
    cashTotal,
    expensesTotal,
    cashFlow: cashTotal - expensesTotal,
    returnsTotal: sum(returns.data),
    damagesTotal: sum(damages.data, "estimated_cost"),
    chequesReceived: sum((cheques.data ?? []).filter((row) => row.status === "received")),
    chequesRedeemed: sum((cheques.data ?? []).filter((row) => row.status === "redeemed")),
    purchasesTotal: sum(purchases.data, "total"),
    supplierPaymentsTotal: sum(supplierPayments.data),
    supplierAdjustmentsTotal: sum(supplierAdjustments.data),
    stockValue: Number(stock.data?.stock_value ?? 0),
    invoiceRows: invoices.data ?? [],
    paymentRows: payments.data ?? [],
    returnRows: returns.data ?? [],
    damageRows: damages.data ?? [],
    chequeRows: cheques.data ?? [],
    purchaseRows: purchases.data ?? [],
    supplierPaymentRows: supplierPayments.data ?? [],
    supplierAdjustmentRows: supplierAdjustments.data ?? []
  };
}

export async function getCutoffReport(date: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const [customers, suppliers, stock, saved] = await Promise.all([
    supabase.from("customer_balances").select("balance"),
    supabase.from("supplier_balances").select("balance"),
    supabase.from("inventory_stock_value").select("stock_value").maybeSingle(),
    supabase.from("cutoff_summaries").select("*").eq("cutoff_date", date).maybeSingle()
  ]);
  const sum = (rows?: Row[] | null, key = "balance") => (rows ?? []).reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const customerBalance = sum(customers.data);
  const supplierBalance = sum(suppliers.data);
  const stockValue = Number(stock.data?.stock_value ?? 0);
  return {
    saved: saved.data,
    customerBalance,
    supplierBalance,
    stockValue,
    netPosition: customerBalance - supplierBalance + stockValue
  };
}

export async function getSupplierCutoffReport(supplierId: string, startDate: string, endDate: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();

  const supplierPromise = supplierId
    ? supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle()
    : Promise.resolve({ data: null });

  const [supplier, invoices, adjustments, payments] = await Promise.all([
    supplierPromise,
    supplierId
      ? supabase
          .from("purchase_orders")
          .select("id, supplier_invoice_number, order_date, total")
          .eq("supplier_id", supplierId)
          .gte("order_date", startDate)
          .lte("order_date", endDate)
          .order("order_date")
          .order("created_at")
      : Promise.resolve({ data: [] }),
    supplierId
      ? supabase
          .from("supplier_adjustments")
          .select("id, purchase_order_id, adjustment_type, amount, adjustment_date, reason")
          .eq("supplier_id", supplierId)
          .gte("adjustment_date", startDate)
          .lte("adjustment_date", endDate)
          .order("adjustment_date")
          .order("created_at")
      : Promise.resolve({ data: [] }),
    supplierId
      ? supabase
          .from("supplier_payments")
          .select("id, amount, payment_date, reference, notes")
          .eq("supplier_id", supplierId)
          .gte("payment_date", startDate)
          .lte("payment_date", endDate)
          .order("payment_date")
          .order("created_at")
      : Promise.resolve({ data: [] })
  ]);

  const invoiceRows = invoices.data ?? [];
  const adjustmentRows = adjustments.data ?? [];
  const paymentRows = payments.data ?? [];
  const invoiceGroupByPurchaseId = new Map<string, string>();
  for (const invoice of invoiceRows) {
    const invoiceNumber = String(invoice.supplier_invoice_number ?? "").trim();
    const groupKey = invoiceNumber ? `${supplierId}:${invoiceNumber}` : String(invoice.id);
    invoiceGroupByPurchaseId.set(String(invoice.id), groupKey);
  }

  const adjustmentsByGroupId = new Map<string, number>();
  for (const adjustment of adjustmentRows) {
    if (!adjustment.purchase_order_id) continue;
    const groupKey = invoiceGroupByPurchaseId.get(String(adjustment.purchase_order_id));
    if (!groupKey) continue;
    adjustmentsByGroupId.set(groupKey, (adjustmentsByGroupId.get(groupKey) ?? 0) + Number(adjustment.amount ?? 0));
  }

  const invoiceGroups = new Map<string, { id: string; date: string; reference: string; delivered: number }>();
  for (const invoice of invoiceRows) {
    const invoiceNumber = String(invoice.supplier_invoice_number ?? "").trim();
    const groupKey = invoiceNumber ? `${supplierId}:${invoiceNumber}` : String(invoice.id);
    const delivered = Number(invoice.total ?? 0);
    const existing = invoiceGroups.get(groupKey);
    if (!existing) {
      invoiceGroups.set(groupKey, {
        id: groupKey,
        date: invoice.order_date,
        reference: invoiceNumber || String(invoice.id).slice(0, 8),
        delivered
      });
      continue;
    }
    existing.delivered += delivered;
    existing.date = String(invoice.order_date ?? "") < String(existing.date ?? "") ? invoice.order_date : existing.date;
  }

  const counterRows = Array.from(invoiceGroups.values()).map((invoice) => {
    const delivered = Number(invoice.delivered ?? 0);
    const returned = adjustmentsByGroupId.get(String(invoice.id)) ?? 0;
    return {
      id: invoice.id,
      date: invoice.date,
      reference: invoice.reference,
      delivered,
      returned,
      amount: delivered - returned
    };
  });

  const linkedAdjustmentIds = new Set(invoiceRows.map((invoice) => String(invoice.id)));
  const unlinkedAdjustments = adjustmentRows.filter((adjustment) => !adjustment.purchase_order_id || !linkedAdjustmentIds.has(String(adjustment.purchase_order_id)));
  for (const adjustment of unlinkedAdjustments) {
    const amount = Number(adjustment.amount ?? 0);
    counterRows.push({
      id: String(adjustment.id),
      date: adjustment.adjustment_date,
      reference: adjustment.reason || adjustment.adjustment_type,
      delivered: 0,
      returned: amount,
      amount: -amount
    });
  }

  counterRows.sort((first, second) => String(first.date).localeCompare(String(second.date)));
  const deliveredTotal = counterRows.reduce((sum, row) => sum + row.delivered, 0);
  const returnTotal = counterRows.reduce((sum, row) => sum + row.returned, 0);
  const invoiceTotal = counterRows.reduce((sum, row) => sum + row.amount, 0);
  const paymentTotal = paymentRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return {
    supplier: supplier.data,
    counterRows,
    paymentRows,
    deliveredTotal,
    returnTotal,
    invoiceTotal,
    paymentTotal,
    remaining: invoiceTotal - paymentTotal
  };
}

export async function getSettings() {
  noStore();
  if (!hasSupabaseEnv()) return { business_name: "MST Household", currency: "PHP", timezone: "Asia/Singapore" };
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  return data ?? { business_name: "MST Household", currency: "PHP", timezone: "Asia/Singapore" };
}

export async function globalSearch(queryText: string) {
  noStore();
  if (!hasSupabaseEnv() || !queryText.trim()) {
    return { customers: [], suppliers: [], items: [], invoices: [], supplierInvoices: [], cheques: [], payments: [] };
  }
  const supabase = await createClient();
  const q = `%${queryText.trim()}%`;
  const [customers, suppliers, items, invoices, supplierInvoices, cheques, payments] = await Promise.all([
    supabase.from("customers").select("id, name, account_code, phone").or(`name.ilike.${q},account_code.ilike.${q},phone.ilike.${q}`).limit(20),
    supabase.from("suppliers").select("id, name, phone, contact_name").or(`name.ilike.${q},phone.ilike.${q},contact_name.ilike.${q}`).limit(20),
    supabase.from("items").select("id, name, sku, current_quantity, reorder_level").or(`name.ilike.${q},sku.ilike.${q}`).limit(20),
    supabase.from("invoices").select("id, invoice_number, total, customers(name)").ilike("invoice_number", q).limit(20),
    supabase.from("supplier_invoice_summaries").select("*").ilike("supplier_invoice_number", q).limit(20),
    supabase.from("cheques").select("id, cheque_number, amount, status, customers(name)").ilike("cheque_number", q).limit(20),
    supabase.from("payments").select("id, reference, amount, method, customers(name)").ilike("reference", q).limit(20)
  ]);
  return {
    customers: customers.data ?? [],
    suppliers: suppliers.data ?? [],
    items: items.data ?? [],
    invoices: invoices.data ?? [],
    supplierInvoices: supplierInvoices.error ? [] : supplierInvoices.data ?? [],
    cheques: cheques.data ?? [],
    payments: payments.data ?? []
  };
}

export async function listAuditLogs() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}
