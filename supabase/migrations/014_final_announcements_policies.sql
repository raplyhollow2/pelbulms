-- ============================================================
-- CREATE WORKING ANNOUNCEMENTS RLS POLICIES
-- ============================================================
-- These policies work with your actual table structure

-- Ensure RLS is enabled
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "announcements_select_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_insert_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_update_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_delete_policy" ON announcements;

-- Students can read all published announcements
CREATE POLICY "announcements_select_policy" ON announcements
FOR SELECT
TO authenticated
USING (
  is_published = true AND
  (is_global = true OR course_id IN (
    SELECT course_id FROM enrollments WHERE user_id = auth.uid()
  ))
);

-- Instructors and admins can insert announcements
CREATE POLICY "announcements_insert_policy" ON announcements
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
);

-- Users can update their own announcements
CREATE POLICY "announcements_update_policy" ON announcements
FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Users can delete their own announcements
CREATE POLICY "announcements_delete_policy" ON announcements
FOR DELETE
TO authenticated
USING (author_id = auth.uid());

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'Announcements RLS policies created successfully!' as result;

-- Show the current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'announcements';