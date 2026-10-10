-- Coursebox-style AI authoring: provider keys stored server-side only.
-- Authenticated clients cannot read secrets; API routes use the service role.

CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'heygen')),
  secret TEXT NOT NULL,
  last4 TEXT NOT NULL,
  is_platform BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_provider_keys_owner_check CHECK (
    (is_platform = true AND user_id IS NULL)
    OR (is_platform = false AND user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_user_provider
  ON ai_provider_keys (user_id, provider)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_platform_provider
  ON ai_provider_keys (provider)
  WHERE is_platform = true;

ALTER TABLE ai_provider_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ai_provider_keys FROM anon, authenticated;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated/anon.
-- Service role bypasses RLS and is the only writer/reader.

COMMENT ON TABLE ai_provider_keys IS
  'Gemini/HeyGen API keys. Never expose secret to the browser; last4 is returned via /api/ai/keys.';
