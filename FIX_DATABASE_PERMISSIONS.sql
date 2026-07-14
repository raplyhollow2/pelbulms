-- ===========================================
-- COMPREHENSIVE DATABASE PERMISSIONS FIX
-- Run this to fix all permission issues
-- ===========================================

-- Step 1: Ensure RLS is disabled
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts DISABLE ROW LEVEL SECURITY;

-- Step 2: Grant proper permissions to authenticated users and service roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE quizzes TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE quiz_questions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE quiz_attempts TO postgres, anon, authenticated, service_role;

-- Step 3: Grant sequence permissions if any sequences exist
DO $$
BEGIN
  -- Grant permissions on all sequences in public schema
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No sequences to grant permissions on';
END $$;

-- Step 4: Verify permissions
SELECT
  'Table permissions:' as info,
  table_name,
  privilege_type,
  grantee
FROM information_schema.table_privileges
WHERE table_name IN ('quizzes', 'quiz_questions', 'quiz_attempts')
AND grantee IN ('postgres', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, privilege_type;

-- Step 5: Test direct query (this should work)
SELECT '✅ Testing direct database query:' as status;
SELECT
  id,
  lesson_id,
  title,
  is_published
FROM quizzes
WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001'
AND is_published = true
LIMIT 1;

-- Step 6: Show table exists and is accessible
SELECT
  '✅ Quiz tables exist and are accessible:' as status,
  schemaname,
  tablename,
  hasindexes,
  hasrules,
    hastriggers
FROM pg_tables
WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- Step 7: Verify RLS is definitely disabled
SELECT
  '✅ RLS Status (should all be false):' as status,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');