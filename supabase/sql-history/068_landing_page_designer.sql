-- ============================================================================
-- 068: Landing page designer fields on platform_settings
-- Cinematic hero video + editable features / steps / FAQ / stats
-- ============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS hero_video_url TEXT
    DEFAULT 'https://www.youtube.com/watch?v=xpCj64W2Yxs',
  ADD COLUMN IF NOT EXISTS hero_rotating_words TEXT[]
    NOT NULL DEFAULT ARRAY['Modern Bhutan', 'Every Learner', 'Future Leaders', 'Gelephu', 'Our Nation'],
  ADD COLUMN IF NOT EXISTS hero_cta_primary_label TEXT
    DEFAULT 'Create your account',
  ADD COLUMN IF NOT EXISTS landing_stats JSONB
    NOT NULL DEFAULT '[
      {"value":"500+","label":"Learners"},
      {"value":"100+","label":"Courses"},
      {"value":"20","label":"Dzongkhags"}
    ]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_features JSONB
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_steps JSONB
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_faq JSONB
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_section_titles JSONB
    NOT NULL DEFAULT '{}'::jsonb;

-- Seed hero video on existing singleton if blank
UPDATE public.platform_settings
SET
  hero_video_url = COALESCE(
    NULLIF(btrim(hero_video_url), ''),
    'https://www.youtube.com/watch?v=xpCj64W2Yxs'
  ),
  hero_cta_primary_label = COALESCE(
    NULLIF(btrim(hero_cta_primary_label), ''),
    'Create your account'
  ),
  updated_at = NOW()
WHERE id = 'default';

COMMENT ON COLUMN public.platform_settings.hero_video_url IS
  'YouTube URL for cinematic full-bleed landing hero background';
COMMENT ON COLUMN public.platform_settings.hero_rotating_words IS
  'Typewriter words shown under the landing headline';
COMMENT ON COLUMN public.platform_settings.landing_features IS
  'JSON array of {title, description, icon} for the features section';
COMMENT ON COLUMN public.platform_settings.landing_steps IS
  'JSON array of {title, description, icon} for how-it-works';
COMMENT ON COLUMN public.platform_settings.landing_faq IS
  'JSON array of {question, answer} for FAQ';
COMMENT ON COLUMN public.platform_settings.landing_section_titles IS
  'JSON object of section eyebrow/title/subtitle overrides';
