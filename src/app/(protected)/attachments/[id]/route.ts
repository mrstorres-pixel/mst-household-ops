import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("app_files").select("file_path").eq("id", id).maybeSingle();

  if (!data?.file_path) {
    return new NextResponse("Attachment not found", { status: 404 });
  }

  const { data: signed } = await supabase.storage.from("mst-attachments").createSignedUrl(data.file_path, 60 * 10);

  if (!signed?.signedUrl) {
    return new NextResponse("Attachment unavailable", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
