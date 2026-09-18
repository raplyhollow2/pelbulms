-- ============================================================================
-- assignment-submissions: student assignment file uploads
-- Path layout: submissions/{courseId}/{lessonId}/{userId}/{filename}
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('assignment-submissions', 'assignment-submissions', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "assignment_submissions_owner_insert" ON storage.objects;
CREATE POLICY "assignment_submissions_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
);

DROP POLICY IF EXISTS "assignment_submissions_owner_update" ON storage.objects;
CREATE POLICY "assignment_submissions_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[4] = auth.uid()::text
);

DROP POLICY IF EXISTS "assignment_submissions_public_select" ON storage.objects;
CREATE POLICY "assignment_submissions_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'assignment-submissions');
