-- Count background sessions as live; skip no-op heartbeat writes; shrink realtime WAL.

ALTER TABLE public.user_presence REPLICA IDENTITY DEFAULT;

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
    updated_at = now()
  WHERE public.user_presence.status IS DISTINCT FROM excluded.status
     OR public.user_presence.path IS DISTINCT FROM excluded.path
     OR public.user_presence.last_seen_at < now() - interval '25 seconds';
END;
$$;
