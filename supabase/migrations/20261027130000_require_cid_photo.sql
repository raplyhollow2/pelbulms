-- Split CID card photo from the CID number requirement.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS require_cid_photo boolean DEFAULT false NOT NULL;

-- Keep today's bundled behavior for installs that already require CID.
UPDATE public.platform_settings
SET require_cid_photo = require_cid
WHERE id = 'default';
