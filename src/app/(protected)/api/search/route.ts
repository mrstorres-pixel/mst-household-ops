import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const results = await globalSearch(q);
  return NextResponse.json({ ok: true, q, results });
}
