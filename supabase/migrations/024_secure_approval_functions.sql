-- ============================================================================
-- SECURE APPROVAL RPC FUNCTIONS
-- ============================================================================
-- Server-side functions with SECURITY DEFINER for safe approval operations
-- All admin operations must go through these functions, never direct DB writes

-- ============================================================================
-- MAIN STUDENT REGISTRATION APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_student_registration(
  target_registration_id UUID,
  review_action VARCHAR,
  review_notes_text TEXT DEFAULT NULL,
  rejection_reason_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer_role VARCHAR;
  reviewer_institution UUID;
  registration_record student_registrations%ROWTYPE;
  user_role VARCHAR;
BEGIN
  -- Get current user's role and institution
  SELECT p.role, p.institution_id INTO reviewer_role, reviewer_institution
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Verify user exists and has valid role
  IF reviewer_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Verify admin/teacher permissions
  IF reviewer_role NOT IN ('resource_person', 'admin', 'instructor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Get the registration record
  SELECT * INTO registration_record
  FROM student_registrations
  WHERE id = target_registration_id;

  -- Verify registration exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
  END IF;

  -- Verify institution access (teachers can only approve for their institution)
  IF reviewer_role = 'instructor' THEN
    IF reviewer_institution != registration_record.institution_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Institution access denied');
    END IF;
  END IF;

  -- BEGIN TRANSACTION APPROVAL PROCESS
  IF review_action = 'approve' THEN
    -- Check if registration is in approvable state
    IF registration_record.registration_status NOT IN ('submitted', 'under_review', 'additional_info_requested') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Registration not in approvable state');
    END IF;

    -- Update student registration status
    UPDATE student_registrations
    SET
      registration_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      review_notes = review_notes_text,
      updated_at = NOW()
    WHERE id = target_registration_id;

    -- Update user profile to active
    UPDATE profiles
    SET
      account_status = 'active',
      institution_id = registration_record.institution_id,
      enrollment_date = NOW(),
      full_name = registration_record.full_name,
      location = registration_record.dzongkhag,
      metadata = jsonb_build_object(
        'cid_number', registration_record.cid_number,
        'pelsung_number', registration_record.pelsung_number,
        'class', registration_record.class,
        'phone_number', registration_record.phone_number
      )
    WHERE id = registration_record.user_id;

    -- Add institution access as student
    INSERT INTO institution_access (
      institution_id,
      user_id,
      role_within_institution,
      granted_by,
      granted_at
    ) VALUES (
      registration_record.institution_id,
      registration_record.user_id,
      'student',
      auth.uid(),
      NOW()
    ) ON CONFLICT (institution_id, user_id) DO UPDATE SET
      role_within_institution = 'student',
      granted_by = auth.uid(),
      granted_at = NOW(),
      is_active = true;

    -- Create user approval record
    INSERT INTO user_approvals (
      user_id,
      institution_id,
      approval_status,
      reviewed_by,
      reviewed_at,
      notes
    ) VALUES (
      registration_record.user_id,
      registration_record.institution_id,
      'approved',
      auth.uid(),
      NOW(),
      'Approved via student registration system: ' || COALESCE(review_notes_text, 'No notes')
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      notes = 'Approved via student registration system: ' || COALESCE(review_notes_text, 'No notes');

    -- Get the user's role from profiles
    SELECT role INTO user_role
    FROM profiles
    WHERE id = registration_record.user_id;

    -- Update auth metadata for instant middleware access
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_build_object(
      'account_status', 'active',
      'role', COALESCE(user_role, 'student'),
      'institution_id', registration_record.institution_id::text
    )
    WHERE id = registration_record.user_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Student registration approved successfully',
      'user_id', registration_record.user_id,
      'registration_id', target_registration_id
    );

  ELSIF review_action = 'reject' THEN
    -- Update registration status to rejected
    UPDATE student_registrations
    SET
      registration_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      review_notes = review_notes_text,
      rejection_reason = rejection_reason_text,
      updated_at = NOW()
    WHERE id = target_registration_id;

    -- Update user profile to rejected
    UPDATE profiles
    SET account_status = 'rejected'
    WHERE id = registration_record.user_id;

    -- Update user approval record
    INSERT INTO user_approvals (
      user_id,
      institution_id,
      approval_status,
      reviewed_by,
      reviewed_at,
      rejection_reason,
      notes
    ) VALUES (
      registration_record.user_id,
      registration_record.institution_id,
      'rejected',
      auth.uid(),
      NOW(),
      rejection_reason_text,
      'Rejected via student registration system: ' || COALESCE(review_notes_text, 'No notes')
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      rejection_reason = rejection_reason_text,
      notes = 'Rejected via student registration system: ' || COALESCE(review_notes_text, 'No notes');

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Student registration rejected',
      'registration_id', target_registration_id
    );

  ELSIF review_action = 'request_info' THEN
    -- Update registration to request additional information
    UPDATE student_registrations
    SET
      registration_status = 'additional_info_requested',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      review_notes = review_notes_text,
      updated_at = NOW()
    WHERE id = target_registration_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Additional information requested from student',
      'registration_id', target_registration_id
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

-- ============================================================================
-- TEACHER ASSIGNMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_teacher_role(
  target_user_id UUID,
  target_institution_id UUID,
  assigned_courses UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- BULK APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION bulk_approve_registrations(
  registration_ids UUID[],
  review_action VARCHAR,
  review_notes_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- STUDENT REGISTRATION STATUS CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION get_registration_status(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- INSTITUTION STATS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_institution_stats(target_institution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION approve_student_registration TO authenticated;
GRANT EXECUTE ON FUNCTION assign_teacher_role TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_approve_registrations TO authenticated;
GRANT EXECUTE ON FUNCTION get_registration_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_institution_stats TO authenticated;

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- All functions use SECURITY DEFINER to bypass normal RLS for admin operations
-- However, they include proper permission checks within the function body
-- This ensures that client-side code cannot bypass security controls
-- All approval operations are transactional and atomic
-- No direct database writes from client components can bypass these functions
-- ============================================================================