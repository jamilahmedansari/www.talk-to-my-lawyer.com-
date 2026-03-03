# Migration Plan: Manus Forge Storage to Supabase Storage (V2 - Private Buckets)

This document outlines the detailed, step-by-step plan to replace the Manus Forge storage proxy with a direct Supabase Storage implementation, using **private buckets and signed URLs** for all file access to ensure data privacy.

## 1. High-Level Goal

The objective is to completely remove the dependency on `server/storage.ts` and the underlying Manus Forge API for file uploads. All file operations will be handled directly by the Supabase client using Supabase Storage, with a security-first approach.

**Key Changes from V1:**
-   Both `attachments` and `approved-letters` buckets will be **private**.
-   All file access will be granted via short-lived **signed URLs** generated on-demand.
-   The database will store the permanent `storagePath` (file key), not a public URL.

## 2. Supabase Storage Configuration

### Step 2.1: Create Storage Buckets

Create two **private** buckets in your Supabase project:

-   **`attachments`**: For user-uploaded supporting documents.
-   **`approved-letters`**: For system-generated final PDF letters.

During creation, ensure the "Public bucket" option is **Off**.

### Step 2.2: Configure Row Level Security (RLS)

For robust security, we will add RLS policies to control access. This ensures that even with a valid JWT, users can only access files they own.

1.  **Enable RLS:** In the Supabase SQL Editor, enable RLS for the `storage.objects` table if it isn't already:
    ```sql
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    ```

2.  **Create Policy for `approved-letters`:** This policy allows a user to access a file if their `id` matches the `user_id` stored in the `letter_requests` table linked to that file.
    ```sql
    CREATE POLICY "Allow subscriber to read own approved letters" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'approved-letters' AND
      auth.uid() = (
        SELECT lr.user_id::text FROM letter_requests lr
        WHERE lr.pdf_storage_path = name
      )
    );
    ```

3.  **Create Policy for `attachments`:** This policy allows a user to access a file if their `id` matches the `uploaded_by_user_id` on the attachment record.
    ```sql
    CREATE POLICY "Allow subscriber to read own attachments" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'attachments' AND
      auth.uid() = (
        SELECT att.uploaded_by_user_id::text FROM attachments att
        WHERE att.storage_path = name
      )
    );
    ```

## 3. Code Implementation Plan

### Step 3.1: Update Database Schema

The `storageUrl` columns are no longer needed, as URLs will be generated dynamically. We need a new column to store the PDF's storage path.

**File:** `drizzle/schema.ts`

-   In the `attachments` table, remove the `storageUrl` column.
-   In the `letter_requests` table, rename `pdfUrl` to `pdfStoragePath` and change its type to `varchar`.

```typescript
// In attachments table
// REMOVE: storageUrl: varchar("storage_url", { length: 2000 }),

// In letter_requests table
// REPLACE:
// pdfUrl: text("pdf_url"),
// WITH:
// pdfStoragePath: varchar("pdf_storage_path", { length: 1000 }),
```

Run `pnpm drizzle:generate` to create the migration script and apply it to your database.

### Step 3.2: Create Supabase Admin & User Clients

We need two clients: an admin client for writing files and a user-scoped client for generating signed URLs.

**File:** `server/supabase.ts` (Create/Update)

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ... (getSupabaseAdminClient from V1 plan remains the same)

/**
 * Creates a new Supabase client scoped to a specific user's JWT.
 * This is used for generating signed URLs with user-level RLS policies.
 */
export function createSupabaseUserClient(jwt: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
```

### Step 3.3: Rewrite `server/storage.ts`

The storage module will now handle both uploads (admin) and signed URL generation (user).

**File:** `server/storage.ts`

```typescript
import { getSupabaseAdminClient, createSupabaseUserClient } from "./supabase";

// supabaseStorageUpload remains the same as the V1 plan, but returns the path, not the URL.
export async function supabaseStorageUpload(
  bucketName: string,
  filePath: string,
  data: Buffer,
  contentType: string
): Promise<{ path: string }> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, data, { contentType, upsert: true });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }
  return { path: filePath };
}

/**
 * Generates a short-lived signed URL for a file in a private bucket.
 */
export async function createSignedUrl(
  userJwt: string,
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600 // Default to 1 hour
): Promise<{ signedUrl: string }> {
  const supabase = createSupabaseUserClient(userJwt);
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  return { signedUrl: data.signedUrl };
}
```

### Step 3.4: Update `uploadAttachment` Mutation

**File:** `server/routers/letters.ts`

Modify the mutation to store only the `storagePath`.

```typescript
// ...
.mutation(async ({ ctx, input }) => {
  // ...
  const { path } = await supabaseStorageUpload("attachments", filePath, buffer, input.mimeType);

  await createAttachment({
    // ...
    storagePath: path,
    // REMOVE: storageUrl: publicUrl,
    // ...
  });

  return { success: true }; // Does not return a URL anymore
});
```

### Step 3.5: Update `pdfGenerator.ts` and Approval Flow

**File:** `server/pdfGenerator.ts`

This function will now return the `pdfKey` (storage path) instead of a URL.

```typescript
export async function generateAndUploadApprovedPdf(
  opts: PdfGenerationOptions
): Promise<{ pdfKey: string }> { // <-- Return type changed
  // ...
  const { path } = await supabaseStorageUpload("approved-letters", fileKey, pdfBuffer, "application/pdf");
  return { pdfKey: path };
}
```

**File:** `server/routers/review.ts` (`approveLetter` mutation)

Update the call to store the path.

```typescript
// ...
const { pdfKey } = await generateAndUploadApprovedPdf({ ... });
await updateLetterPdfPath(input.letterId, pdfKey); // New DB helper
// ...
// The email notification will now need to generate a signed URL.
const { signedUrl } = await createSignedUrl(ctx.req.headers.authorization.split(' ')[1], 'approved-letters', pdfKey, 86400 * 7); // 7-day link for email
await sendLetterApprovedEmail({ ..., pdfUrl: signedUrl });
// ...
```

You will need a new helper in `server/db.ts`, `updateLetterPdfPath`.

### Step 3.6: Create Endpoints to Serve Signed URLs

The client can no longer access URLs directly. We need new tRPC procedures to serve them.

**File:** `server/routers/letters.ts` (Add new procedures)

```typescript
// ...
getAttachmentSignedUrl: protectedProcedure
  .input(z.object({ attachmentId: z.number() }))
  .query(async ({ ctx, input }) => {
    const attachment = await getAttachmentById(input.attachmentId);
    // Add permission check: ensure ctx.user.id owns this attachment
    const { signedUrl } = await createSignedUrl(ctx.jwt, "attachments", attachment.storagePath);
    return { url: signedUrl };
  }),

getApprovedPdfSignedUrl: protectedProcedure
  .input(z.object({ letterId: z.number() }))
  .query(async ({ ctx, input }) => {
    const letter = await getLetterRequestById(input.letterId);
    // Add permission check: ensure ctx.user.id owns this letter
    if (!letter.pdfStoragePath) throw new TRPCError({ code: "NOT_FOUND" });
    const { signedUrl } = await createSignedUrl(ctx.jwt, "approved-letters", letter.pdfStoragePath);
    return { url: signedUrl };
  }),
```

### Step 3.7: Update Frontend Components

Finally, update the frontend to call these new tRPC queries instead of using a direct `href`.

**File:** `client/src/pages/subscriber/LetterDetail.tsx`

```typescript
// For PDF Download
const pdfUrlQuery = trpc.letters.getApprovedPdfSignedUrl.useQuery({ letterId }, { enabled: false });
const handleDownloadPdf = async () => {
  const { data } = await pdfUrlQuery.refetch();
  if (data?.url) window.open(data.url, "_blank");
};

// For Attachments (create a new component for this logic)
const AttachmentLink = ({ attachment }) => {
  const attachmentUrlQuery = trpc.letters.getAttachmentSignedUrl.useQuery({ attachmentId: attachment.id }, { enabled: false });
  const handleClick = async () => {
    const { data } = await attachmentUrlQuery.refetch();
    if (data?.url) window.open(data.url, "_blank");
  };
  return <button onClick={handleClick}>{attachment.fileName}</button>;
};
```

## 4. Testing and Verification

1.  **Private Buckets:** Confirm both buckets are private in the Supabase dashboard.
2.  **Uploads:** Verify that attachments and approved PDFs are correctly uploaded.
3.  **Access Denied:** Try to access an uploaded file using the raw public URL format; it should fail with an access denied error.
4.  **Signed URL Access:** Click the download buttons in the UI. Verify they call the tRPC procedures, receive a signed URL, and open the file correctly.
5.  **Email Link:** Check the "Letter Approved" email and confirm the link is a valid, working signed URL.

This revised plan ensures a robust and secure storage implementation, fully protecting all sensitive user and letter data.
