-- Sequential unlock is module-scoped only. Early testing wrote sequentialUnlock onto
-- individual lesson.metadata; those leftovers kept locking later lectures even when
-- the module toggle was off. Strip that key from lessons (idempotent).
-- Lesson-level gateResourcesUntilComplete / gateNextUntilActivitiesDone remain valid.
UPDATE lessons
SET
  metadata = metadata - 'sequentialUnlock',
  updated_at = NOW()
WHERE metadata ? 'sequentialUnlock';
