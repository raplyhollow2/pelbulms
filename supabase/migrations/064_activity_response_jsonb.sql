-- Store learner submissions for Moodle-style activities (choice, assignment, etc.)
ALTER TABLE public.lesson_activity_progress
  ADD COLUMN IF NOT EXISTS response JSONB;

-- Expand completion sources beyond ack / quiz_pass
ALTER TABLE public.lesson_activity_progress
  DROP CONSTRAINT IF EXISTS lesson_activity_progress_source_check;

ALTER TABLE public.lesson_activity_progress
  ADD CONSTRAINT lesson_activity_progress_source_check
  CHECK (
    source IN (
      'ack',
      'quiz_pass',
      'choice',
      'submission',
      'response',
      'chat'
    )
  );

COMMENT ON COLUMN public.lesson_activity_progress.response IS
  'Learner input payload (choice selection, text submission, chat message, etc.)';
