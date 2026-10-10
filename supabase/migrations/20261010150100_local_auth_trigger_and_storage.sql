-- Local-only additions that a public-schema dump does not include.
-- The auth trigger and storage policies match the hosted project.
-- Bucket rows are definitions, not live files.

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('assignment-submissions', 'assignment-submissions', true, 52428800),
  ('certificates', 'certificates', true, NULL),
  ('course-media', 'course-media', true, 52428800),
  ('kyc-documents', 'kyc-documents', false, 8388608),
  ('lesson-resources', 'lesson-resources', true, 52428800),
  ('avatars', 'avatars', true, 5242880)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

CREATE POLICY "assignment_returns_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'returns'
);

CREATE POLICY "assignment_returns_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'returns'
)
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'returns'
);

CREATE POLICY "assignment_submissions_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[4] = (auth.uid())::text
);

CREATE POLICY "assignment_submissions_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[4] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[4] = (auth.uid())::text
);

CREATE POLICY "assignment_submissions_public_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'assignment-submissions');

CREATE POLICY "certificates_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'certificates');

CREATE POLICY "course_media_discussion_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-media'
  AND (storage.foldername(name))[1] = 'discussion'
  AND (storage.foldername(name))[3] = (auth.uid())::text
);

CREATE POLICY "course_media_public_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'course-media');

CREATE POLICY "kyc_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "kyc_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "kyc_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "kyc_reviewer_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role::text = ANY (ARRAY['instructor','admin','resource_person','superadmin']::text[])
    )
    OR EXISTS (
      SELECT 1 FROM public.registration_reviewers r
      WHERE r.user_id = auth.uid() AND r.is_active = true
    )
  )
);

CREATE POLICY "lesson_resources_public_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'lesson-resources');

CREATE POLICY "lesson_resources_teacher_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lesson-resources'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text = ANY (ARRAY['instructor','admin','resource_person','superadmin']::text[])
  )
);

CREATE POLICY "lesson_resources_teacher_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lesson-resources'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text = ANY (ARRAY['instructor','admin','resource_person','superadmin']::text[])
  )
)
WITH CHECK (
  bucket_id = 'lesson-resources'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text = ANY (ARRAY['instructor','admin','resource_person','superadmin']::text[])
  )
);
