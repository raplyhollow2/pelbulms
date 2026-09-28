-- One Facebook-style reaction per person per discussion post.

CREATE TABLE IF NOT EXISTS public.thread_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (
    reaction IN ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT thread_reactions_thread_user_unique UNIQUE (thread_id, user_id)
);

ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS thread_reactions_select ON public.thread_reactions;
CREATE POLICY thread_reactions_select ON public.thread_reactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.forums f ON f.id = t.forum_id
    WHERE t.id = thread_reactions.thread_id
      AND (
        EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = f.course_id
            AND e.user_id = auth.uid()
            AND e.status IN ('active', 'completed')
        )
        OR EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = f.course_id
            AND (
              c.instructor_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.course_instructors ci
                WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
              )
              OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role IN ('admin', 'superadmin', 'resource_person')
              )
            )
        )
      )
  )
);

DROP POLICY IF EXISTS thread_reactions_insert ON public.thread_reactions;
CREATE POLICY thread_reactions_insert ON public.thread_reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.forums f ON f.id = t.forum_id
    WHERE t.id = thread_reactions.thread_id
      AND (
        EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = f.course_id
            AND e.user_id = auth.uid()
            AND e.status IN ('active', 'completed')
        )
        OR EXISTS (
          SELECT 1 FROM public.courses c
          WHERE c.id = f.course_id
            AND (
              c.instructor_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.course_instructors ci
                WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
              )
              OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role IN ('admin', 'superadmin', 'resource_person')
              )
            )
        )
      )
  )
);

DROP POLICY IF EXISTS thread_reactions_update ON public.thread_reactions;
CREATE POLICY thread_reactions_update ON public.thread_reactions
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS thread_reactions_delete ON public.thread_reactions;
CREATE POLICY thread_reactions_delete ON public.thread_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_reactions TO authenticated;
GRANT ALL ON public.thread_reactions TO service_role;
