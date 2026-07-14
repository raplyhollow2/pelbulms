-- Create modules for the Web Development course
-- This fixes the missing modules issue

INSERT INTO modules (id, course_id, title, description, order_index, created_at, updated_at) VALUES
(
  '750e8400-e29b-41d4-a716-446655440001',
  '650e8400-e29b-41d4-a716-446655440001',
  'Module 1: HTML & CSS Fundamentals',
  'Master the building blocks of web development. Learn HTML5 semantic markup, CSS3 styling, responsive design principles, and modern layout techniques including Flexbox and Grid.',
  1,
  NOW(),
  NOW()
),
(
  '750e8400-e29b-41d4-a716-446655440002',
  '650e8400-e29b-41d4-a716-446655440001',
  'Module 2: JavaScript Essentials',
  'Deep dive into JavaScript programming. Learn variables, functions, arrays, objects, DOM manipulation, events, ES6+ features, and modern JavaScript development practices.',
  2,
  NOW(),
  NOW()
),
(
  '750e8400-e29b-41d4-a716-446655440003',
  '650e8400-e29b-41d4-a716-446655440001',
  'Module 3: React & Modern Frontend',
  'Master React framework fundamentals including components, state management, hooks, routing, and modern frontend development patterns. Build single-page applications with React.',
  3,
  NOW(),
  NOW()
),
(
  '750e8400-e29b-41d4-a716-446655440004',
  '650e8400-e29b-41d4-a716-446655440001',
  'Module 4: Next.js & Full Stack Development',
  'Learn Next.js framework, server-side rendering, API routes, authentication, database integration with Supabase, and deployment. Build full-stack web applications.',
  4,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create sample lessons for Module 1
INSERT INTO lessons (id, module_id, title, description, content, video_url, video_duration, order_index, is_preview, is_published, created_at, updated_at) VALUES
(
  '850e8400-e29b-41d4-a716-446655440001',
  '750e8400-e29b-41d4-a716-446655440001',
  'Introduction to HTML',
  'Learn the basics of HTML5, document structure, semantic elements, and best practices for creating well-structured web pages.',
  'In this comprehensive introduction to HTML5, you will learn the fundamental building blocks of web development. We cover document structure, semantic elements, and industry best practices for creating clean, accessible web pages.',
  'https://www.youtube.com/watch?v=qz0aGYrrlhU',
  2700,
  1,
  true,
  true,
  NOW(),
  NOW()
),
(
  '850e8400-e29b-41d4-a716-446655440002',
  '750e8400-e29b-41d4-a716-446655440001',
  'CSS Fundamentals & Styling',
  'Master CSS selectors, properties, the box model, typography, colors, and basic styling techniques for creating beautiful web pages.',
  'Deep dive into CSS fundamentals including selectors, properties, the box model, typography, colors, and essential styling techniques. Learn to create beautiful, responsive web pages.',
  'https://www.youtube.com/watch?v=1Rs2ND1ryYc',
  3600,
  2,
  true,
  true,
  NOW(),
  NOW()
),
(
  '850e8400-e29b-41d4-a716-446655440003',
  '750e8400-e29b-41d4-a716-446655440001',
  'Responsive Design with Flexbox & Grid',
  'Learn modern CSS layout techniques with Flexbox and CSS Grid. Create responsive designs that work perfectly on all devices.',
  'Master modern CSS layout techniques with Flexbox and CSS Grid. Learn to create responsive designs that work perfectly on all devices, from mobile phones to desktop computers.',
  'https://www.youtube.com/watch?v=3yw0JAcZEqM',
  4500,
  3,
  false,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

SELECT 'Modules and lessons created successfully!' as result;