-- Platform defaults for which model family handles each Pelbu AI task,
-- and a usage log that records the model without storing prompt text.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS ai_model_defaults JSONB NOT NULL
    DEFAULT '{"report":"claude","course-structure":"chatgpt"}'::jsonb;

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  audience TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_created
  ON public.ai_runs (created_at DESC);

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_runs_select_superadmin ON public.ai_runs;
CREATE POLICY ai_runs_select_superadmin ON public.ai_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
