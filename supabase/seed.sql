-- Local sign-in only. This user does not exist on the hosted project.
-- Email: local-admin@rigbu.test
-- Password: RigbuLocalAdmin!1

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'local-admin@rigbu.test',
  extensions.crypt('RigbuLocalAdmin!1', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"superadmin","account_status":"active"}'::jsonb,
  '{"full_name":"Local Admin"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"local-admin@rigbu.test"}'::jsonb,
  'email',
  '00000000-0000-0000-0000-000000000001',
  now(),
  now(),
  now()
);

UPDATE public.profiles
SET
  role = 'superadmin',
  account_status = 'active',
  full_name = 'Local Admin'
WHERE id = '00000000-0000-0000-0000-000000000001';
