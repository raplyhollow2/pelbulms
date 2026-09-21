-- Live LMS presence: heartbeat + instant leave for Active Now / Active Today.

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'idle', 'offline')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_interactive_at timestamptz NOT NULL DEFAULT now(),
  session_started_at timestamptz NOT NULL DEFAULT now(),
  path text,
  path_label text,
  left_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_presence_status_seen_idx
  ON public.user_presence (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS user_presence_today_idx
  ON public.user_presence (last_seen_at DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS user_presence_select_own ON public.user_presence;
CREATE POLICY user_presence_select_own
  ON public.user_presence
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_presence_select_staff ON public.user_presence;
CREATE POLICY user_presence_select_staff
  ON public.user_presence
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS user_presence_insert_own ON public.user_presence;
CREATE POLICY user_presence_insert_own
  ON public.user_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_presence_update_own ON public.user_presence;
CREATE POLICY user_presence_update_own
  ON public.user_presence
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
REVOKE ALL ON TABLE public.user_presence FROM anon;

CREATE OR REPLACE FUNCTION public.presence_heartbeat(
  p_status text,
  p_path text DEFAULT NULL,
  p_path_label text DEFAULT NULL,
  p_interactive boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today_start timestamptz :=
    (date_trunc('day', now() AT TIME ZONE 'Asia/Thimphu') AT TIME ZONE 'Asia/Thimphu');
  next_status text := lower(coalesce(p_status, 'online'));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF next_status NOT IN ('online', 'idle') THEN
    next_status := 'idle';
  END IF;

  INSERT INTO public.user_presence (
    user_id, status, last_seen_at, last_interactive_at, session_started_at,
    path, path_label, left_reason, updated_at
  )
  VALUES (
    uid,
    next_status,
    now(),
    CASE WHEN p_interactive THEN now() ELSE now() END,
    now(),
    p_path,
    p_path_label,
    NULL,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = excluded.status,
    last_seen_at = now(),
    last_interactive_at = CASE
      WHEN p_interactive THEN now()
      ELSE public.user_presence.last_interactive_at
    END,
    session_started_at = CASE
      WHEN public.user_presence.status = 'offline'
        OR public.user_presence.last_seen_at < today_start
      THEN now()
      ELSE public.user_presence.session_started_at
    END,
    path = excluded.path,
    path_label = excluded.path_label,
    left_reason = NULL,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_leave(p_reason text DEFAULT 'unload')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.user_presence
  SET
    status = 'offline',
    left_reason = coalesce(nullif(trim(p_reason), ''), 'unload'),
    last_seen_at = now(),
    updated_at = now()
  WHERE user_id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.presence_heartbeat(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.presence_leave(text) TO authenticated;
REVOKE ALL ON FUNCTION public.presence_heartbeat(text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_leave(text) FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END
$$;

COMMENT ON TABLE public.user_presence IS
  'Per-user LMS presence. Active Now = status online and last_seen within grace window; Active Today = last_seen since Thimphu midnight.';
