// Lender pre-qual document vault — server fns.
//
// The client uploads files directly to the private `lender-docs` storage
// bucket using the user's session (RLS scopes objects by `userId/...`).
// These server functions handle the metadata row + signed-URL minting +
// deletion (which removes the storage object using admin privileges so we
// never leave orphans).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const LENDER_CHECKLIST = [
  { id: "w2", title: "W-2s (last 2 years)", required: true, hint: "Both years if employed" },
  { id: "tax_return", title: "Tax returns (last 2 years)", required: true, hint: "Federal returns, all schedules" },
  { id: "pay_stub", title: "Pay stubs (last 30 days)", required: true, hint: "Most recent 2 pay periods" },
  { id: "bank_statement", title: "Bank statements (last 2 months)", required: true, hint: "All accounts you'll use for the down payment" },
  { id: "id", title: "Government-issued ID", required: true, hint: "Driver's license or passport" },
  { id: "gift_letter", title: "Gift letter (if applicable)", required: false, hint: "Required if any down-payment funds are gifted" },
  { id: "employment_letter", title: "Employment verification (if requested)", required: false, hint: "Letter from employer confirming role + salary" },
  { id: "other", title: "Other documents", required: false, hint: "Anything else your lender asked for" },
] as const;

export type ChecklistItemId = (typeof LENDER_CHECKLIST)[number]["id"];

const checklistItemSchema = z.enum([
  "w2",
  "tax_return",
  "pay_stub",
  "bank_statement",
  "id",
  "gift_letter",
  "employment_letter",
  "other",
]);

export const listLenderDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("lender_documents")
      .select("id, checklist_item, file_path, file_name, file_size, mime_type, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { documents: data ?? [] };
  });

export const recordLenderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        checklistItem: checklistItemSchema,
        filePath: z.string().min(1).max(500),
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().min(0).max(50 * 1024 * 1024),
        mimeType: z.string().max(100).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Sanity: the path must live under the user's folder — defense in depth
    // alongside the storage RLS policy.
    if (!data.filePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid file path");
    }
    const { data: row, error } = await supabaseAdmin
      .from("lender_documents")
      .insert({
        user_id: context.userId,
        checklist_item: data.checklistItem,
        file_path: data.filePath,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType ?? null,
        status: "uploaded",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { document: row };
  });

export const deleteLenderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error: fetchErr } = await supabaseAdmin
      .from("lender_documents")
      .select("id, file_path, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!doc || doc.user_id !== context.userId) {
      throw new Error("Document not found");
    }
    // Remove storage object first; ignore "not found" errors.
    await supabaseAdmin.storage.from("lender-docs").remove([doc.file_path]);
    const { error: delErr } = await supabaseAdmin
      .from("lender_documents")
      .delete()
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const getLenderDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await supabaseAdmin
      .from("lender_documents")
      .select("file_path, file_name, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc || doc.user_id !== context.userId) {
      throw new Error("Document not found");
    }
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("lender-docs")
      .createSignedUrl(doc.file_path, 60 * 5); // 5 minutes
    if (signErr || !signed) throw new Error(signErr?.message ?? "Couldn't sign URL");
    return { url: signed.signedUrl, fileName: doc.file_name };
  });
