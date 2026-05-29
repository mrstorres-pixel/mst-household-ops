"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asNumber } from "@/lib/format";
import { hasSupabaseEnv } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { normalizeSku } from "@/lib/sku";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: { message?: string; code?: string; details?: string } | null) {
  if (!error) return "Unknown database error.";
  const parts = [error.message, error.details, error.code ? `Code: ${error.code}` : ""].filter(Boolean);
  return parts.join(" ");
}

function pageError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function pageSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
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
    const { data, error } = await supabase
      .from("categories")
      .upsert({ name: categoryName }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) redirect(`/inventory?error=${encodeURIComponent(`Category could not be saved: ${errorMessage(error)}`)}`);
    categoryId = data?.id ?? null;
  }
  const sku = normalizeSku(text(formData, "sku"));
  if (sku) {
    const { data: existingSku } = await supabase
      .from("items")
      .select("id, name, sku, is_active")
      .eq("sku", sku)
      .maybeSingle();
    if (existingSku) {
      const state = existingSku.is_active ? "active" : "archived/deleted";
      redirect(
        `/inventory?error=${encodeURIComponent(
          `SKU "${sku}" is already used by ${state} item "${existingSku.name}". ${existingSku.is_active ? "Edit that item instead." : "Restore it from Archived Items below, or use a different SKU."}`
        )}`
      );
    }
  }
  const { data: item, error } = await supabase.from("items").insert({
    sku,
    name: text(formData, "name"),
    category_id: categoryId,
    primary_supplier_id: text(formData, "supplier_id") || null,
    default_price: asNumber(formData.get("default_price")),
    unit_cost: asNumber(formData.get("unit_cost")),
    current_quantity: asNumber(formData.get("current_quantity")),
    reorder_level: asNumber(formData.get("reorder_level"))
  }).select("id").single();
  if (error) {
    const duplicateHint = error.code === "23505" && sku ? ` The SKU "${sku}" may already exist.` : "";
    redirect(`/inventory?error=${encodeURIComponent(`Item could not be saved: ${errorMessage(error)}${duplicateHint}`)}`);
  }
  if (item?.id && text(formData, "supplier_id")) {
    const { error: supplierItemError } = await supabase.from("supplier_items").upsert(
      {
        supplier_id: text(formData, "supplier_id"),
        item_id: item.id,
        supplier_price: asNumber(formData.get("unit_cost"))
      },
      { onConflict: "supplier_id,item_id" }
    );
    if (supplierItemError) {
      redirect(`/inventory?error=${encodeURIComponent(`Item was created, but supplier link failed: ${errorMessage(supplierItemError)}`)}`);
    }
  }
  await writeAudit(supabase, "create", "item", item?.id ?? null, `Created item ${text(formData, "name")}`);
  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent(`Saved item: ${text(formData, "name")}`)}`);
}

export async function updateItem(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const sku = normalizeSku(text(formData, "sku"));
  const categoryName = text(formData, "category");
  let categoryId: string | null = null;
  if (categoryName) {
    const { data, error } = await supabase
      .from("categories")
      .upsert({ name: categoryName }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) redirect(`/inventory?error=${encodeURIComponent(`Category could not be saved: ${errorMessage(error)}`)}`);
    categoryId = data?.id ?? null;
  }
  if (sku) {
    const { data: existingSku } = await supabase
      .from("items")
      .select("id, name, sku, is_active")
      .eq("sku", sku)
      .neq("id", itemId)
      .maybeSingle();
    if (existingSku) {
      const state = existingSku.is_active ? "active" : "archived/deleted";
      redirect(`/inventory?error=${encodeURIComponent(`SKU "${sku}" is already used by ${state} item "${existingSku.name}".`)}`);
    }
  }
  const { error } = await supabase
    .from("items")
    .update({
      name: text(formData, "name"),
      sku,
      primary_supplier_id: text(formData, "supplier_id") || null,
      category_id: categoryId,
      default_price: asNumber(formData.get("default_price")),
      unit_cost: asNumber(formData.get("unit_cost")),
      reorder_level: asNumber(formData.get("reorder_level"))
    })
    .eq("id", itemId);
  if (error) redirect(`/inventory?error=${encodeURIComponent(`Item could not be updated: ${errorMessage(error)}`)}`);
  await writeAudit(supabase, "update", "item", itemId, `Updated item ${text(formData, "name")}`);
  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent(`Updated item: ${text(formData, "name")}`)}`);
}

export async function deleteItem(formData: FormData) {
  const supabase = await requireSupabase();
  const { error } = await supabase.from("items").update({ is_active: false }).eq("id", text(formData, "item_id"));
  if (error) redirect(`/inventory?error=${encodeURIComponent(`Item could not be deleted: ${errorMessage(error)}`)}`);
  await writeAudit(supabase, "archive", "item", text(formData, "item_id"), "Archived item");
  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent("Item archived.")}`);
}

export async function permanentlyDeleteItem(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) {
    redirect(
      `/inventory?error=${encodeURIComponent(
        `Item could not be permanently deleted: ${errorMessage(error)} If this item has invoices, stock movements, damages, supplier invoices, or other history, archive it instead.`
      )}`
    );
  }
  await writeAudit(supabase, "delete_permanent", "item", itemId, "Permanently deleted item");
  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent("Item permanently deleted.")}`);
}

export async function restoreItem(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const { error } = await supabase.from("items").update({ is_active: true }).eq("id", itemId);
  if (error) redirect(`/inventory?error=${encodeURIComponent(`Item could not be restored: ${errorMessage(error)}`)}`);
  await writeAudit(supabase, "restore", "item", itemId, "Restored archived item");
  revalidatePath("/inventory");
  redirect(`/inventory?success=${encodeURIComponent("Item restored.")}`);
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
  if (!customerId) pageError("/invoices/new", "Select a customer before posting an invoice.");

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

  if (!lines.length) pageError("/invoices/new", "Add at least one invoice item with quantity greater than zero.");
  if (lines.some((line) => line.unit_price < 0)) pageError("/invoices/new", "Unit price cannot be negative.");

  const subtotal = lines.reduce((total, line) => total + line.line_total, 0);
  if (subtotal <= 0) pageError("/invoices/new", "Invoice total must be greater than zero.");

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
  if (error) pageError("/invoices/new", `Invoice could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "invoice", invoice.id, `Created customer invoice ${invoiceNumber}`, { total: subtotal });

  let attachmentId: string | null = null;
  try {
    attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "customer_invoice", invoice.id);
  } catch (error) {
    pageError("/invoices/new", `Invoice was created, but the attachment could not be uploaded: ${errorMessage(error as { message?: string; code?: string; details?: string })}`);
  }
  if (attachmentId) {
    const { error: attachmentError } = await supabase.from("invoices").update({ attachment_file_id: attachmentId }).eq("id", invoice.id);
    if (attachmentError) pageError("/invoices/new", `Invoice was created, but the attachment link could not be saved: ${errorMessage(attachmentError)}`);
  }

  const { error: itemError } = await supabase.from("invoice_items").insert(lines.map((line) => ({ ...line, invoice_id: invoice.id })));
  if (itemError) pageError("/invoices/new", `Invoice line items could not be saved: ${errorMessage(itemError)}`);

  const { error: ledgerError } = await supabase.from("customer_ledger_entries").insert({
    customer_id: customerId,
    subaccount_id: subaccountId,
    invoice_id: invoice.id,
    entry_type: "invoice",
    description: `Invoice ${invoiceNumber}`,
    debit: subtotal,
    credit: 0
  });
  if (ledgerError) pageError("/invoices/new", `Customer balance entry could not be saved: ${errorMessage(ledgerError)}`);

  const { error: movementError } = await supabase.from("inventory_movements").insert(
    lines.map((line) => ({
      item_id: line.item_id,
      movement_type: "sale",
      quantity_delta: -line.quantity,
      reference_type: "invoice",
      reference_id: invoice.id,
      notes: invoiceNumber
    }))
  );
  if (movementError) pageError("/invoices/new", `Inventory deduction could not be saved: ${errorMessage(movementError)}`);

  if (text(formData, "cash_sale") === "on") {
    const { data: payment, error: paymentError } = await supabase
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
    if (paymentError) pageError("/invoices/new", `Cash sale payment could not be saved: ${errorMessage(paymentError)}`);

    const { error: cashLedgerError } = await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      invoice_id: invoice.id,
      payment_id: payment?.id,
      entry_type: "cash_sale_payment",
      description: `Cash payment for ${invoiceNumber}`,
      debit: 0,
      credit: subtotal
    });
    if (cashLedgerError) pageError("/invoices/new", `Cash sale ledger entry could not be saved: ${errorMessage(cashLedgerError)}`);

    const { error: cashSaleError } = await supabase.from("cash_sales").insert({ invoice_id: invoice.id, amount: subtotal });
    if (cashSaleError) pageError("/invoices/new", `Cash sale report entry could not be saved: ${errorMessage(cashSaleError)}`);
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
  if (!customerId) pageError("/payments", "Select a customer before recording a payment.");
  if (!["cash", "bank", "cheque"].includes(method)) pageError("/payments", "Select a valid payment method.");
  if (amount <= 0) pageError("/payments", "Payment amount must be greater than zero.");
  if (allocationAmount <= 0) pageError("/payments", "Allocated amount must be greater than zero.");
  if (allocationAmount > amount) pageError("/payments", "Allocated amount cannot be higher than the payment amount.");

  if (invoiceId) {
    const { data: invoiceStatus, error: invoiceError } = await supabase
      .from("invoice_payment_status")
      .select("invoice_id, customer_id, remaining_balance")
      .eq("invoice_id", invoiceId)
      .single();
    if (invoiceError || !invoiceStatus) pageError("/payments", `Selected invoice could not be checked: ${errorMessage(invoiceError)}`);
    if (invoiceStatus.customer_id !== customerId) pageError("/payments", "Selected invoice does not belong to the selected customer.");
    if (allocationAmount > Number(invoiceStatus.remaining_balance ?? 0)) {
      pageError("/payments", `Allocated amount is higher than the invoice remaining balance of ${invoiceStatus.remaining_balance}.`);
    }
  }

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
  if (error) pageError("/payments", `Payment could not be saved: ${errorMessage(error)}`);

  let attachmentId: string | null = null;
  try {
    attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "payment", payment.id);
  } catch (error) {
    pageError("/payments", `Payment was created, but the attachment could not be uploaded: ${errorMessage(error as { message?: string; code?: string; details?: string })}`);
  }
  if (attachmentId) {
    const { error: attachmentError } = await supabase.from("payments").update({ attachment_file_id: attachmentId }).eq("id", payment.id);
    if (attachmentError) pageError("/payments", `Payment was created, but the attachment link could not be saved: ${errorMessage(attachmentError)}`);
  }

  if (invoiceId) {
    const { error: allocationError } = await supabase.from("payment_allocations").insert({
      payment_id: payment.id,
      invoice_id: invoiceId,
      subaccount_id: subaccountId,
      amount: allocationAmount
    });
    if (allocationError) pageError("/payments", `Payment allocation could not be saved: ${errorMessage(allocationError)}`);
  }

  const { error: ledgerError } = await supabase.from("customer_ledger_entries").insert({
    customer_id: customerId,
    subaccount_id: subaccountId,
    payment_id: payment.id,
    entry_type: method === "cheque" ? "cheque_received" : "payment",
    description: `${method.toUpperCase()} payment`,
    debit: 0,
    credit: amount
  });
  if (ledgerError) pageError("/payments", `Customer balance entry could not be saved: ${errorMessage(ledgerError)}`);

  if (method === "cheque") {
    const { data: cheque, error: chequeError } = await supabase.from("cheques").insert({
      payment_id: payment.id,
      customer_id: customerId,
      cheque_number: text(formData, "reference") || null,
      bank_name: text(formData, "bank_name") || null,
      amount,
      received_date: text(formData, "payment_date") || new Date().toISOString().slice(0, 10),
      attachment_file_id: attachmentId
    }).select("id").single();
    if (chequeError) pageError("/payments", `Cheque record could not be saved: ${errorMessage(chequeError)}`);
    if (attachmentId && cheque?.id) {
      const { error: fileError } = await supabase.from("app_files").update({ owner_type: "cheque", owner_id: cheque.id }).eq("id", attachmentId);
      if (fileError) pageError("/payments", `Cheque attachment link could not be updated: ${errorMessage(fileError)}`);
    }
  }
  await writeAudit(supabase, "create", "payment", payment.id, `Recorded ${method} payment`, { amount, invoice_id: invoiceId });

  revalidatePath("/payments");
  revalidatePath(`/customers/${customerId}`);
  pageSuccess("/payments", "Payment saved.");
}

export async function updateChequeStatus(formData: FormData) {
  const supabase = await requireSupabase();
  const chequeId = text(formData, "cheque_id");
  const status = text(formData, "status");
  if (!chequeId) pageError("/cheques", "Select a cheque before changing status.");
  if (!["received", "redeemed", "bounced", "cancelled"].includes(status)) pageError("/cheques", "Select a valid cheque status.");

  const { error } = await supabase
    .from("cheques")
    .update({
      status,
      redeemed_date: status === "redeemed" ? new Date().toISOString().slice(0, 10) : null
    })
    .eq("id", chequeId);
  if (error) pageError("/cheques", `Cheque status could not be updated: ${errorMessage(error)}`);
  await writeAudit(supabase, "status", "cheque", chequeId, `Updated cheque status to ${status}`);
  revalidatePath("/cheques");
  pageSuccess("/cheques", "Cheque status updated.");
}

export async function deleteCheque(formData: FormData) {
  const supabase = await requireSupabase();
  const chequeId = text(formData, "cheque_id");
  if (!chequeId) pageError("/cheques", "Select a cheque before deleting.");
  const { error } = await supabase.from("cheques").delete().eq("id", chequeId);
  if (error) pageError("/cheques", `Cheque could not be deleted: ${errorMessage(error)}`);
  await writeAudit(supabase, "delete", "cheque", chequeId, "Deleted cheque");
  revalidatePath("/cheques");
  pageSuccess("/cheques", "Cheque deleted.");
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
  if (!itemId) pageError("/inventory/damages", "Select an item before recording damage or return.");
  if (quantity <= 0) pageError("/inventory/damages", "Quantity must be greater than zero.");
  if (estimatedCost < 0 || balanceCredit < 0 || repairCharge < 0) pageError("/inventory/damages", "Amounts cannot be negative.");

  const { data: damage, error: damageError } = await supabase
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
  if (damageError) pageError("/inventory/damages", `Damage record could not be saved: ${errorMessage(damageError)}`);
  await writeAudit(supabase, "create", "damage_record", damage?.id ?? null, "Recorded damage/return", { quantity, balanceCredit, repairCharge });
  const { error: movementError } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: "damage",
    quantity_delta: -quantity,
    unit_cost: estimatedCost,
    reference_type: "damage",
    reference_id: damage?.id,
    notes: text(formData, "reason") || null
  });
  if (movementError) pageError("/inventory/damages", `Inventory damage movement could not be saved: ${errorMessage(movementError)}`);
  if (customerId && balanceCredit > 0) {
    const { error: creditError } = await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      entry_type: "damage_credit",
      description: text(formData, "reason") || "Damage/return credit",
      debit: 0,
      credit: balanceCredit
    });
    if (creditError) pageError("/inventory/damages", `Customer balance deduction could not be saved: ${errorMessage(creditError)}`);
  }
  if (customerId && repairCharge > 0) {
    const description = missingParts
      ? `Repair charge for missing/damaged ${missingParts}`
      : text(formData, "reason") || "Repair charge";
    const { data: charge, error: chargeError } = await supabase
      .from("charges")
      .insert({
        customer_id: customerId,
        subaccount_id: subaccountId,
        description,
        amount: repairCharge
      })
      .select("id")
      .single();
    if (chargeError) pageError("/inventory/damages", `Repair charge could not be saved: ${errorMessage(chargeError)}`);

    const { error: chargeLedgerError } = await supabase.from("customer_ledger_entries").insert({
      customer_id: customerId,
      subaccount_id: subaccountId,
      entry_type: "repair_charge",
      description,
      debit: repairCharge,
      credit: 0,
      invoice_id: null
    });
    if (chargeLedgerError) pageError("/inventory/damages", `Repair charge balance entry could not be saved: ${errorMessage(chargeLedgerError)}`);
    if (charge?.id) {
      const { error: fileError } = await supabase.from("app_files").update({ owner_type: "charge", owner_id: charge.id }).eq("owner_type", "pending_charge");
      if (fileError) pageError("/inventory/damages", `Repair charge attachment link could not be updated: ${errorMessage(fileError)}`);
    }
  }
  if (supplierId && balanceCredit > 0) {
    const { error: supplierError } = await supabase.from("supplier_adjustments").insert({
      supplier_id: supplierId,
      item_id: itemId,
      adjustment_type: "damage",
      quantity,
      amount: balanceCredit,
      reason: text(formData, "reason") || null
    });
    if (supplierError) pageError("/inventory/damages", `Supplier balance deduction could not be saved: ${errorMessage(supplierError)}`);
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/damages");
  pageSuccess("/inventory/damages", "Damage or return saved.");
}

export async function recordSupplierPurchase(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  const itemId = text(formData, "item_id");
  const quantity = asNumber(formData.get("quantity"));
  const unitCost = asNumber(formData.get("unit_cost"));
  const total = quantity * unitCost;
  if (!supplierId) pageError("/suppliers", "Select a supplier before posting a supplier invoice.");
  if (!itemId) pageError("/suppliers", "Select an item before posting a supplier invoice.");
  if (quantity <= 0) pageError("/suppliers", "Supplier invoice quantity must be greater than zero.");
  if (unitCost < 0) pageError("/suppliers", "Supplier invoice unit cost cannot be negative.");

  const { data: purchase, error: purchaseError } = await supabase
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
  if (purchaseError) pageError("/suppliers", `Supplier invoice could not be saved: ${errorMessage(purchaseError)}`);

  let attachmentId: string | null = null;
  try {
    attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "supplier_invoice", purchase?.id);
  } catch (error) {
    pageError("/suppliers", `Supplier invoice was created, but the attachment could not be uploaded: ${errorMessage(error as { message?: string; code?: string; details?: string })}`);
  }
  if (attachmentId && purchase?.id) {
    const { error: attachmentError } = await supabase.from("purchase_orders").update({ attachment_file_id: attachmentId }).eq("id", purchase.id);
    if (attachmentError) pageError("/suppliers", `Supplier invoice attachment link could not be saved: ${errorMessage(attachmentError)}`);
  }
  await writeAudit(supabase, "create", "supplier_invoice", purchase?.id ?? null, `Recorded supplier invoice ${text(formData, "supplier_invoice_number") || ""}`, { total });
  const { error: movementError } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: "purchase",
    quantity_delta: quantity,
    unit_cost: unitCost,
    reference_type: "purchase_order",
    reference_id: purchase?.id
  });
  if (movementError) pageError("/suppliers", `Supplier stock movement could not be saved: ${errorMessage(movementError)}`);
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  pageSuccess("/suppliers", "Supplier invoice saved.");
}

export async function createSupplier(formData: FormData) {
  const supabase = await requireSupabase();
  const name = text(formData, "name");
  if (!name) pageError("/suppliers", "Supplier name is required.");
  const { data: supplier, error } = await supabase.from("suppliers").insert({
    name: text(formData, "name"),
    contact_name: text(formData, "contact_name") || null,
    phone: text(formData, "phone") || null,
    address: text(formData, "address") || null
  }).select("id").single();
  if (error) pageError("/suppliers", `Supplier could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "supplier", supplier?.id ?? null, `Created supplier ${name}`);
  revalidatePath("/suppliers");
  pageSuccess("/suppliers", "Supplier saved.");
}

export async function updateSupplier(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  const name = text(formData, "name");
  if (!supplierId) pageError("/suppliers", "Select a supplier before saving changes.");
  if (!name) pageError("/suppliers", "Supplier name is required.");
  const { error } = await supabase
    .from("suppliers")
    .update({
      name,
      contact_name: text(formData, "contact_name") || null,
      phone: text(formData, "phone") || null,
      address: text(formData, "address") || null
    })
    .eq("id", supplierId);
  if (error) pageError("/suppliers", `Supplier could not be updated: ${errorMessage(error)}`);
  await writeAudit(supabase, "update", "supplier", supplierId, `Updated supplier ${name}`);
  revalidatePath("/suppliers");
  pageSuccess("/suppliers", "Supplier updated.");
}

export async function deleteSupplier(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  if (!supplierId) pageError("/suppliers", "Select a supplier before deleting.");
  const { error } = await supabase.from("suppliers").update({ is_active: false }).eq("id", supplierId);
  if (error) pageError("/suppliers", `Supplier could not be deleted: ${errorMessage(error)}`);
  await writeAudit(supabase, "delete", "supplier", supplierId, "Deleted supplier");
  revalidatePath("/suppliers");
  pageSuccess("/suppliers", "Supplier deleted.");
}

export async function recordSupplierPayment(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  const purchaseOrderId = text(formData, "purchase_order_id") || null;
  const amount = asNumber(formData.get("amount"));
  const redirectPath = purchaseOrderId ? `/suppliers/invoices/${purchaseOrderId}` : "/suppliers";
  if (!supplierId) pageError(redirectPath, "Select a supplier before recording a supplier payment.");
  if (amount <= 0) pageError(redirectPath, "Supplier payment amount must be greater than zero.");

  const { data: payment, error } = await supabase.from("supplier_payments").insert({
    supplier_id: supplierId,
    purchase_order_id: purchaseOrderId,
    amount,
    reference: text(formData, "reference") || null,
    notes: text(formData, "notes") || null
  }).select("id").single();
  if (error) pageError(redirectPath, `Supplier payment could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "supplier_payment", payment?.id ?? null, "Recorded supplier payment", { amount, purchase_order_id: purchaseOrderId });
  revalidatePath("/suppliers");
  if (purchaseOrderId) revalidatePath(`/suppliers/invoices/${purchaseOrderId}`);
  pageSuccess(redirectPath, "Supplier payment saved.");
}

export async function recordSupplierAdjustment(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  const purchaseOrderId = text(formData, "purchase_order_id") || null;
  const amount = asNumber(formData.get("amount"));
  const quantity = asNumber(formData.get("quantity"));
  const redirectPath = purchaseOrderId ? `/suppliers/invoices/${purchaseOrderId}` : "/suppliers";
  if (!supplierId) pageError(redirectPath, "Select a supplier before recording a return or damage.");
  if (amount < 0 || quantity < 0) pageError(redirectPath, "Supplier adjustment quantity and amount cannot be negative.");

  const { data: adjustment, error: adjustmentError } = await supabase
    .from("supplier_adjustments")
    .insert({
      supplier_id: supplierId,
      purchase_order_id: purchaseOrderId,
      item_id: text(formData, "item_id") || null,
      adjustment_type: text(formData, "adjustment_type") || "return",
      quantity,
      amount,
      reason: text(formData, "reason") || null,
      adjustment_date: text(formData, "adjustment_date") || new Date().toISOString().slice(0, 10)
    })
    .select("id")
    .single();
  if (adjustmentError) pageError(redirectPath, `Supplier return or damage could not be saved: ${errorMessage(adjustmentError)}`);

  let attachmentId: string | null = null;
  try {
    attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "supplier_adjustment", adjustment?.id);
  } catch (error) {
    pageError(redirectPath, `Supplier return/damage was created, but the attachment could not be uploaded: ${errorMessage(error as { message?: string; code?: string; details?: string })}`);
  }
  if (attachmentId && adjustment?.id) {
    const { error: attachmentError } = await supabase.from("supplier_adjustments").update({ attachment_file_id: attachmentId }).eq("id", adjustment.id);
    if (attachmentError) pageError(redirectPath, `Supplier adjustment attachment link could not be saved: ${errorMessage(attachmentError)}`);
  }
  await writeAudit(supabase, "create", "supplier_adjustment", adjustment?.id ?? null, "Recorded supplier adjustment", { amount });
  revalidatePath("/suppliers");
  revalidatePath("/reports/daily");
  if (purchaseOrderId) revalidatePath(`/suppliers/invoices/${purchaseOrderId}`);
  pageSuccess(redirectPath, "Supplier return or damage saved.");
}

export async function recordExpense(formData: FormData) {
  const supabase = await requireSupabase();
  const description = text(formData, "description");
  const amount = asNumber(formData.get("amount"));
  if (!description) pageError("/expenses", "Expense description is required.");
  if (amount <= 0) pageError("/expenses", "Expense amount must be greater than zero.");
  const { data: expense, error } = await supabase.from("expenses").insert({
    description,
    category: text(formData, "category") || "general",
    amount,
    expense_date: text(formData, "expense_date") || new Date().toISOString().slice(0, 10)
  }).select("id").single();
  if (error) pageError("/expenses", `Expense could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "expense", expense?.id ?? null, `Recorded expense ${description}`, { amount });
  revalidatePath("/expenses");
  revalidatePath("/reports/daily");
  pageSuccess("/expenses", "Expense saved.");
}

export async function updateExpense(formData: FormData) {
  const supabase = await requireSupabase();
  const expenseId = text(formData, "expense_id");
  const description = text(formData, "description");
  const amount = asNumber(formData.get("amount"));
  if (!expenseId) pageError("/expenses", "Select an expense before saving changes.");
  if (!description) pageError("/expenses", "Expense description is required.");
  if (amount <= 0) pageError("/expenses", "Expense amount must be greater than zero.");
  const { error } = await supabase
    .from("expenses")
    .update({
      description,
      category: text(formData, "category") || "general",
      amount,
      expense_date: text(formData, "expense_date") || new Date().toISOString().slice(0, 10)
    })
    .eq("id", expenseId);
  if (error) pageError("/expenses", `Expense could not be updated: ${errorMessage(error)}`);
  await writeAudit(supabase, "update", "expense", expenseId, `Updated expense ${description}`);
  revalidatePath("/expenses");
  revalidatePath("/reports/daily");
  pageSuccess("/expenses", "Expense updated.");
}

export async function deleteExpense(formData: FormData) {
  const supabase = await requireSupabase();
  const expenseId = text(formData, "expense_id");
  if (!expenseId) pageError("/expenses", "Select an expense before deleting.");
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) pageError("/expenses", `Expense could not be deleted: ${errorMessage(error)}`);
  await writeAudit(supabase, "delete", "expense", expenseId, "Deleted expense");
  revalidatePath("/expenses");
  revalidatePath("/reports/daily");
  pageSuccess("/expenses", "Expense deleted.");
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
