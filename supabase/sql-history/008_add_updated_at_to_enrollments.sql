-- ============================================================
-- ADD UPDATED_AT COLUMN TO ENROLLMENTS TABLE
-- ============================================================
-- This migration adds the missing updated_at column to the enrollments table
-- This column is needed by the update_enrollment_progress trigger

-- Add updated_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE enrollments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Verification
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'enrollments'
AND column_name = 'updated_at';