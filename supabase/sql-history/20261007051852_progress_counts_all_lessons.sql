-- Course progress counts every lesson, published or not.
-- Finishing the lessons that are open stays below 100% while unpublished lessons remain.

CREATE OR REPLACE FUNCTION private.recompute_enrollment_progress(p_user_id uuid, p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_lessons integer;
  done_lessons integer;
  new_pct integer;
BEGIN
  IF p_course_id IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = p_course_id;

  SELECT COUNT(*) INTO done_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE lp.user_id = p_user_id
    AND m.course_id = p_course_id
    AND lp.completed = true;

  IF total_lessons = 0 THEN
    new_pct := 0;
  ELSE
    new_pct := ROUND((done_lessons::float / total_lessons::float) * 100);
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
  WHERE user_id = p_user_id
    AND course_id = p_course_id;
END;
$$;

REVOKE ALL ON FUNCTION private.recompute_enrollment_progress(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.recompute_enrollments_for_course(p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  IF p_course_id IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT user_id
    FROM enrollments
    WHERE course_id = p_course_id
  LOOP
    PERFORM private.recompute_enrollment_progress(rec.user_id, p_course_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.recompute_enrollments_for_course(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_enrollment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.course_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM private.recompute_enrollment_progress(NEW.user_id, NEW.course_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_enrollments_on_lesson_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_old_course_id uuid;
BEGIN
  SELECT course_id INTO v_course_id
  FROM modules
  WHERE id = COALESCE(NEW.module_id, OLD.module_id);

  IF v_course_id IS NOT NULL THEN
    PERFORM private.recompute_enrollments_for_course(v_course_id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.module_id IS DISTINCT FROM OLD.module_id THEN
    SELECT course_id INTO v_old_course_id
    FROM modules
    WHERE id = OLD.module_id;

    IF v_old_course_id IS NOT NULL AND v_old_course_id IS DISTINCT FROM v_course_id THEN
      PERFORM private.recompute_enrollments_for_course(v_old_course_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_enrollments_on_lesson_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lessons_recompute_enrollment_progress ON lessons;
CREATE TRIGGER lessons_recompute_enrollment_progress
AFTER INSERT OR DELETE OR UPDATE OF module_id ON lessons
FOR EACH ROW
EXECUTE FUNCTION public.recompute_enrollments_on_lesson_change();

-- Keep the unused helper aligned with the same denominator.
CREATE OR REPLACE FUNCTION public.calculate_course_progress(user_id uuid, course_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_lessons integer;
  completed_lessons integer;
BEGIN
  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = calculate_course_progress.course_id;

  SELECT COUNT(*) INTO completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = calculate_course_progress.course_id
    AND lp.user_id = calculate_course_progress.user_id
    AND lp.completed = true;

  IF total_lessons > 0 THEN
    RETURN ROUND((completed_lessons::float / total_lessons::float) * 100);
  END IF;
  RETURN 0;
END;
$$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT e.user_id, e.course_id FROM enrollments e LOOP
    PERFORM private.recompute_enrollment_progress(rec.user_id, rec.course_id);
  END LOOP;
END $$;
