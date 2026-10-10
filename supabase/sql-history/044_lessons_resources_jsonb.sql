-- ============================================================================
-- lessons.resources: TEXT[] → JSONB
-- ============================================================================
-- Migration 022 added resources as TEXT[]. The teach UI stores Moodle-style
-- activity objects (assignment, quiz, forum, …). Postgres rejects those on
-- TEXT[], so "Add activity" appears to work then reverts. Align with
-- modules.resources (JSONB from migration 039).
-- ============================================================================

ALTER TABLE public.lessons
  ALTER COLUMN resources DROP DEFAULT;

ALTER TABLE public.lessons
  ALTER COLUMN resources TYPE jsonb
  USING (
    CASE
      WHEN resources IS NULL THEN '[]'::jsonb
      ELSE to_jsonb(resources)
    END
  );

ALTER TABLE public.lessons
  ALTER COLUMN resources SET DEFAULT '[]'::jsonb;

UPDATE public.lessons
SET resources = '[]'::jsonb
WHERE resources IS NULL;

COMMENT ON COLUMN public.lessons.resources IS
  'Lesson activity/resource JSON array (assignment, quiz, file, forum, etc.)';
