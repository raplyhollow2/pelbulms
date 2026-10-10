-- ============================================================
-- PROPER RLS POLICIES FOR PRODUCTION WITH 100+ STUDENTS
-- ============================================================
-- This creates comprehensive RLS policies that allow:
-- - Instructors to manage their own course content
-- - Students to access enrolled course content
-- - Admins to have full access
-- - Security while maintaining functionality

-- ============================================================
-- LESSONS TABLE RLS POLICIES
-- ============================================================

-- Enable RLS for lessons
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "lessons_select_policy" ON lessons;
DROP POLICY IF EXISTS "lessons_insert_policy" ON lessons;
DROP POLICY IF EXISTS "lessons_update_policy" ON lessons;
DROP POLICY IF EXISTS "lessons_delete_policy" ON lessons;

-- Select policy: Allow reading lessons from courses user is enrolled in or teaches
CREATE POLICY "lessons_select_policy" ON lessons
FOR SELECT
TO authenticated
USING (
  -- Admins can see all lessons
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can see lessons in their courses (via modules)
  EXISTS (
    SELECT 1 FROM modules
    JOIN courses ON courses.id = modules.course_id
    WHERE modules.id = lessons.module_id
    AND courses.instructor_id = auth.uid()
  )
  OR
  -- Students can see lessons from enrolled courses (via modules)
  EXISTS (
    SELECT 1 FROM enrollments
    JOIN modules ON modules.course_id = enrollments.course_id
    WHERE modules.id = lessons.module_id
    AND enrollments.user_id = auth.uid()
  )
);

-- Insert policy: Allow instructors to create lessons in their courses
CREATE POLICY "lessons_insert_policy" ON lessons
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admins can create lessons in any course
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can create lessons in their courses (via modules)
  EXISTS (
    SELECT 1 FROM modules
    JOIN courses ON courses.id = modules.course_id
    WHERE modules.id = lessons.module_id
    AND courses.instructor_id = auth.uid()
  )
);

-- Update policy: Allow instructors to update lessons in their courses
CREATE POLICY "lessons_update_policy" ON lessons
FOR UPDATE
TO authenticated
USING (
  -- Admins can update any lesson
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can update lessons in their courses (via modules)
  EXISTS (
    SELECT 1 FROM modules
    JOIN courses ON courses.id = modules.course_id
    WHERE modules.id = lessons.module_id
    AND courses.instructor_id = auth.uid()
  )
);

-- Delete policy: Allow instructors to delete lessons in their courses
CREATE POLICY "lessons_delete_policy" ON lessons
FOR DELETE
TO authenticated
USING (
  -- Admins can delete any lesson
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can delete lessons in their courses (via modules)
  EXISTS (
    SELECT 1 FROM modules
    JOIN courses ON courses.id = modules.course_id
    WHERE modules.id = lessons.module_id
    AND courses.instructor_id = auth.uid()
  )
);

-- ============================================================
-- COURSES TABLE RLS POLICIES
-- ============================================================

-- Enable RLS for courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "courses_select_policy" ON courses;
DROP POLICY IF EXISTS "courses_insert_policy" ON courses;
DROP POLICY IF EXISTS "courses_update_policy" ON courses;
DROP POLICY IF EXISTS "courses_delete_policy" ON courses;

-- Select policy: Allow reading published courses or user's own courses
CREATE POLICY "courses_select_policy" ON courses
FOR SELECT
TO authenticated
USING (
  -- Admins can see all courses
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can see their own courses
  instructor_id = auth.uid()
  OR
  -- Students can see published courses they're enrolled in
  (is_published = true AND EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = courses.id
    AND enrollments.user_id = auth.uid()
  ))
);

-- Insert policy: Allow instructors and admins to create courses
CREATE POLICY "courses_insert_policy" ON courses
FOR INSERT
TO authenticated
WITH CHECK (
  -- Admins can create courses
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can create courses (they become the instructor)
  instructor_id = auth.uid()
);

-- Update policy: Allow instructors to update their own courses
CREATE POLICY "courses_update_policy" ON courses
FOR UPDATE
TO authenticated
USING (
  -- Admins can update any course
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can update their own courses
  instructor_id = auth.uid()
);

-- Delete policy: Allow instructors to delete their own courses
CREATE POLICY "courses_delete_policy" ON courses
FOR DELETE
TO authenticated
USING (
  -- Admins can delete any course
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can delete their own courses
  instructor_id = auth.uid()
);

-- ============================================================
-- MODULES TABLE RLS POLICIES
-- ============================================================

-- Enable RLS for modules
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "modules_select_policy" ON modules;
DROP POLICY IF EXISTS "modules_insert_policy" ON modules;
DROP POLICY IF EXISTS "modules_update_policy" ON modules;
DROP POLICY IF EXISTS "modules_delete_policy" ON modules;

-- Select policy: Allow reading modules from accessible courses
CREATE POLICY "modules_select_policy" ON modules
FOR SELECT
TO authenticated
USING (
  -- Admins can see all modules
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  -- Instructors can see modules in their courses
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = modules.course_id
    AND courses.instructor_id = auth.uid()
  )
  OR
  -- Students can see modules from enrolled courses
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = modules.course_id
    AND enrollments.user_id = auth.uid()
  )
);

-- Insert/Update/Delete policies for instructors' course modules
CREATE POLICY "modules_insert_policy" ON modules
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = modules.course_id
    AND courses.instructor_id = auth.uid()
  )
);

CREATE POLICY "modules_update_policy" ON modules
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = modules.course_id
    AND courses.instructor_id = auth.uid()
  )
);

CREATE POLICY "modules_delete_policy" ON modules
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  OR
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = modules.course_id
    AND courses.instructor_id = auth.uid()
  )
);

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'Comprehensive RLS policies created for production use!' as result;

-- Show the current policies
SELECT
  policyname,
  tablename,
  permissive,
  roles
FROM pg_policies
WHERE tablename IN ('lessons', 'courses', 'modules')
ORDER BY tablename, policyname;

-- Show that RLS is enabled
SELECT
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname IN ('lessons', 'courses', 'modules')
AND c.relkind = 'r';