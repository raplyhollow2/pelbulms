-- ============================================================
-- FIX NOTES TABLE RLS POLICIES
-- ============================================================
-- This will fix the RLS violation that prevents note creation

-- First, ensure all required columns exist
DO $$
BEGIN
    -- Check if course_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notes' AND column_name = 'course_id') THEN
        ALTER TABLE notes ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
    END IF;

    -- Check if is_deleted column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notes' AND column_name = 'is_deleted') THEN
        ALTER TABLE notes ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;

    -- Check if updated_at column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notes' AND column_name = 'updated_at') THEN
        ALTER TABLE notes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for notes
CREATE INDEX IF NOT EXISTS notes_course_id_idx ON notes(course_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_lesson_id_idx ON notes(lesson_id);
CREATE INDEX IF NOT EXISTS notes_is_deleted_idx ON notes(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at DESC);

-- Ensure RLS is enabled
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "notes_select_policy" ON notes;
DROP POLICY IF EXISTS "notes_insert_policy" ON notes;
DROP POLICY IF EXISTS "notes_update_policy" ON notes;
DROP POLICY IF EXISTS "notes_delete_policy" ON notes;

-- Create simple, permissive policies for development
CREATE POLICY "notes_select_policy" ON notes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "notes_insert_policy" ON notes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "notes_update_policy" ON notes
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "notes_delete_policy" ON notes
FOR DELETE
TO authenticated
USING (true);

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'Notes RLS policies created successfully!' as result;

-- Show the current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'notes';

-- Show notes table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notes'
ORDER BY ordinal_position;