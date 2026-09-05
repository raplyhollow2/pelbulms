-- Quiz / forum / notification RLS so teach + learn work without service_role locally.

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quizzes_select ON public.quizzes;
CREATE POLICY quizzes_select ON public.quizzes
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS quizzes_manage ON public.quizzes;
CREATE POLICY quizzes_manage ON public.quizzes
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = quizzes.lesson_id
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
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = quizzes.lesson_id
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

DROP POLICY IF EXISTS quiz_questions_select ON public.quiz_questions;
CREATE POLICY quiz_questions_select ON public.quiz_questions
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS quiz_questions_manage ON public.quiz_questions;
CREATE POLICY quiz_questions_manage ON public.quiz_questions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.lessons l ON l.id = q.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
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
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.lessons l ON l.id = q.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE q.id = quiz_questions.quiz_id
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

DROP POLICY IF EXISTS forums_insert_enrolled_or_staff ON public.forums;
CREATE POLICY forums_insert_enrolled_or_staff ON public.forums
FOR INSERT TO authenticated
WITH CHECK (
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

DROP POLICY IF EXISTS threads_select ON public.threads;
CREATE POLICY threads_select ON public.threads
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS replies_select ON public.replies;
CREATE POLICY replies_select ON public.replies
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS teachers_notify_enrolled ON public.notifications;
CREATE POLICY teachers_notify_enrolled ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = NULLIF(metadata->>'course_id', '')::uuid
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
