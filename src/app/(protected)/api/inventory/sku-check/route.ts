import { NextResponse } from "next/server";
import { normalizeSku } from "@/lib/sku";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sku = normalizeSku(url.searchParams.get("sku"));
  const excludeId = url.searchParams.get("excludeId");

  if (!sku) {
    return NextResponse.json({ ok: true, sku: null, exists: false });
  }

  const supabase = await createClient();
  let query = supabase.from("items").select("id, name, sku, is_active").eq("sku", sku).limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    sku,
    exists: Boolean(data),
    item: data
  });
}
