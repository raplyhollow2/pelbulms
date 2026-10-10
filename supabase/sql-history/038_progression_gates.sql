-- Progression gates: module settings + activity completion on lesson progress
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS activity_completed BOOLEAN DEFAULT false;

ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS activity_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN modules.metadata IS
  'Module settings e.g. sequentialUnlock, gateResourcesUntilComplete, gateNextUntilActivitiesDone';

COMMENT ON COLUMN lesson_progress.activity_completed IS
  'Student finished gated resources/flashcards for this lesson (unlocks next when enabled)';
