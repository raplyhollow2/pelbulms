-- ============================================================
-- INSPECT EXISTING lesson_progress TABLE STRUCTURE
-- ============================================================
-- First, let's see what actually exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lesson_progress'
ORDER BY ordinal_position;