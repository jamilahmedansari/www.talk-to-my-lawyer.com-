-- Migration: 0004_private_storage_migration
-- Purpose: Replace Manus Forge S3 proxy with Supabase private storage.
--
-- Changes:
--   1. letter_requests: rename pdf_url → pdf_storage_path (stores bucket key, not URL)
--   2. attachments: drop storage_url column (signed URLs are generated on demand)
--   3. storage.objects RLS policies for both private buckets

-- ─── 1. letter_requests: rename pdf_url → pdf_storage_path ────────────────
ALTER TABLE letter_requests
  RENAME COLUMN pdf_url TO pdf_storage_path;

-- Widen the column type to varchar(1000) to hold bucket paths
ALTER TABLE letter_requests
  ALTER COLUMN pdf_storage_path TYPE varchar(1000);

-- ─── 2. attachments: drop storage_url ─────────────────────────────────────
ALTER TABLE attachments
  DROP COLUMN IF EXISTS storage_url;

-- ─── 3. Supabase Storage RLS Policies ─────────────────────────────────────
-- These policies control which authenticated users can generate signed URLs
-- for files in the private buckets.

-- Allow a subscriber to access their own approved letter PDFs
CREATE POLICY "subscriber_read_own_approved_letters"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'approved-letters'
    AND auth.uid()::text = (
      SELECT u.open_id
      FROM letter_requests lr
      JOIN users u ON u.id = lr.user_id
      WHERE lr.pdf_storage_path = storage.objects.name
      LIMIT 1
    )
  );

-- Allow attorneys/admins to access approved letter PDFs they are reviewing
CREATE POLICY "attorney_read_assigned_approved_letters"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'approved-letters'
    AND auth.uid()::text = (
      SELECT u.open_id
      FROM letter_requests lr
      JOIN users u ON u.id = lr.assigned_reviewer_id
      WHERE lr.pdf_storage_path = storage.objects.name
      LIMIT 1
    )
  );

-- Allow a subscriber to access their own attachments
CREATE POLICY "subscriber_read_own_attachments"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (
      SELECT u.open_id
      FROM attachments att
      JOIN users u ON u.id = att.uploaded_by_user_id
      WHERE att.storage_path = storage.objects.name
      LIMIT 1
    )
  );

-- Allow attorneys/admins to read attachments for letters they are reviewing
CREATE POLICY "attorney_read_letter_attachments"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (
      SELECT u.open_id
      FROM attachments att
      JOIN letter_requests lr ON lr.id = att.letter_request_id
      JOIN users u ON u.id = lr.assigned_reviewer_id
      WHERE att.storage_path = storage.objects.name
      LIMIT 1
    )
  );

-- Allow the service role (server) to upload to both buckets (INSERT)
-- Note: service_role bypasses RLS by default, so no explicit INSERT policy is needed.
