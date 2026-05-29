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

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      actor_id: userData.user?.id ?? null,
      actor_email: userData.user?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      summary,
      metadata
    });
  } catch {
    // Audit logging should never block field operations.
  }
}

async function uploadOptionalFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  fieldName: string,
  ownerType: string,
  ownerId?: string
) {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${ownerType}/${ownerId ?? "pending"}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("mst-attachments")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("app_files")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId ?? null,
      file_name: file.name,
      file_path: path,
      content_type: file.type || null
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
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
      payment_mode: z.string().optional()
    })
    .parse({
      name: text(formData, "name"),
      account_code: text(formData, "account_code") || undefined,
      phone: text(formData, "phone") || undefined,
      address: text(formData, "address") || undefined,
      payment_mode: text(formData, "payment_mode") || undefined
    });

  const { data, error } = await supabase.from("customers").insert(parsed).select("id").single();
  if (error) redirect(`/customers?error=${encodeURIComponent(error.message)}`);

  const subaccounts = text(formData, "subaccounts")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ customer_id: data.id, name }));
  if (subaccounts.length) await supabase.from("customer_subaccounts").insert(subaccounts);
  await writeAudit(supabase, "create", "customer", data.id, `Created customer ${parsed.name}`);

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const { error } = await supabase
    .from("customers")
    .update({
      name: text(formData, "name"),
      account_code: text(formData, "account_code") || null,
      phone: text(formData, "phone") || null,
      address: text(formData, "address") || null,
      notes: text(formData, "notes") || null
    })
    .eq("id", customerId);
  if (error) redirect(`/customers/${customerId}?error=${encodeURIComponent(error.message)}`);
  await writeAudit(supabase, "update", "customer", customerId, `Updated customer ${text(formData, "name")}`);
  revalidatePath(`/customers/${customerId}`);
}

export async function addCustomerSubaccount(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const name = text(formData, "name");
  if (!name) return;
  const { error } = await supabase.from("customer_subaccounts").insert({ customer_id: customerId, name });
  if (error) redirect(`/customers/${customerId}?error=${encodeURIComponent(error.message)}`);
  await writeAudit(supabase, "create", "customer_subaccount", customerId, `Added sub-balance ${name}`);
  revalidatePath(`/customers/${customerId}`);
}

export async function removeCustomerSubaccount(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const subaccountId = text(formData, "subaccount_id");
  const { data: balanceRow } = await supabase
    .from("customer_subaccount_balances")
    .select("balance")
    .eq("subaccount_id", subaccountId)
    .maybeSingle();
  if (Number(balanceRow?.balance ?? 0) !== 0) {
    redirect(`/customers/${customerId}?error=${encodeURIComponent("Only zero-balance sub-balances can be removed.")}`);
  }
  const { error } = await supabase.from("customer_subaccounts").delete().eq("id", subaccountId);
  if (error) redirect(`/customers/${customerId}?error=${encodeURIComponent(error.message)}`);
  await writeAudit(supabase, "delete", "customer_subaccount", subaccountId, "Removed customer sub-balance");
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteCustomer(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("customers").update({ is_active: false }).eq("id", text(formData, "customer_id"));
  await writeAudit(supabase, "delete", "customer", text(formData, "customer_id"), "Deleted customer");
  revalidatePath("/customers");
  redirect("/customers");
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
  const { data: item } = await supabase.from("items").insert({
    sku: text(formData, "sku") || null,
    name: text(formData, "name"),
    category_id: categoryId,
    primary_supplier_id: text(formData, "supplier_id") || null,
    default_price: asNumber(formData.get("default_price")),
    unit_cost: asNumber(formData.get("unit_cost")),
    current_quantity: asNumber(formData.get("current_quantity")),
    reorder_level: asNumber(formData.get("reorder_level"))
  }).select("id").single();
  if (item?.id && text(formData, "supplier_id")) {
    await supabase.from("supplier_items").upsert(
      {
        supplier_id: text(formData, "supplier_id"),
        item_id: item.id,
        supplier_price: asNumber(formData.get("unit_cost"))
      },
      { onConflict: "supplier_id,item_id" }
    );
  }
  await writeAudit(supabase, "create", "item", item?.id ?? null, `Created item ${text(formData, "name")}`);
  revalidatePath("/inventory");
}

export async function updateItem(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  await supabase
    .from("items")
    .update({
      name: text(formData, "name"),
      sku: text(formData, "sku") || null,
      primary_supplier_id: text(formData, "supplier_id") || null,
      default_price: asNumber(formData.get("default_price")),
      unit_cost: asNumber(formData.get("unit_cost")),
      reorder_level: asNumber(formData.get("reorder_level"))
    })
    .eq("id", itemId);
  await writeAudit(supabase, "update", "item", itemId, `Updated item ${text(formData, "name")}`);
  revalidatePath("/inventory");
}

export async function deleteItem(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("items").update({ is_active: false }).eq("id", text(formData, "item_id"));
  await writeAudit(supabase, "delete", "item", text(formData, "item_id"), "Deleted item");
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
  await writeAudit(supabase, "create", "invoice", invoice.id, `Created customer invoice ${invoiceNumber}`, { total: subtotal });

  const attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "customer_invoice", invoice.id);
  if (attachmentId) {
    await supabase.from("invoices").update({ attachment_file_id: attachmentId }).eq("id", invoice.id);
  }

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
  const invoiceId = text(formData, "invoice_id") || null;
  const allocationAmount = asNumber(formData.get("allocation_amount")) || amount;
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

  const attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "payment", payment.id);
  if (attachmentId) {
    await supabase.from("payments").update({ attachment_file_id: attachmentId }).eq("id", payment.id);
  }

  if (invoiceId) {
    await supabase.from("payment_allocations").insert({
      payment_id: payment.id,
      invoice_id: invoiceId,
      subaccount_id: subaccountId,
      amount: allocationAmount
    });
  }

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
    const { data: cheque } = await supabase.from("cheques").insert({
      payment_id: payment.id,
      customer_id: customerId,
      cheque_number: text(formData, "reference") || null,
      bank_name: text(formData, "bank_name") || null,
      amount,
      received_date: text(formData, "payment_date") || new Date().toISOString().slice(0, 10),
      attachment_file_id: attachmentId
    }).select("id").single();
    if (attachmentId && cheque?.id) {
      await supabase.from("app_files").update({ owner_type: "cheque", owner_id: cheque.id }).eq("id", attachmentId);
    }
  }
  await writeAudit(supabase, "create", "payment", payment.id, `Recorded ${method} payment`, { amount, invoice_id: invoiceId });

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
  await writeAudit(supabase, "status", "cheque", text(formData, "cheque_id"), `Updated cheque status to ${text(formData, "status")}`);
  revalidatePath("/cheques");
}

export async function deleteCheque(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("cheques").delete().eq("id", text(formData, "cheque_id"));
  await writeAudit(supabase, "delete", "cheque", text(formData, "cheque_id"), "Deleted cheque");
  revalidatePath("/cheques");
}

export async function recordDamage(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const quantity = asNumber(formData.get("quantity"));
  const estimatedCost = asNumber(formData.get("estimated_cost"));
  const customerId = text(formData, "customer_id") || null;
  const subaccountId = text(formData, "subaccount_id") || null;
  const supplierId = text(formData, "supplier_id") || null;
  const balanceCredit = asNumber(formData.get("balance_credit"));
  const repairCharge = asNumber(formData.get("repair_charge"));
  const missingParts = text(formData, "missing_parts");
  const { data: damage } = await supabase
    .from("damage_records")
    .insert({
      item_id: itemId,
      customer_id: customerId,
      subaccount_id: subaccountId,
      supplier_id: supplierId,
      quantity,
      estimated_cost: estimatedCost,
      balance_credit: balanceCredit,
      missing_parts: missingParts || null,
      repair_charge: repairCharge,
      reason: text(formData, "reason") || null,
      damage_date: text(formData, "damage_date") || new Date().toISOString().slice(0, 10)
    })
    .select("id")
    .single();
  await writeAudit(supabase, "create", "damage_record", damage?.id ?? null, "Recorded damage/return", { quantity, balanceCredit, repairCharge });
  await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: "damage",
    quantity_delta: -quantity,
    unit_cost: estimatedCost,
    reference_type: "damage",
    reference_id: damage?.id,
    notes: text(formData, "reason") || null
  });
  if (customerId && balanceCredit > 0) {
    await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      entry_type: "damage_credit",
      description: text(formData, "reason") || "Damage/return credit",
      debit: 0,
      credit: balanceCredit
    });
  }
  if (customerId && repairCharge > 0) {
    const description = missingParts
      ? `Repair charge for missing/damaged ${missingParts}`
      : text(formData, "reason") || "Repair charge";
    const { data: charge } = await supabase
      .from("charges")
      .insert({
        customer_id: customerId,
        subaccount_id: subaccountId,
        description,
        amount: repairCharge
      })
      .select("id")
      .single();
    await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      entry_type: "repair_charge",
      description,
      debit: repairCharge,
      credit: 0,
      invoice_id: null
    });
    if (charge?.id) {
      await supabase.from("app_files").update({ owner_type: "charge", owner_id: charge.id }).eq("owner_type", "pending_charge");
    }
  }
  if (supplierId && balanceCredit > 0) {
    await supabase.from("supplier_adjustments").insert({
      supplier_id: supplierId,
      item_id: itemId,
      adjustment_type: "damage",
      quantity,
      amount: balanceCredit,
      reason: text(formData, "reason") || null
    });
  }
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
    .insert({
      supplier_id: supplierId,
      item_id: itemId,
      quantity,
      unit_cost: unitCost,
      total,
      supplier_invoice_number: text(formData, "supplier_invoice_number") || null
    })
    .select("id")
    .single();
  const attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "supplier_invoice", purchase?.id);
  if (attachmentId && purchase?.id) {
    await supabase.from("purchase_orders").update({ attachment_file_id: attachmentId }).eq("id", purchase.id);
  }
  await writeAudit(supabase, "create", "supplier_invoice", purchase?.id ?? null, `Recorded supplier invoice ${text(formData, "supplier_invoice_number") || ""}`, { total });
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
  await writeAudit(supabase, "create", "supplier", null, `Created supplier ${text(formData, "name")}`);
  revalidatePath("/suppliers");
}

export async function updateSupplier(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase
    .from("suppliers")
    .update({
      name: text(formData, "name"),
      contact_name: text(formData, "contact_name") || null,
      phone: text(formData, "phone") || null,
      address: text(formData, "address") || null
    })
    .eq("id", text(formData, "supplier_id"));
  await writeAudit(supabase, "update", "supplier", text(formData, "supplier_id"), `Updated supplier ${text(formData, "name")}`);
  revalidatePath("/suppliers");
}

export async function deleteSupplier(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("suppliers").update({ is_active: false }).eq("id", text(formData, "supplier_id"));
  await writeAudit(supabase, "delete", "supplier", text(formData, "supplier_id"), "Deleted supplier");
  revalidatePath("/suppliers");
}

export async function recordSupplierPayment(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("supplier_payments").insert({
    supplier_id: text(formData, "supplier_id"),
    purchase_order_id: text(formData, "purchase_order_id") || null,
    amount: asNumber(formData.get("amount")),
    reference: text(formData, "reference") || null,
    notes: text(formData, "notes") || null
  });
  await writeAudit(supabase, "create", "supplier_payment", text(formData, "purchase_order_id") || null, "Recorded supplier payment", { amount: asNumber(formData.get("amount")) });
  revalidatePath("/suppliers");
}

export async function recordSupplierAdjustment(formData: FormData) {
  const supabase = await requireSupabase();
  const { data: adjustment } = await supabase
    .from("supplier_adjustments")
    .insert({
      supplier_id: text(formData, "supplier_id"),
      purchase_order_id: text(formData, "purchase_order_id") || null,
      item_id: text(formData, "item_id") || null,
      adjustment_type: text(formData, "adjustment_type") || "return",
      quantity: asNumber(formData.get("quantity")),
      amount: asNumber(formData.get("amount")),
      reason: text(formData, "reason") || null,
      adjustment_date: text(formData, "adjustment_date") || new Date().toISOString().slice(0, 10)
    })
    .select("id")
    .single();
  const attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "supplier_adjustment", adjustment?.id);
  if (attachmentId && adjustment?.id) {
    await supabase.from("supplier_adjustments").update({ attachment_file_id: attachmentId }).eq("id", adjustment.id);
  }
  await writeAudit(supabase, "create", "supplier_adjustment", adjustment?.id ?? null, "Recorded supplier adjustment", { amount: asNumber(formData.get("amount")) });
  revalidatePath("/suppliers");
  revalidatePath("/reports/daily");
}

export async function recordExpense(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("expenses").insert({
    description: text(formData, "description"),
    category: text(formData, "category") || "general",
    amount: asNumber(formData.get("amount")),
    expense_date: text(formData, "expense_date") || new Date().toISOString().slice(0, 10)
  });
  await writeAudit(supabase, "create", "expense", null, `Recorded expense ${text(formData, "description")}`, { amount: asNumber(formData.get("amount")) });
  revalidatePath("/expenses");
  revalidatePath("/reports/daily");
}

export async function updateExpense(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase
    .from("expenses")
    .update({
      description: text(formData, "description"),
      category: text(formData, "category") || "general",
      amount: asNumber(formData.get("amount")),
      expense_date: text(formData, "expense_date") || new Date().toISOString().slice(0, 10)
    })
    .eq("id", text(formData, "expense_id"));
  await writeAudit(supabase, "update", "expense", text(formData, "expense_id"), `Updated expense ${text(formData, "description")}`);
  revalidatePath("/expenses");
  revalidatePath("/reports/daily");
}

export async function deleteExpense(formData: FormData) {
  const supabase = await requireSupabase();
  await supabase.from("expenses").delete().eq("id", text(formData, "expense_id"));
  await writeAudit(supabase, "delete", "expense", text(formData, "expense_id"), "Deleted expense");
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
  await writeAudit(supabase, "update", "settings", null, "Updated app settings");
  revalidatePath("/settings");
}
