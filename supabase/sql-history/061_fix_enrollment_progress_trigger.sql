-- Allow lesson completion to update enrollment % without being blocked by
-- enrollment-approval rules or RLS (runs as definer).
CREATE OR REPLACE FUNCTION public.update_enrollment_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_lessons INTEGER;
  done_lessons INTEGER;
  new_pct INTEGER;
BEGIN
  IF NEW.course_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = NEW.course_id
    AND l.is_published = true;

  SELECT COUNT(*) INTO done_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE lp.user_id = NEW.user_id
    AND m.course_id = NEW.course_id
    AND l.is_published = true
    AND lp.completed = true;

  IF total_lessons = 0 THEN
    new_pct := 0;
  ELSE
    new_pct := ROUND((done_lessons::FLOAT / total_lessons::FLOAT) * 100);
  END IF;

  UPDATE enrollments
  SET progress_percentage = new_pct,
      completed_at = CASE
        WHEN new_pct >= 100 THEN COALESCE(completed_at, NOW())
        ELSE completed_at
      END,
      status = CASE
        WHEN new_pct >= 100 THEN 'completed'
        WHEN status = 'completed' AND new_pct < 100 THEN 'active'
        ELSE status
      END,
      updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND course_id = NEW.course_id;

  RETURN NEW;
END;
$$;

-- Students may transition active <-> completed via progress rollup.
-- Creators/admins still control pending/rejected/etc.
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
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'completed' AND NEW.status = 'active' THEN
      RETURN NEW;
    END IF;

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
