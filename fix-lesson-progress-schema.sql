-- ============================================================
-- FIX FOR LESSON PROGRESS LAST_ACCESSED_AT COLUMN
-- ============================================================
-- Run this in your Supabase SQL Editor to fix the lesson progress issue

-- Check if the column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lesson_progress'
        AND column_name = 'last_accessed_at'
    ) THEN
        ALTER TABLE lesson_progress ADD COLUMN last_accessed_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Verify the fix
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'lesson_progress'
AND column_name = 'last_accessed_at';

-- Test result
SELECT 'lesson_progress.last_accessed_at column added/verified' as result;