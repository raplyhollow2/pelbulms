-- ============================================================================
-- KYC STORAGE: OWNER + REVIEWER POLICIES
-- ============================================================================
-- Registration photo uploads must work without SUPABASE_SERVICE_ROLE_KEY
-- (Vercel Sensitive secrets cannot be pulled into local .env.local).
-- Paths are namespaced as {user_id}/passport-*.jpg | {user_id}/cid-*.jpg
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('kyc-documents', 'kyc-documents', false, 8388608)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "kyc_owner_insert" ON storage.objects;
CREATE POLICY "kyc_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "kyc_owner_update" ON storage.objects;
CREATE POLICY "kyc_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "kyc_owner_select" ON storage.objects;
CREATE POLICY "kyc_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "kyc_reviewer_select" ON storage.objects;
CREATE POLICY "kyc_reviewer_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('instructor', 'admin', 'resource_person', 'superadmin')
    )
    OR EXISTS (
      SELECT 1 FROM public.registration_reviewers r
      WHERE r.user_id = auth.uid() AND r.is_active = true
    )
  )
);
