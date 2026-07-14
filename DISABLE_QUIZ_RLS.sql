-- ===========================================
-- DEFINITIVE QUIZ RLS FIX
-- Run this to completely disable RLS for development
-- ===========================================

-- Disable RLS completely for quiz tables
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- This should show 'f' (false) for rowsecurity, meaning RLS is disabled