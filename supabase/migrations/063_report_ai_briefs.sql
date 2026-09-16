-- Cache + audit trail for Claude executive report briefings
CREATE TABLE IF NOT EXISTS public.report_ai_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  range TEXT NOT NULL DEFAULT '30d',
  snapshot_hash TEXT NOT NULL,
  brief JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_ai_briefs_user_created
  ON public.report_ai_briefs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_ai_briefs_hash
  ON public.report_ai_briefs (snapshot_hash);

ALTER TABLE public.report_ai_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_ai_briefs_select_own ON public.report_ai_briefs;
CREATE POLICY report_ai_briefs_select_own ON public.report_ai_briefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS report_ai_briefs_insert_own ON public.report_ai_briefs;
CREATE POLICY report_ai_briefs_insert_own ON public.report_ai_briefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
