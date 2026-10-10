-- Course AI assistant: one private thread per student per course,
-- saved prompts, and generated study documents.
-- Instructors do not receive chat transcripts or artifacts.
-- Worksheet answers stay on lesson_activity_progress.

CREATE TABLE IF NOT EXISTS public.ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_threads_user_course_unique UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS ai_threads_user_course_idx
  ON public.ai_threads (user_id, course_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  task TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_messages_thread_created_idx
  ON public.ai_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.ai_saved_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_saved_prompts_user_course_idx
  ON public.ai_saved_prompts (user_id, course_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  activity_id TEXT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('summary', 'document')),
  body_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_artifacts_user_course_idx
  ON public.ai_artifacts (user_id, course_id, created_at DESC);

DROP TRIGGER IF EXISTS update_ai_threads_updated_at ON public.ai_threads;
CREATE TRIGGER update_ai_threads_updated_at
  BEFORE UPDATE ON public.ai_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_saved_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_threads_select_own ON public.ai_threads;
CREATE POLICY ai_threads_select_own ON public.ai_threads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_threads_insert_own ON public.ai_threads;
CREATE POLICY ai_threads_insert_own ON public.ai_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = ai_threads.course_id
        AND e.user_id = auth.uid()
        AND e.status IN ('active', 'completed')
    )
  );

DROP POLICY IF EXISTS ai_threads_update_own ON public.ai_threads;
CREATE POLICY ai_threads_update_own ON public.ai_threads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_threads_delete_own ON public.ai_threads;
CREATE POLICY ai_threads_delete_own ON public.ai_threads
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_select_own ON public.ai_messages;
CREATE POLICY ai_messages_select_own ON public.ai_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_threads t
      WHERE t.id = ai_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_insert_own ON public.ai_messages;
CREATE POLICY ai_messages_insert_own ON public.ai_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_threads t
      WHERE t.id = ai_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_delete_own ON public.ai_messages;
CREATE POLICY ai_messages_delete_own ON public.ai_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_threads t
      WHERE t.id = ai_messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_saved_prompts_select_own ON public.ai_saved_prompts;
CREATE POLICY ai_saved_prompts_select_own ON public.ai_saved_prompts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_saved_prompts_insert_own ON public.ai_saved_prompts;
CREATE POLICY ai_saved_prompts_insert_own ON public.ai_saved_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = ai_saved_prompts.course_id
        AND e.user_id = auth.uid()
        AND e.status IN ('active', 'completed')
    )
  );

DROP POLICY IF EXISTS ai_saved_prompts_delete_own ON public.ai_saved_prompts;
CREATE POLICY ai_saved_prompts_delete_own ON public.ai_saved_prompts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_artifacts_select_own ON public.ai_artifacts;
CREATE POLICY ai_artifacts_select_own ON public.ai_artifacts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_artifacts_insert_own ON public.ai_artifacts;
CREATE POLICY ai_artifacts_insert_own ON public.ai_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = ai_artifacts.course_id
        AND e.user_id = auth.uid()
        AND e.status IN ('active', 'completed')
    )
  );

DROP POLICY IF EXISTS ai_artifacts_delete_own ON public.ai_artifacts;
CREATE POLICY ai_artifacts_delete_own ON public.ai_artifacts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_threads TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ai_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ai_saved_prompts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ai_artifacts TO authenticated;

GRANT ALL ON public.ai_threads TO service_role;
GRANT ALL ON public.ai_messages TO service_role;
GRANT ALL ON public.ai_saved_prompts TO service_role;
GRANT ALL ON public.ai_artifacts TO service_role;
