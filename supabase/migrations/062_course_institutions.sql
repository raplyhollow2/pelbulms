-- ============================================================================
-- 062: Institution-scoped course visibility (opt-in multi-select)
-- ============================================================================
-- Semantics:
--   No rows in course_institutions  → course is open to all (current behavior)
--   ≥1 row                          → only matching institution members (+ staff) see/enroll
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.course_institutions (
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_course_institutions_institution_id
  ON public.course_institutions (institution_id);

CREATE INDEX IF NOT EXISTS idx_course_institutions_course_id
  ON public.course_institutions (course_id);

COMMENT ON TABLE public.course_institutions IS
  'Optional audience targeting. Empty set = open to all; non-empty = restricted to listed institutions.';

-- ---------------------------------------------------------------------------
-- Visibility helper (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------
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
      WHERE e.course_id = p_course_id
        AND e.user_id = p_user_id
        AND e.status IN ('active', 'completed', 'pending')
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
  'True when the user may view a course (staff, owner, enrolled, or published + institution audience).';

GRANT EXECUTE ON FUNCTION public.user_can_see_course(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_see_course(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.user_can_see_course(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Tighten courses SELECT for authenticated users (replaces emergency USING true)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "courses_select_policy" ON public.courses;
DROP POLICY IF EXISTS "Everyone can view published courses" ON public.courses;

CREATE POLICY "courses_select_policy" ON public.courses
  FOR SELECT
  TO authenticated
  USING (public.user_can_see_course(id, auth.uid()));

-- Anon: only open (unrestricted) published courses — used by marketing if needed
DROP POLICY IF EXISTS "courses_select_anon_open_published" ON public.courses;
CREATE POLICY "courses_select_anon_open_published" ON public.courses
  FOR SELECT
  TO anon
  USING (
    is_published = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.course_institutions x WHERE x.course_id = courses.id
    )
  );

-- ---------------------------------------------------------------------------
-- course_institutions RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.course_institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_institutions_select" ON public.course_institutions;
CREATE POLICY "course_institutions_select" ON public.course_institutions
  FOR SELECT
  TO authenticated
  USING (public.user_can_see_course(course_id, auth.uid()));

DROP POLICY IF EXISTS "course_institutions_insert" ON public.course_institutions;
CREATE POLICY "course_institutions_insert" ON public.course_institutions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin', 'resource_person')
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.course_instructors ci
      WHERE ci.course_id = course_institutions.course_id
        AND ci.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "course_institutions_update" ON public.course_institutions;
CREATE POLICY "course_institutions_update" ON public.course_institutions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin', 'resource_person')
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "course_institutions_delete" ON public.course_institutions;
CREATE POLICY "course_institutions_delete" ON public.course_institutions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin', 'resource_person')
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.course_instructors ci
      WHERE ci.course_id = course_institutions.course_id
        AND ci.user_id = auth.uid()
    )
  );
