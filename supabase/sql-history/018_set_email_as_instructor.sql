-- ============================================================
-- SET raplyhollow2@gmail.com AS INSTRUCTOR FOR ALL COURSES
-- ============================================================

-- First, let's find your user ID
DO $$
DECLARE
  user_id_to_set UUID;
  current_instructor UUID;
  course_count INT;
BEGIN
  -- Find the user ID for this email
  SELECT id INTO user_id_to_set
  FROM auth.users
  WHERE email = 'raplyhollow2@gmail.com';

  IF user_id_to_set IS NULL THEN
    RAISE EXCEPTION 'User with email raplyhollow2@gmail.com not found in auth.users';
  END IF;

  RAISE NOTICE 'Found user ID: %', user_id_to_set;

  -- Check if profile exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id_to_set) THEN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (user_id_to_set, 'raplyhollow2@gmail.com', 'Instructor', 'instructor');
    RAISE NOTICE 'Created profile for user';
  ELSE
    -- Update existing profile to ensure instructor role and email
    UPDATE profiles
    SET email = 'raplyhollow2@gmail.com',
        role = 'instructor'
    WHERE id = user_id_to_set;
    RAISE NOTICE 'Updated profile to instructor role';
  END IF;

  -- Update ALL courses to set you as instructor
  UPDATE courses
  SET instructor_id = user_id_to_set
  WHERE instructor_id != user_id_to_set OR instructor_id IS NULL;

  GET DIAGNOSTICS course_count = ROW_COUNT;
  RAISE NOTICE 'Updated % courses to set you as instructor', course_count;

END $$;

-- Final verification
SELECT
  c.id,
  c.title,
  c.instructor_id,
  p.email as instructor_email,
  p.role,
  CASE
    WHEN p.email = 'raplyhollow2@gmail.com' THEN '✅ CONFIRMED - You own this course'
    ELSE '❌ ISSUE - Not your course'
  END as status
FROM courses c
LEFT JOIN auth.users p ON c.instructor_id = p.id
ORDER BY c.created_at DESC
LIMIT 10;

SELECT 'raplyhollow2@gmail.com is now the instructor for all courses!' as final_result;