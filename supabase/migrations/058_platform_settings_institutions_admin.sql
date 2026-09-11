-- ============================================================================
-- 058: Superadmin site settings + institution admin + optional KYC fields
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Platform settings (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  site_name TEXT NOT NULL DEFAULT 'Pelbu LMS',
  tagline TEXT DEFAULT 'Bhutan''s private learning platform',
  support_email TEXT,
  landing_headline TEXT,
  landing_description TEXT,
  public_catalog BOOLEAN NOT NULL DEFAULT true,
  featured_course_ids UUID[] NOT NULL DEFAULT '{}',
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  require_identity_documents BOOLEAN NOT NULL DEFAULT true,
  require_qualification BOOLEAN NOT NULL DEFAULT false,
  require_student_id BOOLEAN NOT NULL DEFAULT false,
  require_emergency_contact BOOLEAN NOT NULL DEFAULT false,
  require_tos_consent BOOLEAN NOT NULL DEFAULT false,
  collect_hear_about_us BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

COMMENT ON TABLE public.platform_settings IS
  'Singleton LMS site administration settings. Writes via service role only.';

-- ---------------------------------------------------------------------------
-- Institutions: soft-delete
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_institutions_is_active
  ON public.institutions (is_active);

-- ---------------------------------------------------------------------------
-- Optional identity documents on student_registrations
-- ---------------------------------------------------------------------------
ALTER TABLE public.student_registrations
  ALTER COLUMN cid_number DROP NOT NULL,
  ALTER COLUMN passport_photo_url DROP NOT NULL,
  ALTER COLUMN gewog DROP NOT NULL,
  ALTER COLUMN dzongkhag DROP NOT NULL;

ALTER TABLE public.student_registrations DROP CONSTRAINT IF EXISTS valid_cid_format;
ALTER TABLE public.student_registrations
  ADD CONSTRAINT valid_cid_format
  CHECK (cid_number IS NULL OR btrim(cid_number) = '' OR cid_number ~ '^[0-9]{11}$');

ALTER TABLE public.student_registrations DROP CONSTRAINT IF EXISTS unique_cid_per_institution;
DROP INDEX IF EXISTS unique_cid_per_institution_not_null;
CREATE UNIQUE INDEX unique_cid_per_institution_not_null
  ON public.student_registrations (cid_number, institution_id)
  WHERE cid_number IS NOT NULL AND btrim(cid_number) <> '';

ALTER TABLE public.student_registrations
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hear_about_us TEXT;
