-- Course forum scope: one shared forum per course, with an optional per-lesson filter.
-- Existing lesson and module posts move onto the course forum and keep their source lesson.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS forum_scope TEXT NOT NULL DEFAULT 'course';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'courses_forum_scope_check'
      AND conrelid = 'public.courses'::regclass
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_forum_scope_check
      CHECK (forum_scope IN ('course', 'lesson'));
  END IF;
END $$;

-- Course forum for any course that only has lesson or module forums, so posts have a home.
INSERT INTO public.forums (course_id, title, description, is_enabled, created_by)
SELECT
  src.course_id,
  'Course discussion',
  'Ask questions and share ideas with classmates.',
  src.is_enabled,
  src.created_by
FROM (
  SELECT
    f.course_id,
    bool_or(COALESCE(f.is_enabled, true)) AS is_enabled,
    (array_agg(f.created_by ORDER BY f.created_at ASC NULLS LAST))[1] AS created_by
  FROM public.forums f
  WHERE f.course_id IS NOT NULL
    AND (f.lesson_id IS NOT NULL OR f.module_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM public.forums c
      WHERE c.course_id = f.course_id
        AND c.module_id IS NULL
        AND c.lesson_id IS NULL
    )
  GROUP BY f.course_id
) src;

UPDATE public.threads t
SET metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_strip_nulls(
  jsonb_build_object(
    'source_lesson_id', f.lesson_id,
    'source_lesson_title', l.title,
    'source_module_id', CASE WHEN f.lesson_id IS NULL THEN f.module_id ELSE NULL END
  )
)
FROM public.forums f
LEFT JOIN public.lessons l ON l.id = f.lesson_id
WHERE t.forum_id = f.id
  AND (f.lesson_id IS NOT NULL OR f.module_id IS NOT NULL)
  AND COALESCE(t.metadata->>'source_lesson_id', '') = '';

UPDATE public.threads t
SET forum_id = course_forum.id
FROM public.forums f
JOIN public.forums course_forum
  ON course_forum.course_id = f.course_id
 AND course_forum.module_id IS NULL
 AND course_forum.lesson_id IS NULL
WHERE t.forum_id = f.id
  AND f.course_id IS NOT NULL
  AND (f.lesson_id IS NOT NULL OR f.module_id IS NOT NULL)
  AND t.forum_id <> course_forum.id;

CREATE INDEX IF NOT EXISTS threads_source_lesson_idx
  ON public.threads ((metadata->>'source_lesson_id'))
  WHERE metadata->>'source_lesson_id' IS NOT NULL;
