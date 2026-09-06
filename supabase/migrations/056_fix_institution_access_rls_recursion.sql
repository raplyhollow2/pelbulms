-- ============================================================================
-- Break institution_access RLS recursion that blocked KYC submit
-- ============================================================================
-- "Teachers can view institution access" selected from institution_access
-- inside an institution_access policy. Postgres then re-evaluated the same
-- policy forever. KYC upsert needs SELECT (ON CONFLICT) so every SELECT
-- policy ran, including the recursive one.

CREATE OR REPLACE FUNCTION public.is_institution_staff(check_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.institution_access ia
    WHERE ia.user_id = auth.uid()
      AND ia.institution_id = check_institution_id
      AND ia.is_active = true
      AND ia.role_within_institution IN ('teacher', 'resource_person', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_institution_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_institution_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "Teachers can view institution access" ON public.institution_access;
CREATE POLICY "Teachers can view institution access"
ON public.institution_access FOR SELECT
USING (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Teachers can view institution registrations" ON public.student_registrations;
CREATE POLICY "Teachers can view institution registrations"
ON public.student_registrations FOR SELECT
USING (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Teachers can update registrations" ON public.student_registrations;
CREATE POLICY "Teachers can update registrations"
ON public.student_registrations FOR UPDATE
USING (public.is_institution_staff(institution_id))
WITH CHECK (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Teachers can view institution approvals" ON public.user_approvals;
CREATE POLICY "Teachers can view institution approvals"
ON public.user_approvals FOR SELECT
USING (public.is_institution_staff(institution_id));
