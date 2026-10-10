-- Optional LMS logo. Null keeps the built-in Rigbu mark.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.platform_settings.logo_url IS
  'Public URL of the LMS logo. Null uses the built-in Rigbu mark.';
