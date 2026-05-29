"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asNumber } from "@/lib/format";
import { hasSupabaseEnv } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function requireSupabase() {
  if (!hasSupabaseEnv()) throw new Error("Supabase is not configured.");
  return createClient();
}

export async function signIn(formData: FormData) {
  const supabase = await requireSupabase();
  const email = text(formData, "email");
  const password = text(formData, "password");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await requireSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createCustomer(formData: FormData) {
  const supabase = await requireSupabase();
  const parsed = z
    .object({
      name: z.string().min(1),
      account_code: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      payment_mode: z.string().default("cash")
    })
    .parse({
      name: text(formData, "name"),
      account_code: text(formData, "account_code") || undefined,
      phone: text(formData, "phone") || undefined,
      address: text(formData, "address") || undefined,
      payment_mode: text(formData, "payment_mode") || "cash"
    });

  const { data, error } = await supabase.from("customers").insert(parsed).select("id").single();
  if (error) throw error;

  const subaccounts = text(formData, "subaccounts")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ customer_id: data.id, name }));
  if (subaccounts.length) await supabase.from("customer_subaccounts").insert(subaccounts);

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function createItem(formData: FormData) {
  const supabase = await requireSupabase();
  const categoryName = text(formData, "category");
  let categoryId: string | null = null;
  if (categoryName) {
    const { data } = await supabase
      .from("categories")
      .upsert({ name: categoryName }, { onConflict: "name" })
      .select("id")
      .single();
    categoryId = data?.id ?? null;
  }
  await supabase.from("items").insert({
    sku: text(formData, "sku") || null,
    name: text(formData, "name"),
    category_id: categoryId,
    default_price: asNumber(formData.get("default_price")),
    unit_cost: asNumber(formData.get("unit_cost")),
    current_quantity: asNumber(formData.get("current_quantity")),
    reorder_level: asNumber(formData.get("reorder_level"))
  });
  revalidatePath("/inventory");
}

export async function saveCustomerTemplate(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  await supabase.from("customer_item_templates").upsert(
    {
      customer_id: customerId,
      item_id: text(formData, "item_id"),
      quantity: asNumber(formData.get("quantity")),
      price: asNumber(formData.get("price"))
    },
    { onConflict: "customer_id,item_id" }
  );
  revalidatePath(`/customers/${customerId}`);
}

export async function createInvoice(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const subaccountId = text(formData, "subaccount_id") || null;
  const itemIds = formData.getAll("item_id").map(String);
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(asNumber);
  const prices = formData.getAll("unit_price").map(asNumber);
  const lines = itemIds
    .map((itemId, index) => ({
      item_id: itemId,
      description: descriptions[index] || "Item",
      quantity: quantities[index],
      unit_price: prices[index],
      line_total: quantities[index] * prices[index]
    }))
    .filter((line) => line.item_id && line.quantity > 0);

  if (!lines.length) throw new Error("Add at least one invoice item.");
  const subtotal = lines.reduce((total, line) => total + line.line_total, 0);
  const invoiceNumber = `MST-${Date.now()}`;
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      customer_id: customerId,
      subaccount_id: subaccountId,
      invoice_date: text(formData, "invoice_date") || new Date().toISOString().slice(0, 10),
      subtotal,
      total: subtotal,
      notes: text(formData, "notes") || null
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("invoice_items").insert(lines.map((line) => ({ ...line, invoice_id: invoice.id })));
  await supabase.from("customer_ledger_entries").insert({
    customer_id: customerId,
    subaccount_id: subaccountId,
    invoice_id: invoice.id,
    entry_type: "invoice",
    description: `Invoice ${invoiceNumber}`,
    debit: subtotal,
    credit: 0
  });
  await supabase.from("inventory_movements").insert(
    lines.map((line) => ({
      item_id: line.item_id,
      movement_type: "sale",
      quantity_delta: -line.quantity,
      reference_type: "invoice",
      reference_id: invoice.id,
      notes: invoiceNumber
    }))
  );
  if (text(formData, "cash_sale") === "on") {
    const { data: payment } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId,
        subaccount_id: subaccountId,
        method: "cash",
        amount: subtotal,
        payment_date: text(formData, "invoice_date") || new Date().toISOString().slice(0, 10),
        reference: invoiceNumber,
        notes: "Cash sale invoice"
      })
      .select("id")
      .single();
    await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      invoice_id: invoice.id,
      payment_id: payment?.id,
      entry_type: "cash_sale_payment",
      description: `Cash payment for ${invoiceNumber}`,
      debit: 0,
      credit: subtotal
    });
    await supabase.from("cash_sales").insert({ invoice_id: invoice.id, amount: subtotal });
  }
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoice.id}/print`);
}

export async function recordPayment(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const subaccountId = text(formData, "subaccount_id") || null;
  const method = text(formData, "method") as "cash" | "bank" | "cheque";
  const amount = asNumber(formData.get("amount"));
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      method,
      amount,
      payment_date: text(formData, "payment_date") || new Date().toISOString().slice(0, 10),
      reference: text(formData, "reference") || null,
      notes: text(formData, "notes") || null
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("customer_ledger_entries").insert({
    customer_id: customerId,
    subaccount_id: subaccountId,
    payment_id: payment.id,
    entry_type: method === "cheque" ? "cheque_received" : "payment",
    description: `${method.toUpperCase()} payment`,
    debit: 0,
    credit: amount
  });

  if (method === "cheque") {
    await supabase.from("cheques").insert({
      payment_id: payment.id,
      customer_id: customerId,
      cheque_number: text(formData, "reference") || null,
      bank_name: text(formData, "bank_name") || null,
      amount,
      received_date: text(formData, "payment_date") || new Date().toISOString().slice(0, 10)
    });
  }

  revalidatePath("/payments");
  revalidatePath(`/customers/${customerId}`);
}

export async function updateChequeStatus(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase
    .from("cheques")
    .update({
      status: text(formData, "status"),
      redeemed_date: text(formData, "status") === "redeemed" ? new Date().toISOString().slice(0, 10) : null
    })
    .eq("id", text(formData, "cheque_id"));
  revalidatePath("/cheques");
}

export async function recordDamage(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const quantity = asNumber(formData.get("quantity"));
  const estimatedCost = asNumber(formData.get("estimated_cost"));
  const { data: damage } = await supabase
    .from("damage_records")
    .insert({
      item_id: itemId,
      quantity,
      estimated_cost: estimatedCost,
      reason: text(formData, "reason") || null,
      damage_date: text(formData, "damage_date") || new Date().toISOString().slice(0, 10)
    })
    .select("id")
    .single();
  await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: "damage",
    quantity_delta: -quantity,
    unit_cost: estimatedCost,
    reference_type: "damage",
    reference_id: damage?.id,
    notes: text(formData, "reason") || null
  });
  revalidatePath("/inventory");
  revalidatePath("/inventory/damages");
}

export async function recordSupplierPurchase(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  const itemId = text(formData, "item_id");
  const quantity = asNumber(formData.get("quantity"));
  const unitCost = asNumber(formData.get("unit_cost"));
  const total = quantity * unitCost;
  const { data: purchase } = await supabase
    .from("purchase_orders")
    .insert({ supplier_id: supplierId, item_id: itemId, quantity, unit_cost: unitCost, total })
    .select("id")
    .single();
  await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: "purchase",
    quantity_delta: quantity,
    unit_cost: unitCost,
    reference_type: "purchase_order",
    reference_id: purchase?.id
  });
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
}

export async function createSupplier(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("suppliers").insert({
    name: text(formData, "name"),
    contact_name: text(formData, "contact_name") || null,
    phone: text(formData, "phone") || null,
    address: text(formData, "address") || null
  });
  revalidatePath("/suppliers");
}

export async function recordSupplierPayment(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("supplier_payments").insert({
    supplier_id: text(formData, "supplier_id"),
    amount: asNumber(formData.get("amount")),
    reference: text(formData, "reference") || null,
    notes: text(formData, "notes") || null
  });
  revalidatePath("/suppliers");
}

export async function recordExpense(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("expenses").insert({
    description: text(formData, "description"),
    category: text(formData, "category") || "general",
    amount: asNumber(formData.get("amount")),
    expense_date: text(formData, "expense_date") || new Date().toISOString().slice(0, 10)
  });
  revalidatePath("/expenses");
  revalidatePath("/reports/daily");
}

export async function saveCutoffSummary(formData: FormData) {
  const supabase = await requireSupabase();
  const cutoff_date = text(formData, "cutoff_date");
  const customer_balance_total = asNumber(formData.get("customer_balance_total"));
  const supplier_balance_total = asNumber(formData.get("supplier_balance_total"));
  const stock_value = asNumber(formData.get("stock_value"));
  await supabase.from("cutoff_summaries").upsert(
    {
      cutoff_date,
      customer_balance_total,
      supplier_balance_total,
      stock_value,
      net_position: customer_balance_total - supplier_balance_total + stock_value
    },
    { onConflict: "cutoff_date" }
  );
  revalidatePath("/reports/cutoff");
}

export async function updateSettings(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("app_settings").upsert(
    {
      id: true,
      business_name: text(formData, "business_name") || "MST Household",
      currency: text(formData, "currency") || "PHP",
      timezone: text(formData, "timezone") || "Asia/Singapore",
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  revalidatePath("/settings");
}
