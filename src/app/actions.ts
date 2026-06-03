"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
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

function moneyNumber(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
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

async function requireAdminSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createSupabaseAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

async function upsertCategoryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryName: string,
  errorPath: string
) {
  if (!categoryName) return null;
  const adminSupabase = await requireAdminSupabase();
  const client = adminSupabase ?? supabase;
  const { data, error } = await client
    .from("categories")
    .upsert({ name: categoryName }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) pageError(errorPath, `Category "${categoryName}" could not be saved: ${errorMessage(error)}`);
  return data?.id ?? null;
}

async function upsertSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  supplierName: string,
  errorPath: string
) {
  if (!supplierName) return null;
  const adminSupabase = await requireAdminSupabase();
  const client = adminSupabase ?? supabase;
  const { data, error } = await client
    .from("suppliers")
    .upsert({ name: supplierName, is_active: true }, { onConflict: "name" })
    .select("id")
    .single();
  if (error) pageError(errorPath, `Supplier "${supplierName}" could not be saved: ${errorMessage(error)}`);
  return data?.id ?? null;
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
  if (error) pageError("/customers", `Customer could not be created: ${errorMessage(error)}`);

  const subaccounts = text(formData, "subaccounts")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ customer_id: data.id, name }));
  if (subaccounts.length) {
    const { error: subaccountError } = await supabase.from("customer_subaccounts").insert(subaccounts);
    if (subaccountError) pageError(`/customers/${data.id}`, `Customer was created, but sub-balances could not be saved: ${errorMessage(subaccountError)}`);
  }
  await writeAudit(supabase, "create", "customer", data.id, `Created customer ${parsed.name}`);

  revalidatePath("/customers");
  pageSuccess(`/customers/${data.id}`, `Created customer: ${parsed.name}`);
}

export async function bulkImportCustomers(formData: FormData) {
  const supabase = await requireSupabase();
  const names = text(formData, "names")
    .split(/\r?\n/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const uniqueNames = Array.from(new Map(names.map((name) => [name.toUpperCase(), name])).values());
  if (!uniqueNames.length) pageError("/customers", "Paste at least one customer name to import.");

  const { data: existing, error: existingError } = await supabase
    .from("customers")
    .select("name")
    .in("name", uniqueNames);
  if (existingError) pageError("/customers", `Existing customers could not be checked: ${errorMessage(existingError)}`);

  const existingNames = new Set((existing ?? []).map((row) => String(row.name).toUpperCase()));
  const customersToInsert = uniqueNames.filter((name) => !existingNames.has(name.toUpperCase())).map((name) => ({ name }));
  if (customersToInsert.length) {
    const { error } = await supabase.from("customers").insert(customersToInsert);
    if (error) pageError("/customers", `Customers could not be imported: ${errorMessage(error)}`);
  }

  await writeAudit(supabase, "bulk_import", "customer", null, "Bulk imported customers", {
    input_count: names.length,
    unique_count: uniqueNames.length,
    added_count: customersToInsert.length,
    skipped_count: uniqueNames.length - customersToInsert.length
  });
  revalidatePath("/customers");
  pageSuccess("/customers", `Imported ${customersToInsert.length} customers. Skipped ${uniqueNames.length - customersToInsert.length} existing or repeated names.`);
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
  if (error) pageError(`/customers/${customerId}`, `Customer could not be updated: ${errorMessage(error)}`);
  await writeAudit(supabase, "update", "customer", customerId, `Updated customer ${text(formData, "name")}`);
  revalidatePath(`/customers/${customerId}`);
  pageSuccess(`/customers/${customerId}`, "Customer updated.");
}

export async function addCustomerSubaccount(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const name = text(formData, "name");
  if (!name) pageError(`/customers/${customerId}`, "Sub-balance name is required.");
  const { error } = await supabase.from("customer_subaccounts").insert({ customer_id: customerId, name });
  if (error) pageError(`/customers/${customerId}`, `Sub-balance could not be added: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "customer_subaccount", customerId, `Added sub-balance ${name}`);
  revalidatePath(`/customers/${customerId}`);
  pageSuccess(`/customers/${customerId}`, `Added sub-balance: ${name}`);
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
    pageError(`/customers/${customerId}`, "Only zero-balance sub-balances can be removed.");
  }
  const { error } = await supabase.from("customer_subaccounts").delete().eq("id", subaccountId);
  if (error) pageError(`/customers/${customerId}`, `Sub-balance could not be removed: ${errorMessage(error)}`);
  await writeAudit(supabase, "delete", "customer_subaccount", subaccountId, "Removed customer sub-balance");
  revalidatePath(`/customers/${customerId}`);
  pageSuccess(`/customers/${customerId}`, "Sub-balance removed.");
}

export async function updateCustomerSubaccount(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const subaccountId = text(formData, "subaccount_id");
  const name = text(formData, "name");
  if (!name) pageError(`/customers/${customerId}`, "Sub-balance name is required.");
  const { error } = await supabase.from("customer_subaccounts").update({ name }).eq("id", subaccountId);
  if (error) pageError(`/customers/${customerId}`, `Sub-balance could not be updated: ${errorMessage(error)}`);
  await writeAudit(supabase, "update", "customer_subaccount", subaccountId, `Updated sub-balance ${name}`);
  revalidatePath(`/customers/${customerId}`);
  pageSuccess(`/customers/${customerId}`, "Sub-balance updated.");
}

export async function adjustCustomerSubaccountBalance(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const subaccountId = text(formData, "subaccount_id");
  const direction = text(formData, "direction");
  const amount = asNumber(formData.get("amount"));
  const entryDate = text(formData, "entry_date") || new Date().toISOString().slice(0, 10);
  const notes = text(formData, "notes");
  if (!subaccountId) pageError(`/customers/${customerId}`, "Select a sub-balance before adjusting.");
  if (amount <= 0) pageError(`/customers/${customerId}`, "Adjustment amount must be greater than zero.");
  if (!["add", "subtract"].includes(direction)) pageError(`/customers/${customerId}`, "Select add or subtract for the sub-balance adjustment.");

  const description = notes || (direction === "add" ? "Manual sub-balance addition" : "Manual sub-balance deduction");
  const { error } = await supabase.from("customer_ledger_entries").insert({
    customer_id: customerId,
    subaccount_id: subaccountId,
    entry_type: "sub_balance_adjustment",
    description,
    debit: direction === "add" ? amount : 0,
    credit: direction === "subtract" ? amount : 0,
    entry_date: entryDate
  });
  if (error) pageError(`/customers/${customerId}`, `Sub-balance adjustment could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "adjust", "customer_subaccount", subaccountId, description, { amount, direction });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  pageSuccess(`/customers/${customerId}`, "Sub-balance adjusted.");
}

export async function deleteCustomer(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const { error } = await supabase.from("customers").update({ is_active: false }).eq("id", customerId);
  if (error) pageError(`/customers/${customerId}`, `Customer could not be deleted: ${errorMessage(error)}`);
  await writeAudit(supabase, "delete", "customer", customerId, "Deleted customer");
  revalidatePath("/customers");
  pageSuccess("/customers", "Customer deleted.");
}

export async function recordCustomerOpeningBalance(formData: FormData) {
  const supabase = await requireSupabase();
  const customerId = text(formData, "customer_id");
  const subaccountId = text(formData, "subaccount_id") || null;
  const direction = text(formData, "direction");
  const amount = asNumber(formData.get("amount"));
  const entryDate = text(formData, "entry_date") || new Date().toISOString().slice(0, 10);
  const notes = text(formData, "notes");
  if (!customerId) pageError("/customers", "Select a customer before recording an opening balance.");
  if (amount <= 0) pageError(`/customers/${customerId}`, "Opening balance amount must be greater than zero.");
  if (!["customer_owes", "customer_credit"].includes(direction)) pageError(`/customers/${customerId}`, "Select a valid opening balance type.");

  const description = notes || (direction === "customer_owes" ? "Opening balance from previous records" : "Opening credit from previous records");
  const { error } = await supabase.from("customer_ledger_entries").insert({
    customer_id: customerId,
    subaccount_id: subaccountId,
    entry_type: "opening_balance",
    description,
    debit: direction === "customer_owes" ? amount : 0,
    credit: direction === "customer_credit" ? amount : 0,
    entry_date: entryDate
  });
  if (error) pageError(`/customers/${customerId}`, `Opening balance could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "customer_opening_balance", customerId, description, { amount, direction, subaccount_id: subaccountId });
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  pageSuccess(`/customers/${customerId}`, "Customer opening balance saved.");
}

export async function createItem(formData: FormData) {
  const supabase = await requireSupabase();
  const categoryName = text(formData, "category");
  const categoryId = await upsertCategoryId(supabase, categoryName, "/inventory");
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

type ParsedInventoryLine = {
  name: string;
  sku: string;
  supplierName: string;
  categoryName: string;
  unitCost: number;
  defaultPrice: number;
  quantity: number;
};

function parseInventoryLine(line: string): ParsedInventoryLine | null {
  const columns = line.includes("|") ? line.split("|").map((part) => part.trim()) : line.split("\t").map((part) => part.trim());
  const descriptor = columns[0]?.replace(/\s+/g, " ").trim();
  if (!descriptor) return null;

  const supplierName = "";
  let sku = "";
  const name = descriptor;
  const descriptorParts = descriptor.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (descriptorParts.length >= 3) {
    // Keep brand-style prefixes, such as "MICROMATIC", inside the item name.
    sku = descriptorParts[1];
  }

  const secondColumnIsNumber = columns[1] === "" || Number.isFinite(Number((columns[1] ?? "").replace(/[^\d.-]/g, "")));
  if (columns.length > 1 && !secondColumnIsNumber) {
    sku = columns[1] || sku;
    return {
      name,
      sku: normalizeSku(sku) ?? "",
      supplierName: columns[6] || supplierName,
      categoryName: columns[5] || "",
      unitCost: moneyNumber(columns[2]),
      defaultPrice: moneyNumber(columns[3]),
      quantity: moneyNumber(columns[4])
    };
  }

  return {
    name,
    sku: normalizeSku(sku) ?? "",
    supplierName: columns[5] || supplierName,
    categoryName: columns[4] || "",
    unitCost: moneyNumber(columns[1]),
    defaultPrice: moneyNumber(columns[2]),
    quantity: moneyNumber(columns[3])
  };
}

export async function bulkImportInventoryItems(formData: FormData) {
  const supabase = await requireSupabase();
  const rawLines = String(formData.get("items") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rawLines.length) pageError("/inventory", "Paste at least one inventory item to import.");

  const parsedLines = rawLines.map(parseInventoryLine).filter(Boolean) as ParsedInventoryLine[];
  if (!parsedLines.length) pageError("/inventory", "No valid inventory rows were found.");

  const uniqueBySkuOrName = new Map<string, ParsedInventoryLine>();
  for (const item of parsedLines) {
    const key = item.sku ? `sku:${item.sku}` : `name:${item.name.toUpperCase()}`;
    if (!uniqueBySkuOrName.has(key)) uniqueBySkuOrName.set(key, item);
  }
  const uniqueItems = Array.from(uniqueBySkuOrName.values());
  const skuList = uniqueItems.map((item) => item.sku).filter(Boolean);
  const nameList = uniqueItems.map((item) => item.name);

  const [existingSkuResult, existingNameResult] = await Promise.all([
    skuList.length ? supabase.from("items").select("sku").in("sku", skuList) : Promise.resolve({ data: [], error: null }),
    nameList.length ? supabase.from("items").select("name").in("name", nameList) : Promise.resolve({ data: [], error: null })
  ]);
  if (existingSkuResult.error) pageError("/inventory", `Existing SKUs could not be checked: ${errorMessage(existingSkuResult.error)}`);
  if (existingNameResult.error) pageError("/inventory", `Existing item names could not be checked: ${errorMessage(existingNameResult.error)}`);

  const existingSkus = new Set((existingSkuResult.data ?? []).map((row) => String(row.sku).toUpperCase()));
  const existingNames = new Set((existingNameResult.data ?? []).map((row) => String(row.name).toUpperCase()));
  const itemsToCreate = uniqueItems.filter((item) => item.sku ? !existingSkus.has(item.sku.toUpperCase()) : !existingNames.has(item.name.toUpperCase()));
  let added = 0;

  for (const item of itemsToCreate) {
    const supplierId = await upsertSupplierId(supabase, item.supplierName, "/inventory");
    const categoryId = await upsertCategoryId(supabase, item.categoryName, "/inventory");

    const { data: createdItem, error } = await supabase
      .from("items")
      .insert({
        name: item.name,
        sku: item.sku || null,
        primary_supplier_id: supplierId,
        category_id: categoryId,
        unit_cost: item.unitCost,
        default_price: item.defaultPrice,
        current_quantity: item.quantity,
        reorder_level: 0
      })
      .select("id")
      .single();
    if (error) pageError("/inventory", `Item "${item.name}" could not be imported: ${errorMessage(error)}`);

    if (createdItem?.id && supplierId) {
      const { error: supplierItemError } = await supabase.from("supplier_items").upsert(
        {
          supplier_id: supplierId,
          item_id: createdItem.id,
          supplier_price: item.unitCost
        },
        { onConflict: "supplier_id,item_id" }
      );
      if (supplierItemError) pageError("/inventory", `Item "${item.name}" was imported, but supplier link failed: ${errorMessage(supplierItemError)}`);
    }
    added += 1;
  }

  await writeAudit(supabase, "bulk_import", "item", null, "Bulk imported inventory items", {
    input_count: rawLines.length,
    unique_count: uniqueItems.length,
    added_count: added,
    skipped_count: uniqueItems.length - added
  });
  revalidatePath("/inventory");
  pageSuccess("/inventory", `Imported ${added} inventory items. Skipped ${uniqueItems.length - added} duplicates from existing items or repeated pasted rows.`);
}

export async function updateItem(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const sku = normalizeSku(text(formData, "sku"));
  const categoryName = text(formData, "category");
  const categoryId = await upsertCategoryId(supabase, categoryName, "/inventory");
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

export async function adjustItemQuantity(formData: FormData) {
  const supabase = await requireSupabase();
  const itemId = text(formData, "item_id");
  const newQuantity = asNumber(formData.get("new_quantity"));
  const reason = text(formData, "reason") || "Manual stock count correction";
  if (!itemId) pageError("/inventory", "Select an item before adjusting stock.");
  if (newQuantity < 0) pageError("/inventory", "Stock quantity cannot be negative.");

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, name, current_quantity, unit_cost")
    .eq("id", itemId)
    .single();
  if (itemError || !item) pageError("/inventory", `Item could not be loaded for stock adjustment: ${errorMessage(itemError)}`);

  const currentQuantity = Number(item.current_quantity ?? 0);
  const quantityDelta = newQuantity - currentQuantity;
  if (quantityDelta === 0) pageSuccess("/inventory", `No stock change needed for ${item.name}.`);

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    item_id: itemId,
    movement_type: "adjustment",
    quantity_delta: quantityDelta,
    unit_cost: Number(item.unit_cost ?? 0),
    reference_type: "manual_adjustment",
    reference_id: itemId,
    notes: reason
  });
  if (movementError) pageError("/inventory", `Stock quantity could not be adjusted: ${errorMessage(movementError)}`);

  await writeAudit(supabase, "adjust_stock", "item", itemId, `Adjusted stock for ${item.name}`, {
    previous_quantity: currentQuantity,
    new_quantity: newQuantity,
    quantity_delta: quantityDelta,
    reason
  });
  revalidatePath("/inventory");
  pageSuccess("/inventory", `Stock adjusted for ${item.name}: ${currentQuantity} to ${newQuantity}.`);
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

export async function updatePostedInvoice(formData: FormData) {
  const supabase = await requireSupabase();
  const invoiceId = text(formData, "invoice_id");
  if (!invoiceId) pageError("/invoices/new", "Select an invoice before saving changes.");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, subaccount_id, invoice_date")
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) pageError(`/invoices/${invoiceId}/edit`, `Invoice could not be loaded: ${errorMessage(invoiceError)}`);

  const { data: existingLines, error: linesError } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("id");
  if (linesError) pageError(`/invoices/${invoiceId}/edit`, `Invoice lines could not be loaded: ${errorMessage(linesError)}`);

  const lineIds = formData.getAll("line_id").map(String);
  const descriptions = formData.getAll("description").map(String);
  const quantities = formData.getAll("quantity").map(asNumber);
  const prices = formData.getAll("unit_price").map(asNumber);
  const existingById = new Map((existingLines ?? []).map((line) => [line.id, line]));
  const updates = lineIds.map((lineId, index) => {
    const existing = existingById.get(lineId);
    if (!existing) return null;
    const quantity = quantities[index];
    const unitPrice = prices[index];
    return {
      id: lineId,
      item_id: existing.item_id,
      old_quantity: Number(existing.quantity ?? 0),
      description: descriptions[index] || existing.description || "Item",
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice
    };
  }).filter(Boolean) as Array<{
    id: string;
    item_id: string;
    old_quantity: number;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;

  if (!updates.length) pageError(`/invoices/${invoiceId}/edit`, "No invoice lines were found to update.");
  if (updates.some((line) => line.quantity <= 0)) pageError(`/invoices/${invoiceId}/edit`, "Invoice quantities must be greater than zero.");
  if (updates.some((line) => line.unit_price < 0)) pageError(`/invoices/${invoiceId}/edit`, "Invoice prices cannot be negative.");

  const subtotal = updates.reduce((sum, line) => sum + line.line_total, 0);
  if (subtotal <= 0) pageError(`/invoices/${invoiceId}/edit`, "Invoice total must be greater than zero.");

  for (const line of updates) {
    const { error } = await supabase
      .from("invoice_items")
      .update({
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total
      })
      .eq("id", line.id);
    if (error) pageError(`/invoices/${invoiceId}/edit`, `Invoice line could not be updated: ${errorMessage(error)}`);
  }

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({ subtotal, total: subtotal })
    .eq("id", invoiceId);
  if (invoiceUpdateError) pageError(`/invoices/${invoiceId}/edit`, `Invoice total could not be updated: ${errorMessage(invoiceUpdateError)}`);

  const { error: ledgerError } = await supabase
    .from("customer_ledger_entries")
    .update({ debit: subtotal, credit: 0 })
    .eq("invoice_id", invoiceId)
    .eq("entry_type", "invoice");
  if (ledgerError) pageError(`/invoices/${invoiceId}/edit`, `Customer balance entry could not be updated: ${errorMessage(ledgerError)}`);

  const inventoryAdjustments = updates
    .map((line) => ({
      item_id: line.item_id,
      movement_type: "adjustment",
      quantity_delta: line.old_quantity - line.quantity,
      reference_type: "invoice_correction",
      reference_id: invoiceId,
      notes: `Correction for invoice ${invoice.invoice_number}`
    }))
    .filter((movement) => movement.quantity_delta !== 0);
  if (inventoryAdjustments.length) {
    const { error: movementError } = await supabase.from("inventory_movements").insert(inventoryAdjustments);
    if (movementError) pageError(`/invoices/${invoiceId}/edit`, `Inventory correction could not be saved: ${errorMessage(movementError)}`);
  }

  const { data: cashSaleRows } = await supabase.from("cash_sales").select("id").eq("invoice_id", invoiceId);
  if (cashSaleRows?.length) {
    await supabase.from("cash_sales").update({ amount: subtotal }).eq("invoice_id", invoiceId);
    await supabase
      .from("payments")
      .update({ amount: subtotal })
      .eq("customer_id", invoice.customer_id)
      .eq("reference", invoice.invoice_number)
      .eq("method", "cash");
    await supabase
      .from("customer_ledger_entries")
      .update({ credit: subtotal, debit: 0 })
      .eq("invoice_id", invoiceId)
      .eq("entry_type", "cash_sale_payment");
  }

  await writeAudit(supabase, "update", "invoice", invoiceId, `Edited invoice ${invoice.invoice_number}`, { total: subtotal, line_count: updates.length });
  revalidatePath(`/invoices/${invoiceId}/print`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  revalidatePath(`/customers/${invoice.customer_id}`);
  revalidatePath("/inventory");
  pageSuccess(`/invoices/${invoiceId}/edit`, "Invoice updated and inventory correction posted.");
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
  const itemIds = formData.getAll("item_id").map(String);
  const quantities = formData.getAll("quantity").map(asNumber);
  const unitCosts = formData.getAll("unit_cost").map(asNumber);
  const supplierInvoiceNumber = text(formData, "supplier_invoice_number") || null;
  const lines = itemIds
    .map((itemId, index) => ({
      supplier_id: supplierId,
      item_id: itemId,
      quantity: quantities[index],
      unit_cost: unitCosts[index],
      total: quantities[index] * unitCosts[index],
      supplier_invoice_number: supplierInvoiceNumber
    }))
    .filter((line) => line.item_id && line.quantity > 0);
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  if (!supplierId) pageError("/suppliers", "Select a supplier before posting a supplier invoice.");
  if (!lines.length) pageError("/suppliers", "Add at least one supplier invoice item with quantity greater than zero.");
  if (lines.some((line) => line.unit_cost < 0)) pageError("/suppliers", "Supplier invoice unit cost cannot be negative.");

  const { data: purchases, error: purchaseError } = await supabase
    .from("purchase_orders")
    .insert(lines)
    .select("id, item_id, quantity, unit_cost, total");
  if (purchaseError) pageError("/suppliers", `Supplier invoice could not be saved: ${errorMessage(purchaseError)}`);
  const postedPurchases = purchases ?? [];
  const firstPurchaseId = postedPurchases[0]?.id ?? null;

  let attachmentId: string | null = null;
  try {
    attachmentId = await uploadOptionalFile(supabase, formData, "attachment", "supplier_invoice", firstPurchaseId ?? undefined);
  } catch (error) {
    pageError("/suppliers", `Supplier invoice was created, but the attachment could not be uploaded: ${errorMessage(error as { message?: string; code?: string; details?: string })}`);
  }
  if (attachmentId && postedPurchases.length) {
    const { error: attachmentError } = await supabase.from("purchase_orders").update({ attachment_file_id: attachmentId }).in("id", postedPurchases.map((purchase) => purchase.id));
    if (attachmentError) pageError("/suppliers", `Supplier invoice attachment link could not be saved: ${errorMessage(attachmentError)}`);
  }
  await writeAudit(supabase, "create", "supplier_invoice", firstPurchaseId, `Recorded supplier invoice ${supplierInvoiceNumber || ""}`, { total, line_count: postedPurchases.length });
  const { error: movementError } = await supabase.from("inventory_movements").insert(
    postedPurchases.map((purchase) => ({
      item_id: purchase.item_id,
      movement_type: "purchase",
      quantity_delta: purchase.quantity,
      unit_cost: purchase.unit_cost,
      reference_type: "purchase_order",
      reference_id: purchase.id
    }))
  );
  if (movementError) pageError("/suppliers", `Supplier stock movement could not be saved: ${errorMessage(movementError)}`);
  revalidatePath("/suppliers");
  revalidatePath("/inventory");
  pageSuccess("/suppliers", `Supplier invoice saved with ${postedPurchases.length} item line${postedPurchases.length === 1 ? "" : "s"}.`);
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

export async function recordSupplierOpeningBalance(formData: FormData) {
  const supabase = await requireSupabase();
  const supplierId = text(formData, "supplier_id");
  const direction = text(formData, "direction");
  const amount = asNumber(formData.get("amount"));
  const adjustmentDate = text(formData, "adjustment_date") || new Date().toISOString().slice(0, 10);
  const notes = text(formData, "notes");
  if (!supplierId) pageError("/suppliers", "Select a supplier before recording an opening balance.");
  if (amount <= 0) pageError("/suppliers", "Opening balance amount must be greater than zero.");
  if (!["we_owe_supplier", "supplier_credit"].includes(direction)) pageError("/suppliers", "Select a valid supplier opening balance type.");

  const signedAmount = direction === "we_owe_supplier" ? -amount : amount;
  const reason = notes || (direction === "we_owe_supplier" ? "Opening payable from previous records" : "Opening supplier credit from previous records");
  const { error } = await supabase.from("supplier_adjustments").insert({
    supplier_id: supplierId,
    adjustment_type: "credit",
    quantity: 0,
    amount: signedAmount,
    reason,
    adjustment_date: adjustmentDate
  });
  if (error) pageError("/suppliers", `Supplier opening balance could not be saved: ${errorMessage(error)}`);
  await writeAudit(supabase, "create", "supplier_opening_balance", supplierId, reason, { amount, signed_amount: signedAmount, direction });
  revalidatePath("/suppliers");
  revalidatePath("/reports/daily");
  pageSuccess("/suppliers", "Supplier opening balance saved.");
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
