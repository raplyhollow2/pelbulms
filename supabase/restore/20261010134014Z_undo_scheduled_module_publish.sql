-- Undo scheduled module publish and email templates.
-- Restore point recorded on project lmspelbu (vtqqkexvwprettqnuhuk)
-- before the migration ran: 2026-10-10 13:40:14.055588 UTC
-- Run this whole script in the Supabase SQL editor if that migration must be reversed.

DROP TRIGGER IF EXISTS modules_enforce_availability ON public.modules;
DROP TRIGGER IF EXISTS modules_queue_release_mail ON public.modules;
DROP TRIGGER IF EXISTS lessons_bump_status_generation ON public.lessons;
DROP TRIGGER IF EXISTS lessons_queue_status_mail ON public.lessons;

-- These modules were unpublished before the migration. The backfill marks a
-- module published when it already contains a published lesson.
UPDATE public.modules
SET is_published = false
WHERE id IN (
  '4ecb1e69-4c99-4a90-bb3d-fadd90d878ef',
  '27c56ee5-cd0c-4366-8928-feaf35308465',
  'f1a68651-791c-4911-b4e2-1e5edc6f07c2',
  '4fa2c70a-0a60-4fbc-be5e-f17032c53422',
  '637164fb-99ea-4619-876f-91060a12d622',
  'b4905b38-dbb2-4612-8d46-b7f557abf773'
);

DROP POLICY IF EXISTS "lessons_select_policy" ON public.lessons;
CREATE POLICY "lessons_select_policy" ON public.lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = lessons.module_id
        AND public.user_can_see_course(m.course_id, auth.uid())
        AND (
          private.can_manage_course(m.course_id, auth.uid())
          OR lessons.is_published IS TRUE
          OR EXISTS (
            SELECT 1
            FROM public.enrollments e
            WHERE e.course_id = m.course_id
              AND e.user_id = auth.uid()
              AND e.status IN ('active', 'completed')
          )
        )
    )
  );

DELETE FROM public.notifications
WHERE created_at >= '2026-10-10 13:40:14+00'
  AND coalesce(metadata->>'dedupe_key', '') <> '';

DROP FUNCTION IF EXISTS public.claim_email_deliveries(INTEGER);
DROP FUNCTION IF EXISTS public.lesson_is_open(UUID, UUID);
DROP FUNCTION IF EXISTS private.lessons_queue_status_mail();
DROP FUNCTION IF EXISTS private.lessons_bump_status_generation();
DROP FUNCTION IF EXISTS private.modules_queue_release_mail();
DROP FUNCTION IF EXISTS private.modules_enforce_availability();
DROP FUNCTION IF EXISTS private.queue_course_mail(TEXT, TEXT, UUID, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS private.lesson_is_open(UUID, UUID);
DROP FUNCTION IF EXISTS private.module_is_live(TEXT, TIMESTAMPTZ);

DROP TABLE IF EXISTS public.email_deliveries;
DROP TABLE IF EXISTS public.email_templates;

ALTER TABLE public.lessons
  DROP COLUMN IF EXISTS notify_on_status,
  DROP COLUMN IF EXISTS status_generation;

ALTER TABLE public.modules
  DROP COLUMN IF EXISTS availability,
  DROP COLUMN IF EXISTS publish_at,
  DROP COLUMN IF EXISTS publish_timezone,
  DROP COLUMN IF EXISTS notify_on_publish,
  DROP COLUMN IF EXISTS notify_on_unpublish,
  DROP COLUMN IF EXISTS release_lessons,
  DROP COLUMN IF EXISTS release_generation;

DELETE FROM public.role_capabilities rc
USING public.capabilities c
WHERE rc.capability_id = c.id
  AND c.key IN (
    'admin.settings.email_templates.view',
    'admin.settings.email_templates.edit'
  );

DELETE FROM public.capabilities
WHERE key IN (
  'admin.settings.email_templates.view',
  'admin.settings.email_templates.edit'
);
