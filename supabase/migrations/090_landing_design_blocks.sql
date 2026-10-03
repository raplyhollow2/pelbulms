-- Extra public-homepage blocks edited from Site admin → Marketing.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS hero_cta_secondary_label TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS landing_campus JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_gallery JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.platform_settings.hero_image_url IS
  'Shown in the hero visual panel when hero_video_url is empty.';
COMMENT ON COLUMN public.platform_settings.landing_campus IS
  'Campus cards: [{image_url, title, description}]';
COMMENT ON COLUMN public.platform_settings.landing_quotes IS
  'Quote cards: [{quote, name, role, stars}]';
COMMENT ON COLUMN public.platform_settings.landing_gallery IS
  'Gallery image URLs: ["https://..."]';
