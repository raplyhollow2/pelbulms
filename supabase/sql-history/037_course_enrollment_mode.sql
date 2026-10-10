-- Per-course enrollment: auto (immediate) or approval (creator must verify)
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enrollment_mode TEXT NOT NULL DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_enrollment_mode_check'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_enrollment_mode_check
      CHECK (enrollment_mode IN ('auto', 'approval'));
  END IF;
END $$;

COMMENT ON COLUMN courses.enrollment_mode IS
  'auto = student enrolls immediately; approval = creator must approve before access';

-- Ensure pending is a valid enrollment status (status is free-form text already)
CREATE INDEX IF NOT EXISTS idx_enrollments_course_status
  ON enrollments(course_id, status);
