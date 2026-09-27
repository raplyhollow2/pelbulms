-- Drop HeyGen, D-ID, and Tavus. Language models stay: gemini, claude, chatgpt, copilot.

DELETE FROM public.ai_provider_keys
WHERE provider IN ('heygen', 'did', 'tavus');

ALTER TABLE public.ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_check;

ALTER TABLE public.ai_provider_keys
  ADD CONSTRAINT ai_provider_keys_provider_check
  CHECK (provider IN ('gemini', 'claude', 'chatgpt', 'copilot'));

UPDATE public.platform_settings
SET ai_feature_routes = ai_feature_routes - 'avatar-script'
WHERE id = 'default'
  AND ai_feature_routes ? 'avatar-script';
