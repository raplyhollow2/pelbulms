-- ============================================================
-- PROGRESS -> COMPLETION -> CERTIFICATE PIPELINE
-- ============================================================
-- 1. Ensure lesson_progress has all tracking columns
-- 2. Ensure enrollments has status column
-- 3. Rewrite update_enrollment_progress() to count only published
--    lessons and finalize the enrollment (completed_at + status) at 100%
-- 4. Ensure certificates table + RLS exist
-- ============================================================

-- ---------- lesson_progress columns (idempotent) ----------
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill course_id for any existing rows that are missing it
UPDATE lesson_progress lp
SET course_id = (
  SELECT m.course_id
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE l.id = lp.lesson_id
)
WHERE course_id IS NULL;

CREATE INDEX IF NOT EXISTS lesson_progress_course_id_idx ON lesson_progress(course_id);
CREATE INDEX IF NOT EXISTS lesson_progress_completed_idx ON lesson_progress(completed);

-- Instructors can read progress rows for courses they own (teacher reports)
DROP POLICY IF EXISTS "lesson_progress_select_instructor" ON lesson_progress;
CREATE POLICY "lesson_progress_select_instructor" ON lesson_progress
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = lesson_progress.course_id
      AND c.instructor_id = auth.uid()
  )
);

-- ---------- enrollments status column (idempotent) ----------
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Instructors can read enrollments for courses they own (teacher reports)
DROP POLICY IF EXISTS "enrollments_select_instructor" ON enrollments;
CREATE POLICY "enrollments_select_instructor" ON enrollments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = enrollments.course_id
      AND c.instructor_id = auth.uid()
  )
);

-- ---------- progress rollup + completion finalization ----------
CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_lessons INTEGER;
  done_lessons INTEGER;
  new_pct INTEGER;
BEGIN
  -- Count only PUBLISHED lessons for the course
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
      completed_at = CASE WHEN new_pct >= 100 THEN COALESCE(completed_at, NOW()) ELSE NULL END,
      status = CASE WHEN new_pct >= 100 THEN 'completed' ELSE 'active' END,
      updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND course_id = NEW.course_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_enrollment_progress_trigger ON lesson_progress;
CREATE TRIGGER update_enrollment_progress_trigger
AFTER INSERT OR UPDATE OF completed ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION update_enrollment_progress();

-- ---------- certificates table + RLS ----------
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  certificate_url TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verification_code VARCHAR(255) UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One certificate per user per course
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_course_unique
  ON certificates(user_id, course_id);
CREATE INDEX IF NOT EXISTS certificates_verification_code_idx
  ON certificates(verification_code);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Students can read their own certificates
DROP POLICY IF EXISTS "certificates_select_own" ON certificates;
CREATE POLICY "certificates_select_own" ON certificates
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Instructors can read certificates issued for courses they own
DROP POLICY IF EXISTS "certificates_select_instructor" ON certificates;
CREATE POLICY "certificates_select_instructor" ON certificates
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = certificates.course_id
      AND c.instructor_id = auth.uid()
  )
);

-- NOTE: certificate issuance and public verification are performed with the
-- service-role client (server-side API routes), which bypasses RLS. No anon
-- policy is required.

SELECT 'Progress/completion/certificate pipeline installed.' as result;
