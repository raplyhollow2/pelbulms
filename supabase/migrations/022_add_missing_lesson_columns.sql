-- ============================================================
-- ADD MISSING LESSON COLUMNS
-- ============================================================
-- This migration adds columns that are expected by the TypeScript types
-- but are missing from the actual database schema

-- Add missing columns to lessons table
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transcript TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resources TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- Update existing records to set is_free based on is_preview
UPDATE lessons SET is_free = is_preview WHERE is_free IS NULL;

-- Verify columns were added
SELECT
  '✅ Missing lesson columns added successfully!' as result,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'lessons'
AND column_name IN ('duration_minutes', 'transcript', 'resources', 'is_free')
ORDER BY column_name;