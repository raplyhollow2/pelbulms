-- ============================================================
-- DIRECT FIX: Disable RLS for notes table temporarily
-- ============================================================
-- Run this in Supabase SQL Editor to completely disable RLS for notes

ALTER TABLE notes DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notes';

-- Test result
SELECT 'Notes RLS completely disabled - all operations should work now' as result;