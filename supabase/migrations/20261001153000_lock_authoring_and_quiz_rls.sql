-- Lock that replaced migration 017 open writes.
-- Verified on project lmspelbu (vtqqkexvwprettqnuhuk) on 2026-10-01:
-- courses, modules, and lessons writes use private.can_manage_course;
-- profiles_enforce_privileges is installed; quiz_questions learner SELECT
-- is gone; authenticated has no INSERT or UPDATE on quiz_attempts.
-- Residual: quizzes_select is still USING (true). Answer keys live on
-- quiz_questions, which learners cannot read.
-- This migration does not replay 017.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER + owner bypasses RLS, so policies cannot recurse.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_teaching_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role::text IN ('instructor', 'admin', 'resource_person', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_course(p_course_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND p_course_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_user_id
          AND p.role::text IN ('superadmin', 'resource_person')
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = p_course_id
          AND c.instructor_id = p_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.course_instructors ci
        WHERE ci.course_id = p_course_id
          AND ci.user_id = p_user_id
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = p_user_id
            AND p.role::text = 'admin'
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.institution_access ia
            WHERE ia.user_id = p_user_id
              AND ia.role_within_institution = 'admin'
              AND ia.is_active = true
          )
          OR EXISTS (
            SELECT 1
            FROM public.institution_access ia
            JOIN public.course_institutions x ON x.institution_id = ia.institution_id
            WHERE ia.user_id = p_user_id
              AND ia.role_within_institution = 'admin'
              AND ia.is_active = true
              AND x.course_id = p_course_id
          )
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION private.is_teaching_role(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_course(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_teaching_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_course(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Courses: drop the emergency open writes and the public "any self insert".
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "courses_insert_policy" ON public.courses;
DROP POLICY IF EXISTS "courses_update_policy" ON public.courses;
DROP POLICY IF EXISTS "courses_delete_policy" ON public.courses;
DROP POLICY IF EXISTS "Instructors can create courses" ON public.courses;
DROP POLICY IF EXISTS "Instructors can update own courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can manage all courses" ON public.courses;

CREATE POLICY "courses_insert_policy" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    instructor_id = auth.uid()
    AND private.is_teaching_role(auth.uid())
  );

CREATE POLICY "courses_update_policy" ON public.courses
  FOR UPDATE TO authenticated
  USING (private.can_manage_course(id, auth.uid()))
  WITH CHECK (private.can_manage_course(id, auth.uid()));

CREATE POLICY "courses_delete_policy" ON public.courses
  FOR DELETE TO authenticated
  USING (
    instructor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role::text IN ('admin', 'superadmin')
    )
  );

-- ---------------------------------------------------------------------------
-- Modules and lessons
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "modules_select_policy" ON public.modules;
DROP POLICY IF EXISTS "modules_insert_policy" ON public.modules;
DROP POLICY IF EXISTS "modules_update_policy" ON public.modules;
DROP POLICY IF EXISTS "modules_delete_policy" ON public.modules;

CREATE POLICY "modules_select_policy" ON public.modules
  FOR SELECT TO authenticated
  USING (public.user_can_see_course(course_id, auth.uid()));

CREATE POLICY "modules_insert_policy" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_course(course_id, auth.uid()));

CREATE POLICY "modules_update_policy" ON public.modules
  FOR UPDATE TO authenticated
  USING (private.can_manage_course(course_id, auth.uid()))
  WITH CHECK (private.can_manage_course(course_id, auth.uid()));

CREATE POLICY "modules_delete_policy" ON public.modules
  FOR DELETE TO authenticated
  USING (private.can_manage_course(course_id, auth.uid()));

DROP POLICY IF EXISTS "lessons_select_policy" ON public.lessons;
DROP POLICY IF EXISTS "lessons_insert_policy" ON public.lessons;
DROP POLICY IF EXISTS "lessons_update_policy" ON public.lessons;
DROP POLICY IF EXISTS "lessons_delete_policy" ON public.lessons;

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

CREATE POLICY "lessons_insert_policy" ON public.lessons
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = lessons.module_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  );

CREATE POLICY "lessons_update_policy" ON public.lessons
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = lessons.module_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = lessons.module_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  );

CREATE POLICY "lessons_delete_policy" ON public.lessons
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.modules m
      WHERE m.id = lessons.module_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Profiles: learners cannot change role or account_status.
-- service_role and security-definer approval functions (owner postgres) may.
-- The function is INVOKER so current_user stays the session role.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.enforce_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.account_status IS NOT DISTINCT FROM OLD.account_status THEN
    RETURN NEW;
  END IF;

  IF current_user IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'role and account_status can only be changed by an approval or admin path'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_profile_privileges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.enforce_profile_privileges() TO authenticated, service_role;

DROP TRIGGER IF EXISTS profiles_enforce_privileges ON public.profiles;
CREATE TRIGGER profiles_enforce_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_profile_privileges();

DROP POLICY IF EXISTS "Users can update own profile (limited)" ON public.profiles;
CREATE POLICY "Users can update own profile (limited)"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND account_status::text = (
      SELECT p.account_status::text FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND role::text = (
      SELECT p.role::text FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Quizzes: learners do not receive answer keys. Scores are server-written.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS quiz_questions_select ON public.quiz_questions;
CREATE POLICY quiz_questions_select_staff ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.lessons l ON l.id = q.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE q.id = quiz_questions.quiz_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can update their own quiz attempts" ON public.quiz_attempts;

DROP POLICY IF EXISTS quiz_attempts_select_staff ON public.quiz_attempts;
CREATE POLICY quiz_attempts_select_staff ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.lessons l ON l.id = q.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE q.id = quiz_attempts.quiz_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS quiz_attempts_delete_staff ON public.quiz_attempts;
CREATE POLICY quiz_attempts_delete_staff ON public.quiz_attempts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.lessons l ON l.id = q.lesson_id
      JOIN public.modules m ON m.id = l.module_id
      WHERE q.id = quiz_attempts.quiz_id
        AND private.can_manage_course(m.course_id, auth.uid())
    )
  );

REVOKE INSERT, UPDATE ON public.quiz_attempts FROM authenticated, anon;
