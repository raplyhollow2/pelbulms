-- Per-activity completion for mandatory lesson activities
CREATE TABLE IF NOT EXISTS public.lesson_activity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'ack'
    CHECK (source IN ('ack', 'quiz_pass')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id, activity_id)
);

CREATE INDEX IF NOT EXISTS lesson_activity_progress_user_lesson_idx
  ON public.lesson_activity_progress (user_id, lesson_id);

CREATE INDEX IF NOT EXISTS lesson_activity_progress_lesson_idx
  ON public.lesson_activity_progress (lesson_id);

ALTER TABLE public.lesson_activity_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_activity_progress_select_own ON public.lesson_activity_progress;
CREATE POLICY lesson_activity_progress_select_own ON public.lesson_activity_progress
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'superadmin', 'resource_person')
  )
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = lesson_activity_progress.lesson_id
      AND (
        c.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.course_instructors ci
          WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS lesson_activity_progress_insert_own ON public.lesson_activity_progress;
CREATE POLICY lesson_activity_progress_insert_own ON public.lesson_activity_progress
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lesson_activity_progress_update_own ON public.lesson_activity_progress;
CREATE POLICY lesson_activity_progress_update_own ON public.lesson_activity_progress
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lesson_activity_progress_delete_own ON public.lesson_activity_progress;
CREATE POLICY lesson_activity_progress_delete_own ON public.lesson_activity_progress
FOR DELETE TO authenticated
USING (user_id = auth.uid());
