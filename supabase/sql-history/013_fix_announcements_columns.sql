-- ============================================================
-- FIX ANNOUNCEMENTS TABLE - ADD ALL MISSING COLUMNS
-- ============================================================

-- First, let's see what columns currently exist and add any missing ones
DO $$
BEGIN
    -- Check and add is_pinned column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'announcements' AND column_name = 'is_pinned') THEN
        ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;

    -- Check and add created_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'announcements' AND column_name = 'created_by') THEN
        ALTER TABLE announcements ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Check and add is_global column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'announcements' AND column_name = 'is_global') THEN
        ALTER TABLE announcements ADD COLUMN is_global BOOLEAN DEFAULT false;
    END IF;

    -- Check and add priority column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'announcements' AND column_name = 'priority') THEN
        ALTER TABLE announcements ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
    END IF;
END $$;

-- Update any existing NULL values for the new columns
UPDATE announcements
SET is_pinned = false WHERE is_pinned IS NULL;

UPDATE announcements
SET is_global = false WHERE is_global IS NULL;

UPDATE announcements
SET priority = 'medium' WHERE priority IS NULL;

-- ============================================================
-- CREATE/UPDATE ANNOUNCEMENTS POLICIES
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "announcements_select_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_insert_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_update_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_delete_policy" ON announcements;

-- Create new policies (only use columns that should now exist)
CREATE POLICY "announcements_select_policy" ON announcements
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "announcements_insert_policy" ON announcements
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "announcements_update_policy" ON announcements
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "announcements_delete_policy" ON announcements
FOR DELETE
TO authenticated
USING (true);

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'Announcements table fixed successfully!' as result;

-- Check current columns in announcements table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'announcements'
ORDER BY ordinal_position;