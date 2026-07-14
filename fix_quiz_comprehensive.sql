-- COMPREHENSIVE QUIZ SYSTEM FIX

-- First, let's verify tables exist
SELECT 'Checking quiz tables...' as status;
SELECT tablename FROM pg_tables WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can view published quizzes" ON quizzes;
DROP POLICY IF EXISTS "Instructors can view all quizzes for their courses" ON quizzes;
DROP POLICY IF EXISTS "Instructors can insert quizzes" ON quizzes;
DROP POLICY IF EXISTS "Instructors can update quizzes" ON quizzes;
DROP POLICY IF EXISTS "Instructors can delete quizzes" ON quizzes;
DROP POLICY IF EXISTS "Authenticated users can view questions for published quizzes" ON quiz_questions;
DROP POLICY IF EXISTS "Instructors can manage questions for their quizzes" ON quiz_questions;

-- Create very simple permissive policies for development
CREATE POLICY "Enable read access for all authenticated users" ON quizzes
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON quizzes
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON quizzes
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON quizzes
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Same for quiz_questions
CREATE POLICY "Enable read access for all authenticated users" ON quiz_questions
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON quiz_questions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON quiz_questions
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON quiz_questions
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- And quiz_attempts
CREATE POLICY "Enable all access for authenticated users" ON quiz_attempts
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Verify policies are created
SELECT 'Quiz policies created:' as info, tablename, policyname FROM pg_policies WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');

-- Test data insertion with proper error handling
DO $$
BEGIN
  -- Insert sample quiz
  INSERT INTO quizzes (id, lesson_id, title, description, passing_score, max_attempts, is_published)
  VALUES (
    '750e8400-e29b-41d4-a716-446655440001',
    '850e8400-e29b-41d4-a716-446655440001',
    'Lesson Quiz',
    'Test your understanding of this lesson material',
    70,
    3,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    lesson_id = EXCLUDED.lesson_id,
    title = EXCLUDED.title,
    is_published = EXCLUDED.is_published;

  -- Insert sample questions
  INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, explanation, order_index, points)
  VALUES
    ('850q1-1', '750e8400-e29b-41d4-a716-446655440001', 'What is the main concept covered in this lesson?', 'multiple_choice', '["Option A", "Option B", "Option C", "Option D"]', 'Option A', 'Option A is the correct answer because it represents the core concept discussed.', 0, 10),
    ('850q1-2', '750e8400-e29b-41d4-a716-446655440001', 'True or False: This lesson covers advanced topics.', 'true_false', null, 'false', 'This lesson covers fundamental concepts, not advanced topics.', 1, 5)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Quiz data inserted successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error inserting quiz data: %', SQLERRM;
END $$;

-- Verify data exists
SELECT 'Quiz data verification:' as status;
SELECT id, lesson_id, title, is_published FROM quizzes WHERE id = '750e8400-e29b-41d4-a716-446655440001';
SELECT id, quiz_id, question_text, question_type FROM quiz_questions WHERE quiz_id = '750e8400-e29b-41d4-a716-446655440001';

-- Test query that the app uses
SELECT 'Testing app query:' as status;
SELECT * FROM quizzes WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001' AND is_published = true;