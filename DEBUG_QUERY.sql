-- ===========================================
-- DEBUG: Test the exact query the app uses
-- ===========================================

-- Test 1: Check what lesson_id we're looking for
SELECT 'Test 1: Looking for quiz with lesson_id:' as info, '850e8400-e29b-41d4-a716-446655440001' as lesson_id;

-- Test 2: Check if quiz exists with that lesson_id
SELECT 'Test 2: Quiz found by lesson_id:' as info, id, lesson_id, title, is_published
FROM quizzes
WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001';

-- Test 3: Check if quiz is published
SELECT 'Test 3: Quiz found by lesson_id AND is_published:' as info, id, lesson_id, title, is_published
FROM quizzes
WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001'
AND is_published = true;

-- Test 4: Check data types
SELECT 'Test 4: Data types in quiz table:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quizzes'
AND column_name IN ('id', 'lesson_id', 'is_published');

-- Test 5: Try a different approach - see all quizzes
SELECT 'Test 5: All quizzes (to see what we have):' as info, id, lesson_id, title, is_published FROM quizzes;