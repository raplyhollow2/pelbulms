-- AI provider keys (Gemini + paid avatar vendors).
-- Safe to run even if 040 was never applied: creates the table when missing.

CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  secret TEXT NOT NULL,
  last4 TEXT NOT NULL,
  is_platform BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_provider_keys_owner_check CHECK (
    (is_platform = true AND user_id IS NULL)
    OR (is_platform = false AND user_id IS NOT NULL)
  )
);

ALTER TABLE ai_provider_keys
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_check;

ALTER TABLE ai_provider_keys
  ADD CONSTRAINT ai_provider_keys_provider_check
  CHECK (provider IN ('gemini', 'heygen', 'did', 'tavus'));

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_user_provider
  ON ai_provider_keys (user_id, provider)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_platform_provider
  ON ai_provider_keys (provider)
  WHERE is_platform = true;

ALTER TABLE ai_provider_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ai_provider_keys FROM anon, authenticated;

COMMENT ON TABLE ai_provider_keys IS
  'Gemini/HeyGen/D-ID/Tavus API keys. Never expose secret to the browser; last4 is returned via /api/ai/keys.';

COMMENT ON COLUMN ai_provider_keys.meta IS
  'Non-secret vendor settings such as HeyGen avatar_id, D-ID source_url, Tavus replica_id.';
