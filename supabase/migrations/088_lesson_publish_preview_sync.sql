-- lessons.is_free and lessons.is_preview are one free-preview flag.
-- The editor writes is_free. Older rows and sample data used is_preview.
-- Keep them equal on every insert and update.

UPDATE public.lessons
SET
  is_free = COALESCE(is_free, false) OR COALESCE(is_preview, false),
  is_preview = COALESCE(is_free, false) OR COALESCE(is_preview, false)
WHERE is_free IS DISTINCT FROM is_preview
   OR is_free IS NULL
   OR is_preview IS NULL;

ALTER TABLE public.lessons
  ALTER COLUMN is_published SET DEFAULT false,
  ALTER COLUMN is_free SET DEFAULT false,
  ALTER COLUMN is_preview SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_lesson_preview_flags()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_published := COALESCE(NEW.is_published, false);
    NEW.is_free := COALESCE(NEW.is_free, false) OR COALESCE(NEW.is_preview, false);
    NEW.is_preview := NEW.is_free;
    RETURN NEW;
  END IF;

  NEW.is_published := COALESCE(NEW.is_published, OLD.is_published, false);

  IF NEW.is_free IS DISTINCT FROM OLD.is_free THEN
    NEW.is_preview := COALESCE(NEW.is_free, false);
    NEW.is_free := NEW.is_preview;
  ELSIF NEW.is_preview IS DISTINCT FROM OLD.is_preview THEN
    NEW.is_free := COALESCE(NEW.is_preview, false);
    NEW.is_preview := NEW.is_free;
  ELSE
    NEW.is_free := COALESCE(NEW.is_free, OLD.is_free, false);
    NEW.is_preview := NEW.is_free;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_lesson_preview_flags ON public.lessons;
CREATE TRIGGER sync_lesson_preview_flags
  BEFORE INSERT OR UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lesson_preview_flags();
