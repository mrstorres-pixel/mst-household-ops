import { unstable_noStore as noStore } from "next/cache";
import { hasSupabaseEnv } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type Row = Record<string, unknown>;

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
      .select("invoice_number, invoice_date, total, status")
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
  const { data } = await supabase.from("customers").select("*, customer_subaccounts(*)").order("name");
  return data ?? [];
}

export async function listSuppliers() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("supplier_balances").select("*").order("name");
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

export async function getInvoice(id: string) {
  noStore();
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*, customers(name, address, phone)").eq("id", id).maybeSingle(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id")
  ]);
  if (!invoice) return null;
  return { invoice, lines: lines ?? [] };
}

export async function listPayments() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, customers(name), customer_subaccounts(name)")
    .order("payment_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function dashboardTotals() {
  noStore();
  if (!hasSupabaseEnv()) {
    return { customerBalance: 0, supplierBalance: 0, stockValue: 0, todayCash: 0, todayExpenses: 0 };
  }
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
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

export async function listCheques() {
  noStore();
  if (!hasSupabaseEnv()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("cheques")
    .select("*, customers(name)")
    .order("received_date", { ascending: false });
  return data ?? [];
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

export async function getSettings() {
  noStore();
  if (!hasSupabaseEnv()) return { business_name: "MST Household", currency: "PHP", timezone: "Asia/Singapore" };
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  return data ?? { business_name: "MST Household", currency: "PHP", timezone: "Asia/Singapore" };
}
