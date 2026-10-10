-- Split mandatory CID + identity photo into independent registration toggles,
-- and store registration details on profiles so the user directory can show
-- and edit them (phone, dzongkhag, CID, photos, and related fields).

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS require_cid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_identity_photo BOOLEAN NOT NULL DEFAULT false;

UPDATE public.platform_settings
SET
  require_identity_documents = (require_cid OR require_identity_photo),
  updated_at = NOW()
WHERE id = 'default';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS cid_number TEXT,
  ADD COLUMN IF NOT EXISTS gewog TEXT,
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS passport_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cid_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS pelsung_number TEXT,
  ADD COLUMN IF NOT EXISTS class_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS parent_guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_guardian_phone TEXT;

UPDATE public.student_registrations
SET dzongkhag = CASE dzongkhag
  WHEN 'Chukha' THEN 'Chhukha'
  WHEN 'Pema Gatshel' THEN 'Pemagatshel'
  ELSE dzongkhag
END
WHERE dzongkhag IN ('Chukha', 'Pema Gatshel');

UPDATE public.profiles
SET location = CASE location
  WHEN 'Chukha' THEN 'Chhukha'
  WHEN 'Pema Gatshel' THEN 'Pemagatshel'
  ELSE location
END
WHERE location IN ('Chukha', 'Pema Gatshel');

UPDATE public.profiles p
SET
  phone_number = COALESCE(NULLIF(p.phone_number, ''), r.phone_number),
  date_of_birth = COALESCE(p.date_of_birth, r.date_of_birth),
  gender = COALESCE(NULLIF(p.gender, ''), r.gender),
  cid_number = COALESCE(NULLIF(p.cid_number, ''), NULLIF(btrim(r.cid_number), '')),
  location = COALESCE(NULLIF(p.location, ''), r.dzongkhag),
  gewog = COALESCE(NULLIF(p.gewog, ''), r.gewog),
  village = COALESCE(NULLIF(p.village, ''), r.village),
  education_level = COALESCE(NULLIF(p.education_level, ''), r.education_level),
  passport_photo_url = COALESCE(NULLIF(p.passport_photo_url, ''), r.passport_photo_url),
  cid_photo_url = COALESCE(NULLIF(p.cid_photo_url, ''), r.cid_photo_url),
  pelsung_number = COALESCE(NULLIF(p.pelsung_number, ''), r.pelsung_number),
  class_name = COALESCE(NULLIF(p.class_name, ''), r."class"),
  emergency_contact_name = COALESCE(NULLIF(p.emergency_contact_name, ''), r.emergency_contact_name),
  emergency_contact_phone = COALESCE(NULLIF(p.emergency_contact_phone, ''), r.emergency_contact_phone),
  parent_guardian_name = COALESCE(NULLIF(p.parent_guardian_name, ''), r.parent_guardian_name),
  parent_guardian_phone = COALESCE(NULLIF(p.parent_guardian_phone, ''), r.parent_guardian_phone)
FROM (
  SELECT DISTINCT ON (user_id) *
  FROM public.student_registrations
  ORDER BY user_id, updated_at DESC NULLS LAST, submitted_at DESC NULLS LAST
) r
WHERE r.user_id = p.id;

UPDATE public.profiles
SET
  phone_number = COALESCE(NULLIF(phone_number, ''), NULLIF(metadata->>'phone_number', '')),
  cid_number = COALESCE(NULLIF(cid_number, ''), NULLIF(metadata->>'cid_number', '')),
  pelsung_number = COALESCE(NULLIF(pelsung_number, ''), NULLIF(metadata->>'pelsung_number', '')),
  class_name = COALESCE(NULLIF(class_name, ''), NULLIF(metadata->>'class', ''))
WHERE metadata IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_phone_number
  ON public.profiles (phone_number)
  WHERE phone_number IS NOT NULL;
