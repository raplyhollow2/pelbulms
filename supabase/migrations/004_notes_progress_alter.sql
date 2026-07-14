-- ============================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================
-- This migration adds missing columns to existing tables

-- Add course_id column to lesson_progress if it doesn't exist
DO $$
BEGIN
  -- Check if course_id column exists in lesson_progress
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'course_id'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

    -- Update existing records to set course_id based on lesson
    UPDATE lesson_progress lp
    SET course_id = (
      SELECT l.course_id
      FROM lessons l
      WHERE l.id = lp.lesson_id
    )
    WHERE course_id IS NULL;
  END IF;
END $$;

-- Add other missing columns to lesson_progress if they don't exist
DO $$
BEGIN
  -- Add progress_percentage if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'progress_percentage'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;

  -- Add last_position_seconds if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'last_position_seconds'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN last_position_seconds INTEGER DEFAULT 0;
  END IF;

  -- Add time_spent_seconds if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lesson_progress'
    AND column_name = 'time_spent_seconds'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN time_spent_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create notes table (this should be new)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_lesson_id_idx ON notes(lesson_id);
CREATE INDEX IF NOT EXISTS notes_course_id_idx ON notes(course_id);

-- Enable RLS on notes table
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notes (users can only access their own notes)
CREATE POLICY "notes_select_policy" ON notes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notes_insert_policy" ON notes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_update_policy" ON notes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_delete_policy" ON notes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Enable RLS on lesson_progress table (if not already enabled)
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lesson_progress (if they don't exist)
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
AFTER INSERT OR UPDATE ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION update_enrollment_progress();

-- Verification
SELECT 'Notes and progress system updated successfully!' as result;