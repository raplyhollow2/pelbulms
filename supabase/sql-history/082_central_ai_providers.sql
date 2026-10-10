-- School-wide language models (Claude, Gemini, ChatGPT, Copilot) plus
-- feature routing. Secrets stay service-role only.

ALTER TABLE public.ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_check;

ALTER TABLE public.ai_provider_keys
  ADD CONSTRAINT ai_provider_keys_provider_check
  CHECK (provider IN (
    'gemini', 'claude', 'chatgpt', 'copilot',
    'heygen', 'did', 'tavus'
  ));

COMMENT ON TABLE public.ai_provider_keys IS
  'Platform AI and avatar keys. Never expose secret to the browser.';

COMMENT ON COLUMN public.ai_provider_keys.meta IS
  'Non-secret settings: model, Azure endpoint/deployment, hourly cap, enabled, avatar ids.';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS ai_feature_routes JSONB NOT NULL
    DEFAULT '{
      "tutor":"gemini",
      "quiz":"gemini",
      "course-generate":"gemini",
      "course-edit":"gemini",
      "extract":"gemini",
      "image":"gemini",
      "avatar-script":"gemini",
      "course-structure":"chatgpt",
      "report":"claude",
      "report-followup":"claude"
    }'::jsonb;

ALTER TABLE public.ai_runs
  ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_runs_user_provider_created
  ON public.ai_runs (user_id, provider, created_at DESC);
