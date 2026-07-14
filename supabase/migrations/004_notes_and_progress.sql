-- ============================================================
-- NOTES AND PROGRESS TRACKING SYSTEM
-- ============================================================
-- This creates the complete notes and lesson progress tracking system

-- Step 1: Create notes table for student lesson notes
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

-- Step 2: Create lesson_progress table (if not exists)
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0, -- 0-100 for video progress
  last_position_seconds INTEGER DEFAULT 0, -- Video position
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_lesson_id_idx ON notes(lesson_id);
CREATE INDEX IF NOT EXISTS notes_course_id_idx ON notes(course_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at DESC);

CREATE INDEX IF NOT EXISTS lesson_progress_user_id_idx ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS lesson_progress_lesson_id_idx ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_progress_course_id_idx ON lesson_progress(course_id);
CREATE INDEX IF NOT EXISTS lesson_progress_completed_idx ON lesson_progress(completed);

-- Step 4: Enable RLS on both tables
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for notes
DROP POLICY IF EXISTS "notes_select_policy" ON notes;
DROP POLICY IF EXISTS "notes_insert_policy" ON notes;
DROP POLICY IF EXISTS "notes_update_policy" ON notes;
DROP POLICY IF EXISTS "notes_delete_policy" ON notes;

CREATE POLICY "notes_select_policy" ON notes
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "notes_insert_policy" ON notes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "notes_update_policy" ON notes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "notes_delete_policy" ON notes
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);

-- Step 6: Create RLS policies for lesson_progress
DROP POLICY IF EXISTS "lesson_progress_select_policy" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_insert_policy" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_update_policy" ON lesson_progress;

CREATE POLICY "lesson_progress_select_policy" ON lesson_progress
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "lesson_progress_insert_policy" ON lesson_progress
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "lesson_progress_update_policy" ON lesson_progress
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Step 7: Service role policies for admin functions
CREATE POLICY IF NOT EXISTS "notes_manage_policy" ON notes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "lesson_progress_manage_policy" ON lesson_progress
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 8: Create function to update enrollment progress when lesson is completed
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

-- Step 9: Create trigger to automatically update enrollment progress
DROP TRIGGER IF EXISTS update_enrollment_progress_trigger ON lesson_progress;
CREATE TRIGGER update_enrollment_progress_trigger
AFTER INSERT OR UPDATE ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION update_enrollment_progress();

-- Step 10: Verification queries
SELECT 'Notes table created' as status, COUNT(*) as count FROM notes LIMIT 1;
SELECT 'Lesson progress table created' as status, COUNT(*) as count FROM lesson_progress LIMIT 1;
SELECT 'RLS policies created for notes' as status, COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'notes';
SELECT 'RLS policies created for lesson_progress' as status, COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'lesson_progress';
SELECT 'Progress update function created' as status, COUNT(*) as function_count FROM pg_proc WHERE proname = 'update_enrollment_progress';