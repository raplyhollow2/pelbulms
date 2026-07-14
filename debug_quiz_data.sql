-- ===========================================
-- DEBUG: Check if quiz data exists and matches
-- Run this to verify everything is correct
-- ===========================================

-- Step 1: Check if quiz table exists and has data
SELECT 'Step 1: Quiz tables' as debug_info;
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- Step 2: Check if quiz was inserted
SELECT 'Step 2: Quiz data' as debug_info;
SELECT id, lesson_id, title, is_published
FROM quizzes
WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001';

-- Step 3: Check if quiz questions were inserted
SELECT 'Step 3: Quiz questions' as debug_info;
SELECT qq.id, qq.quiz_id, qq.question_text, qq.question_type, qq.points
FROM quiz_questions qq
JOIN quizzes q ON qq.quiz_id = q.id
WHERE q.lesson_id = '850e8400-e29b-41d4-a716-446655440001';

-- Step 4: Check the lesson that should have the quiz
SELECT 'Step 4: Lesson info' as debug_info;
SELECT id, title, module_id
FROM lessons
WHERE id = '850e8400-e29b-41d4-a716-446655440001';

-- Step 5: Test the exact query your app uses
SELECT 'Step 5: App query test' as debug_info;
SELECT * FROM quizzes
WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001'
AND is_published = true;

-- Step 6: Check table permissions
SELECT 'Step 6: Table permissions' as debug_info;
SELECT grantor, grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'quizzes'
AND grantee = 'anon';