-- ============================================================
-- MAKE raplyhollow2@gmail.com A SUPERUSER/ADMIN
-- ============================================================

DO $$
DECLARE
  user_id_to_set UUID;
BEGIN
  -- Find the user ID for this email
  SELECT id INTO user_id_to_set
  FROM auth.users
  WHERE email = 'raplyhollow2@gmail.com';

  IF user_id_to_set IS NULL THEN
    RAISE EXCEPTION 'User with email raplyhollow2@gmail.com not found in auth.users';
  END IF;

  RAISE NOTICE 'Found user ID: %', user_id_to_set;

  -- Update or insert profile with admin role
  INSERT INTO profiles (id, email, full_name, role, avatar_url)
  VALUES (
    user_id_to_set,
    'raplyhollow2@gmail.com',
    'Super Admin',
    'admin',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = 'raplyhollow2@gmail.com',
    role = 'admin',
    full_name = 'Super Admin',
    updated_at = NOW();

  RAISE NOTICE 'User raplyhollow2@gmail.com is now set as admin/superuser';

END $$;

-- Verify the admin status
SELECT
  '✅ SUPERUSER STATUS CONFIRMED' as result,
  u.id,
  u.email,
  p.full_name,
  p.role,
  u.created_at,
  u.last_sign_in_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'raplyhollow2@gmail.com';

-- Show what admin access means
SELECT
  'As an admin, you now have:' as capability_description
UNION ALL
SELECT '✅ Full access to all courses (create, read, update, delete)'
UNION ALL
SELECT '✅ Full access to all modules and lessons'
UNION ALL
SELECT '✅ Full access to user management'
UNION ALL
SELECT '✅ Full access to all enrollments and progress'
UNION ALL
SELECT '✅ Ability to manage other instructors'
UNION ALL
SELECT '✅ System-wide permissions for all tables';

-- Test admin access by showing all courses
SELECT
  'All courses in system (admin view):' as info,
  c.id,
  c.title,
  c.instructor_id,
  u.email as current_instructor_email
FROM courses c
LEFT JOIN auth.users u ON c.instructor_id = u.id
ORDER BY c.created_at DESC;

SELECT '🎉 raplyhollow2@gmail.com is now a SUPERUSER/ADMIN!' as final_result;