-- ============================================================
-- SET dipanpradhan.biz@gmail.com AS TEACHER/INSTRUCTOR
-- ============================================================

DO $$
DECLARE
  user_id_to_set UUID;
BEGIN
  -- Find the user ID for this email
  SELECT id INTO user_id_to_set
  FROM auth.users
  WHERE email = 'dipanpradhan.biz@gmail.com';

  IF user_id_to_set IS NULL THEN
    RAISE EXCEPTION 'User with email dipanpradhan.biz@gmail.com not found in auth.users';
  END IF;

  RAISE NOTICE 'Found user ID: %', user_id_to_set;

  -- Update or insert profile with instructor role
  INSERT INTO profiles (id, email, full_name, role, avatar_url)
  VALUES (
    user_id_to_set,
    'dipanpradhan.biz@gmail.com',
    'Dipan Pradhan',
    'instructor',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=dipan'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = 'dipanpradhan.biz@gmail.com',
    role = 'instructor',
    full_name = 'Dipan Pradhan',
    updated_at = NOW();

  RAISE NOTICE 'User dipanpradhan.biz@gmail.com is now set as instructor';

END $$;

-- Verify the instructor status
SELECT
  '✅ INSTRUCTOR STATUS CONFIRMED' as result,
  u.id,
  u.email,
  p.full_name,
  p.role,
  u.created_at,
  u.last_sign_in_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'dipanpradhan.biz@gmail.com';

-- Show what instructor access means
SELECT
  'As an instructor, you now have:' as capability_description
UNION ALL
SELECT '✅ Create and manage your own courses'
UNION ALL
SELECT '✅ Create and manage lessons in your courses'
UNION ALL
SELECT '✅ View enrolled students and progress'
UNION ALL
SELECT '✅ Manage course content and materials'
UNION ALL
SELECT '✅ Access instructor dashboard features';

-- Create a sample course for this instructor if none exist
DO $$
DECLARE
  instructor_user_id UUID;
  course_count INT;
BEGIN
  -- Get the instructor user ID
  SELECT id INTO instructor_user_id
  FROM auth.users
  WHERE email = 'dipanpradhan.biz@gmail.com';

  -- Check if instructor has any courses
  SELECT COUNT(*) INTO course_count
  FROM courses
  WHERE instructor_id = instructor_user_id;

  IF course_count = 0 THEN
    -- Create a sample course
    INSERT INTO courses (
      id,
      title,
      slug,
      description,
      category,
      level,
      price,
      instructor_id,
      is_published,
      thumbnail_url,
      language
    ) VALUES (
      gen_random_uuid(),
      'Getting Started with Your First Course',
      'getting-started-with-your-first-course',
      'Welcome! This is your first course. You can edit this or create new courses from your instructor dashboard.',
      'General',
      'beginner',
      0,
      instructor_user_id,
      true,
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
      'en'
    );

    RAISE NOTICE 'Created sample course for instructor';
  END IF;

END $$;

-- Show instructor's courses
SELECT
  'Instructor courses:' as info,
  c.id,
  c.title,
  c.is_published,
  c.created_at
FROM courses c
WHERE c.instructor_id = (
  SELECT id FROM auth.users WHERE email = 'dipanpradhan.biz@gmail.com'
);

SELECT '🎉 dipanpradhan.biz@gmail.com is now set up as an INSTRUCTOR/TEACHER!' as final_result;