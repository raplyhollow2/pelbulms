-- Insert sample quiz for the lesson
-- Make sure you have the lesson_id: 850e8400-e29b-41d4-a716-446655440001

-- First, let's check if the quiz tables exist and create a sample quiz
INSERT INTO quizzes (
  id,
  lesson_id,
  title,
  description,
  passing_score,
  max_attempts,
  is_published
) VALUES (
  '750e8400-e29b-41d4-a716-446655440001',
  '850e8400-e29b-41d4-a716-446655440001',
  'Lesson Quiz',
  'Test your understanding of this lesson material',
  70,
  3,
  true
) ON CONFLICT (id) DO UPDATE SET
  lesson_id = EXCLUDED.lesson_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  passing_score = EXCLUDED.passing_score,
  max_attempts = EXCLUDED.max_attempts,
  is_published = EXCLUDED.is_published;

-- Insert sample questions
INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, explanation, order_index, points) VALUES
  ('850q1-1', '750e8400-e29b-41d4-a716-446655440001', 'What is the main concept covered in this lesson?', 'multiple_choice', '["Option A", "Option B", "Option C", "Option D"]', 'Option A', 'Option A is the correct answer because it represents the core concept discussed.', 0, 10),
  ('850q1-2', '750e8400-e29b-41d4-a716-446655440001', 'True or False: This lesson covers advanced topics.', 'true_false', null, 'false', 'This lesson covers fundamental concepts, not advanced topics.', 1, 5),
  ('850q1-3', '750e8400-e29b-41d4-a716-446655440001', 'Explain the importance of this topic in your own words.', 'short_answer', null, null, null, 2, 15)
ON CONFLICT (id) DO NOTHING;

-- Check if data was inserted successfully
SELECT 'Quiz created:' as status, id, title, is_published FROM quizzes WHERE id = '750e8400-e29b-41d4-a716-446655440001';
SELECT 'Questions created:' as status, id, question_text, question_type FROM quiz_questions WHERE quiz_id = '750e8400-e29b-41d4-a716-446655440001';