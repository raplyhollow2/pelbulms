-- Merge duplicate lesson/module/course forums so discussion posts stay visible.
WITH ranked AS (
  SELECT id, lesson_id, course_id, module_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(
        lesson_id::text,
        'm:' || COALESCE(module_id::text, ''),
        'c:' || course_id::text
      )
      ORDER BY
        (SELECT COUNT(*) FROM threads t WHERE t.forum_id = forums.id) DESC,
        created_at ASC
    ) AS rn
  FROM forums
),
keeper AS (SELECT id, lesson_id, course_id, module_id FROM ranked WHERE rn = 1),
dupes AS (
  SELECT r.id AS dupe_id, k.id AS keep_id
  FROM ranked r
  JOIN keeper k ON (
    (r.lesson_id IS NOT NULL AND r.lesson_id = k.lesson_id)
    OR (r.lesson_id IS NULL AND k.lesson_id IS NULL AND r.module_id IS NOT NULL AND r.module_id = k.module_id)
    OR (r.lesson_id IS NULL AND k.lesson_id IS NULL AND r.module_id IS NULL AND k.module_id IS NULL AND r.course_id = k.course_id)
  )
  WHERE r.rn > 1
)
UPDATE threads t SET forum_id = d.keep_id
FROM dupes d
WHERE t.forum_id = d.dupe_id;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(
        lesson_id::text,
        'm:' || COALESCE(module_id::text, ''),
        'c:' || course_id::text
      )
      ORDER BY
        (SELECT COUNT(*) FROM threads t WHERE t.forum_id = forums.id) DESC,
        created_at ASC
    ) AS rn
  FROM forums
)
DELETE FROM forums WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS forums_unique_lesson_idx
  ON public.forums (lesson_id)
  WHERE lesson_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forums_unique_module_idx
  ON public.forums (module_id)
  WHERE module_id IS NOT NULL AND lesson_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forums_unique_course_idx
  ON public.forums (course_id)
  WHERE module_id IS NULL AND lesson_id IS NULL;
