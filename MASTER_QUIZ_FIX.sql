-- ===========================================
-- MASTER DATABASE FIX FOR QUIZ ACCESS
-- Run this complete solution in Supabase SQL Editor
-- ===========================================

-- Step 1: Drop and recreate tables with proper permissions
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;

-- Step 2: Recreate quizzes table
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  time_limit_minutes INTEGER,
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  is_published BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Recreate quiz_questions table
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options TEXT,
  correct_answer TEXT,
  explanation TEXT,
  order_index INTEGER DEFAULT 0,
  points INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Recreate quiz_attempts table
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  passed BOOLEAN DEFAULT false,
  time_spent_seconds INTEGER,
  answers JSONB,
  feedback JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create indexes
CREATE INDEX idx_quizzes_lesson_id ON quizzes(lesson_id);
CREATE INDEX idx_quizzes_is_published ON quizzes(is_published);
CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);

-- Step 6: Grant permissions to all users
GRANT ALL ON quizzes TO postgres, anon, authenticated, service_role;
GRANT ALL ON quiz_questions TO postgres, anon, authenticated, service_role;
GRANT ALL ON quiz_attempts TO postgres, anon, authenticated, service_role;

-- Step 7: Insert sample quiz data
INSERT INTO quizzes (id, lesson_id, title, description, passing_score, max_attempts, is_published)
VALUES (
  '950e8400-e29b-41d4-a716-446655440001',
  '850e8400-e29b-41d4-a716-446655440001',
  'HTML & CSS Fundamentals Quiz',
  'Test your knowledge of HTML5 and CSS3 fundamentals including semantic markup, styling, responsive design, and modern layout techniques.',
  70,
  3,
  true
);

-- Step 8: Insert sample questions with proper UUIDs
INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, explanation, order_index, points)
VALUES
  (gen_random_uuid(), '950e8400-e29b-41d4-a716-446655440001', 'What does HTML stand for?', 'multiple_choice', '["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlinks and Text Markup Language"]', 'Hyper Text Markup Language', 'HTML is the standard markup language for creating web pages.', 0, 10),
  (gen_random_uuid(), '950e8400-e29b-41d4-a716-446655440001', 'What CSS property is used to change text color?', 'multiple_choice', '["font-color", "text-color", "color", "text-style"]', 'color', 'The color property in CSS is used to set the text color.', 1, 10),
  (gen_random_uuid(), '950e8400-e29b-41d4-a716-446655440001', 'CSS Flexbox is used for:', 'multiple_choice', '["Database management", "One-dimensional layout", "Two-dimensional layout", "Server-side rendering"]', 'One-dimensional layout', 'Flexbox is designed for one-dimensional layout model.', 2, 10),
  (gen_random_uuid(), '950e8400-e29b-41d4-a716-446655440001', 'True or False: Semantic HTML helps with SEO.', 'true_false', null, 'true', 'Semantic HTML provides meaning to web content, which search engines can better understand and rank.', 3, 5);

-- Step 9: Verify everything is working
SELECT '✅ QUIZ SYSTEM RECREATED SUCCESSFULLY!' as status;
SELECT '✅ Tables created:' as info, tablename FROM pg_tables WHERE tablename IN ('quizzes', 'quiz_questions', 'quiz_attempts');
SELECT '✅ Sample quiz:' as info, id, title, is_published FROM quizzes WHERE id = '950e8400-e29b-41d4-a716-446655440001';
SELECT '✅ Sample questions:' as info, id, question_text, question_type FROM quiz_questions WHERE quiz_id = '950e8400-e29b-41d4-a716-446655440001';
SELECT '✅ Test query (should return quiz):' as info, id, lesson_id, title, is_published FROM quizzes WHERE lesson_id = '850e8400-e29b-41d4-a716-446655440001' AND is_published = true;