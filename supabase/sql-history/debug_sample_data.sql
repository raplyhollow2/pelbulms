-- Debug queries to check what's happening with the sample data

-- 1. Check if you have auth users
SELECT 'Auth users:' as query, id, email FROM auth.users;

-- 2. Check if profiles exist
SELECT 'Profiles:' as query, id, full_name, email, role FROM profiles;

-- 3. Check if institutions exist
SELECT 'Institutions:' as query, id, name, slug FROM institutions;

-- 4. Check if courses exist
SELECT 'Courses:' as query, id, title, slug, instructor_id FROM courses;

-- 5. Check if modules exist
SELECT 'Modules:' as query, id, title, course_id FROM modules;

-- 6. Check if lessons exist
SELECT 'Lessons:' as query, id, title, module_id FROM lessons;

-- 7. Check if quizzes exist
SELECT 'Quizzes:' as query, id, title, lesson_id FROM quizzes;