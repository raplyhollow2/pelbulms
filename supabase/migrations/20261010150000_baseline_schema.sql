


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."approve_student_registration"("target_registration_id" "uuid", "review_action" character varying, "review_notes_text" "text" DEFAULT NULL::"text", "rejection_reason_text" "text" DEFAULT NULL::"text", "assigned_role_text" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  registration_record student_registrations%ROWTYPE;
  final_role VARCHAR;
  institution_role VARCHAR;
BEGIN
  -- Load the registration first so we know which institution to check against.
  SELECT * INTO registration_record
  FROM student_registrations
  WHERE id = target_registration_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;

  -- Only a superadmin or an assigned reviewer for this institution may act.
  IF NOT is_registration_reviewer(auth.uid(), registration_record.institution_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an assigned reviewer for this institution');
  END IF;

  IF review_action = 'approve' THEN
    IF registration_record.registration_status NOT IN ('submitted', 'under_review', 'additional_info_requested') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Registration not in approvable state');
    END IF;

    -- Confirmed role: reviewer override > requested role > student.
    final_role := COALESCE(
      NULLIF(assigned_role_text, ''),
      NULLIF(registration_record.requested_role, ''),
      'student'
    );

    institution_role := CASE
      WHEN final_role IN ('instructor', 'admin', 'resource_person') THEN 'teacher'
      ELSE 'student'
    END;

    UPDATE student_registrations
    SET registration_status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = review_notes_text,
        updated_at = NOW()
    WHERE id = target_registration_id;

    UPDATE profiles
    SET account_status = 'active',
        role = final_role,
        institution_id = registration_record.institution_id,
        enrollment_date = NOW(),
        full_name = registration_record.full_name,
        location = registration_record.dzongkhag,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'cid_number', registration_record.cid_number,
          'pelsung_number', registration_record.pelsung_number,
          'class', registration_record.class,
          'phone_number', registration_record.phone_number
        )
    WHERE id = registration_record.user_id;

    INSERT INTO institution_access (
      institution_id, user_id, role_within_institution, granted_by, granted_at
    ) VALUES (
      registration_record.institution_id,
      registration_record.user_id,
      institution_role,
      auth.uid(),
      NOW()
    ) ON CONFLICT (institution_id, user_id) DO UPDATE SET
      role_within_institution = institution_role,
      granted_by = auth.uid(),
      granted_at = NOW(),
      is_active = true;

    INSERT INTO user_approvals (
      user_id, institution_id, approval_status, reviewed_by, reviewed_at, notes
    ) VALUES (
      registration_record.user_id,
      registration_record.institution_id,
      'approved',
      auth.uid(),
      NOW(),
      'Approved as ' || final_role || ': ' || COALESCE(review_notes_text, 'No notes')
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      notes = 'Approved as ' || final_role || ': ' || COALESCE(review_notes_text, 'No notes');

    -- Sync auth metadata so the middleware gate sees the change instantly.
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'account_status', 'active',
      'role', final_role,
      'institution_id', registration_record.institution_id::text
    )
    WHERE id = registration_record.user_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Registration approved as ' || final_role,
      'user_id', registration_record.user_id,
      'assigned_role', final_role,
      'registration_id', target_registration_id
    );

  ELSIF review_action = 'reject' THEN
    UPDATE student_registrations
    SET registration_status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = review_notes_text,
        rejection_reason = rejection_reason_text,
        updated_at = NOW()
    WHERE id = target_registration_id;

    UPDATE profiles SET account_status = 'rejected'
    WHERE id = registration_record.user_id;

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'account_status', 'rejected'
    )
    WHERE id = registration_record.user_id;

    INSERT INTO user_approvals (
      user_id, institution_id, approval_status, reviewed_by, reviewed_at, rejection_reason, notes
    ) VALUES (
      registration_record.user_id,
      registration_record.institution_id,
      'rejected',
      auth.uid(),
      NOW(),
      rejection_reason_text,
      'Rejected: ' || COALESCE(review_notes_text, 'No notes')
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      rejection_reason = rejection_reason_text,
      notes = 'Rejected: ' || COALESCE(review_notes_text, 'No notes');

    RETURN jsonb_build_object('success', true, 'message', 'Registration rejected', 'registration_id', target_registration_id);

  ELSIF review_action = 'request_info' THEN
    UPDATE student_registrations
    SET registration_status = 'additional_info_requested',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = review_notes_text,
        updated_at = NOW()
    WHERE id = target_registration_id;

    RETURN jsonb_build_object('success', true, 'message', 'Additional information requested', 'registration_id', target_registration_id);

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;


ALTER FUNCTION "public"."approve_student_registration"("target_registration_id" "uuid", "review_action" character varying, "review_notes_text" "text", "rejection_reason_text" "text", "assigned_role_text" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_teacher_role"("target_user_id" "uuid", "target_institution_id" "uuid", "assigned_courses" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  admin_role VARCHAR;
  admin_institution UUID;
  user_exists BOOLEAN;
BEGIN
  -- Get current user's role and institution
  SELECT p.role, p.institution_id INTO admin_role, admin_institution
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Verify admin/resource person permissions
  IF admin_role NOT IN ('resource_person', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Verify institution access
  IF admin_institution != target_institution_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Institution mismatch');
  END IF;

  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = target_user_id) INTO user_exists;
  IF NOT user_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
  END IF;

  -- Update user profile role to instructor
  UPDATE profiles
  SET role = 'instructor'
  WHERE id = target_user_id;

  -- Update or create institution access with teacher role
  INSERT INTO institution_access (
    institution_id,
    user_id,
    role_within_institution,
    granted_by,
    granted_at
  ) VALUES (
    target_institution_id,
    target_user_id,
    'teacher',
    auth.uid(),
    NOW()
  ) ON CONFLICT (institution_id, user_id) DO UPDATE SET
    role_within_institution = 'teacher',
    granted_by = auth.uid(),
    granted_at = NOW(),
    is_active = true;

  -- Update auth metadata
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_build_object(
    'role', 'instructor',
    'institution_id', target_institution_id::text
  )
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Teacher role assigned successfully',
    'user_id', target_user_id,
    'assigned_courses', assigned_courses
  );
END;
$$;


ALTER FUNCTION "public"."assign_teacher_role"("target_user_id" "uuid", "target_institution_id" "uuid", "assigned_courses" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_approve_registrations"("registration_ids" "uuid"[], "review_action" character varying, "review_notes_text" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  registration_id UUID;
  success_count INTEGER := 0;
  failure_count INTEGER := 0;
  result JSONB;
  results JSONB := '{}'::jsonb;
BEGIN
  -- Process each registration
  FOREACH registration_id IN ARRAY registration_ids
  LOOP
    -- Call the main approval function for each registration
    result := approve_student_registration(registration_id, review_action, review_notes_text);

    IF (result->>'success')::boolean = true THEN
      success_count := success_count + 1;
    ELSE
      failure_count := failure_count + 1;
      results := results || jsonb_build_object(
        registration_id::text,
        jsonb_build_object('success', false, 'error', result->>'error')
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', jsonb_build_object(
      'total', array_length(registration_ids, 1),
      'successful', success_count,
      'failed', failure_count
    ),
    'results', results,
    'message', format('Bulk approval completed: %s successful, %s failed', success_count, failure_count)
  );
END;
$$;


ALTER FUNCTION "public"."bulk_approve_registrations"("registration_ids" "uuid"[], "review_action" character varying, "review_notes_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_course_progress"("user_id" "uuid", "course_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  total_lessons integer;
  completed_lessons integer;
BEGIN
  SELECT COUNT(*) INTO total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = calculate_course_progress.course_id;

  SELECT COUNT(*) INTO completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = calculate_course_progress.course_id
    AND lp.user_id = calculate_course_progress.user_id
    AND lp.completed = true;

  IF total_lessons > 0 THEN
    RETURN ROUND((completed_lessons::float / total_lessons::float) * 100);
  END IF;
  RETURN 0;
END;
$$;


ALTER FUNCTION "public"."calculate_course_progress"("user_id" "uuid", "course_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."email_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dedupe_key" "text" NOT NULL,
    "template_key" "text" NOT NULL,
    "user_id" "uuid",
    "to_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "claimed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "last_error" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'skipped'::"text", 'dead'::"text"])))
);


ALTER TABLE "public"."email_deliveries" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_email_deliveries"("p_limit" integer) RETURNS SETOF "public"."email_deliveries"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT d.id
    FROM public.email_deliveries d
    WHERE d.status = 'pending'
      AND d.attempts < 5
      AND (d.claimed_at IS NULL OR d.claimed_at < now() - interval '10 minutes')
    ORDER BY d.created_at
    LIMIT GREATEST(COALESCE(p_limit, 1), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_deliveries d
  SET claimed_at = now(),
      attempts = d.attempts + 1
  FROM picked
  WHERE d.id = picked.id
  RETURNING d.*;
END;
$$;


ALTER FUNCTION "public"."claim_email_deliveries"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_user_auth_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When profile is deleted, mark auth metadata as deleted
  UPDATE auth.users
  SET
    raw_app_meta_data = jsonb_build_object(
      'account_status', 'deleted',
      'role', 'deleted',
      'deleted_at', NOW()::text
    ),
    raw_user_meta_data = '{}'::jsonb
  WHERE id = OLD.id;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_user_auth_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_discussion_reply"("p_thread_id" "uuid", "p_content" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_discussion_reply"("p_thread_id" "uuid", "p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_discussion_thread"("p_forum_id" "uuid", "p_title" "text", "p_content" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- Must be enrolled or course staff
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


ALTER FUNCTION "public"."create_discussion_thread"("p_forum_id" "uuid", "p_title" "text", "p_content" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_course_enrollment_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  mode text;
  jwt_role text;
BEGIN
  jwt_role := COALESCE(auth.jwt() ->> 'role', '');

  SELECT c.enrollment_mode INTO mode
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(mode, 'approval') = 'approval'
       AND COALESCE(NEW.status, 'pending') IN ('active', 'completed')
       AND jwt_role IS DISTINCT FROM 'service_role' THEN
      NEW.status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Progress rollup / course finish
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'completed' AND NEW.status = 'active' THEN
      RETURN NEW;
    END IF;

    IF jwt_role = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.instructor_id = auth.uid()
    ) THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only the course creator can change enrollment status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_course_enrollment_approval"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_discussion_forum"("p_course_id" "uuid", "p_module_id" "uuid" DEFAULT NULL::"uuid", "p_lesson_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."ensure_discussion_forum"("p_course_id" "uuid", "p_module_id" "uuid", "p_lesson_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dzongkhag_id"("dzongkhag_name" character varying) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  dzongkhag_id INTEGER;
BEGIN
  SELECT id INTO dzongkhag_id
  FROM bhutan_dzongkhags
  WHERE name = dzongkhag_name OR name_dzongkha = dzongkhag_name;

  RETURN dzongkhag_id;
END;
$$;


ALTER FUNCTION "public"."get_dzongkhag_id"("dzongkhag_name" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_institution_stats"("target_institution_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  pending_count INTEGER;
  approved_count INTEGER;
  rejected_count INTEGER;
  total_students INTEGER;
  total_teachers INTEGER;
BEGIN
  -- Count registration statuses
  SELECT COUNT(*) INTO pending_count
  FROM student_registrations
  WHERE institution_id = target_institution_id
  AND registration_status IN ('submitted', 'under_review');

  SELECT COUNT(*) INTO approved_count
  FROM student_registrations
  WHERE institution_id = target_institution_id
  AND registration_status = 'approved';

  SELECT COUNT(*) INTO rejected_count
  FROM student_registrations
  WHERE institution_id = target_institution_id
  AND registration_status = 'rejected';

  -- Count active students and teachers
  SELECT COUNT(*) INTO total_students
  FROM institution_access
  WHERE institution_id = target_institution_id
  AND role_within_institution = 'student'
  AND is_active = true;

  SELECT COUNT(*) INTO total_teachers
  FROM institution_access
  WHERE institution_id = target_institution_id
  AND role_within_institution = 'teacher'
  AND is_active = true;

  RETURN jsonb_build_object(
    'pending_registrations', pending_count,
    'approved_students', approved_count,
    'rejected_applications', rejected_count,
    'total_active_students', total_students,
    'total_active_teachers', total_teachers,
    'total_participants', total_students + total_teachers
  );
END;
$$;


ALTER FUNCTION "public"."get_institution_stats"("target_institution_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_registration_status"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  registration_info student_registrations%ROWTYPE;
  user_account_status VARCHAR;
BEGIN
  -- Get user's account status
  SELECT account_status INTO user_account_status
  FROM profiles
  WHERE id = target_user_id;

  -- Get registration information
  SELECT * INTO registration_info
  FROM student_registrations
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'registered', false,
      'account_status', user_account_status,
      'message', 'No registration found'
    );
  END IF;

  RETURN jsonb_build_object(
    'registered', true,
    'account_status', user_account_status,
    'registration_status', registration_info.registration_status,
    'institution_id', registration_info.institution_id::text,
    'submitted_at', registration_info.submitted_at,
    'reviewed_at', registration_info.reviewed_at,
    'review_notes', registration_info.review_notes,
    'rejection_reason', registration_info.rejection_reason
  );
END;
$$;


ALTER FUNCTION "public"."get_registration_status"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_institution_staff"("check_institution_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.institution_access ia
    WHERE ia.user_id = auth.uid()
      AND ia.institution_id = check_institution_id
      AND ia.is_active = true
      AND ia.role_within_institution IN ('teacher', 'resource_person', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_institution_staff"("check_institution_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_platform_admin"() IS 'True when the signed-in user is an LMS admin or superadmin. SECURITY DEFINER avoids RLS recursion on profiles.';



CREATE OR REPLACE FUNCTION "public"."is_registration_reviewer"("check_user_id" "uuid", "check_institution_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  is_super BOOLEAN;
  is_reviewer BOOLEAN;
BEGIN
  SELECT (role = 'superadmin') INTO is_super
  FROM profiles WHERE id = check_user_id;

  IF COALESCE(is_super, false) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM registration_reviewers r
    WHERE r.user_id = check_user_id
      AND r.institution_id = check_institution_id
      AND r.is_active = true
  ) INTO is_reviewer;

  RETURN COALESCE(is_reviewer, false);
END;
$$;


ALTER FUNCTION "public"."is_registration_reviewer"("check_user_id" "uuid", "check_institution_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_registration_reviewer"("check_user_id" "uuid", "check_institution_id" "uuid") IS 'True if user is superadmin OR an active registration_reviewers assignee for the institution. Teachers are not auto-granted.';



CREATE OR REPLACE FUNCTION "public"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT private.lesson_is_open(p_lesson_id, p_user_id);
$$;


ALTER FUNCTION "public"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."presence_heartbeat"("p_status" "text", "p_path" "text" DEFAULT NULL::"text", "p_path_label" "text" DEFAULT NULL::"text", "p_interactive" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."presence_heartbeat"("p_status" "text", "p_path" "text", "p_path_label" "text", "p_interactive" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."presence_leave"("p_reason" "text" DEFAULT 'unload'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."presence_leave"("p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_lesson_activity_grades"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  is_staff BOOLEAN := false;
BEGIN
  -- Service role / no JWT: allow full writes (teach grading APIs)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'superadmin', 'resource_person')
  )
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id
    WHERE l.id = NEW.lesson_id
      AND (
        c.instructor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.course_instructors ci
          WHERE ci.course_id = c.id AND ci.user_id = auth.uid()
        )
      )
  )
  INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Learners: never set grades or return materials themselves
  IF TG_OP = 'INSERT' THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    NEW.return_file_url := NULL;
    NEW.return_file_name := NULL;
    NEW.return_url := NULL;
    IF NEW.status IS NULL OR NEW.status NOT IN ('draft', 'submitted', 'late') THEN
      NEW.status := CASE WHEN NEW.completed THEN 'submitted' ELSE 'draft' END;
    END IF;
    RETURN NEW;
  END IF;

  -- On learner resubmit: keep submission fields, clear prior grade + return
  IF NEW.response IS DISTINCT FROM OLD.response
     OR NEW.completed IS DISTINCT FROM OLD.completed
     OR NEW.source IS DISTINCT FROM OLD.source THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.graded_at := NULL;
    NEW.graded_by := NULL;
    NEW.return_file_url := NULL;
    NEW.return_file_name := NULL;
    NEW.return_url := NULL;
    IF NEW.status NOT IN ('submitted', 'late', 'draft') THEN
      NEW.status := CASE WHEN NEW.completed THEN 'submitted' ELSE 'draft' END;
    END IF;
  ELSE
    NEW.grade := OLD.grade;
    NEW.max_grade := OLD.max_grade;
    NEW.feedback := OLD.feedback;
    NEW.graded_at := OLD.graded_at;
    NEW.graded_by := OLD.graded_by;
    NEW.return_file_url := OLD.return_file_url;
    NEW.return_file_name := OLD.return_file_name;
    NEW.return_url := OLD.return_url;
    IF OLD.status IN ('graded', 'returned') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_lesson_activity_grades"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_enrollments_on_lesson_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_course_id uuid;
  v_old_course_id uuid;
BEGIN
  SELECT course_id INTO v_course_id
  FROM modules
  WHERE id = COALESCE(NEW.module_id, OLD.module_id);

  IF v_course_id IS NOT NULL THEN
    PERFORM private.recompute_enrollments_for_course(v_course_id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.module_id IS DISTINCT FROM OLD.module_id THEN
    SELECT course_id INTO v_old_course_id
    FROM modules
    WHERE id = OLD.module_id;

    IF v_old_course_id IS NOT NULL AND v_old_course_id IS DISTINCT FROM v_course_id THEN
      PERFORM private.recompute_enrollments_for_course(v_old_course_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."recompute_enrollments_on_lesson_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_all_profiles_to_auth_metadata"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  synced_count INTEGER := 0;
  failed_count INTEGER := 0;
  user_metadata JSONB;
BEGIN
  -- Sync all existing profiles to auth metadata
  FOR profile_record IN
    SELECT * FROM profiles
  LOOP
    BEGIN
      -- Build metadata object
      user_metadata := jsonb_build_object(
        'account_status', COALESCE(profile_record.account_status, 'pending'),
        'role', COALESCE(profile_record.role, 'student'),
        'institution_id', COALESCE(profile_record.institution_id::text, ''),
        'full_name', COALESCE(profile_record.full_name, ''),
        'email', COALESCE(profile_record.email, ''),
        'avatar_url', COALESCE(profile_record.avatar_url, ''),
        'location', COALESCE(profile_record.location, ''),
        'last_sync', NOW()::text
      );

      -- Update auth.users metadata
      UPDATE auth.users
      SET
        raw_app_meta_data = user_metadata,
        raw_user_meta_data = jsonb_build_object(
          'full_name', COALESCE(profile_record.full_name, ''),
          'avatar_url', COALESCE(profile_record.avatar_url, '')
        )
      WHERE id = profile_record.id;

      synced_count := synced_count + 1;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'synced', synced_count,
    'failed', failed_count,
    'message', format('Profile metadata sync completed: %s successful, %s failed', synced_count, failed_count)
  );
END;
$$;


ALTER FUNCTION "public"."sync_all_profiles_to_auth_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_lesson_preview_flags"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_published := COALESCE(NEW.is_published, false);
    NEW.is_free := COALESCE(NEW.is_free, false) OR COALESCE(NEW.is_preview, false);
    NEW.is_preview := NEW.is_free;
    RETURN NEW;
  END IF;

  NEW.is_published := COALESCE(NEW.is_published, OLD.is_published, false);

  IF NEW.is_free IS DISTINCT FROM OLD.is_free THEN
    NEW.is_preview := COALESCE(NEW.is_free, false);
    NEW.is_free := NEW.is_preview;
  ELSIF NEW.is_preview IS DISTINCT FROM OLD.is_preview THEN
    NEW.is_free := COALESCE(NEW.is_preview, false);
    NEW.is_preview := NEW.is_free;
  ELSE
    NEW.is_free := COALESCE(NEW.is_free, OLD.is_free, false);
    NEW.is_preview := NEW.is_free;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_lesson_preview_flags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_to_auth_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_metadata JSONB;
BEGIN
  IF TG_OP = 'INSERT' OR (
    NEW.account_status IS DISTINCT FROM OLD.account_status OR
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.institution_id IS DISTINCT FROM OLD.institution_id OR
    NEW.full_name IS DISTINCT FROM OLD.full_name OR
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR
    NEW.location IS DISTINCT FROM OLD.location
  ) THEN
    user_metadata := jsonb_build_object(
      'account_status', COALESCE(NEW.account_status, 'pending'),
      'role', COALESCE(NEW.role, 'student'),
      'institution_id', COALESCE(NEW.institution_id::text, ''),
      'full_name', COALESCE(NEW.full_name, ''),
      'email', COALESCE(NEW.email, ''),
      'avatar_url', COALESCE(NEW.avatar_url, ''),
      'location', COALESCE(NEW.location, ''),
      'last_sync', NOW()::text
    );

    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || user_metadata,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'full_name', COALESCE(NEW.full_name, ''),
        'avatar_url', COALESCE(NEW.avatar_url, '')
      )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_to_auth_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_registration_to_profile_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.registration_status = 'approved' AND OLD.registration_status IS DISTINCT FROM 'approved' THEN
    UPDATE profiles
    SET
      account_status = 'active',
      institution_id = COALESCE(NEW.institution_id, institution_id),
      enrollment_date = COALESCE(enrollment_date, NOW())
    WHERE id = NEW.user_id;
  END IF;

  IF NEW.registration_status = 'rejected' AND OLD.registration_status IS DISTINCT FROM 'rejected' THEN
    UPDATE profiles
    SET account_status = 'rejected'
    WHERE id = NEW.user_id
      AND account_status = 'pending';
  END IF;

  IF NEW.registration_status = 'submitted'
     AND OLD.registration_status IS DISTINCT FROM 'submitted' THEN
    UPDATE profiles
    SET account_status = 'pending'
    WHERE id = NEW.user_id
      AND account_status = 'rejected';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_registration_to_profile_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_single_profile_to_auth_metadata"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  profile_record profiles%ROWTYPE;
  user_metadata JSONB;
BEGIN
  -- Get profile record
  SELECT * INTO profile_record
  FROM profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Build metadata object
  user_metadata := jsonb_build_object(
    'account_status', COALESCE(profile_record.account_status, 'pending'),
    'role', COALESCE(profile_record.role, 'student'),
    'institution_id', COALESCE(profile_record.institution_id::text, ''),
    'full_name', COALESCE(profile_record.full_name, ''),
    'email', COALESCE(profile_record.email, ''),
    'avatar_url', COALESCE(profile_record.avatar_url, ''),
    'location', COALESCE(profile_record.location, ''),
    'last_sync', NOW()::text
  );

  -- Update auth.users metadata
  UPDATE auth.users
  SET
    raw_app_meta_data = user_metadata,
    raw_user_meta_data = jsonb_build_object(
      'full_name', COALESCE(profile_record.full_name, ''),
      'avatar_url', COALESCE(profile_record.avatar_url, '')
    )
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile metadata synced successfully',
    'user_id', target_user_id,
    'metadata', user_metadata
  );
END;
$$;


ALTER FUNCTION "public"."sync_single_profile_to_auth_metadata"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_course_rating_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.courses
  SET
    average_rating = (
      SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
      FROM public.reviews
      WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)
    )
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_course_rating_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_enrollment_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.course_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM private.recompute_enrollment_progress(NEW.user_id, NEW.course_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_enrollment_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_see_course"("p_course_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN FALSE
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_user_id
        AND p.role IN ('admin', 'superadmin', 'resource_person')
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_course_id
        AND c.instructor_id = p_user_id
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.course_instructors ci
      WHERE ci.course_id = p_course_id
        AND ci.user_id = p_user_id
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.enrollments e
      WHERE e.course_id = p_course_id
        AND e.user_id = p_user_id
        AND e.status IN ('active', 'completed', 'pending')
    ) THEN TRUE
    WHEN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_course_id
        AND c.is_published = TRUE
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.course_institutions x WHERE x.course_id = c.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.course_institutions x
            JOIN public.profiles p ON p.id = p_user_id
            WHERE x.course_id = c.id
              AND p.institution_id IS NOT NULL
              AND x.institution_id = p.institution_id
          )
        )
    ) THEN TRUE
    ELSE FALSE
  END;
$$;


ALTER FUNCTION "public"."user_can_see_course"("p_course_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_can_see_course"("p_course_id" "uuid", "p_user_id" "uuid") IS 'True when the user may view a course (staff, owner, enrolled, or published + institution audience).';



CREATE OR REPLACE FUNCTION "public"."validate_bhutan_cid"("cid_text" character varying) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN cid_text ~ '^[0-9]{11}$';
END;
$_$;


ALTER FUNCTION "public"."validate_bhutan_cid"("cid_text" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_bhutan_phone"("phone_text" character varying) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN phone_text ~ '^\+975[0-9]{8}$';
END;
$_$;


ALTER FUNCTION "public"."validate_bhutan_phone"("phone_text" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_dzongkhag"("dzongkhag_name" character varying) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  is_valid BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM bhutan_dzongkhags
    WHERE name = dzongkhag_name OR name_dzongkha = dzongkhag_name
  ) INTO is_valid;

  RETURN is_valid;
END;
$$;


ALTER FUNCTION "public"."validate_dzongkhag"("dzongkhag_name" character varying) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" character varying(255) NOT NULL,
    "entity_type" character varying(100),
    "entity_id" "uuid",
    "changes" "jsonb",
    "ip_address" character varying(50),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "lesson_id" "uuid",
    "activity_id" "text",
    "title" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "body_markdown" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_artifacts_kind_check" CHECK (("kind" = ANY (ARRAY['summary'::"text", 'document'::"text"])))
);


ALTER TABLE "public"."ai_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "lesson_id" "uuid",
    "task" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_provider_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "secret" "text" NOT NULL,
    "last4" "text" NOT NULL,
    "is_platform" boolean DEFAULT false NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_provider_keys_owner_check" CHECK (((("is_platform" = true) AND ("user_id" IS NULL)) OR (("is_platform" = false) AND ("user_id" IS NOT NULL)))),
    CONSTRAINT "ai_provider_keys_provider_check" CHECK (("provider" = ANY (ARRAY['gemini'::"text", 'claude'::"text", 'chatgpt'::"text", 'copilot'::"text"])))
);


ALTER TABLE "public"."ai_provider_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_provider_keys" IS 'Platform AI and avatar keys. Never expose secret to the browser.';



COMMENT ON COLUMN "public"."ai_provider_keys"."meta" IS 'Non-secret settings: model, Azure endpoint/deployment, hourly cap, enabled, avatar ids.';



CREATE TABLE IF NOT EXISTS "public"."ai_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "task" "text" NOT NULL,
    "model" "text" NOT NULL,
    "audience" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text"
);


ALTER TABLE "public"."ai_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_saved_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_saved_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" character varying(100) NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "page_url" "text",
    "referrer_url" "text",
    "user_agent" "text",
    "ip_address" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcement_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."announcement_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text",
    "is_published" boolean DEFAULT false,
    "publish_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_pinned" boolean DEFAULT false,
    "created_by" "uuid",
    "is_global" boolean DEFAULT false
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid",
    "user_id" "uuid",
    "enrollment_id" "uuid",
    "content" "text",
    "attachment_urls" "text"[],
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "grade" integer,
    "feedback" "text",
    "graded_at" timestamp with time zone,
    "graded_by" "uuid",
    "status" character varying(50) DEFAULT 'submitted'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "assignment_submissions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['submitted'::character varying, 'graded'::character varying, 'late'::character varying, 'resubmit_required'::character varying])::"text"[])))
);


ALTER TABLE "public"."assignment_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid",
    "title" character varying(500) NOT NULL,
    "description" "text",
    "instructions" "text",
    "due_date" timestamp with time zone,
    "max_points" integer DEFAULT 100,
    "attachment_urls" "text"[],
    "is_published" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "icon_url" "text",
    "requirement" "jsonb" NOT NULL,
    "points" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bhutan_dzongkhags" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "name_dzongkha" character varying(100),
    "established_year" integer
);


ALTER TABLE "public"."bhutan_dzongkhags" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bhutan_dzongkhags_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bhutan_dzongkhags_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bhutan_dzongkhags_id_seq" OWNED BY "public"."bhutan_dzongkhags"."id";



CREATE TABLE IF NOT EXISTS "public"."capabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying(150) NOT NULL,
    "label" character varying(255) NOT NULL,
    "description" "text",
    "cap_group" character varying(20) NOT NULL,
    "menu_key" character varying(100) NOT NULL,
    "parent_menu_key" character varying(100),
    "action" character varying(20) NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capabilities_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['view'::character varying, 'add'::character varying, 'edit'::character varying, 'delete'::character varying, 'configure'::character varying, 'uninstall'::character varying])::"text"[]))),
    CONSTRAINT "capabilities_cap_group_check" CHECK ((("cap_group")::"text" = ANY ((ARRAY['menu'::character varying, 'module'::character varying])::"text"[])))
);


ALTER TABLE "public"."capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "course_id" "uuid",
    "enrollment_id" "uuid",
    "certificate_url" "text",
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "verification_code" character varying(255) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "message_type" character varying(50) DEFAULT 'text'::character varying,
    "attachment_url" "text",
    "is_edited" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_message_type_check" CHECK ((("message_type")::"text" = ANY ((ARRAY['text'::character varying, 'image'::character varying, 'file'::character varying, 'system'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "room_type" character varying(50) DEFAULT 'general'::character varying,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_rooms_room_type_check" CHECK ((("room_type")::"text" = ANY ((ARRAY['general'::character varying, 'announcements'::character varying, 'q_a'::character varying, 'group_project'::character varying])::"text"[])))
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloudinary_connection" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "cloud_name" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "api_secret" "text" NOT NULL,
    "api_key_last4" "text" NOT NULL,
    "api_secret_last4" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "cloudinary_connection_singleton" CHECK (("id" = 'default'::"text"))
);


ALTER TABLE "public"."cloudinary_connection" OWNER TO "postgres";


COMMENT ON TABLE "public"."cloudinary_connection" IS 'Singleton Cloudinary account for private media. Readable and writable only by the service role.';



CREATE TABLE IF NOT EXISTS "public"."course_institutions" (
    "course_id" "uuid" NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."course_institutions" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_institutions" IS 'Optional audience targeting. Empty set = open to all; non-empty = restricted to listed institutions.';



CREATE TABLE IF NOT EXISTS "public"."course_instructors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'co_teacher'::"text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "course_instructors_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'co_teacher'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."course_instructors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(500) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "instructor_id" "uuid",
    "category" character varying(100) NOT NULL,
    "level" character varying(50) DEFAULT 'beginner'::character varying,
    "language" character varying(50) DEFAULT 'en'::character varying,
    "price" numeric(10,2) DEFAULT 0.00,
    "currency" character varying(10) DEFAULT 'USD'::character varying,
    "duration_minutes" integer DEFAULT 0,
    "is_published" boolean DEFAULT false,
    "is_featured" boolean DEFAULT false,
    "requirements" "text"[],
    "learning_objectives" "text"[],
    "target_audience" "text"[],
    "tags" "text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prerequisites" "text"[],
    "enrollment_mode" "text" DEFAULT 'approval'::"text" NOT NULL,
    "certificate_enabled" boolean DEFAULT true,
    "certificate_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "average_rating" numeric(3,2) DEFAULT 0.0 NOT NULL,
    "rating_count" integer DEFAULT 0 NOT NULL,
    "forum_scope" "text" DEFAULT 'course'::"text" NOT NULL,
    CONSTRAINT "courses_enrollment_mode_check" CHECK (("enrollment_mode" = ANY (ARRAY['auto'::"text", 'approval'::"text", 'invite_code'::"text", 'paid'::"text"]))),
    CONSTRAINT "courses_forum_scope_check" CHECK (("forum_scope" = ANY (ARRAY['course'::"text", 'lesson'::"text"]))),
    CONSTRAINT "courses_level_check" CHECK ((("level")::"text" = ANY ((ARRAY['beginner'::character varying, 'intermediate'::character varying, 'advanced'::character varying, 'all_levels'::character varying])::"text"[])))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."courses"."enrollment_mode" IS 'auto | approval (default) | invite_code | paid — who may join and how';



CREATE TABLE IF NOT EXISTS "public"."email_hosts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "from_name" "text",
    "from_email" "text" NOT NULL,
    "smtp_host" "text",
    "smtp_port" integer,
    "smtp_secure" boolean DEFAULT false NOT NULL,
    "smtp_username" "text",
    "secret" "text" NOT NULL,
    "secret_last4" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "email_hosts_provider_check" CHECK (("provider" = ANY (ARRAY['resend'::"text", 'gmail_smtp'::"text", 'smtp'::"text"])))
);


ALTER TABLE "public"."email_hosts" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_hosts" IS 'Outbound email hosts (Resend, Gmail SMTP, custom SMTP). Readable and writable only by the service role.';



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "subject" "text" NOT NULL,
    "html_body" "text" DEFAULT ''::"text" NOT NULL,
    "text_body" "text" DEFAULT ''::"text" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollment_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "student_email" "text",
    "student_phone" "text",
    "student_user_id" "uuid",
    "expires_at" timestamp with time zone,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "delivery" "text" DEFAULT 'copy'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enrollment_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "course_id" "uuid",
    "enrolled_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "progress_percentage" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_lesson_id" "uuid",
    CONSTRAINT "enrollments_progress_percentage_check" CHECK ((("progress_percentage" >= 0) AND ("progress_percentage" <= 100))),
    CONSTRAINT "enrollments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'dropped'::character varying, 'suspended'::character varying, 'pending'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."enrollments"."status" IS 'pending (awaiting creator) | active | completed | dropped | suspended | rejected';



COMMENT ON COLUMN "public"."enrollments"."last_lesson_id" IS 'Last lesson the student opened; used by Resume / Continue Learning';



CREATE TABLE IF NOT EXISTS "public"."flashcard_decks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "lesson_id" "uuid",
    "instructor_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flashcard_decks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flashcards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deck_id" "uuid" NOT NULL,
    "front" "text" NOT NULL,
    "back" "text" NOT NULL,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flashcards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forums" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid",
    "title" character varying(500) NOT NULL,
    "description" "text",
    "is_announcement_forum" boolean DEFAULT false,
    "is_qa_forum" boolean DEFAULT false,
    "order_index" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "module_id" "uuid",
    "lesson_id" "uuid",
    "is_enabled" boolean DEFAULT true,
    "created_by" "uuid"
);


ALTER TABLE "public"."forums" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institution_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_within_institution" character varying(50),
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    CONSTRAINT "institution_access_role_within_institution_check" CHECK ((("role_within_institution")::"text" = ANY ((ARRAY['student'::character varying, 'teacher'::character varying, 'admin'::character varying, 'resource_person'::character varying])::"text"[])))
);


ALTER TABLE "public"."institution_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(255) NOT NULL,
    "logo_url" "text",
    "domain" character varying(255),
    "description" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "signup_approval_required" boolean DEFAULT true,
    "allowed_email_domains" "text"[],
    "max_students" integer,
    "resource_person_id" "uuid",
    "display_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."institutions"."display_name" IS 'Short human-readable label for signup dropdowns and UI. Prefer over name.';



CREATE TABLE IF NOT EXISTS "public"."lesson_activity_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "activity_id" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "source" "text" DEFAULT 'ack'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "response" "jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "grade" numeric,
    "max_grade" numeric,
    "feedback" "text",
    "graded_at" timestamp with time zone,
    "graded_by" "uuid",
    "submitted_at" timestamp with time zone,
    "return_file_url" "text",
    "return_file_name" "text",
    "return_url" "text",
    CONSTRAINT "lesson_activity_progress_source_check" CHECK (("source" = ANY (ARRAY['ack'::"text", 'quiz_pass'::"text", 'choice'::"text", 'submission'::"text", 'response'::"text", 'chat'::"text"]))),
    CONSTRAINT "lesson_activity_progress_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'graded'::"text", 'returned'::"text", 'late'::"text"])))
);


ALTER TABLE "public"."lesson_activity_progress" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lesson_activity_progress"."response" IS 'Learner input payload (choice selection, text submission, chat message, etc.)';



COMMENT ON COLUMN "public"."lesson_activity_progress"."status" IS 'Assessed workflow: draft | submitted | graded | returned | late';



COMMENT ON COLUMN "public"."lesson_activity_progress"."grade" IS 'Staff-assigned score for this activity submission';



COMMENT ON COLUMN "public"."lesson_activity_progress"."max_grade" IS 'Snapshot of activity maxGrade at submit time';



COMMENT ON COLUMN "public"."lesson_activity_progress"."feedback" IS 'Staff feedback for the learner';



COMMENT ON COLUMN "public"."lesson_activity_progress"."return_file_url" IS 'Staff-uploaded annotated/returned file for the learner';



COMMENT ON COLUMN "public"."lesson_activity_progress"."return_file_name" IS 'Original filename of the staff return file';



COMMENT ON COLUMN "public"."lesson_activity_progress"."return_url" IS 'Optional URL staff share when returning graded work';



CREATE TABLE IF NOT EXISTS "public"."lesson_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "lesson_id" "uuid",
    "enrollment_id" "uuid",
    "is_completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "time_spent_seconds" integer DEFAULT 0,
    "progress_percentage" integer DEFAULT 0,
    "last_position_seconds" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed" boolean DEFAULT false,
    "course_id" "uuid",
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "activity_completed" boolean DEFAULT false,
    "activity_completed_at" timestamp with time zone,
    CONSTRAINT "lesson_progress_progress_percentage_check" CHECK ((("progress_percentage" >= 0) AND ("progress_percentage" <= 100)))
);


ALTER TABLE "public"."lesson_progress" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lesson_progress"."activity_completed" IS 'Student finished gated resources/flashcards for this lesson (unlocks next when enabled)';



CREATE TABLE IF NOT EXISTS "public"."lesson_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "nodes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lesson_scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid",
    "title" character varying(500) NOT NULL,
    "description" "text",
    "content" "text",
    "video_url" "text",
    "video_duration" integer,
    "order_index" integer NOT NULL,
    "is_preview" boolean DEFAULT false,
    "is_published" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "duration_minutes" integer DEFAULT 0,
    "transcript" "text",
    "resources" "jsonb" DEFAULT '[]'::"jsonb",
    "is_free" boolean DEFAULT false,
    "notify_on_status" boolean DEFAULT false NOT NULL,
    "status_generation" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lessons"."resources" IS 'Lesson activity/resource JSON array (assignment, quiz, file, forum, etc.)';



CREATE TABLE IF NOT EXISTS "public"."live_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone,
    "duration_seconds" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."live_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid",
    "instructor_id" "uuid",
    "title" character varying(500) NOT NULL,
    "description" "text",
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone,
    "stream_url" "text",
    "recording_url" "text",
    "max_participants" integer DEFAULT 100,
    "is_recorded" boolean DEFAULT false,
    "status" character varying(50) DEFAULT 'scheduled'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "live_sessions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['scheduled'::character varying, 'live'::character varying, 'ended'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."live_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid",
    "title" character varying(500) NOT NULL,
    "description" "text",
    "order_index" integer NOT NULL,
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resources" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "availability" "text" DEFAULT 'draft'::"text" NOT NULL,
    "publish_at" timestamp with time zone,
    "publish_timezone" "text",
    "notify_on_publish" boolean DEFAULT false NOT NULL,
    "notify_on_unpublish" boolean DEFAULT false NOT NULL,
    "release_lessons" boolean DEFAULT true NOT NULL,
    "release_generation" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "modules_availability_check" CHECK (("availability" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."modules"."resources" IS 'Module-level activity/resource JSON, same shape as lessons.resources';



COMMENT ON COLUMN "public"."modules"."metadata" IS 'Module settings e.g. sequentialUnlock, gateResourcesUntilComplete, gateNextUntilActivitiesDone';



CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "lesson_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "timestamp" integer DEFAULT (EXTRACT(epoch FROM "now"()))::integer NOT NULL,
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" character varying(100) NOT NULL,
    "title" character varying(500) NOT NULL,
    "message" "text" NOT NULL,
    "action_url" "text",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "site_name" "text" DEFAULT 'Pelbu LMS'::"text" NOT NULL,
    "tagline" "text" DEFAULT 'Bhutan''s private learning platform'::"text",
    "support_email" "text",
    "landing_headline" "text",
    "landing_description" "text",
    "public_catalog" boolean DEFAULT true NOT NULL,
    "featured_course_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "maintenance_mode" boolean DEFAULT false NOT NULL,
    "require_identity_documents" boolean DEFAULT true NOT NULL,
    "require_qualification" boolean DEFAULT false NOT NULL,
    "require_student_id" boolean DEFAULT false NOT NULL,
    "require_emergency_contact" boolean DEFAULT false NOT NULL,
    "require_tos_consent" boolean DEFAULT false NOT NULL,
    "collect_hear_about_us" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hero_video_url" "text" DEFAULT 'https://www.youtube.com/watch?v=xpCj64W2Yxs'::"text",
    "hero_rotating_words" "text"[] DEFAULT ARRAY['Modern Bhutan'::"text", 'Every Learner'::"text", 'Future Leaders'::"text", 'Gelephu'::"text", 'Our Nation'::"text"] NOT NULL,
    "hero_cta_primary_label" "text" DEFAULT 'Create your account'::"text",
    "landing_stats" "jsonb" DEFAULT '[{"label": "Learners", "value": "500+"}, {"label": "Courses", "value": "100+"}, {"label": "Dzongkhags", "value": "20"}]'::"jsonb" NOT NULL,
    "landing_features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "landing_steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "landing_faq" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "landing_section_titles" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hero_video_start_seconds" integer,
    "hero_video_end_seconds" integer,
    "video_quality" "text" DEFAULT 'high'::"text" NOT NULL,
    "require_cid" boolean DEFAULT false NOT NULL,
    "require_identity_photo" boolean DEFAULT false NOT NULL,
    "ai_model_defaults" "jsonb" DEFAULT '{"report": "claude", "course-structure": "chatgpt"}'::"jsonb" NOT NULL,
    "ai_feature_routes" "jsonb" DEFAULT '{"quiz": "gemini", "image": "gemini", "tutor": "gemini", "report": "claude", "extract": "gemini", "course-edit": "gemini", "avatar-script": "gemini", "course-generate": "gemini", "report-followup": "claude", "course-structure": "chatgpt"}'::"jsonb" NOT NULL,
    "hero_cta_secondary_label" "text",
    "hero_image_url" "text",
    "landing_campus" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "landing_quotes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "landing_gallery" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "hero_glass_opacity" integer DEFAULT 70 NOT NULL,
    "logo_url" "text",
    CONSTRAINT "platform_settings_hero_video_end_seconds_check" CHECK ((("hero_video_end_seconds" IS NULL) OR ("hero_video_end_seconds" > 0))),
    CONSTRAINT "platform_settings_hero_video_start_seconds_check" CHECK ((("hero_video_start_seconds" IS NULL) OR ("hero_video_start_seconds" >= 0))),
    CONSTRAINT "platform_settings_id_check" CHECK (("id" = 'default'::"text")),
    CONSTRAINT "platform_settings_video_quality_check" CHECK (("video_quality" = ANY (ARRAY['auto'::"text", 'high'::"text", 'max'::"text"])))
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_settings" IS 'Singleton LMS site administration settings. Readable by everyone; writes by admin/superadmin or service role.';



COMMENT ON COLUMN "public"."platform_settings"."hero_video_url" IS 'YouTube URL for cinematic full-bleed landing hero background';



COMMENT ON COLUMN "public"."platform_settings"."hero_rotating_words" IS 'Typewriter words shown under the landing headline';



COMMENT ON COLUMN "public"."platform_settings"."landing_features" IS 'JSON array of {title, description, icon} for the features section';



COMMENT ON COLUMN "public"."platform_settings"."landing_steps" IS 'JSON array of {title, description, icon} for how-it-works';



COMMENT ON COLUMN "public"."platform_settings"."landing_faq" IS 'JSON array of {question, answer} for FAQ';



COMMENT ON COLUMN "public"."platform_settings"."landing_section_titles" IS 'JSON object of section eyebrow/title/subtitle overrides';



COMMENT ON COLUMN "public"."platform_settings"."hero_video_start_seconds" IS 'Seconds into the hero YouTube video where the background loop starts (null = 0)';



COMMENT ON COLUMN "public"."platform_settings"."hero_video_end_seconds" IS 'Seconds into the hero YouTube video where the background loop ends and restarts (null = full video)';



COMMENT ON COLUMN "public"."platform_settings"."video_quality" IS 'Delivery preference for lesson videos and marketing hero: auto (smaller), high (default), max (best bitrate).';



COMMENT ON COLUMN "public"."platform_settings"."hero_image_url" IS 'Shown in the hero visual panel when hero_video_url is empty.';



COMMENT ON COLUMN "public"."platform_settings"."landing_campus" IS 'Campus cards: [{image_url, title, description}]';



COMMENT ON COLUMN "public"."platform_settings"."landing_quotes" IS 'Quote cards: [{quote, name, role, stars}]';



COMMENT ON COLUMN "public"."platform_settings"."landing_gallery" IS 'Gallery image URLs: ["https://..."]';



COMMENT ON COLUMN "public"."platform_settings"."hero_glass_opacity" IS 'White fill of the homepage hero card, as a percent from 20 to 90.';



COMMENT ON COLUMN "public"."platform_settings"."logo_url" IS 'Public URL of the LMS logo. Null uses the built-in Rigbu mark.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "avatar_url" "text",
    "role" character varying(50) DEFAULT 'student'::character varying,
    "institution_id" "uuid",
    "bio" "text",
    "location" character varying(255),
    "website" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "account_status" character varying(20) DEFAULT 'pending'::character varying,
    "enrollment_date" timestamp with time zone,
    "last_approval_check" timestamp with time zone,
    "headline" "text",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "role_id" "uuid",
    "phone_number" "text",
    "date_of_birth" "date",
    "gender" "text",
    "cid_number" "text",
    "gewog" "text",
    "village" "text",
    "education_level" "text",
    "passport_photo_url" "text",
    "cid_photo_url" "text",
    "pelsung_number" "text",
    "class_name" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "parent_guardian_name" "text",
    "parent_guardian_phone" "text",
    CONSTRAINT "profiles_account_status_check" CHECK ((("account_status")::"text" = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'suspended'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "profiles_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['student'::character varying, 'instructor'::character varying, 'admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."account_status" IS 'pending (awaiting KYC) | active | suspended | rejected — new users default pending; 054-era active users stay active';



CREATE TABLE IF NOT EXISTS "public"."quiz_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "enrollment_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "score" integer,
    "passed" boolean DEFAULT false,
    "time_spent_seconds" integer,
    "answers" "jsonb",
    "feedback" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quiz_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quiz_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quiz_id" "uuid" NOT NULL,
    "question_text" "text" NOT NULL,
    "question_type" "text" DEFAULT 'multiple_choice'::"text" NOT NULL,
    "options" "text",
    "correct_answer" "text",
    "explanation" "text",
    "order_index" integer DEFAULT 0,
    "points" integer DEFAULT 1,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "incorrect_explanation" "text"
);


ALTER TABLE "public"."quiz_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quizzes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lesson_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "time_limit_minutes" integer,
    "passing_score" integer DEFAULT 70,
    "max_attempts" integer DEFAULT 3,
    "is_published" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quizzes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_reviewers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."registration_reviewers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid",
    "user_id" "uuid",
    "parent_reply_id" "uuid",
    "content" "text" NOT NULL,
    "is_answer" boolean DEFAULT false,
    "votes" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "helpful_count" integer DEFAULT 0 NOT NULL,
    "not_helpful_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_capabilities" (
    "role_id" "uuid" NOT NULL,
    "capability_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_capabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_institutions" (
    "role_id" "uuid" NOT NULL,
    "institution_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" character varying(100) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "base_archetype" character varying(50) NOT NULL,
    "is_assignable" boolean DEFAULT true NOT NULL,
    "all_institutions" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roles_base_archetype_check" CHECK ((("base_archetype")::"text" = ANY ((ARRAY['student'::character varying, 'instructor'::character varying, 'admin'::character varying, 'resource_person'::character varying, 'superadmin'::character varying])::"text"[])))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "institution_id" "uuid",
    "full_name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone_number" character varying(20) NOT NULL,
    "date_of_birth" "date",
    "gender" character varying(20),
    "cid_number" character varying(20),
    "pelsung_number" character varying(50),
    "passport_photo_url" "text",
    "class" character varying(50),
    "section" character varying(50),
    "education_level" character varying(100),
    "institution_name" character varying(255),
    "village" character varying(255),
    "gewog" character varying(255),
    "dzongkhag" character varying(255),
    "parent_guardian_name" character varying(255),
    "parent_guardian_phone" character varying(20),
    "parent_guardian_email" character varying(255),
    "emergency_contact_name" character varying(255),
    "emergency_contact_phone" character varying(20),
    "address" "text",
    "special_skills" "text"[],
    "interests" "text"[],
    "motivation_statement" "text",
    "immersion_cohort" character varying(100),
    "career_aspirations" "text",
    "previous_experience" "text",
    "registration_status" character varying(50) DEFAULT 'submitted'::character varying,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "rejection_reason" "text",
    "assigned_teacher_id" "uuid",
    "teacher_recommendation" "text",
    "teacher_reviewed_at" timestamp with time zone,
    "submitted_ip" "inet",
    "submitted_from" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cid_photo_url" "text",
    "requested_role" character varying(50) DEFAULT 'student'::character varying,
    "tos_accepted_at" timestamp with time zone,
    "hear_about_us" "text",
    CONSTRAINT "student_registrations_gender_check" CHECK ((("gender")::"text" = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "student_registrations_registration_status_check" CHECK ((("registration_status")::"text" = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'under_review'::character varying, 'additional_info_requested'::character varying, 'approved'::character varying, 'rejected'::character varying, 'waitlisted'::character varying, 'enrolled'::character varying])::"text"[]))),
    CONSTRAINT "valid_cid_format" CHECK ((("cid_number" IS NULL) OR ("btrim"(("cid_number")::"text") = ''::"text") OR (("cid_number")::"text" ~ '^[0-9]{11}$'::"text"))),
    CONSTRAINT "valid_phone_format" CHECK ((("phone_number")::"text" ~ '^\+975[0-9]{8}$'::"text"))
);


ALTER TABLE "public"."student_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_interventions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'note'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teacher_interventions_kind_check" CHECK (("kind" = ANY (ARRAY['note'::"text", 'nudge'::"text", 'question'::"text", 'at_risk'::"text"])))
);


ALTER TABLE "public"."teacher_interventions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "thread_reactions_reaction_check" CHECK (("reaction" = ANY (ARRAY['like'::"text", 'love'::"text", 'care'::"text", 'haha'::"text", 'wow'::"text", 'sad'::"text", 'angry'::"text"])))
);


ALTER TABLE "public"."thread_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "forum_id" "uuid",
    "user_id" "uuid",
    "title" character varying(500) NOT NULL,
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "is_locked" boolean DEFAULT false,
    "views" integer DEFAULT 0,
    "reply_count" integer DEFAULT 0,
    "last_reply_at" timestamp with time zone,
    "last_reply_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "institution_id" "uuid",
    "requested_by" "uuid",
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "rejection_reason" "text",
    "notes" "text",
    CONSTRAINT "user_approvals_approval_status_check" CHECK ((("approval_status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "badge_id" "uuid",
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_presence" (
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'online'::"text" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_interactive_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "path" "text",
    "path_label" "text",
    "left_reason" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_presence_status_check" CHECK (("status" = ANY (ARRAY['online'::"text", 'idle'::"text", 'offline'::"text"])))
);


ALTER TABLE "public"."user_presence" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_presence" IS 'Per-user LMS presence. Active Now = status online and last_seen within grace window; Active Today = last_seen since Thimphu midnight.';



CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "course_updates" boolean DEFAULT true,
    "announcement_notifications" boolean DEFAULT true,
    "message_notifications" boolean DEFAULT true,
    "theme" character varying(20) DEFAULT 'system'::character varying,
    "language" character varying(10) DEFAULT 'en'::character varying,
    "timezone" character varying(50) DEFAULT 'UTC'::character varying,
    "profile_visibility" character varying(20) DEFAULT 'public'::character varying,
    "show_progress" boolean DEFAULT true,
    "show_certificates" boolean DEFAULT true,
    "auto_play_video" boolean DEFAULT false,
    "video_quality" character varying(20) DEFAULT 'auto'::character varying,
    "playback_speed" numeric(3,2) DEFAULT 1.00,
    "subtitle_language" character varying(10) DEFAULT 'en'::character varying,
    "digest_frequency" character varying(20) DEFAULT 'weekly'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bhutan_dzongkhags" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bhutan_dzongkhags_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_provider_keys"
    ADD CONSTRAINT "ai_provider_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_runs"
    ADD CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_saved_prompts"
    ADD CONSTRAINT "ai_saved_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_user_course_unique" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_announcement_id_user_id_key" UNIQUE ("announcement_id", "user_id");



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bhutan_dzongkhags"
    ADD CONSTRAINT "bhutan_dzongkhags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."bhutan_dzongkhags"
    ADD CONSTRAINT "bhutan_dzongkhags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capabilities"
    ADD CONSTRAINT "capabilities_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."capabilities"
    ADD CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_verification_code_key" UNIQUE ("verification_code");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloudinary_connection"
    ADD CONSTRAINT "cloudinary_connection_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_institutions"
    ADD CONSTRAINT "course_institutions_pkey" PRIMARY KEY ("course_id", "institution_id");



ALTER TABLE ONLY "public"."course_instructors"
    ADD CONSTRAINT "course_instructors_course_id_user_id_key" UNIQUE ("course_id", "user_id");



ALTER TABLE ONLY "public"."course_instructors"
    ADD CONSTRAINT "course_instructors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."email_deliveries"
    ADD CONSTRAINT "email_deliveries_dedupe_key_key" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."email_deliveries"
    ADD CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_hosts"
    ADD CONSTRAINT "email_hosts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."enrollment_invites"
    ADD CONSTRAINT "enrollment_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."enrollment_invites"
    ADD CONSTRAINT "enrollment_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."flashcard_decks"
    ADD CONSTRAINT "flashcard_decks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forums"
    ADD CONSTRAINT "forums_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institution_access"
    ADD CONSTRAINT "institution_access_institution_id_user_id_key" UNIQUE ("institution_id", "user_id");



ALTER TABLE ONLY "public"."institution_access"
    ADD CONSTRAINT "institution_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."lesson_activity_progress"
    ADD CONSTRAINT "lesson_activity_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_activity_progress"
    ADD CONSTRAINT "lesson_activity_progress_user_id_lesson_id_activity_id_key" UNIQUE ("user_id", "lesson_id", "activity_id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_user_id_lesson_id_key" UNIQUE ("user_id", "lesson_id");



ALTER TABLE ONLY "public"."lesson_scenarios"
    ADD CONSTRAINT "lesson_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_order_index_key" UNIQUE ("module_id", "order_index");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_attendance"
    ADD CONSTRAINT "live_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_course_id_order_index_key" UNIQUE ("course_id", "order_index");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_reviewers"
    ADD CONSTRAINT "registration_reviewers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_reviewers"
    ADD CONSTRAINT "registration_reviewers_user_id_institution_id_key" UNIQUE ("user_id", "institution_id");



ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_course_unique" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_pkey" PRIMARY KEY ("role_id", "capability_id");



ALTER TABLE ONLY "public"."role_institutions"
    ADD CONSTRAINT "role_institutions_pkey" PRIMARY KEY ("role_id", "institution_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."student_registrations"
    ADD CONSTRAINT "student_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_interventions"
    ADD CONSTRAINT "teacher_interventions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_thread_user_unique" UNIQUE ("thread_id", "user_id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_registrations"
    ADD CONSTRAINT "unique_user_registration" UNIQUE ("user_id", "institution_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "unique_user_settings" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_approvals"
    ADD CONSTRAINT "user_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_presence"
    ADD CONSTRAINT "user_presence_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_artifacts_user_course_idx" ON "public"."ai_artifacts" USING "btree" ("user_id", "course_id", "created_at" DESC);



CREATE INDEX "ai_messages_thread_created_idx" ON "public"."ai_messages" USING "btree" ("thread_id", "created_at");



CREATE UNIQUE INDEX "ai_provider_keys_platform_provider" ON "public"."ai_provider_keys" USING "btree" ("provider") WHERE ("is_platform" = true);



CREATE UNIQUE INDEX "ai_provider_keys_user_provider" ON "public"."ai_provider_keys" USING "btree" ("user_id", "provider") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "ai_saved_prompts_user_course_idx" ON "public"."ai_saved_prompts" USING "btree" ("user_id", "course_id", "created_at" DESC);



CREATE INDEX "ai_threads_user_course_idx" ON "public"."ai_threads" USING "btree" ("user_id", "course_id");



CREATE UNIQUE INDEX "certificates_user_course_unique" ON "public"."certificates" USING "btree" ("user_id", "course_id");



CREATE INDEX "certificates_verification_code_idx" ON "public"."certificates" USING "btree" ("verification_code");



CREATE INDEX "email_deliveries_pending_idx" ON "public"."email_deliveries" USING "btree" ("created_at") WHERE ("status" = 'pending'::"text");



CREATE UNIQUE INDEX "email_hosts_one_default" ON "public"."email_hosts" USING "btree" ("is_default") WHERE "is_default";



CREATE INDEX "flashcard_decks_course_id_idx" ON "public"."flashcard_decks" USING "btree" ("course_id");



CREATE INDEX "flashcards_deck_id_idx" ON "public"."flashcards" USING "btree" ("deck_id");



CREATE INDEX "forums_course_id_idx" ON "public"."forums" USING "btree" ("course_id");



CREATE INDEX "forums_lesson_id_idx" ON "public"."forums" USING "btree" ("lesson_id");



CREATE INDEX "forums_module_id_idx" ON "public"."forums" USING "btree" ("module_id");



CREATE UNIQUE INDEX "forums_unique_course_idx" ON "public"."forums" USING "btree" ("course_id") WHERE (("module_id" IS NULL) AND ("lesson_id" IS NULL));



CREATE UNIQUE INDEX "forums_unique_lesson_idx" ON "public"."forums" USING "btree" ("lesson_id") WHERE ("lesson_id" IS NOT NULL);



CREATE UNIQUE INDEX "forums_unique_module_idx" ON "public"."forums" USING "btree" ("module_id") WHERE (("module_id" IS NOT NULL) AND ("lesson_id" IS NULL));



CREATE INDEX "idx_ai_runs_created" ON "public"."ai_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_runs_user_provider_created" ON "public"."ai_runs" USING "btree" ("user_id", "provider", "created_at" DESC);



CREATE INDEX "idx_analytics_events_type" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "idx_analytics_events_user" ON "public"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "idx_announcement_reads_announcement_id" ON "public"."announcement_reads" USING "btree" ("announcement_id");



CREATE INDEX "idx_announcement_reads_user_id" ON "public"."announcement_reads" USING "btree" ("user_id");



CREATE INDEX "idx_announcements_author_id" ON "public"."announcements" USING "btree" ("author_id");



CREATE INDEX "idx_announcements_course_id" ON "public"."announcements" USING "btree" ("course_id");



CREATE INDEX "idx_announcements_is_published" ON "public"."announcements" USING "btree" ("is_published");



CREATE INDEX "idx_announcements_publish_at" ON "public"."announcements" USING "btree" ("publish_at");



CREATE INDEX "idx_assignment_submissions_assignment" ON "public"."assignment_submissions" USING "btree" ("assignment_id");



CREATE INDEX "idx_assignment_submissions_user" ON "public"."assignment_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_assignments_lesson" ON "public"."assignments" USING "btree" ("lesson_id");



CREATE INDEX "idx_capabilities_menu" ON "public"."capabilities" USING "btree" ("menu_key", "action");



CREATE INDEX "idx_certificates_course" ON "public"."certificates" USING "btree" ("course_id");



CREATE INDEX "idx_certificates_user" ON "public"."certificates" USING "btree" ("user_id");



CREATE INDEX "idx_chat_messages_room" ON "public"."chat_messages" USING "btree" ("room_id");



CREATE INDEX "idx_chat_messages_user" ON "public"."chat_messages" USING "btree" ("user_id");



CREATE INDEX "idx_chat_rooms_course" ON "public"."chat_rooms" USING "btree" ("course_id");



CREATE INDEX "idx_course_institutions_course_id" ON "public"."course_institutions" USING "btree" ("course_id");



CREATE INDEX "idx_course_institutions_institution_id" ON "public"."course_institutions" USING "btree" ("institution_id");



CREATE INDEX "idx_course_instructors_course" ON "public"."course_instructors" USING "btree" ("course_id");



CREATE INDEX "idx_course_instructors_user" ON "public"."course_instructors" USING "btree" ("user_id");



CREATE INDEX "idx_courses_category" ON "public"."courses" USING "btree" ("category");



CREATE INDEX "idx_courses_featured" ON "public"."courses" USING "btree" ("is_featured");



CREATE INDEX "idx_courses_instructor" ON "public"."courses" USING "btree" ("instructor_id");



CREATE INDEX "idx_courses_published" ON "public"."courses" USING "btree" ("is_published");



CREATE INDEX "idx_enrollment_invites_code" ON "public"."enrollment_invites" USING "btree" ("code");



CREATE INDEX "idx_enrollment_invites_course" ON "public"."enrollment_invites" USING "btree" ("course_id", "created_at" DESC);



CREATE INDEX "idx_enrollments_course" ON "public"."enrollments" USING "btree" ("course_id");



CREATE INDEX "idx_enrollments_course_status" ON "public"."enrollments" USING "btree" ("course_id", "status");



CREATE INDEX "idx_enrollments_last_accessed" ON "public"."enrollments" USING "btree" ("user_id", "last_accessed_at" DESC);



CREATE INDEX "idx_enrollments_status" ON "public"."enrollments" USING "btree" ("status");



CREATE INDEX "idx_enrollments_user" ON "public"."enrollments" USING "btree" ("user_id");



CREATE INDEX "idx_forums_course" ON "public"."forums" USING "btree" ("course_id");



CREATE INDEX "idx_institution_access_active" ON "public"."institution_access" USING "btree" ("is_active", "institution_id");



CREATE INDEX "idx_institution_access_role" ON "public"."institution_access" USING "btree" ("role_within_institution");



CREATE INDEX "idx_institution_access_user" ON "public"."institution_access" USING "btree" ("user_id", "institution_id");



CREATE INDEX "idx_institutions_is_active" ON "public"."institutions" USING "btree" ("is_active");



CREATE INDEX "idx_lesson_progress_completed" ON "public"."lesson_progress" USING "btree" ("is_completed");



CREATE INDEX "idx_lesson_progress_lesson" ON "public"."lesson_progress" USING "btree" ("lesson_id");



CREATE INDEX "idx_lesson_progress_user" ON "public"."lesson_progress" USING "btree" ("user_id");



CREATE INDEX "idx_lesson_scenarios_lesson" ON "public"."lesson_scenarios" USING "btree" ("lesson_id");



CREATE INDEX "idx_lessons_module" ON "public"."lessons" USING "btree" ("module_id");



CREATE INDEX "idx_lessons_published" ON "public"."lessons" USING "btree" ("is_published");



CREATE INDEX "idx_live_attendance_session" ON "public"."live_attendance" USING "btree" ("session_id");



CREATE INDEX "idx_live_sessions_course" ON "public"."live_sessions" USING "btree" ("course_id");



CREATE INDEX "idx_modules_course" ON "public"."modules" USING "btree" ("course_id");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_institution" ON "public"."profiles" USING "btree" ("institution_id");



CREATE INDEX "idx_profiles_phone_number" ON "public"."profiles" USING "btree" ("phone_number") WHERE ("phone_number" IS NOT NULL);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_role_id" ON "public"."profiles" USING "btree" ("role_id");



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("account_status", "institution_id");



CREATE INDEX "idx_quiz_attempts_quiz_id" ON "public"."quiz_attempts" USING "btree" ("quiz_id");



CREATE INDEX "idx_quiz_attempts_user_id" ON "public"."quiz_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_quiz_questions_quiz_id" ON "public"."quiz_questions" USING "btree" ("quiz_id");



CREATE INDEX "idx_quizzes_is_published" ON "public"."quizzes" USING "btree" ("is_published");



CREATE INDEX "idx_quizzes_lesson_id" ON "public"."quizzes" USING "btree" ("lesson_id");



CREATE INDEX "idx_registration_reviewers_institution" ON "public"."registration_reviewers" USING "btree" ("institution_id", "is_active");



CREATE INDEX "idx_registration_reviewers_user" ON "public"."registration_reviewers" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_registrations_cid" ON "public"."student_registrations" USING "btree" ("cid_number");



CREATE INDEX "idx_registrations_dzongkhag" ON "public"."student_registrations" USING "btree" ("dzongkhag");



CREATE INDEX "idx_registrations_email" ON "public"."student_registrations" USING "btree" ("email");



CREATE INDEX "idx_registrations_review" ON "public"."student_registrations" USING "btree" ("reviewed_by", "reviewed_at");



CREATE INDEX "idx_registrations_status" ON "public"."student_registrations" USING "btree" ("registration_status", "institution_id");



CREATE INDEX "idx_registrations_teacher" ON "public"."student_registrations" USING "btree" ("assigned_teacher_id");



CREATE INDEX "idx_registrations_user" ON "public"."student_registrations" USING "btree" ("user_id");



CREATE INDEX "idx_replies_thread" ON "public"."replies" USING "btree" ("thread_id");



CREATE INDEX "idx_replies_user" ON "public"."replies" USING "btree" ("user_id");



CREATE INDEX "idx_role_capabilities_role" ON "public"."role_capabilities" USING "btree" ("role_id");



CREATE INDEX "idx_roles_base_archetype" ON "public"."roles" USING "btree" ("base_archetype");



CREATE INDEX "idx_teacher_interventions_course_student" ON "public"."teacher_interventions" USING "btree" ("course_id", "student_id", "created_at" DESC);



CREATE INDEX "idx_threads_forum" ON "public"."threads" USING "btree" ("forum_id");



CREATE INDEX "idx_threads_user" ON "public"."threads" USING "btree" ("user_id");



CREATE INDEX "idx_user_approvals_reviewed" ON "public"."user_approvals" USING "btree" ("reviewed_by", "reviewed_at");



CREATE INDEX "idx_user_approvals_status" ON "public"."user_approvals" USING "btree" ("approval_status", "institution_id");



CREATE INDEX "idx_user_approvals_user" ON "public"."user_approvals" USING "btree" ("user_id");



CREATE INDEX "idx_user_badges_badge" ON "public"."user_badges" USING "btree" ("badge_id");



CREATE INDEX "idx_user_badges_user" ON "public"."user_badges" USING "btree" ("user_id");



CREATE INDEX "lesson_activity_progress_graded_by_idx" ON "public"."lesson_activity_progress" USING "btree" ("graded_by") WHERE ("graded_by" IS NOT NULL);



CREATE INDEX "lesson_activity_progress_lesson_activity_idx" ON "public"."lesson_activity_progress" USING "btree" ("lesson_id", "activity_id");



CREATE INDEX "lesson_activity_progress_lesson_idx" ON "public"."lesson_activity_progress" USING "btree" ("lesson_id");



CREATE INDEX "lesson_activity_progress_status_idx" ON "public"."lesson_activity_progress" USING "btree" ("status");



CREATE INDEX "lesson_activity_progress_user_lesson_idx" ON "public"."lesson_activity_progress" USING "btree" ("user_id", "lesson_id");



CREATE INDEX "lesson_progress_completed_idx" ON "public"."lesson_progress" USING "btree" ("completed");



CREATE INDEX "lesson_progress_course_id_idx" ON "public"."lesson_progress" USING "btree" ("course_id");



CREATE INDEX "modules_scheduled_publish_idx" ON "public"."modules" USING "btree" ("publish_at") WHERE ("availability" = 'scheduled'::"text");



CREATE INDEX "notes_course_id_idx" ON "public"."notes" USING "btree" ("course_id");



CREATE INDEX "notes_created_at_idx" ON "public"."notes" USING "btree" ("created_at" DESC);



CREATE INDEX "notes_is_deleted_idx" ON "public"."notes" USING "btree" ("is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "notes_lesson_id_idx" ON "public"."notes" USING "btree" ("lesson_id");



CREATE INDEX "notes_user_id_idx" ON "public"."notes" USING "btree" ("user_id");



CREATE INDEX "reviews_course_id_idx" ON "public"."reviews" USING "btree" ("course_id");



CREATE INDEX "reviews_created_at_idx" ON "public"."reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "reviews_rating_idx" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "reviews_user_id_idx" ON "public"."reviews" USING "btree" ("user_id");



CREATE INDEX "threads_source_lesson_idx" ON "public"."threads" USING "btree" ((("metadata" ->> 'source_lesson_id'::"text"))) WHERE (("metadata" ->> 'source_lesson_id'::"text") IS NOT NULL);



CREATE UNIQUE INDEX "unique_cid_per_institution_not_null" ON "public"."student_registrations" USING "btree" ("cid_number", "institution_id") WHERE (("cid_number" IS NOT NULL) AND ("btrim"(("cid_number")::"text") <> ''::"text"));



CREATE UNIQUE INDEX "user_approvals_user_institution_key" ON "public"."user_approvals" USING "btree" ("user_id", "institution_id");



CREATE INDEX "user_presence_status_seen_idx" ON "public"."user_presence" USING "btree" ("status", "last_seen_at" DESC);



CREATE INDEX "user_presence_today_idx" ON "public"."user_presence" USING "btree" ("last_seen_at" DESC);



CREATE OR REPLACE TRIGGER "enforce_course_enrollment_approval_trigger" BEFORE INSERT OR UPDATE ON "public"."enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_course_enrollment_approval"();



CREATE OR REPLACE TRIGGER "lessons_bump_status_generation" BEFORE INSERT OR UPDATE ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "private"."lessons_bump_status_generation"();



CREATE OR REPLACE TRIGGER "lessons_queue_status_mail" AFTER INSERT OR UPDATE ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "private"."lessons_queue_status_mail"();



CREATE OR REPLACE TRIGGER "lessons_recompute_enrollment_progress" AFTER INSERT OR DELETE OR UPDATE OF "module_id" ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "public"."recompute_enrollments_on_lesson_change"();



CREATE OR REPLACE TRIGGER "modules_enforce_availability" BEFORE INSERT OR UPDATE ON "public"."modules" FOR EACH ROW EXECUTE FUNCTION "private"."modules_enforce_availability"();



CREATE OR REPLACE TRIGGER "modules_queue_release_mail" AFTER INSERT OR UPDATE ON "public"."modules" FOR EACH ROW EXECUTE FUNCTION "private"."modules_queue_release_mail"();



CREATE OR REPLACE TRIGGER "profile_auth_cleanup_trigger" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_user_auth_metadata"();



CREATE OR REPLACE TRIGGER "profile_auth_sync_trigger" AFTER INSERT OR UPDATE OF "account_status", "role", "institution_id", "full_name", "email", "avatar_url", "location" ON "public"."profiles" FOR EACH ROW WHEN (("new"."id" IS NOT NULL)) EXECUTE FUNCTION "public"."sync_profile_to_auth_metadata"();



CREATE OR REPLACE TRIGGER "profiles_enforce_privileges" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_profile_privileges"();



CREATE OR REPLACE TRIGGER "registration_profile_sync_trigger" AFTER UPDATE OF "registration_status", "institution_id" ON "public"."student_registrations" FOR EACH ROW WHEN (("new"."user_id" IS NOT NULL)) EXECUTE FUNCTION "public"."sync_registration_to_profile_status"();



CREATE OR REPLACE TRIGGER "sync_lesson_preview_flags" BEFORE INSERT OR UPDATE ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "public"."sync_lesson_preview_flags"();



CREATE OR REPLACE TRIGGER "trg_protect_lesson_activity_grades" BEFORE INSERT OR UPDATE ON "public"."lesson_activity_progress" FOR EACH ROW EXECUTE FUNCTION "public"."protect_lesson_activity_grades"();



CREATE OR REPLACE TRIGGER "update_ai_threads_updated_at" BEFORE UPDATE ON "public"."ai_threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_assignment_submissions_updated_at" BEFORE UPDATE ON "public"."assignment_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_assignments_updated_at" BEFORE UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_chat_rooms_updated_at" BEFORE UPDATE ON "public"."chat_rooms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_course_rating_after_review" AFTER INSERT OR DELETE OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_course_rating_stats"();



CREATE OR REPLACE TRIGGER "update_courses_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_enrollment_progress_trigger" AFTER INSERT OR UPDATE OF "completed" ON "public"."lesson_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_enrollment_progress"();



CREATE OR REPLACE TRIGGER "update_lessons_updated_at" BEFORE UPDATE ON "public"."lessons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_live_sessions_updated_at" BEFORE UPDATE ON "public"."live_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_modules_updated_at" BEFORE UPDATE ON "public"."modules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_replies_updated_at" BEFORE UPDATE ON "public"."replies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_student_registrations_updated_at" BEFORE UPDATE ON "public"."student_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_threads_updated_at" BEFORE UPDATE ON "public"."threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_settings_updated_at"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_artifacts"
    ADD CONSTRAINT "ai_artifacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_provider_keys"
    ADD CONSTRAINT "ai_provider_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_runs"
    ADD CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_saved_prompts"
    ADD CONSTRAINT "ai_saved_prompts_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_saved_prompts"
    ADD CONSTRAINT "ai_saved_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_threads"
    ADD CONSTRAINT "ai_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_reads"
    ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."assignment_submissions"
    ADD CONSTRAINT "assignment_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloudinary_connection"
    ADD CONSTRAINT "cloudinary_connection_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."course_institutions"
    ADD CONSTRAINT "course_institutions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_institutions"
    ADD CONSTRAINT "course_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_instructors"
    ADD CONSTRAINT "course_instructors_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_instructors"
    ADD CONSTRAINT "course_instructors_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."course_instructors"
    ADD CONSTRAINT "course_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_deliveries"
    ADD CONSTRAINT "email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_hosts"
    ADD CONSTRAINT "email_hosts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollment_invites"
    ADD CONSTRAINT "enrollment_invites_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollment_invites"
    ADD CONSTRAINT "enrollment_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollment_invites"
    ADD CONSTRAINT "enrollment_invites_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollment_invites"
    ADD CONSTRAINT "enrollment_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_last_lesson_id_fkey" FOREIGN KEY ("last_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flashcard_decks"
    ADD CONSTRAINT "flashcard_decks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flashcard_decks"
    ADD CONSTRAINT "flashcard_decks_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flashcard_decks"
    ADD CONSTRAINT "flashcard_decks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flashcards"
    ADD CONSTRAINT "flashcards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."flashcard_decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forums"
    ADD CONSTRAINT "forums_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forums"
    ADD CONSTRAINT "forums_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forums"
    ADD CONSTRAINT "forums_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forums"
    ADD CONSTRAINT "forums_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institution_access"
    ADD CONSTRAINT "institution_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."institution_access"
    ADD CONSTRAINT "institution_access_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institution_access"
    ADD CONSTRAINT "institution_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_resource_person_id_fkey" FOREIGN KEY ("resource_person_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lesson_activity_progress"
    ADD CONSTRAINT "lesson_activity_progress_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lesson_activity_progress"
    ADD CONSTRAINT "lesson_activity_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_activity_progress"
    ADD CONSTRAINT "lesson_activity_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_progress"
    ADD CONSTRAINT "lesson_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lesson_scenarios"
    ADD CONSTRAINT "lesson_scenarios_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_attendance"
    ADD CONSTRAINT "live_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_attendance"
    ADD CONSTRAINT "live_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_attempts"
    ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_questions"
    ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quizzes"
    ADD CONSTRAINT "quizzes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_reviewers"
    ADD CONSTRAINT "registration_reviewers_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."registration_reviewers"
    ADD CONSTRAINT "registration_reviewers_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_reviewers"
    ADD CONSTRAINT "registration_reviewers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_parent_reply_id_fkey" FOREIGN KEY ("parent_reply_id") REFERENCES "public"."replies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."replies"
    ADD CONSTRAINT "replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_capabilities"
    ADD CONSTRAINT "role_capabilities_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_institutions"
    ADD CONSTRAINT "role_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_institutions"
    ADD CONSTRAINT "role_institutions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_registrations"
    ADD CONSTRAINT "student_registrations_assigned_teacher_id_fkey" FOREIGN KEY ("assigned_teacher_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."student_registrations"
    ADD CONSTRAINT "student_registrations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_registrations"
    ADD CONSTRAINT "student_registrations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."student_registrations"
    ADD CONSTRAINT "student_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_interventions"
    ADD CONSTRAINT "teacher_interventions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_interventions"
    ADD CONSTRAINT "teacher_interventions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_interventions"
    ADD CONSTRAINT "teacher_interventions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_forum_id_fkey" FOREIGN KEY ("forum_id") REFERENCES "public"."forums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_last_reply_by_fkey" FOREIGN KEY ("last_reply_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_approvals"
    ADD CONSTRAINT "user_approvals_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_approvals"
    ADD CONSTRAINT "user_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_approvals"
    ADD CONSTRAINT "user_approvals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_approvals"
    ADD CONSTRAINT "user_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_presence"
    ADD CONSTRAINT "user_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND (("profiles_1"."role")::"text" = 'superadmin'::"text")))));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND (("profiles_1"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view all analytics" ON "public"."analytics_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[]))))));



CREATE POLICY "Anyone can read platform settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Assigned reviewers can view institute registrations" ON "public"."student_registrations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."registration_reviewers" "r"
  WHERE (("r"."user_id" = "auth"."uid"()) AND ("r"."institution_id" = "student_registrations"."institution_id") AND ("r"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = 'resource_person'::"text") AND (("p"."institution_id" = "student_registrations"."institution_id") OR (EXISTS ( SELECT 1
           FROM "public"."institutions" "i"
          WHERE (("i"."id" = "student_registrations"."institution_id") AND ("i"."resource_person_id" = "auth"."uid"()))))))))));



CREATE POLICY "Authenticated can view institutions" ON "public"."institutions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Course creators can update enrollments" ON "public"."enrollments" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollments"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollments"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])))))));



CREATE POLICY "Enrolled users can send messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Instructors can create announcements for their courses" ON "public"."announcements" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "announcements"."course_id") AND ("courses"."instructor_id" = "auth"."uid"())))) OR (("course_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = ANY ((ARRAY['instructor'::character varying, 'admin'::character varying])::"text"[]))))))));



CREATE POLICY "Instructors can delete their own announcements" ON "public"."announcements" FOR DELETE USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text"))))));



CREATE POLICY "Instructors can update their own announcements" ON "public"."announcements" FOR UPDATE USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text"))))));



CREATE POLICY "Instructors can view course enrollments" ON "public"."enrollments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "enrollments"."course_id") AND ("courses"."instructor_id" = "auth"."uid"())))));



CREATE POLICY "Instructors can view own courses" ON "public"."courses" FOR SELECT USING (("auth"."uid"() = "instructor_id"));



CREATE POLICY "Instructors can view student progress" ON "public"."lesson_progress" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."id" = "lesson_progress"."enrollment_id") AND ("enrollments"."course_id" IN ( SELECT "courses"."id"
           FROM "public"."courses"
          WHERE ("courses"."instructor_id" = "auth"."uid"())))))));



CREATE POLICY "Platform admins can insert institutions" ON "public"."institutions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Platform admins can insert settings" ON "public"."platform_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Platform admins can update institutions" ON "public"."institutions" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Platform admins can update settings" ON "public"."platform_settings" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Platform admins can view all registrations" ON "public"."student_registrations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying])::"text"[]))))));



CREATE POLICY "Reviewers can view own assignments" ON "public"."registration_reviewers" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students can view own registration" ON "public"."student_registrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Superadmin can view all reviewers" ON "public"."registration_reviewers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = 'superadmin'::"text")))));



CREATE POLICY "Teachers can update registrations" ON "public"."student_registrations" FOR UPDATE USING ("public"."is_institution_staff"("institution_id")) WITH CHECK ("public"."is_institution_staff"("institution_id"));



CREATE POLICY "Teachers can view institution access" ON "public"."institution_access" FOR SELECT USING ("public"."is_institution_staff"("institution_id"));



CREATE POLICY "Teachers can view institution approvals" ON "public"."user_approvals" FOR SELECT USING ("public"."is_institution_staff"("institution_id"));



CREATE POLICY "Teachers can view institution registrations" ON "public"."student_registrations" FOR SELECT USING ("public"."is_institution_staff"("institution_id"));



CREATE POLICY "Users can create enrollments" ON "public"."enrollments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own settings" ON "public"."user_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own announcement reads" ON "public"."announcement_reads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own analytics" ON "public"."analytics_events" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own registration" ON "public"."student_registrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own announcement reads" ON "public"."announcement_reads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own progress" ON "public"."lesson_progress" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own enrollments" ON "public"."enrollments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own messages" ON "public"."chat_messages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own posts" ON "public"."threads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile (limited)" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND (("account_status")::"text" = ( SELECT ("p"."account_status")::"text" AS "account_status"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))) AND (("role")::"text" = ( SELECT ("p"."role")::"text" AS "role"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update own registration" ON "public"."student_registrations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own replies" ON "public"."replies" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own announcement reads" ON "public"."announcement_reads" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can view course chat rooms" ON "public"."chat_rooms" FOR SELECT USING (true);



CREATE POLICY "Users can view own access" ON "public"."institution_access" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own approval" ON "public"."user_approvals" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own enrollments" ON "public"."enrollments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view published announcements for their enrolled cours" ON "public"."announcements" FOR SELECT USING ((("is_published" = true) AND (("course_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."course_id" = "announcements"."course_id") AND ("enrollments"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."courses"
  WHERE (("courses"."id" = "announcements"."course_id") AND ("courses"."instructor_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view their own announcement reads" ON "public"."announcement_reads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own quiz attempts" ON "public"."quiz_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_artifacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_artifacts_delete_own" ON "public"."ai_artifacts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "ai_artifacts_insert_own" ON "public"."ai_artifacts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "ai_artifacts"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[])))))));



CREATE POLICY "ai_artifacts_select_own" ON "public"."ai_artifacts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_messages_delete_own" ON "public"."ai_messages" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_threads" "t"
  WHERE (("t"."id" = "ai_messages"."thread_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "ai_messages_insert_own" ON "public"."ai_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_threads" "t"
  WHERE (("t"."id" = "ai_messages"."thread_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "ai_messages_select_own" ON "public"."ai_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_threads" "t"
  WHERE (("t"."id" = "ai_messages"."thread_id") AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."ai_provider_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_runs_select_superadmin" ON "public"."ai_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'superadmin'::"text")))));



ALTER TABLE "public"."ai_saved_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_saved_prompts_delete_own" ON "public"."ai_saved_prompts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "ai_saved_prompts_insert_own" ON "public"."ai_saved_prompts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "ai_saved_prompts"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[])))))));



CREATE POLICY "ai_saved_prompts_select_own" ON "public"."ai_saved_prompts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_threads_delete_own" ON "public"."ai_threads" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "ai_threads_insert_own" ON "public"."ai_threads" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "ai_threads"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[])))))));



CREATE POLICY "ai_threads_select_own" ON "public"."ai_threads" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "ai_threads_update_own" ON "public"."ai_threads" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcement_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_delete_policy" ON "public"."announcements" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "announcements_insert_policy" ON "public"."announcements" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "announcements_select_policy" ON "public"."announcements" FOR SELECT TO "authenticated" USING ((("is_published" = true) AND (("is_global" = true) OR ("course_id" IN ( SELECT "enrollments"."course_id"
   FROM "public"."enrollments"
  WHERE ("enrollments"."user_id" = "auth"."uid"()))))));



CREATE POLICY "announcements_update_policy" ON "public"."announcements" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."assignment_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignment_submissions_insert" ON "public"."assignment_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ((("public"."assignments" "a"
     JOIN "public"."lessons" "l" ON (("l"."id" = "a"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."enrollments" "e" ON (("e"."course_id" = "m"."course_id")))
  WHERE (("a"."id" = "assignment_submissions"."assignment_id") AND ("a"."is_published" = true) AND ("e"."user_id" = "auth"."uid"()))))));



CREATE POLICY "assignment_submissions_select" ON "public"."assignment_submissions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ((("public"."assignments" "a"
     JOIN "public"."lessons" "l" ON (("l"."id" = "a"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("a"."id" = "assignment_submissions"."assignment_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))));



CREATE POLICY "assignment_submissions_update" ON "public"."assignment_submissions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignments_manage" ON "public"."assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "assignments"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "assignments"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))));



CREATE POLICY "assignments_select" ON "public"."assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "assignments"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))) OR (("assignments"."is_published" = true) AND (EXISTS ( SELECT 1
           FROM "public"."enrollments" "e"
          WHERE (("e"."course_id" = "c"."id") AND ("e"."user_id" = "auth"."uid"()))))))))));



ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bhutan_dzongkhags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certificates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certificates_select_instructor" ON "public"."certificates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "certificates"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))));



CREATE POLICY "certificates_select_own" ON "public"."certificates" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cloudinary_connection" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_institutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_institutions_delete" ON "public"."course_institutions" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_institutions"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."course_instructors" "ci"
  WHERE (("ci"."course_id" = "course_institutions"."course_id") AND ("ci"."user_id" = "auth"."uid"()))))));



CREATE POLICY "course_institutions_insert" ON "public"."course_institutions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_institutions"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."course_instructors" "ci"
  WHERE (("ci"."course_id" = "course_institutions"."course_id") AND ("ci"."user_id" = "auth"."uid"()))))));



CREATE POLICY "course_institutions_select" ON "public"."course_institutions" FOR SELECT TO "authenticated" USING ("public"."user_can_see_course"("course_id", "auth"."uid"()));



CREATE POLICY "course_institutions_update" ON "public"."course_institutions" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_institutions"."course_id") AND ("c"."instructor_id" = "auth"."uid"()))))));



ALTER TABLE "public"."course_instructors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_instructors_select" ON "public"."course_instructors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "course_instructors_select_published" ON "public"."course_instructors" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_instructors"."course_id") AND ("c"."is_published" = true)))));



CREATE POLICY "course_instructors_write" ON "public"."course_instructors" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_instructors"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_instructors"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[]))))))))));



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courses_delete_policy" ON "public"."courses" FOR DELETE TO "authenticated" USING ((("instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])))))));



CREATE POLICY "courses_insert_policy" ON "public"."courses" FOR INSERT TO "authenticated" WITH CHECK ((("instructor_id" = "auth"."uid"()) AND "private"."is_teaching_role"("auth"."uid"())));



CREATE POLICY "courses_select_anon_open_published" ON "public"."courses" FOR SELECT TO "anon" USING ((("is_published" = true) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."course_institutions" "x"
  WHERE ("x"."course_id" = "courses"."id"))))));



CREATE POLICY "courses_select_policy" ON "public"."courses" FOR SELECT TO "authenticated" USING ("public"."user_can_see_course"("id", "auth"."uid"()));



CREATE POLICY "courses_update_policy" ON "public"."courses" FOR UPDATE TO "authenticated" USING ("private"."can_manage_course"("id", "auth"."uid"())) WITH CHECK ("private"."can_manage_course"("id", "auth"."uid"()));



CREATE POLICY "discussion_tag_notify" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (((("type")::"text" = 'discussion_tag'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = (NULLIF(("notifications"."metadata" ->> 'course_id'::"text"), ''::"text"))::"uuid") AND ((EXISTS ( SELECT 1
           FROM "public"."enrollments" "e"
          WHERE (("e"."course_id" = "c"."id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR ("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))));



ALTER TABLE "public"."email_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_hosts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollment_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollment_invites_select" ON "public"."enrollment_invites" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("student_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollment_invites"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))));



CREATE POLICY "enrollment_invites_write" ON "public"."enrollment_invites" TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollment_invites"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[]))))))) WITH CHECK ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollment_invites"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[])))))));



ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "enrollments_select_instructor" ON "public"."enrollments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "enrollments"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))));



ALTER TABLE "public"."flashcard_decks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flashcard_decks_select" ON "public"."flashcard_decks" FOR SELECT USING (true);



CREATE POLICY "flashcard_decks_write" ON "public"."flashcard_decks" USING (("auth"."uid"() = "instructor_id"));



ALTER TABLE "public"."flashcards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flashcards_select" ON "public"."flashcards" FOR SELECT USING (true);



CREATE POLICY "flashcards_write" ON "public"."flashcards" USING ((EXISTS ( SELECT 1
   FROM "public"."flashcard_decks" "d"
  WHERE (("d"."id" = "flashcards"."deck_id") AND ("d"."instructor_id" = "auth"."uid"())))));



ALTER TABLE "public"."forums" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forums_insert_enrolled_or_staff" ON "public"."forums" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "forums"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "forums"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))));



CREATE POLICY "forums_select_enrolled_or_staff" ON "public"."forums" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."enrollments" "e"
  WHERE (("e"."course_id" = "forums"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "forums"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))));



ALTER TABLE "public"."institution_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lesson_activity_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lesson_activity_progress_delete_own" ON "public"."lesson_activity_progress" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "lesson_activity_progress_insert_own" ON "public"."lesson_activity_progress" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "lesson_activity_progress_select_own" ON "public"."lesson_activity_progress" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_activity_progress"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"()))))))))));



CREATE POLICY "lesson_activity_progress_update_own" ON "public"."lesson_activity_progress" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."lesson_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lesson_progress_insert_policy" ON "public"."lesson_progress" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "lesson_progress_select_instructor" ON "public"."lesson_progress" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "lesson_progress"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))));



CREATE POLICY "lesson_progress_select_policy" ON "public"."lesson_progress" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "lesson_progress_update_policy" ON "public"."lesson_progress" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."lesson_scenarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lesson_scenarios_select" ON "public"."lesson_scenarios" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lesson_scenarios_write" ON "public"."lesson_scenarios" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_scenarios"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "lesson_scenarios"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))));



ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lessons_delete_policy" ON "public"."lessons" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "lessons"."module_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"())))));



CREATE POLICY "lessons_insert_policy" ON "public"."lessons" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "lessons"."module_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"())))));



CREATE POLICY "lessons_manage_policy" ON "public"."lessons" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "lessons_select_policy" ON "public"."lessons" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "lessons"."module_id") AND ("private"."can_manage_course"("m"."course_id", "auth"."uid"()) OR "private"."lesson_is_open"("lessons"."id", "auth"."uid"()))))));



CREATE POLICY "lessons_update_policy" ON "public"."lessons" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "lessons"."module_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."modules" "m"
  WHERE (("m"."id" = "lessons"."module_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"())))));



ALTER TABLE "public"."live_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_delete_policy" ON "public"."modules" FOR DELETE TO "authenticated" USING ("private"."can_manage_course"("course_id", "auth"."uid"()));



CREATE POLICY "modules_insert_policy" ON "public"."modules" FOR INSERT TO "authenticated" WITH CHECK ("private"."can_manage_course"("course_id", "auth"."uid"()));



CREATE POLICY "modules_manage_policy" ON "public"."modules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "modules_select_policy" ON "public"."modules" FOR SELECT TO "authenticated" USING ("public"."user_can_see_course"("course_id", "auth"."uid"()));



CREATE POLICY "modules_update_policy" ON "public"."modules" FOR UPDATE TO "authenticated" USING ("private"."can_manage_course"("course_id", "auth"."uid"())) WITH CHECK ("private"."can_manage_course"("course_id", "auth"."uid"()));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_delete_own" ON "public"."notes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notes_insert_own" ON "public"."notes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "notes_select_own" ON "public"."notes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notes_update_own" ON "public"."notes" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quiz_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_attempts_delete_staff" ON "public"."quiz_attempts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."quizzes" "q"
     JOIN "public"."lessons" "l" ON (("l"."id" = "q"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
  WHERE (("q"."id" = "quiz_attempts"."quiz_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"())))));



CREATE POLICY "quiz_attempts_select_staff" ON "public"."quiz_attempts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."quizzes" "q"
     JOIN "public"."lessons" "l" ON (("l"."id" = "q"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
  WHERE (("q"."id" = "quiz_attempts"."quiz_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"())))));



ALTER TABLE "public"."quiz_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quiz_questions_manage" ON "public"."quiz_questions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."quizzes" "q"
     JOIN "public"."lessons" "l" ON (("l"."id" = "q"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("q"."id" = "quiz_questions"."quiz_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."quizzes" "q"
     JOIN "public"."lessons" "l" ON (("l"."id" = "q"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("q"."id" = "quiz_questions"."quiz_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))));



CREATE POLICY "quiz_questions_select_staff" ON "public"."quiz_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."quizzes" "q"
     JOIN "public"."lessons" "l" ON (("l"."id" = "q"."lesson_id")))
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
  WHERE (("q"."id" = "quiz_questions"."quiz_id") AND "private"."can_manage_course"("m"."course_id", "auth"."uid"())))));



ALTER TABLE "public"."quizzes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quizzes_manage" ON "public"."quizzes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "quizzes"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."lessons" "l"
     JOIN "public"."modules" "m" ON (("m"."id" = "l"."module_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "m"."course_id")))
  WHERE (("l"."id" = "quizzes"."lesson_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))));



CREATE POLICY "quizzes_select" ON "public"."quizzes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."registration_reviewers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."replies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "replies_insert_own" ON "public"."replies" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "replies_select" ON "public"."replies" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."threads" "t"
     JOIN "public"."forums" "f" ON (("f"."id" = "t"."forum_id")))
  WHERE (("t"."id" = "replies"."thread_id") AND ((EXISTS ( SELECT 1
           FROM "public"."enrollments" "e"
          WHERE (("e"."course_id" = "f"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
           FROM "public"."courses" "c"
          WHERE (("c"."id" = "f"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
                   FROM "public"."course_instructors" "ci"
                  WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
                   FROM "public"."profiles" "p"
                  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))))))));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_delete_policy" ON "public"."reviews" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "reviews_insert_policy" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reviews_select_policy" ON "public"."reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reviews_update_policy" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."role_capabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_institutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_interventions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_interventions_insert" ON "public"."teacher_interventions" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "teacher_interventions_select" ON "public"."teacher_interventions" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) OR ("student_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "teacher_interventions"."course_id") AND ("c"."instructor_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."course_instructors" "ci"
  WHERE (("ci"."course_id" = "teacher_interventions"."course_id") AND ("ci"."user_id" = "auth"."uid"()))))));



CREATE POLICY "teachers_notify_enrolled" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = (NULLIF(("notifications"."metadata" ->> 'course_id'::"text"), ''::"text"))::"uuid") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."course_instructors" "ci"
          WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))));



ALTER TABLE "public"."thread_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "thread_reactions_delete" ON "public"."thread_reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "thread_reactions_insert" ON "public"."thread_reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."threads" "t"
     JOIN "public"."forums" "f" ON (("f"."id" = "t"."forum_id")))
  WHERE (("t"."id" = "thread_reactions"."thread_id") AND ((EXISTS ( SELECT 1
           FROM "public"."enrollments" "e"
          WHERE (("e"."course_id" = "f"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
           FROM "public"."courses" "c"
          WHERE (("c"."id" = "f"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
                   FROM "public"."course_instructors" "ci"
                  WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
                   FROM "public"."profiles" "p"
                  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[])))))))))))))));



CREATE POLICY "thread_reactions_select" ON "public"."thread_reactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."threads" "t"
     JOIN "public"."forums" "f" ON (("f"."id" = "t"."forum_id")))
  WHERE (("t"."id" = "thread_reactions"."thread_id") AND ((EXISTS ( SELECT 1
           FROM "public"."enrollments" "e"
          WHERE (("e"."course_id" = "f"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
           FROM "public"."courses" "c"
          WHERE (("c"."id" = "f"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
                   FROM "public"."course_instructors" "ci"
                  WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
                   FROM "public"."profiles" "p"
                  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))))))));



CREATE POLICY "thread_reactions_update" ON "public"."thread_reactions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "threads_insert_own" ON "public"."threads" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "threads_select" ON "public"."threads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forums" "f"
  WHERE (("f"."id" = "threads"."forum_id") AND ((EXISTS ( SELECT 1
           FROM "public"."enrollments" "e"
          WHERE (("e"."course_id" = "f"."course_id") AND ("e"."user_id" = "auth"."uid"()) AND (("e"."status")::"text" = ANY ((ARRAY['active'::character varying, 'completed'::character varying])::"text"[]))))) OR (EXISTS ( SELECT 1
           FROM "public"."courses" "c"
          WHERE (("c"."id" = "f"."course_id") AND (("c"."instructor_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
                   FROM "public"."course_instructors" "ci"
                  WHERE (("ci"."course_id" = "c"."id") AND ("ci"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
                   FROM "public"."profiles" "p"
                  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying, 'resource_person'::character varying])::"text"[]))))))))))))));



ALTER TABLE "public"."user_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_presence_insert_own" ON "public"."user_presence" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_presence_select_own" ON "public"."user_presence" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_presence_select_staff" ON "public"."user_presence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND (("p"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'superadmin'::character varying])::"text"[]))))));



CREATE POLICY "user_presence_update_own" ON "public"."user_presence" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_student_registration"("target_registration_id" "uuid", "review_action" character varying, "review_notes_text" "text", "rejection_reason_text" "text", "assigned_role_text" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."approve_student_registration"("target_registration_id" "uuid", "review_action" character varying, "review_notes_text" "text", "rejection_reason_text" "text", "assigned_role_text" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_student_registration"("target_registration_id" "uuid", "review_action" character varying, "review_notes_text" "text", "rejection_reason_text" "text", "assigned_role_text" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_teacher_role"("target_user_id" "uuid", "target_institution_id" "uuid", "assigned_courses" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."assign_teacher_role"("target_user_id" "uuid", "target_institution_id" "uuid", "assigned_courses" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_teacher_role"("target_user_id" "uuid", "target_institution_id" "uuid", "assigned_courses" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_approve_registrations"("registration_ids" "uuid"[], "review_action" character varying, "review_notes_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_approve_registrations"("registration_ids" "uuid"[], "review_action" character varying, "review_notes_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_approve_registrations"("registration_ids" "uuid"[], "review_action" character varying, "review_notes_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_course_progress"("user_id" "uuid", "course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_course_progress"("user_id" "uuid", "course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_course_progress"("user_id" "uuid", "course_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."email_deliveries" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_email_deliveries"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_email_deliveries"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_user_auth_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_user_auth_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_user_auth_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_discussion_reply"("p_thread_id" "uuid", "p_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_discussion_reply"("p_thread_id" "uuid", "p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_discussion_reply"("p_thread_id" "uuid", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_discussion_thread"("p_forum_id" "uuid", "p_title" "text", "p_content" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_discussion_thread"("p_forum_id" "uuid", "p_title" "text", "p_content" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_discussion_thread"("p_forum_id" "uuid", "p_title" "text", "p_content" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_course_enrollment_approval"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_course_enrollment_approval"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_course_enrollment_approval"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_course_enrollment_approval"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_discussion_forum"("p_course_id" "uuid", "p_module_id" "uuid", "p_lesson_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_discussion_forum"("p_course_id" "uuid", "p_module_id" "uuid", "p_lesson_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_discussion_forum"("p_course_id" "uuid", "p_module_id" "uuid", "p_lesson_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dzongkhag_id"("dzongkhag_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dzongkhag_id"("dzongkhag_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dzongkhag_id"("dzongkhag_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_institution_stats"("target_institution_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_institution_stats"("target_institution_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_institution_stats"("target_institution_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_registration_status"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_registration_status"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_registration_status"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_institution_staff"("check_institution_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_institution_staff"("check_institution_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_institution_staff"("check_institution_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_institution_staff"("check_institution_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_registration_reviewer"("check_user_id" "uuid", "check_institution_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_registration_reviewer"("check_user_id" "uuid", "check_institution_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_registration_reviewer"("check_user_id" "uuid", "check_institution_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lesson_is_open"("p_lesson_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."presence_heartbeat"("p_status" "text", "p_path" "text", "p_path_label" "text", "p_interactive" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presence_heartbeat"("p_status" "text", "p_path" "text", "p_path_label" "text", "p_interactive" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."presence_heartbeat"("p_status" "text", "p_path" "text", "p_path_label" "text", "p_interactive" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."presence_heartbeat"("p_status" "text", "p_path" "text", "p_path_label" "text", "p_interactive" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."presence_leave"("p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."presence_leave"("p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."presence_leave"("p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."presence_leave"("p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_lesson_activity_grades"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_lesson_activity_grades"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_lesson_activity_grades"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_enrollments_on_lesson_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_enrollments_on_lesson_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_all_profiles_to_auth_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_all_profiles_to_auth_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_all_profiles_to_auth_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_lesson_preview_flags"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_lesson_preview_flags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_lesson_preview_flags"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_to_auth_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_to_auth_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_to_auth_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_registration_to_profile_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_registration_to_profile_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_registration_to_profile_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_single_profile_to_auth_metadata"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_single_profile_to_auth_metadata"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_single_profile_to_auth_metadata"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_course_rating_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_course_rating_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_enrollment_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_enrollment_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_enrollment_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_see_course"("p_course_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_see_course"("p_course_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_see_course"("p_course_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_bhutan_cid"("cid_text" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_bhutan_cid"("cid_text" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_bhutan_cid"("cid_text" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_bhutan_phone"("phone_text" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_bhutan_phone"("phone_text" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_bhutan_phone"("phone_text" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_dzongkhag"("dzongkhag_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_dzongkhag"("dzongkhag_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_dzongkhag"("dzongkhag_name" character varying) TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."ai_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."ai_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_provider_keys" TO "service_role";



GRANT ALL ON TABLE "public"."ai_runs" TO "anon";
GRANT ALL ON TABLE "public"."ai_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_runs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_saved_prompts" TO "anon";
GRANT ALL ON TABLE "public"."ai_saved_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_saved_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_threads" TO "anon";
GRANT ALL ON TABLE "public"."ai_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_threads" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."announcement_reads" TO "anon";
GRANT ALL ON TABLE "public"."announcement_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."announcement_reads" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_submissions" TO "anon";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."bhutan_dzongkhags" TO "anon";
GRANT ALL ON TABLE "public"."bhutan_dzongkhags" TO "authenticated";
GRANT ALL ON TABLE "public"."bhutan_dzongkhags" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bhutan_dzongkhags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bhutan_dzongkhags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bhutan_dzongkhags_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."capabilities" TO "anon";
GRANT ALL ON TABLE "public"."capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."certificates" TO "anon";
GRANT ALL ON TABLE "public"."certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificates" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."cloudinary_connection" TO "service_role";



GRANT ALL ON TABLE "public"."course_institutions" TO "anon";
GRANT ALL ON TABLE "public"."course_institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."course_institutions" TO "service_role";



GRANT ALL ON TABLE "public"."course_instructors" TO "anon";
GRANT ALL ON TABLE "public"."course_instructors" TO "authenticated";
GRANT ALL ON TABLE "public"."course_instructors" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."email_hosts" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."enrollment_invites" TO "anon";
GRANT ALL ON TABLE "public"."enrollment_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollment_invites" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."flashcard_decks" TO "anon";
GRANT ALL ON TABLE "public"."flashcard_decks" TO "authenticated";
GRANT ALL ON TABLE "public"."flashcard_decks" TO "service_role";



GRANT ALL ON TABLE "public"."flashcards" TO "anon";
GRANT ALL ON TABLE "public"."flashcards" TO "authenticated";
GRANT ALL ON TABLE "public"."flashcards" TO "service_role";



GRANT ALL ON TABLE "public"."forums" TO "anon";
GRANT ALL ON TABLE "public"."forums" TO "authenticated";
GRANT ALL ON TABLE "public"."forums" TO "service_role";



GRANT ALL ON TABLE "public"."institution_access" TO "anon";
GRANT ALL ON TABLE "public"."institution_access" TO "authenticated";
GRANT ALL ON TABLE "public"."institution_access" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_activity_progress" TO "anon";
GRANT ALL ON TABLE "public"."lesson_activity_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_activity_progress" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_progress" TO "anon";
GRANT ALL ON TABLE "public"."lesson_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_progress" TO "service_role";



GRANT ALL ON TABLE "public"."lesson_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."lesson_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."lesson_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."live_attendance" TO "anon";
GRANT ALL ON TABLE "public"."live_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."live_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."live_sessions" TO "anon";
GRANT ALL ON TABLE "public"."live_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."live_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quiz_attempts" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quiz_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_questions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_questions" TO "service_role";



GRANT ALL ON TABLE "public"."quizzes" TO "anon";
GRANT ALL ON TABLE "public"."quizzes" TO "authenticated";
GRANT ALL ON TABLE "public"."quizzes" TO "service_role";



GRANT ALL ON TABLE "public"."registration_reviewers" TO "anon";
GRANT ALL ON TABLE "public"."registration_reviewers" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_reviewers" TO "service_role";



GRANT ALL ON TABLE "public"."replies" TO "anon";
GRANT ALL ON TABLE "public"."replies" TO "authenticated";
GRANT ALL ON TABLE "public"."replies" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."role_capabilities" TO "anon";
GRANT ALL ON TABLE "public"."role_capabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."role_capabilities" TO "service_role";



GRANT ALL ON TABLE "public"."role_institutions" TO "anon";
GRANT ALL ON TABLE "public"."role_institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_institutions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."student_registrations" TO "anon";
GRANT ALL ON TABLE "public"."student_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."student_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_interventions" TO "anon";
GRANT ALL ON TABLE "public"."teacher_interventions" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_interventions" TO "service_role";



GRANT ALL ON TABLE "public"."thread_reactions" TO "anon";
GRANT ALL ON TABLE "public"."thread_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."user_approvals" TO "anon";
GRANT ALL ON TABLE "public"."user_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."user_presence" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







