-- ============================================================
-- SAFE COMPREHENSIVE SCHEMA FOR ALL NEW FEATURES
-- ============================================================
-- This migration handles existing tables and adds missing components
-- ============================================================

-- ============================================================
-- REVIEWS TABLE (NEW)
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for reviews
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_course_id_idx ON reviews(course_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews(rating);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);

-- RLS for reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_insert_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;
DROP POLICY IF EXISTS "reviews_delete_policy" ON reviews;

-- Students can read all reviews for a course
CREATE POLICY "reviews_select_policy" ON reviews
FOR SELECT
TO authenticated
USING (true);

-- Students can insert their own reviews
CREATE POLICY "reviews_insert_policy" ON reviews
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "reviews_update_policy" ON reviews
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "reviews_delete_policy" ON reviews
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- ANNOUNCEMENTS TABLE (UPDATE EXISTING)
-- ============================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Check if is_pinned column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'announcements' AND column_name = 'is_pinned') THEN
        ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;

    -- Check if created_by column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'announcements' AND column_name = 'created_by') THEN
        ALTER TABLE announcements ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for announcements
CREATE INDEX IF NOT EXISTS announcements_course_id_idx ON announcements(course_id);
CREATE INDEX IF NOT EXISTS announcements_priority_idx ON announcements(priority);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_is_pinned_idx ON announcements(is_pinned) WHERE is_pinned = true;

-- Ensure RLS is enabled
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for announcements (handle existing policies)
DROP POLICY IF EXISTS "announcements_select_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_insert_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_update_policy" ON announcements;
DROP POLICY IF EXISTS "announcements_delete_policy" ON announcements;

-- Students can read announcements
CREATE POLICY "announcements_select_policy" ON announcements
FOR SELECT
TO authenticated
USING (is_global = true OR course_id IN (
  SELECT course_id FROM enrollments WHERE user_id = auth.uid()
));

-- Instructors can insert announcements for their courses
CREATE POLICY "announcements_insert_policy" ON announcements
FOR INSERT
TO authenticated
WITH CHECK (
  is_global = true AND
  (created_by IS NULL OR created_by = auth.uid()) OR
  course_id IN (
    SELECT id FROM courses WHERE instructor_id = auth.uid()
  )
);

-- Instructors can update their announcements
CREATE POLICY "announcements_update_policy" ON announcements
FOR UPDATE
TO authenticated
USING (created_by IS NULL OR created_by = auth.uid())
WITH CHECK (created_by IS NULL OR created_by = auth.uid());

-- Instructors can delete their announcements
CREATE POLICY "announcements_delete_policy" ON announcements
FOR DELETE
TO authenticated
USING (created_by IS NULL OR created_by = auth.uid());

-- ============================================================
-- NOTES TABLE (ENSURE SCHEMA IS COMPLETE)
-- ============================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Check if course_id column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notes' AND column_name = 'course_id') THEN
        ALTER TABLE notes ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE CASCADE;
    END IF;

    -- Check if is_deleted column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notes' AND column_name = 'is_deleted') THEN
        ALTER TABLE notes ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;

    -- Check if updated_at column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'notes' AND column_name = 'updated_at') THEN
        ALTER TABLE notes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for notes
CREATE INDEX IF NOT EXISTS notes_course_id_idx ON notes(course_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_lesson_id_idx ON notes(lesson_id);
CREATE INDEX IF NOT EXISTS notes_is_deleted_idx ON notes(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at DESC);

-- Ensure RLS is enabled on notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies for notes
DROP POLICY IF EXISTS "notes_select_policy" ON notes;
DROP POLICY IF EXISTS "notes_insert_policy" ON notes;
DROP POLICY IF EXISTS "notes_update_policy" ON notes;
DROP POLICY IF EXISTS "notes_delete_policy" ON notes;

CREATE POLICY "notes_select_policy" ON notes
FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND is_deleted = false);

CREATE POLICY "notes_insert_policy" ON notes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_update_policy" ON notes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_delete_policy" ON notes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- COURSE CREATION UPDATES (ADD MISSING FIELDS)
-- ============================================================
DO $$
BEGIN
    -- Add published_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'courses' AND column_name = 'published_at') THEN
        ALTER TABLE courses ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add last_updated_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'courses' AND column_name = 'last_updated_at') THEN
        ALTER TABLE courses ADD COLUMN last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add enrollment_count if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'courses' AND column_name = 'enrollment_count') THEN
        ALTER TABLE courses ADD COLUMN enrollment_count INTEGER DEFAULT 0;
    END IF;

    -- Add average_rating if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'courses' AND column_name = 'average_rating') THEN
        ALTER TABLE courses ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0.0;
    END IF;

    -- Add rating_count if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'courses' AND column_name = 'rating_count') THEN
        ALTER TABLE courses ADD COLUMN rating_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================================
-- HELPER FUNCTIONS FOR REVIEWS
-- ============================================================
-- Function to update course rating stats after review insert/update
CREATE OR REPLACE FUNCTION update_course_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews
      WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)
    )
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rating stats
DROP TRIGGER IF EXISTS update_course_rating_after_review ON reviews;
CREATE TRIGGER update_course_rating_after_review
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_course_rating_stats();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check reviews table
SELECT 'Reviews table check:' as info,
       COUNT(*) as total_reviews,
       AVG(rating) as avg_rating
FROM reviews;

-- Check announcements table
SELECT 'Announcements table check:' as info,
       COUNT(*) as total_announcements,
       SUM(CASE WHEN is_pinned THEN 1 ELSE 0 END) as pinned_count
FROM announcements;

-- Check notes table
SELECT 'Notes table check:' as info,
       COUNT(*) as total_notes,
       SUM(CASE WHEN is_deleted THEN 1 ELSE 0 END) as deleted_count
FROM notes;

-- Check courses table updates
SELECT 'Courses table check:' as info,
       COUNT(*) as total_courses,
       AVG(average_rating) as overall_avg_rating
FROM courses;

SELECT 'All new features schema created/updated successfully!' as result;