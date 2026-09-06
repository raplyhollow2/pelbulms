-- ============================================================================
-- Backfill course-creator enrollment approval
-- ============================================================================
-- 054/055 only changed the DEFAULT for new courses. Existing rows stayed
-- enrollment_mode = 'auto', so after KYC students joined instantly and the
-- creator never saw a request. Also: students could UPDATE their own
-- enrollment status through RLS, which would bypass creator approval.

UPDATE public.courses
SET enrollment_mode = 'approval'
WHERE enrollment_mode = 'auto';

ALTER TABLE public.enrollments
  ALTER COLUMN status SET DEFAULT 'pending';

COMMENT ON COLUMN public.enrollments.status IS
  'pending (awaiting creator) | active | completed | dropped | suspended | rejected';

CREATE OR REPLACE FUNCTION public.enforce_course_enrollment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mode text;
  jwt_role text;
BEGIN
  jwt_role := COALESCE(auth.jwt() ->> 'role', '');

  SELECT c.enrollment_mode INTO mode
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(mode, 'approval') = 'approval'
       AND COALESCE(NEW.status, 'pending') IN ('active', 'completed')
       AND jwt_role IS DISTINCT FROM 'service_role' THEN
      NEW.status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.instructor_id = auth.uid()
    ) THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only the course creator can change enrollment status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_course_enrollment_approval() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_course_enrollment_approval_trigger ON public.enrollments;
CREATE TRIGGER enforce_course_enrollment_approval_trigger
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_course_enrollment_approval();

DROP POLICY IF EXISTS "Course creators can update enrollments" ON public.enrollments;
CREATE POLICY "Course creators can update enrollments"
ON public.enrollments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
      AND c.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
      AND c.instructor_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'superadmin')
  )
);
