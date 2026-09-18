-- ============================================================================
-- 070: Hero video loop clip (start / end seconds)
-- Admins can trim which portion of the YouTube hero background loops
-- ============================================================================

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS hero_video_start_seconds INTEGER
    CHECK (hero_video_start_seconds IS NULL OR hero_video_start_seconds >= 0),
  ADD COLUMN IF NOT EXISTS hero_video_end_seconds INTEGER
    CHECK (hero_video_end_seconds IS NULL OR hero_video_end_seconds > 0);

COMMENT ON COLUMN public.platform_settings.hero_video_start_seconds IS
  'Seconds into the hero YouTube video where the background loop starts (null = 0)';
COMMENT ON COLUMN public.platform_settings.hero_video_end_seconds IS
  'Seconds into the hero YouTube video where the background loop ends and restarts (null = full video)';
