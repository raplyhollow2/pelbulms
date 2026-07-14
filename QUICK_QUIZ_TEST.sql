-- ===========================================
-- QUICK QUIZ TEST - Insert simple quiz and verify
-- Run this to create a test quiz RIGHT NOW
-- ===========================================

-- First, let's see what we have
SELECT 'Current quiz data:' as info;
SELECT id, lesson_id, title, is_published FROM quizzes;

-- If no quiz exists, insert one
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM quizzes WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001') THEN
    INSERT INTO quizzes (id, lesson_id, title, description, is_published)
    VALUES (
      '950e8400-e29b-41d4-a716-446655440001',
      '850e8400-e29b-41d4-a716-446655440001',
      'HTML & CSS Fundamentals Quiz',
      'Test your knowledge of HTML5 and CSS3 fundamentals.',
      true
    );

    RAISE NOTICE 'Quiz inserted successfully';
  ELSE
    RAISE NOTICE 'Quiz already exists';
  END IF;
END $$;

-- Now add questions if they don't exist
DO $$
BEGIN
  -- Get the quiz ID
  DECLARE quiz_id UUID;
  SELECT id INTO quiz_id FROM quizzes WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001';

  IF quiz_id IS NOT NULL THEN
    -- Insert questions only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = quiz_id) THEN
      INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, order_index, points)
      VALUES
        (quiz_id, 'What does HTML stand for?', 'multiple_choice', '["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlinks and Text Markup Language"]', 'Hyper Text Markup Language', 'HTML is the standard markup language for creating web pages.', 0, 10),
        (quiz_id, 'What CSS property is used to change text color?', 'multiple_choice', '["font-color", "text-color", "color", "text-style"]', 'color', 'The color property in CSS is used to set the text color.', 1, 10),
        (quiz_id, 'True or False: Semantic HTML helps with SEO.', 'true_false', null, 'true', 'Semantic HTML provides meaning to web content, which search engines can better understand and rank.', 2, 5);

      RAISE NOTICE 'Quiz questions inserted successfully';
    ELSE
      RAISE NOTICE 'Quiz questions already exist';
    END IF;
  ELSE
    RAISE NOTICE 'No quiz found';
  END IF;
END $$;

-- Verify the data
SELECT '✅ Final verification:' as info;
SELECT q.id, q.lesson_id, q.title, q.is_published, COUNT(qq.id) as question_count
FROM quizzes q
LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
WHERE q.lesson_id = '850e8400-e29b-41d4-a716-446655440001'
GROUP BY q.id;