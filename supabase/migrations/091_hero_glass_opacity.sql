-- Opacity of the frosted hero card on the public homepage (20–90).
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS hero_glass_opacity INTEGER NOT NULL DEFAULT 70;

COMMENT ON COLUMN public.platform_settings.hero_glass_opacity IS
  'White fill of the homepage hero card, as a percent from 20 to 90.';
