/**
 * Supabase Storage Module
 *
 * Replaces the legacy Manus Forge S3 proxy.
 * Both buckets (attachments, approved-letters) are PRIVATE.
 * Files are uploaded using the service-role admin client.
 * Access is granted via short-lived signed URLs generated on demand.
 *
 * Buckets:
 *   - "attachments"       — user-uploaded supporting documents
 *   - "approved-letters"  — system-generated final PDF letters
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Admin Client (service_role) ───────────────────────────────────────────
// Bypasses RLS — used only for server-side uploads.
let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "[Storage] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  if (!_adminClient) {
    _adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

// ─── Upload ────────────────────────────────────────────────────────────────

/**
 * Uploads a file to a private Supabase Storage bucket.
 * Returns the storage path (key) only — never a public URL.
 *
 * @param filePath    Full path within the bucket, e.g. "attachments/3/12/1234-file.pdf"
 * @param data        File content as a Buffer
 * @param contentType MIME type of the file
 * @param bucketName  "attachments" | "approved-letters"
 * @returns           { key, path } — the storage key to persist in the database
 */
export async function storagePut(
  filePath: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  bucketName = "attachments"
): Promise<{ key: string; path: string }> {
  const supabase = getAdminClient();
  const normalizedPath = filePath.replace(/^\/+/, "");

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(normalizedPath, data, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error(
      `[Storage] Upload failed — bucket: ${bucketName}, path: ${normalizedPath}`,
      error
    );
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return { key: normalizedPath, path: normalizedPath };
}

// ─── Signed URL Generation ─────────────────────────────────────────────────

/**
 * Generates a short-lived signed URL for a file in a private bucket.
 * Should be called at request time — never stored in the database.
 *
 * @param jwt         The caller's Supabase access token (from Authorization header)
 * @param bucketName  "attachments" | "approved-letters"
 * @param filePath    The storage path (key) stored in the database
 * @param expiresIn   Seconds until the URL expires (default: 3600 = 1 hour)
 * @returns           { signedUrl } — a time-limited URL for the file
 */
export async function storageGetSignedUrl(
  jwt: string,
  bucketName: string,
  filePath: string,
  expiresIn = 3600
): Promise<{ key: string; url: string }> {
  // Use admin client for signed URL generation to avoid RLS issues on the server.
  // The permission check is enforced at the tRPC procedure level before calling this.
  const supabase = getAdminClient();
  const normalizedPath = filePath.replace(/^\/+/, "");

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(normalizedPath, expiresIn);

  if (error || !data?.signedUrl) {
    console.error(
      `[Storage] Signed URL failed — bucket: ${bucketName}, path: ${normalizedPath}`,
      error
    );
    throw new Error(`Failed to generate signed URL: ${error?.message}`);
  }

  return { key: normalizedPath, url: data.signedUrl };
}

/**
 * @deprecated Legacy alias — kept for backwards compatibility during migration.
 * Callers should be updated to use storagePut() with explicit bucketName.
 */
export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  throw new Error(
    "[Storage] storageGet() is no longer supported. Use storageGetSignedUrl() instead."
  );
}
