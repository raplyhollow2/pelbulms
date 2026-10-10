-- ============================================================
-- NOTES AND PROGRESS TRACKING SYSTEM
-- ============================================================
-- Run this in Supabase SQL Editor to enable notes and progress tracking

-- Create notes table for student lesson notes
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

-- Create lesson_progress table (if not exists)
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  last_position_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_lesson_id_idx ON notes(lesson_id);
CREATE INDEX IF NOT EXISTS notes_course_id_idx ON notes(course_id);

CREATE INDEX IF NOT EXISTS lesson_progress_user_id_idx ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS lesson_progress_lesson_id_idx ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_progress_course_id_idx ON lesson_progress(course_id);

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

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

-- Create RLS policies for lesson_progress
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
SELECT 'Notes and progress system created successfully!' as result;