-- ===========================================
-- CHECK IF QUIZ DATA EXISTS
-- Run this to see what's in the database
-- ===========================================

-- Check if quizzes table has any data
SELECT 'All quizzes in database:' as info;
SELECT id, lesson_id, title, is_published, created_at FROM quizzes;

-- Check specifically for our lesson
SELECT 'Quizzes for lesson 850e8400-e29b-41d4-a716-446655440001:' as info;
SELECT id, lesson_id, title, is_published FROM quizzes WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001';

-- Check if lesson exists
SELECT 'Lesson info:' as info;
SELECT id, title, module_id FROM lessons WHERE id = '850e8400-e29b-41d4-a716-446655440001';

-- Check quiz questions if quiz exists
SELECT 'Quiz questions:' as info;
SELECT qq.id, qq.question_text, qq.question_type, qq.quiz_id
FROM quiz_questions qq
JOIN quizzes q ON qq.quiz_id = q.id
WHERE q.lesson_id = '850e8400-e29b-41d4-a716-446655440001';