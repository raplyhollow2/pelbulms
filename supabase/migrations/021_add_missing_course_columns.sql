-- ============================================================
-- ADD MISSING COURSE COLUMNS
-- ============================================================
-- This migration adds columns that are expected by the TypeScript types
-- but are missing from the actual database schema

-- Add missing columns to courses table
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS prerequisites TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requirements TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT NULL;

-- Verify columns were added
SELECT
  '✅ Missing course columns added successfully!' as result,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'courses'
AND column_name IN ('prerequisites', 'learning_objectives', 'requirements', 'tags')
ORDER BY column_name;