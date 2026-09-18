-- ============================================================================
-- Teacher return of graded work: annotated file and/or URL
-- ============================================================================

ALTER TABLE public.lesson_activity_progress
  ADD COLUMN IF NOT EXISTS return_file_url TEXT,
  ADD COLUMN IF NOT EXISTS return_file_name TEXT,
  ADD COLUMN IF NOT EXISTS return_url TEXT;

COMMENT ON COLUMN public.lesson_activity_progress.return_file_url IS
  'Staff-uploaded annotated/returned file for the learner';
COMMENT ON COLUMN public.lesson_activity_progress.return_file_name IS
  'Original filename of the staff return file';
COMMENT ON COLUMN public.lesson_activity_progress.return_url IS
  'Optional URL staff share when returning graded work';

-- Staff return files live under returns/{courseId}/...
DROP POLICY IF EXISTS "assignment_returns_staff_insert" ON storage.objects;
CREATE POLICY "assignment_returns_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'returns'
);

DROP POLICY IF EXISTS "assignment_returns_staff_update" ON storage.objects;
CREATE POLICY "assignment_returns_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'returns'
)
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (storage.foldername(name))[1] = 'returns'
);

-- Keep grade + return fields learner-safe
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

  -- Learners: never set grades or return materials themselves
  IF TG_OP = 'INSERT' THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    NEW.return_file_url := NULL;
    NEW.return_file_name := NULL;
    NEW.return_url := NULL;
    IF NEW.status IS NULL OR NEW.status NOT IN ('draft', 'submitted', 'late') THEN
      NEW.status := CASE WHEN NEW.completed THEN 'submitted' ELSE 'draft' END;
    END IF;
    RETURN NEW;
  END IF;

  -- On learner resubmit: keep submission fields, clear prior grade + return
  IF NEW.response IS DISTINCT FROM OLD.response
     OR NEW.completed IS DISTINCT FROM OLD.completed
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    NEW.return_file_url := NULL;
    NEW.return_file_name := NULL;
    NEW.return_url := NULL;
    IF NEW.status NOT IN ('submitted', 'late', 'draft') THEN
      NEW.status := CASE WHEN NEW.completed THEN 'submitted' ELSE 'draft' END;
    END IF;
  ELSE
    NEW.grade := OLD.grade;
    NEW.max_grade := OLD.max_grade;
    NEW.feedback := OLD.feedback;
    NEW.graded_at := OLD.graded_at;
    NEW.graded_by := OLD.graded_by;
    NEW.return_file_url := OLD.return_file_url;
    NEW.return_file_name := OLD.return_file_name;
    NEW.return_url := OLD.return_url;
    IF OLD.status IN ('graded', 'returned') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
