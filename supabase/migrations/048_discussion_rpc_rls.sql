-- Secure RPCs for discussion posts (bypasses flaky direct-table RLS while
-- still enforcing auth + enrollment/staff checks inside the function).

CREATE OR REPLACE FUNCTION public.create_discussion_thread(
  p_forum_id uuid,
  p_title text,
  p_content text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_forum forums%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_forum FROM forums WHERE id = p_forum_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forum not found';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = v_forum.course_id
        AND e.user_id = v_uid
        AND e.status IN ('active', 'completed')
    )
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = v_forum.course_id
        AND (
          c.instructor_id = v_uid
          OR EXISTS (
            SELECT 1 FROM course_instructors ci
            WHERE ci.course_id = c.id AND ci.user_id = v_uid
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = v_uid
              AND p.role IN ('admin', 'superadmin', 'resource_person')
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO threads (forum_id, user_id, title, content, metadata)
  VALUES (
    p_forum_id,
    v_uid,
    LEFT(COALESCE(NULLIF(trim(p_title), ''), 'Update'), 500),
    COALESCE(NULLIF(trim(p_content), ''), 'Update'),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_discussion_reply(
  p_thread_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_course_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(trim(COALESCE(p_content, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Reply text is required';
  END IF;

  SELECT f.course_id INTO v_course_id
  FROM threads t
  JOIN forums f ON f.id = t.forum_id
  WHERE t.id = p_thread_id;

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = v_course_id
        AND e.user_id = v_uid
        AND e.status IN ('active', 'completed')
    )
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = v_course_id
        AND (
          c.instructor_id = v_uid
          OR EXISTS (
            SELECT 1 FROM course_instructors ci
            WHERE ci.course_id = c.id AND ci.user_id = v_uid
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = v_uid
              AND p.role IN ('admin', 'superadmin', 'resource_person')
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO replies (thread_id, user_id, content)
  VALUES (p_thread_id, v_uid, trim(p_content))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_discussion_forum(
  p_course_id uuid,
  p_module_id uuid DEFAULT NULL,
  p_lesson_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.course_id = p_course_id
        AND e.user_id = v_uid
        AND e.status IN ('active', 'completed')
    )
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = p_course_id
        AND (
          c.instructor_id = v_uid
          OR EXISTS (
            SELECT 1 FROM course_instructors ci
            WHERE ci.course_id = c.id AND ci.user_id = v_uid
          )
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = v_uid
              AND p.role IN ('admin', 'superadmin', 'resource_person')
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_lesson_id IS NOT NULL THEN
    SELECT id INTO v_id FROM forums
    WHERE course_id = p_course_id AND lesson_id = p_lesson_id
    ORDER BY created_at ASC
    LIMIT 1;
  ELSIF p_module_id IS NOT NULL THEN
    SELECT id INTO v_id FROM forums
    WHERE course_id = p_course_id AND module_id = p_module_id AND lesson_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  ELSE
    SELECT id INTO v_id FROM forums
    WHERE course_id = p_course_id AND module_id IS NULL AND lesson_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO forums (
    course_id, module_id, lesson_id, title, description, is_enabled, created_by
  ) VALUES (
    p_course_id,
    p_module_id,
    p_lesson_id,
    CASE WHEN p_lesson_id IS NOT NULL THEN 'Lesson discussion' ELSE 'Course discussion' END,
    'Ask questions and share ideas with classmates.',
    true,
    v_uid
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    IF p_lesson_id IS NOT NULL THEN
      SELECT id INTO v_id FROM forums
      WHERE course_id = p_course_id AND lesson_id = p_lesson_id
      ORDER BY created_at ASC LIMIT 1;
    ELSIF p_module_id IS NOT NULL THEN
      SELECT id INTO v_id FROM forums
      WHERE course_id = p_course_id AND module_id = p_module_id AND lesson_id IS NULL
      ORDER BY created_at ASC LIMIT 1;
    ELSE
      SELECT id INTO v_id FROM forums
      WHERE course_id = p_course_id AND module_id IS NULL AND lesson_id IS NULL
      ORDER BY created_at ASC LIMIT 1;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_discussion_thread(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_discussion_reply(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_discussion_forum(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS course_media_discussion_insert ON storage.objects;
CREATE POLICY course_media_discussion_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'course-media'
  AND (storage.foldername(name))[1] = 'discussion'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

DROP POLICY IF EXISTS course_media_public_select ON storage.objects;
CREATE POLICY course_media_public_select ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'course-media');

DROP POLICY IF EXISTS teachers_notify_enrolled ON public.notifications;
CREATE POLICY teachers_notify_enrolled ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = NULLIF(notifications.metadata->>'course_id', '')::uuid
      AND (
        c.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.course_instructors ci
          WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin', 'resource_person')
        )
      )
  )
);
