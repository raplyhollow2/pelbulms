-- Per-question feedback when the learner picks a wrong answer
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS incorrect_explanation TEXT;
