-- Enrollment no longer grants visibility of an unpublished course.
-- Staff, owners, and admins still see drafts. Republishing restores learner access
-- because enrollment rows are left in place.

CREATE OR REPLACE FUNCTION public.user_can_see_course(
  p_course_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN FALSE
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_user_id
        AND p.role IN ('admin', 'superadmin', 'resource_person')
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_course_id
        AND c.instructor_id = p_user_id
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.course_instructors ci
      WHERE ci.course_id = p_course_id
        AND ci.user_id = p_user_id
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE e.course_id = p_course_id
        AND e.user_id = p_user_id
        AND e.status IN ('active', 'completed', 'pending')
        AND c.is_published = TRUE
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_course_id
        AND c.is_published = TRUE
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.course_institutions x WHERE x.course_id = c.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.course_institutions x
            JOIN public.profiles p ON p.id = p_user_id
            WHERE x.course_id = c.id
              AND p.institution_id IS NOT NULL
              AND x.institution_id = p.institution_id
          )
        )
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.user_can_see_course(UUID, UUID) IS
  'True when the user may view a course (staff, owner, or published + enrolled / institution audience).';
