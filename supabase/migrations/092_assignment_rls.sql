-- Assignments had row security enabled and no policies, so a signed-in
-- teacher or learner could not read or write them without the service role.

DROP POLICY IF EXISTS assignments_select ON public.assignments;
CREATE POLICY assignments_select ON public.assignments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = assignments.lesson_id
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
        OR (
          assignments.is_published = true
          AND EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = c.id AND e.user_id = auth.uid()
          )
        )
      )
  )
);

DROP POLICY IF EXISTS assignments_manage ON public.assignments;
CREATE POLICY assignments_manage ON public.assignments
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = assignments.lesson_id
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
    WHERE l.id = assignments.lesson_id
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

DROP POLICY IF EXISTS assignment_submissions_select ON public.assignment_submissions;
CREATE POLICY assignment_submissions_select ON public.assignment_submissions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.lessons l ON l.id = a.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE a.id = assignment_submissions.assignment_id
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

DROP POLICY IF EXISTS assignment_submissions_insert ON public.assignment_submissions;
CREATE POLICY assignment_submissions_insert ON public.assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.lessons l ON l.id = a.lesson_id
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.enrollments e ON e.course_id = m.course_id
    WHERE a.id = assignment_submissions.assignment_id
      AND a.is_published = true
      AND e.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS assignment_submissions_update ON public.assignment_submissions;
CREATE POLICY assignment_submissions_update ON public.assignment_submissions
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
