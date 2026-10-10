-- ============================================================
-- COMPLETE LESSON_PROGRESS TABLE FIX
-- ============================================================
-- This migration adds all missing columns to the lesson_progress table
-- It checks each column individually and adds only if missing

-- Add completed column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'completed'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN completed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add completed_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add course_id column if missing (this is critical for progress tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'course_id'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

    -- Update existing records to set course_id through modules relationship
    UPDATE lesson_progress lp
    SET course_id = (
      SELECT m.course_id
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE l.id = lp.lesson_id
    )
    WHERE course_id IS NULL;
  END IF;
END $$;

-- Add progress_percentage column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add last_position_seconds column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'last_position_seconds'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN last_position_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add time_spent_seconds column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'time_spent_seconds'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN time_spent_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create index on course_id for performance if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lesson_progress'
    AND indexname = 'lesson_progress_course_id_idx'
  ) THEN
    CREATE INDEX lesson_progress_course_id_idx ON lesson_progress(course_id);
  END IF;
END $$;

-- Create index on completed column for performance if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lesson_progress'
    AND indexname = 'lesson_progress_completed_idx'
  ) THEN
    CREATE INDEX lesson_progress_completed_idx ON lesson_progress(completed);
  END IF;
END $$;

-- Enable RLS on lesson_progress table (if not already enabled)
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lesson_progress (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "lesson_progress_select_policy" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_insert_policy" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_update_policy" ON lesson_progress;

CREATE POLICY "lesson_progress_select_policy" ON lesson_progress
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "lesson_progress_insert_policy" ON lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "lesson_progress_update_policy" ON lesson_progress
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create function to automatically update enrollment progress
CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total completed lessons for this user in this course
  UPDATE enrollments
  SET progress_percentage = (
    SELECT ROUND(
      (COUNT(*) FILTER (WHERE completed = true)::FLOAT /
      (SELECT COUNT(*) FROM lessons WHERE module_id IN
        (SELECT id FROM modules WHERE course_id = NEW.course_id)
      )::FLOAT) * 100
    )
    FROM lesson_progress lp
    JOIN lessons l ON lp.lesson_id = l.id
    WHERE lp.user_id = NEW.user_id
    AND lp.course_id = NEW.course_id
    AND l.module_id IN (SELECT id FROM modules WHERE course_id = NEW.course_id)
  ),
  updated_at = NOW()
  WHERE user_id = NEW.user_id
  AND course_id = NEW.course_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update enrollment progress
DROP TRIGGER IF EXISTS update_enrollment_progress_trigger ON lesson_progress;
CREATE TRIGGER update_enrollment_progress_trigger
AFTER INSERT OR UPDATE OF completed ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION update_enrollment_progress();

-- Verification
SELECT 'Lesson progress table updated successfully!' as result;