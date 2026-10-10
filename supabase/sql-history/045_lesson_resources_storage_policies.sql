-- ============================================================================
-- lesson-resources: allow teachers to upload without service_role
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lesson-resources', 'lesson-resources', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "lesson_resources_teacher_insert" ON storage.objects;
CREATE POLICY "lesson_resources_teacher_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lesson-resources'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('instructor', 'admin', 'resource_person', 'superadmin')
  )
);

DROP POLICY IF EXISTS "lesson_resources_teacher_update" ON storage.objects;
CREATE POLICY "lesson_resources_teacher_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lesson-resources'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('instructor', 'admin', 'resource_person', 'superadmin')
  )
)
WITH CHECK (
  bucket_id = 'lesson-resources'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('instructor', 'admin', 'resource_person', 'superadmin')
  )
);

DROP POLICY IF EXISTS "lesson_resources_public_select" ON storage.objects;
CREATE POLICY "lesson_resources_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-resources');
