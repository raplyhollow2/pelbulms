-- Allow anyone to see facilitators on published courses (public course page)
DROP POLICY IF EXISTS course_instructors_select_published ON public.course_instructors;
CREATE POLICY course_instructors_select_published ON public.course_instructors
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = course_instructors.course_id
      AND c.is_published = true
  )
);
