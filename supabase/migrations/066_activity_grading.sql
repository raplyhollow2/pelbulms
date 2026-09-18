-- ============================================================================
-- Assessed results: grade / feedback / status on lesson_activity_progress
-- ============================================================================

ALTER TABLE public.lesson_activity_progress
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS grade NUMERIC,
  ADD COLUMN IF NOT EXISTS max_grade NUMERIC,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Backfill status + submitted_at from existing completion rows
UPDATE public.lesson_activity_progress
SET
  submitted_at = COALESCE(submitted_at, completed_at, created_at),
  status = COALESCE(
    status,
    CASE
      WHEN completed = true AND source IN ('submission', 'response', 'choice') THEN 'submitted'
      WHEN completed = true THEN 'submitted'
      ELSE 'draft'
    END
  )
WHERE status IS NULL OR submitted_at IS NULL;

ALTER TABLE public.lesson_activity_progress
  ALTER COLUMN status SET DEFAULT 'draft';

UPDATE public.lesson_activity_progress
SET status = 'draft'
WHERE status IS NULL;

ALTER TABLE public.lesson_activity_progress
  DROP CONSTRAINT IF EXISTS lesson_activity_progress_status_check;

ALTER TABLE public.lesson_activity_progress
  ADD CONSTRAINT lesson_activity_progress_status_check
  CHECK (status IN ('draft', 'submitted', 'graded', 'returned', 'late'));

CREATE INDEX IF NOT EXISTS lesson_activity_progress_lesson_activity_idx
  ON public.lesson_activity_progress (lesson_id, activity_id);

CREATE INDEX IF NOT EXISTS lesson_activity_progress_status_idx
  ON public.lesson_activity_progress (status);

CREATE INDEX IF NOT EXISTS lesson_activity_progress_graded_by_idx
  ON public.lesson_activity_progress (graded_by)
  WHERE graded_by IS NOT NULL;

COMMENT ON COLUMN public.lesson_activity_progress.status IS
  'Assessed workflow: draft | submitted | graded | returned | late';
COMMENT ON COLUMN public.lesson_activity_progress.grade IS
  'Staff-assigned score for this activity submission';
COMMENT ON COLUMN public.lesson_activity_progress.max_grade IS
  'Snapshot of activity maxGrade at submit time';
COMMENT ON COLUMN public.lesson_activity_progress.feedback IS
  'Staff feedback for the learner';

-- Prevent learners from forging grade fields via client RLS updates
CREATE OR REPLACE FUNCTION public.protect_lesson_activity_grades()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff BOOLEAN := false;
BEGIN
  -- Service role / no JWT: allow full writes (teach grading APIs)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'superadmin', 'resource_person')
  )
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = NEW.lesson_id
      AND (
        c.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.course_instructors ci
          WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
        )
      )
  )
  INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Learners: never set grades themselves
  IF TG_OP = 'INSERT' THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    IF NEW.status IS NULL OR NEW.status NOT IN ('draft', 'submitted', 'late') THEN
      NEW.status := CASE WHEN NEW.completed THEN 'submitted' ELSE 'draft' END;
    END IF;
    RETURN NEW;
  END IF;

  -- On learner resubmit: keep submission fields, clear prior grade
  IF NEW.response IS DISTINCT FROM OLD.response
     OR NEW.completed IS DISTINCT FROM OLD.completed
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    IF NEW.status NOT IN ('submitted', 'late', 'draft') THEN
      NEW.status := CASE WHEN NEW.completed THEN 'submitted' ELSE 'draft' END;
    END IF;
  ELSE
    NEW.grade := OLD.grade;
    NEW.max_grade := OLD.max_grade;
    NEW.feedback := OLD.feedback;
    NEW.graded_at := OLD.graded_at;
    NEW.graded_by := OLD.graded_by;
    IF OLD.status IN ('graded', 'returned') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lesson_activity_grades ON public.lesson_activity_progress;
CREATE TRIGGER trg_protect_lesson_activity_grades
  BEFORE INSERT OR UPDATE ON public.lesson_activity_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_lesson_activity_grades();
