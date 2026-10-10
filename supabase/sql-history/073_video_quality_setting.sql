-- 073: Platform video delivery quality (lesson Cloudinary + marketing hero preference)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS video_quality TEXT NOT NULL DEFAULT 'high'
    CHECK (video_quality IN ('auto', 'high', 'max'));

COMMENT ON COLUMN public.platform_settings.video_quality IS
  'Delivery preference for lesson videos and marketing hero: auto (smaller), high (default), max (best bitrate).';
