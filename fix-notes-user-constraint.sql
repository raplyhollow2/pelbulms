-- ============================================================
-- FIX FOR NOTES USER_ID FOREIGN KEY CONSTRAINT
-- ============================================================
-- Run this in your Supabase SQL Editor to fix the notes user_id issue

-- Step 1: Drop the foreign key constraint
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;

-- Step 2: Make user_id nullable for now (can be reverted later)
ALTER TABLE notes ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Create a more permissive foreign key (optional - for production)
-- ALTER TABLE notes ADD CONSTRAINT notes_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Verify the fix
SELECT
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'notes' AND column_name = 'user_id';

-- Test result
SELECT 'Notes user_id constraint fixed - now accepts NULL values and no FK validation' as result;