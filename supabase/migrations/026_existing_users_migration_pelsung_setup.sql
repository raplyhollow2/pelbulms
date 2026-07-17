-- ============================================================================
-- EXISTING USERS MIGRATION & PELSUNG INSTITUTION SETUP
-- ============================================================================
-- This migration handles:
-- 1. Auto-migration of existing users to active status
-- 2. Setup of Pelsung as primary institution
-- 3. Assignment of dipanpradhan.biz@gmail.com as resource person
-- 4. Creation of approval records for migrated users

-- ============================================================================
-- ENSURE PELSUNG INSTITUTION EXISTS
-- ============================================================================

-- Insert Pelsung institution if it doesn't exist
INSERT INTO institutions (id, name, slug, description, signup_approval_required, settings)
VALUES (
  gen_random_uuid(),
  'Pelsung - Guardians of Prosperity',
  'pelsung',
  'Bhutan''s prestigious national program to develop youth leaders for Gelephu Mindfulness City and 10X Bhutan',
  true,
  jsonb_build_object(
    'program_type', 'national_youth_development',
    'focus_areas', jsonb_build_array('Gelephu Mindfulness City', '10X Bhutan'),
    'established', '2024',
    'requires_verification', true
  )
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  signup_approval_required = true;

-- ============================================================================
-- GET PELSUNG INSTITUTION ID
-- ============================================================================

DO $$
DECLARE
  pelsung_institution_id UUID;
  resource_person_profile_id UUID;
  migrated_count INTEGER := 0;
  approval_created_count INTEGER := 0;
  existing_user RECORD;
BEGIN
  -- Get Pelsung institution ID
  SELECT id INTO pelsung_institution_id
  FROM institutions
  WHERE slug = 'pelsung';

  -- Get dipanpradhan.biz@gmail.com profile ID
  SELECT id INTO resource_person_profile_id
  FROM profiles
  WHERE email = 'dipanpradhan.biz@gmail.com';

  -- Update Pelsung institution with resource person
  UPDATE institutions
  SET
    resource_person_id = resource_person_profile_id,
    settings = jsonb_build_object(
      'program_type', 'national_youth_development',
      'focus_areas', jsonb_build_array('Gelephu Mindfulness City', '10X Bhutan'),
      'established', '2024',
      'requires_verification', true,
      'resource_person_email', 'dipanpradhan.biz@gmail.com'
    )
  WHERE slug = 'pelsung';

  -- Ensure dipanpradhan.biz@gmail.com has correct role and access
  UPDATE profiles
  SET
    account_status = 'active',
    role = 'resource_person',
    institution_id = pelsung_institution_id,
    enrollment_date = COALESCE(enrollment_date, NOW())
  WHERE email = 'dipanpradhan.biz@gmail.com';

  -- Grant institution access to resource person
  INSERT INTO institution_access (
    institution_id,
    user_id,
    role_within_institution,
    granted_by,
    granted_at,
    is_active
  ) VALUES (
    pelsung_institution_id,
    resource_person_profile_id,
    'resource_person',
    resource_person_profile_id,
    NOW(),
    true
  ) ON CONFLICT (institution_id, user_id) DO UPDATE SET
    role_within_institution = 'resource_person',
    is_active = true;

  RAISE NOTICE 'Pelsung institution setup completed with resource person: dipanpradhan.biz@gmail.com';

  -- ============================================================================
  -- AUTO-MIGRATE EXISTING USERS TO ACTIVE STATUS
  -- ============================================================================

  -- Migrate existing enrolled users to active status
  FOR existing_user IN
    SELECT DISTINCT p.id, p.email, p.full_name, p.role
    FROM profiles p
    INNER JOIN enrollments e ON p.id = e.user_id
    WHERE p.account_status IS NULL OR p.account_status = 'pending'
  LOOP
    -- Update profile to active with Pelsung institution
    UPDATE profiles
    SET
      account_status = 'active',
      institution_id = pelsung_institution_id,
      enrollment_date = COALESCE(enrollment_date, NOW()),
      updated_at = NOW()
    WHERE id = existing_user.id;

    -- Create institution access record
    INSERT INTO institution_access (
      institution_id,
      user_id,
      role_within_institution,
      granted_by,
      granted_at,
      is_active
    ) VALUES (
      pelsung_institution_id,
      existing_user.id,
      CASE WHEN existing_user.role = 'instructor' THEN 'teacher' ELSE 'student' END,
      resource_person_profile_id,
      NOW(),
      true
    ) ON CONFLICT (institution_id, user_id) DO UPDATE SET
      role_within_institution = CASE WHEN existing_user.role = 'instructor' THEN 'teacher' ELSE 'student' END,
      is_active = true;

    -- Create approval record for migrated users
    INSERT INTO user_approvals (
      user_id,
      institution_id,
      approval_status,
      reviewed_by,
      reviewed_at,
      notes
    ) VALUES (
      existing_user.id,
      pelsung_institution_id,
      'approved',
      resource_person_profile_id,
      NOW(),
      'Auto-migrated during Pelsung LMS system upgrade. Previously enrolled user granted active status.'
    ) ON CONFLICT (user_id, institution_id) DO UPDATE SET
      approval_status = 'approved',
      reviewed_by = resource_person_profile_id,
      reviewed_at = NOW(),
      notes = 'Auto-migrated during Pelsung LMS system upgrade. Previously enrolled user granted active status.';

    migrated_count := migrated_count + 1;
    approval_created_count := approval_created_count + 1;

    RAISE NOTICE 'Migrated user: % (ID: %)', existing_user.email, existing_user.id;
  END LOOP;

  -- ============================================================================
  -- HANDLE NON-ENROLLED EXISTING USERS
  -- ============================================================================

  -- For existing users without enrollments, set to pending status
  FOR existing_user IN
    SELECT p.id, p.email, p.full_name, p.role
    FROM profiles p
    WHERE p.account_status IS NULL OR p.account_status = 'pending'
    AND p.id NOT IN (SELECT DISTINCT user_id FROM enrollments)
    AND p.email != 'dipanpradhan.biz@gmail.com'
  LOOP
    -- Set to pending status
    UPDATE profiles
    SET
      account_status = 'pending',
      institution_id = pelsung_institution_id,
      updated_at = NOW()
    WHERE id = existing_user.id;

    -- Create pending approval record
    INSERT INTO user_approvals (
      user_id,
      institution_id,
      approval_status,
      notes
    ) VALUES (
      existing_user.id,
      pelsung_institution_id,
      'pending',
      'Existing user without enrollments. Pending registration form submission.'
    ) ON CONFLICT (user_id, institution_id) DO NOTHING;

    migrated_count := migrated_count + 1;

    RAISE NOTICE 'Set pending status for user: % (ID: %)', existing_user.email, existing_user.id;
  END LOOP;

  -- ============================================================================
  -- SYNC AUTH METADATA FOR ALL MIGRATED USERS
  -- ============================================================================

  -- Call the sync function to update auth metadata
  PERFORM sync_single_profile_to_auth_metadata(existing_user.id)
  FROM profiles existing_user
  WHERE existing_user.account_status IS NOT NULL;

  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'MIGRATION SUMMARY:';
  RAISE NOTICE 'Total users processed: %', migrated_count;
  RAISE NOTICE 'Users auto-approved (enrolled): %', approval_created_count;
  RAISE NOTICE 'Users set to pending (non-enrolled): %', migrated_count - approval_created_count;
  RAISE NOTICE 'Pelsung institution ID: %', pelsung_institution_id;
  RAISE NOTICE 'Resource person: dipanpradhan.biz@gmail.com (ID: %)', resource_person_profile_id;
  RAISE NOTICE '============================================================================';

END $$;

-- ============================================================================
-- BHUTANESE DZONGKHAGS DATA FOR REFERENCE
-- ============================================================================

-- Create a reference table with all 20 Bhutanese dzongkhags
CREATE TABLE IF NOT EXISTS bhutan_dzongkhags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  name_dzongkha VARCHAR(100),
  established_year INTEGER
);

-- Insert all 20 dzongkhags
INSERT INTO bhutan_dzongkhags (name, name_dzongkha, established_year) VALUES
('Bumthang', 'བུམ་ཐང་, 1987),
('Chukha', 'ཆུ་ཁ་, 1987),
('Dagana', 'སྡར་གན་ད་, 1987),
('Gasa', 'གས་ས་, 1987),
('Haa', 'ཧཱ་, 1987),
('Lhuentse', 'ལྷུན་ཙེ་, 1987),
('Mongar', 'མོང་སྒར་, 1987),
('Paro', 'སྤ་རོ་, 1987),
('Pema Gatshel', 'དཔལ་མགོན་སྐྱིད་སྲིང་, 1987),
('Punakha', 'སྤུ་ན་ཁ་, 1987),
('Samdrup Jongkhar', 'བསམ་གྲུབ་ལྗོངས་དཀར་, 1987),
('Samtse', 'བསམ་རྩེ་, 1987),
('Sarpang', 'གསར་སྤང་, 1987),
('Thimphu', 'ཐིམ་ཕུ་, 1987),
('Trashigang',བཀྲ་ཤིས་སྒང་, 1987),
('Trashiyangtse', 'བཀྲ་ཤིས་གཡང་རྩེ་, 1987),
('Trongsa', 'ཀྲོང་གསར་, 1987),
('Tsirang', 'རྩི་རང་, 1987),
('Wangdue Phodrang', 'དབང་འདུས་ཕོ་བྲང་, 1987),
('Zhemgang', 'གཞརམ་གང་, 1987)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- CREATE HELPER FUNCTIONS FOR REGISTRATION
-- ============================================================================

-- Function to get dzongkhag ID by name
CREATE OR REPLACE FUNCTION get_dzongkhag_id(dzongkhag_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  dzongkhag_id INTEGER;
BEGIN
  SELECT id INTO dzongkhag_id
  FROM bhutan_dzongkhags
  WHERE name = dzongkhag_name OR name_dzongkha = dzongkhag_name;

  RETURN dzongkhag_id;
END;
$$ LANGUAGE plpgsql;

-- Function to validate dzongkhag name
CREATE OR REPLACE FUNCTION validate_dzongkhag(dzongkhag_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM bhutan_dzongkhags
    WHERE name = dzongkhag_name OR name_dzongkha = dzongkhag_name
  ) INTO is_valid;

  RETURN is_valid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETED
-- ============================================================================
-- All existing users have been processed:
-- - Enrolled users: Auto-migrated to active status
-- - Non-enrolled users: Set to pending (need to complete registration)
-- - Pelsung institution: Configured as primary institution
-- - dipanpradhan.biz@gmail.com: Set as resource person with full access
-- - Auth metadata: Synced for instant middleware access
-- ============================================================================