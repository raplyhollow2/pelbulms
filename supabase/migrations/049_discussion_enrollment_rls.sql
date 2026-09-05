DROP POLICY IF EXISTS "Enrolled users can view course forums" ON public.forums;

DROP POLICY IF EXISTS forums_select_enrolled_or_staff ON public.forums;
CREATE POLICY forums_select_enrolled_or_staff ON public.forums
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = forums.course_id
      AND e.user_id = auth.uid()
      AND e.status IN ('active', 'completed')
  )
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = forums.course_id
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
);

-- Restrict forum thread/reply/forum reads to enrolled learners + course staff

DROP POLICY IF EXISTS threads_select ON public.threads;
CREATE POLICY threads_select ON public.threads
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.forums f
    WHERE f.id = threads.forum_id
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

DROP POLICY IF EXISTS replies_select ON public.replies;
CREATE POLICY replies_select ON public.replies
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.forums f ON f.id = t.forum_id
    WHERE t.id = replies.thread_id
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

DROP POLICY IF EXISTS forums_select_enrolled_or_staff ON public.forums;
CREATE POLICY forums_select_enrolled_or_staff ON public.forums
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.course_id = forums.course_id
      AND e.user_id = auth.uid()
      AND e.status IN ('active', 'completed')
  )
  OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = forums.course_id
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
);

DROP POLICY IF EXISTS discussion_tag_notify ON public.notifications;
CREATE POLICY discussion_tag_notify ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  type = 'discussion_tag'
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = NULLIF(notifications.metadata->>'course_id', '')::uuid
      AND (
        EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = c.id
            AND e.user_id = auth.uid()
            AND e.status IN ('active', 'completed')
        )
        OR c.instructor_id = auth.uid()
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
);
