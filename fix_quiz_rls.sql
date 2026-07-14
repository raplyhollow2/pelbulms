-- Fix RLS policies for quizzes to allow authenticated users to view published quizzes

-- Drop existing policies
DROP POLICY IF EXISTS "Instructors can view quizzes for their course lessons" ON quizzes;
DROP POLICY IF EXISTS "Instructors can insert quizzes" ON quizzes;
DROP POLICY IF EXISTS "Instructors can update quizzes" ON quizzes;
DROP POLICY IF EXISTS "Instructors can delete quizzes" ON quizzes;

-- Create simpler policies
CREATE POLICY "Authenticated users can view published quizzes" ON quizzes
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Instructors can view all quizzes for their courses" ON quizzes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can insert quizzes" ON quizzes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update quizzes" ON quizzes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete quizzes" ON quizzes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE lessons.id = quizzes.lesson_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Also fix quiz_questions policies
DROP POLICY IF EXISTS "Instructors can view questions for their quizzes" ON quiz_questions;
DROP POLICY IF EXISTS "Instructors can manage questions for their quizzes" ON quiz_questions;

CREATE POLICY "Authenticated users can view questions for published quizzes" ON quiz_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
      AND quizzes.is_published = true
    )
  );

CREATE POLICY "Instructors can manage questions for their quizzes" ON quiz_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN lessons ON lessons.id = quizzes.lesson_id
      JOIN modules ON modules.id = lessons.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
      AND courses.instructor_id = auth.uid()
    )
  );

-- Verify the policies
SELECT 'Quizzes policies:' as info, tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'quizzes';
SELECT 'Quiz_questions policies:' as info, tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'quiz_questions';