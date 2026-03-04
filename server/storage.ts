// Storage helpers using Supabase Storage
// Replaces the legacy Forge proxy storage

import { createClient } from "@supabase/supabase-js";

const BUCKET = "uploads";

function getSupabaseStorage() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Storage credentials missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey).storage;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const storage = getSupabaseStorage();
  const key = normalizeKey(relKey);

  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

  const { error } = await storage
    .from(BUCKET)
    .upload(key, bytes, { contentType, upsert: true });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = storage.from(BUCKET).getPublicUrl(key);

  return { key, url: urlData.publicUrl };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const storage = getSupabaseStorage();
  const key = normalizeKey(relKey);

  const { data: urlData } = storage.from(BUCKET).getPublicUrl(key);

  return { key, url: urlData.publicUrl };
}
