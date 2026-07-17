-- ============================================================
-- INSPECT CURRENT RBAC/ROLE STRUCTURE IN SUPABASE
-- ============================================================

-- 1. Check what columns exist in the profiles table
SELECT
  'PROFILES TABLE STRUCTURE' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. Show all users and their roles
SELECT
  'ALL USERS AND THEIR ROLES' as info,
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  p.full_name,
  p.role,
  p.bio,
  p.avatar_url,
  CASE
    WHEN u.email = 'raplyhollow2@gmail.com' THEN '🦸 SUPERUSER'
    WHEN p.role = 'admin' THEN '👑 ADMIN'
    WHEN p.role = 'instructor' THEN '👨‍🏫 INSTRUCTOR'
    WHEN p.role = 'student' THEN '👨‍🎓 STUDENT'
    ELSE '❓ UNKNOWN: ' || p.role
  END as role_description
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY
  CASE p.role
    WHEN 'admin' THEN 1
    WHEN 'instructor' THEN 2
    WHEN 'student' THEN 3
    ELSE 4
  END,
  u.created_at DESC;

-- 3. Show distinct roles that exist
SELECT
  'EXISTING ROLES' as info,
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role
ORDER BY user_count DESC;

-- 4. Check if courses table has instructor_id
SELECT
  'COURSES TABLE STRUCTURE' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'courses'
AND column_name IN ('instructor_id', 'creator_id', 'user_id')
ORDER BY column_name;

-- 5. Show all courses and their instructors
SELECT
  'COURSES AND INSTRUCTORS' as info,
  c.id,
  c.title,
  c.instructor_id,
  u.email as instructor_email,
  p.full_name as instructor_name,
  p.role as instructor_role,
  c.is_published,
  c.created_at
FROM courses c
LEFT JOIN auth.users u ON c.instructor_id = u.id
LEFT JOIN profiles p ON u.id = p.id
ORDER BY c.created_at DESC;

-- 6. Show current RLS policies
SELECT
  'CURRENT RLS POLICIES' as info,
  policyname,
  tablename,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('courses', 'lessons', 'modules', 'profiles', 'enrollments')
ORDER BY tablename, policyname;

-- 7. Check if RLS is enabled
SELECT
  'RLS STATUS' as info,
  n.nspname as schema,
  c.relname as table,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname IN ('courses', 'lessons', 'modules', 'profiles', 'enrollments')
AND c.relkind = 'r'
ORDER BY c.relname;

-- 8. Summary of current RBAC structure
SELECT
  'RBAC SUMMARY' as info,
  'Current role structure in your LMS' as description
UNION ALL
SELECT '🦸 Superuser/Admin: Full system access', 'System-wide access'
UNION ALL
SELECT '👨‍🏫 Instructor: Manage own courses and content', 'Course-level access'
UNION ALL
SELECT '👨‍🎓 Student: View enrolled courses and progress', 'Content access'
UNION ALL
SELECT '📊 Use this information to plan your RBAC strategy', 'Planning guide';