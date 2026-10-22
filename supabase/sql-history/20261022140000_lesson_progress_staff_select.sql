-- Staff who can manage a course must see learner progress/certificates the same way
-- they see lessons (private.can_manage_course). Owner-only SELECT left admins/superadmins
-- with empty progress on the student detail page.

DROP POLICY IF EXISTS "lesson_progress_select_instructor" ON public.lesson_progress;
CREATE POLICY "lesson_progress_select_instructor"
  ON public.lesson_progress
  FOR SELECT
  TO authenticated
  USING (private.can_manage_course(course_id, auth.uid()));

DROP POLICY IF EXISTS "certificates_select_instructor" ON public.certificates;
CREATE POLICY "certificates_select_instructor"
  ON public.certificates
  FOR SELECT
  TO authenticated
  USING (private.can_manage_course(course_id, auth.uid()));
