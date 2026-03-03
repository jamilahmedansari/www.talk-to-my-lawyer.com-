# Migration Plan: Manus Forge Storage to Supabase Storage

This document outlines the detailed, step-by-step plan to replace the Manus Forge storage proxy with a direct Supabase Storage implementation. This is the most critical dependency to resolve for full platform independence.

## 1. High-Level Goal

The objective is to completely remove the dependency on `server/storage.ts` and the underlying Manus Forge API for file uploads. All file operations will be handled directly by the Supabase client using Supabase Storage.

**Key Benefits:**
-   Removes a critical dependency on the Manus platform.
-   Consolidates all backend services under the Supabase umbrella.
-   Improves performance and reliability by removing a proxy layer.

## 2. Analysis of Current Implementation

The current implementation in `server/storage.ts` provides two main functions:

-   `storagePut(relKey, data, contentType)`: Uploads a file to the Forge S3 proxy.
-   `storageGet(relKey)`: Retrieves a pre-signed download URL from the Forge S3 proxy.

These functions are used in three primary locations:

1.  **`server/routers/letters.ts`**: The `uploadAttachment` mutation uses `storagePut` to upload user-provided supporting documents.
2.  **`server/pdfGenerator.ts`**: The `generateAndUploadApprovedPdf` function uses `storagePut` to upload the final, attorney-approved PDF letter.
3.  **`server/routers.legacy.ts`**: A deprecated version of the `uploadAttachment` procedure also uses `storagePut`.

## 3. Supabase Storage Configuration

Before any code changes, the necessary Supabase Storage buckets and policies must be configured.

### Step 3.1: Create Storage Buckets

Two buckets are required to mirror the existing path structure:

-   **`attachments`**: This bucket will store all user-uploaded supporting documents.
-   **`approved-letters`**: This bucket will store the final, system-generated PDF letters.

These can be created via the Supabase Dashboard under **Storage** > **Create a new bucket**.

### Step 3.2: Configure Bucket Access Policies

For simplicity and to match the current public URL functionality, both buckets should be made **public**.

-   Go to the settings for each bucket.
-   Toggle the "Public bucket" option to **On**.

This allows anyone with the direct URL to view the files, which is the expected behavior for email links and in-app downloads. If more granular access is needed in the future, Row Level Security (RLS) policies can be implemented on the `storage.objects` table.

## 4. Code Implementation Plan

This section details the required code changes, file by file.

### Step 4.1: Create a Supabase Admin Client

For server-side operations, a Supabase admin client that uses the `SUPABASE_SERVICE_ROLE_KEY` is required. This client will have the necessary permissions to upload files to storage.

**File:** `server/supabase.ts` (Create this new file)

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

/**
 * Returns a Supabase admin client initialized with the service role key.
 * This client should only be used in server-side code.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase URL and service role key are required for admin client.");
  }

  if (!_adminClient) {
    _adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _adminClient;
}
```

### Step 4.2: Rewrite `server/storage.ts`

The existing `storage.ts` file will be completely rewritten to use the new Supabase admin client.

**File:** `server/storage.ts`

```typescript
import { getSupabaseAdminClient } from "./supabase";

/**
 * Uploads a file to a specified Supabase Storage bucket.
 *
 * @param bucketName The name of the Supabase Storage bucket.
 * @param filePath The full path for the file within the bucket (e.g., "public/avatar.png").
 * @param data The file content as a Buffer.
 * @param contentType The MIME type of the file.
 * @returns The public URL of the uploaded file.
 */
export async function supabaseStorageUpload(
  bucketName: string,
  filePath: string,
  data: Buffer,
  contentType: string
): Promise<{ publicUrl: string }> {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, data, {
      contentType,
      upsert: true, // Overwrite file if it already exists
    });

  if (error) {
    console.error(`[SupabaseStorage] Failed to upload to ${bucketName}/${filePath}:`, error);
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  if (!urlData) {
    throw new Error("Failed to retrieve public URL after upload.");
  }

  return { publicUrl: urlData.publicUrl };
}
```

### Step 4.3: Update `server/routers/letters.ts`

Modify the `uploadAttachment` mutation to use the new `supabaseStorageUpload` function.

**File:** `server/routers/letters.ts`

```typescript
// ... other imports
import { supabaseStorageUpload } from "../storage"; // <-- Change this import

// ... inside the lettersRouter
  uploadAttachment: subscriberProcedure
    .input(/*...input schema...*/)
    .mutation(async ({ ctx, input }) => {
      // ... (permission checks remain the same)

      const buffer = Buffer.from(input.base64Data, "base64");
      const filePath = `attachments/${ctx.user.id}/${input.letterId}/${Date.now()}-${input.fileName}`;

      // --- MODIFICATION START ---
      const { publicUrl } = await supabaseStorageUpload(
        "attachments", // Bucket name
        filePath,      // File path
        buffer,
        input.mimeType
      );
      // --- MODIFICATION END ---

      await createAttachment({
        letterRequestId: input.letterId,
        uploadedByUserId: ctx.user.id,
        storagePath: filePath, // Use filePath instead of key
        storageUrl: publicUrl, // Use the new publicUrl
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: buffer.length,
      });

      return { url: publicUrl, key: filePath };
    }),
```

### Step 4.4: Update `server/pdfGenerator.ts`

Modify `generateAndUploadApprovedPdf` to use the new upload function.

**File:** `server/pdfGenerator.ts`

```typescript
// ... other imports
import { supabaseStorageUpload } from "./storage"; // <-- Change this import

export async function generateAndUploadApprovedPdf(
  opts: PdfGenerationOptions
): Promise<{ pdfUrl: string; pdfKey: string }> {
  const pdfBuffer = await generatePdfBuffer(opts);

  // ... (fileKey generation remains the same)
  const fileKey = `approved-letters/${opts.letterId}-${safeSubject}-${timestamp}.pdf`;

  // --- MODIFICATION START ---
  const { publicUrl } = await supabaseStorageUpload(
    "approved-letters", // Bucket name
    fileKey,            // File path
    pdfBuffer,
    "application/pdf"
  );
  // --- MODIFICATION END ---

  console.log(`[PDF] Generated and uploaded letter #${opts.letterId}: ${publicUrl}`);
  return { pdfUrl: publicUrl, pdfKey: fileKey };
}
```

### Step 4.5: Update Environment Variables

The new implementation relies on Supabase-specific environment variables. The old Forge variables can be removed.

**File:** `.env` (and `.env.example`)

**Remove:**
```
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

**Ensure these are present:**
```
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Update `server/_core/env.ts` to remove the `forgeApiUrl` and `forgeApiKey` variables.

## 5. Testing and Verification

After implementing the changes, a thorough testing process is required:

1.  **Attachment Upload:** As a subscriber, create a new letter and upload a supporting document. Verify the file appears in the `attachments` bucket in the Supabase dashboard and is correctly linked in the application.
2.  **PDF Generation:** As an attorney, approve a letter. Verify the final PDF is generated and uploaded to the `approved-letters` bucket. Check that the `pdf_url` in the `letter_requests` table is the correct Supabase public URL.
3.  **Email Verification:** Ensure the "Letter Approved" email contains the correct, working link to the PDF stored in Supabase.
4.  **Regression Testing:** Confirm that no other parts of the application have been negatively affected.

By following this plan, the migration from the Manus Forge storage proxy to Supabase Storage will be systematic, systematic, and complete.
