-- Sample Data for Pelbu LMS Testing
-- This file contains production-ready sample data for testing the course catalog and enrollment functionality

-- IMPORTANT: First, we need to create sample instructor profiles that reference your actual auth user
-- This script will automatically use your existing authenticated user to create instructor profiles and courses

-- Sample Institution (this doesn't depend on auth users)
INSERT INTO institutions (id, name, slug, domain, logo_url, description, settings, created_at, updated_at) VALUES
(
  '550e8400-e29b-41d4-a716-446655440000',
  'Pelsung Bhutan',
  'pelsung-bhutan',
  'pelbu.bt',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Pelbu',
  'Leading educational institution in Bhutan providing world-class learning management and digital education solutions.',
  '{"theme": "bhutan", "features": ["lms", "analytics", "certifications"], "max_students": 1000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create a temporary function to handle profile creation with proper auth user references
-- This function will create profiles only if the corresponding auth user exists
CREATE OR REPLACE FUNCTION create_sample_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the first authenticated user (you, since you're logged in)
  SELECT id INTO current_user_id
  FROM auth.users
  LIMIT 1;

  -- Only proceed if we have a real user
  IF current_user_id IS NOT NULL THEN
    -- Update or create profile for the current user as an instructor
    INSERT INTO profiles (id, full_name, email, role, bio, avatar_url, institution_id, created_at, updated_at)
    VALUES (
      current_user_id,
      'Dr. Pema Wangchuk',
      'pema.wangchuk@pelbu.bt',
      'instructor',
      'Ph.D. in Computer Science with 15+ years of teaching experience. Specialized in web development, mobile apps, and AI integration. Passionate about practical, hands-on learning.',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Pema',
      '550e8400-e29b-41d4-a716-446655440000',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'instructor',
      full_name = 'Dr. Pema Wangchuk',
      bio = 'Ph.D. in Computer Science with 15+ years of teaching experience. Specialized in web development, mobile apps, and AI integration. Passionate about practical, hands-on learning.',
      avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pema',
      institution_id = '550e8400-e29b-41d4-a716-446655440000',
      updated_at = NOW();

    RAISE NOTICE 'Sample instructor profile created for user: %', current_user_id;
  ELSE
    RAISE NOTICE 'No authenticated users found. Please create at least one user via authentication first.';
  END IF;
END;
$$;

-- Execute the function to create sample profiles
SELECT create_sample_profiles();

-- Clean up the function
DROP FUNCTION create_sample_profiles();

-- Get the actual user ID for courses
-- We'll create a function that automatically assigns courses to existing instructors
CREATE OR REPLACE FUNCTION create_sample_courses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  instructor_id UUID;
BEGIN
  -- Get the first instructor profile
  SELECT id INTO instructor_id
  FROM profiles
  WHERE role = 'instructor'
  LIMIT 1;

  -- Only proceed if we have an instructor
  IF instructor_id IS NOT NULL THEN
    -- Sample Courses with real instructor ID
    INSERT INTO courses (id, title, slug, description, instructor_id, category, level, price, currency, duration_minutes, is_published, is_featured, thumbnail_url, tags, requirements, learning_objectives, target_audience, language, created_at, updated_at) VALUES
    (
      '650e8400-e29b-41d4-a716-446655440001',
      'Complete Web Development Bootcamp 2025',
      'complete-web-development-bootcamp-2025',
      'Master modern web development from scratch. Learn HTML, CSS, JavaScript, React, Next.js, and Supabase. Build real-world projects including e-commerce sites, dashboards, and progressive web apps. Perfect for beginners and intermediate developers looking to upgrade their skills.',
      instructor_id,
      'Web Development',
      'beginner',
      49.99,
      'USD',
      2400,
      true,
      true,
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop',
      ARRAY['Web Development', 'React', 'Next.js', 'JavaScript', 'Full Stack'],
      ARRAY['Basic computer literacy', 'No prior coding experience needed', 'Laptop or computer with internet access'],
      ARRAY['Build responsive websites from scratch', 'Master React and Next.js frameworks', 'Create progressive web apps', 'Deploy applications to production', 'Understand modern web development best practices'],
      ARRAY['Beginners', 'Career changers', 'Students', 'Hobbyists'],
      'en',
      NOW(),
      NOW()
    ),
    (
      '650e8400-e29b-41d4-a716-446655440002',
      'Data Science & Machine Learning with Python',
      'data-science-machine-learning-python',
      'Learn data science fundamentals, Python programming, statistical analysis, machine learning algorithms, and AI integration. Work with real datasets and build predictive models. Includes hands-on projects with Pandas, NumPy, Scikit-learn, and TensorFlow.',
      instructor_id,
      'Data Science',
      'intermediate',
      79.99,
      'USD',
      3600,
      true,
      false,
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      ARRAY['Data Science', 'Python', 'Machine Learning', 'AI', 'Statistics'],
      ARRAY['Basic Python knowledge', 'Understanding of basic math concepts', 'Computer with 8GB+ RAM'],
      ARRAY['Master data analysis with Python', 'Build machine learning models', 'Understand statistical concepts', 'Create data visualizations', 'Apply AI to real-world problems'],
      ARRAY['Python developers', 'Data analysts', 'Researchers', 'Students'],
      'en',
      NOW(),
      NOW()
    ),
    (
      '650e8400-e29b-41d4-a716-446655440003',
      'Digital Marketing Masterclass: SEO to Social Media',
      'digital-marketing-masterclass-seo-social-media',
      'Complete digital marketing training covering SEO, social media marketing, content marketing, email marketing, Google Ads, and analytics. Learn to create effective marketing strategies and measure ROI. Perfect for entrepreneurs and marketing professionals.',
      instructor_id,
      'Digital Marketing',
      'beginner',
      39.99,
      'USD',
      1800,
      true,
      false,
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
      ARRAY['Digital Marketing', 'SEO', 'Social Media', 'Google Ads', 'Analytics'],
      ARRAY['Basic computer skills', 'Interest in marketing', 'No prior marketing experience needed'],
      ARRAY['Master SEO techniques', 'Run effective social media campaigns', 'Understand Google Ads', 'Analyze marketing metrics', 'Create content strategies'],
      ARRAY['Entrepreneurs', 'Marketing professionals', 'Small business owners'],
      'en',
      NOW(),
      NOW()
    ),
    (
      '650e8400-e29b-41d4-a716-446655440004',
      'UI/UX Design Fundamentals with Figma',
      'ui-ux-design-fundamentals-figma',
      'Learn user interface and user experience design from scratch. Master Figma, design thinking, prototyping, and user research. Create professional mobile app interfaces and web designs. Understand design principles, color theory, and typography.',
      instructor_id,
      'Design',
      'beginner',
      44.99,
      'USD',
      2100,
      true,
      false,
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop',
      ARRAY['UI Design', 'UX Design', 'Figma', 'Prototyping', 'User Research'],
      ARRAY['No design experience needed', 'Computer with internet access', 'Creative mindset'],
      ARRAY['Master Figma design tools', 'Understand UX principles', 'Create professional interfaces', 'Conduct user research', 'Build interactive prototypes'],
      ARRAY['Aspiring designers', 'Product managers', 'Developers'],
      'en',
      NOW(),
      NOW()
    ),
    (
      '650e8400-e29b-41d4-a716-446655440005',
      'Cloud Computing & DevOps with AWS',
      'cloud-computing-devops-aws',
      'Master cloud infrastructure, AWS services, Docker, Kubernetes, CI/CD pipelines, and infrastructure as code. Learn to build scalable, reliable cloud systems. Includes hands-on labs and real-world deployment scenarios.',
      instructor_id,
      'Cloud Computing',
      'advanced',
      89.99,
      'USD',
      3200,
      true,
      false,
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop',
      ARRAY['Cloud Computing', 'AWS', 'DevOps', 'Docker', 'Kubernetes'],
      ARRAY['Basic Linux knowledge', 'Understanding of networking concepts', 'Some programming experience'],
      ARRAY['Deploy applications to AWS', 'Set up CI/CD pipelines', 'Master Docker and Kubernetes', 'Implement infrastructure as code', 'Monitor and optimize cloud systems'],
      ARRAY['System administrators', 'DevOps engineers', 'Backend developers'],
      'en',
      NOW(),
      NOW()
    ),
    (
      '650e8400-e29b-41d4-a716-446655440006',
      'Mobile App Development with React Native',
      'mobile-app-development-react-native',
      'Build cross-platform mobile applications using React Native. Learn to create iOS and Android apps simultaneously, work with device APIs, implement navigation, state management, and push notifications. Build real apps including a social media app and e-commerce app.',
      instructor_id,
      'Mobile Development',
      'intermediate',
      69.99,
      'USD',
      2800,
      true,
      false,
      'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop',
      ARRAY['Mobile Development', 'React Native', 'iOS', 'Android', 'JavaScript'],
      ARRAY['React.js knowledge', 'JavaScript fundamentals', 'Understanding of mobile app concepts'],
      ARRAY['Build cross-platform mobile apps', 'Master React Native framework', 'Implement navigation and state', 'Work with device APIs', 'Deploy to App Store and Play Store'],
      ARRAY['React developers', 'Mobile app developers', 'Full-stack developers'],
      'en',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Sample courses created for instructor: %', instructor_id;
  ELSE
    RAISE NOTICE 'No instructor profile found. Please create at least one instructor profile first.';
  END IF;
END;
$$;

-- Execute the function to create sample courses
SELECT create_sample_courses();

-- Clean up the function
DROP FUNCTION create_sample_courses();

-- Sample Modules for Web Development Course
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

-- Sample Lessons for Module 1
INSERT INTO lessons (id, module_id, title, description, content, video_url, video_duration, order_index, is_preview, is_published, created_at, updated_at) VALUES
(
  '850e8400-e29b-41d4-a716-446655440001',
  '750e8400-e29b-41d4-a716-446655440001',
  'Introduction to HTML',
  'Learn the basics of HTML5, document structure, semantic elements, and best practices for creating well-structured web pages.',
  'In this comprehensive introduction to HTML5, you will learn the fundamental building blocks of web development. We cover document structure, semantic elements, and industry best practices for creating clean, accessible web pages.',
  'https://www.youtube.com/watch?v=qz0aGYrrlhU',
  2700, -- 45 minutes in seconds
  1,
  true, -- Free preview
  true, -- Published
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
  3600, -- 60 minutes in seconds
  2,
  true, -- Free preview
  true, -- Published
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
  4500, -- 75 minutes in seconds
  3,
  false, -- Not a preview (requires enrollment)
  true, -- Published
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Sample Quizzes for Assessment
INSERT INTO quizzes (id, lesson_id, title, description, time_limit_minutes, passing_score, max_attempts, is_published, created_at, updated_at) VALUES
(
  '950e8400-e29b-41d4-a716-446655440001',
  '850e8400-e29b-41d4-a716-446655440001',
  'HTML & CSS Fundamentals Quiz',
  'Test your knowledge of HTML5 and CSS3 fundamentals including semantic markup, styling, responsive design, and modern layout techniques.',
  30,
  70,
  3,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Sample Quiz Questions
INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, points, order_index, explanation, created_at, updated_at) VALUES
(
  'a50e8400-e29b-41d4-a716-446655440001',
  '950e8400-e29b-41d4-a716-446655440001',
  'Which HTML5 element is used to specify the main content of a document?',
  'multiple_choice',
  '[{"text": "<main>", "is_correct": true}, {"text": "<primary>", "is_correct": false}, {"text": "<content>", "is_correct": false}, {"text": "<section>", "is_correct": false}]'::jsonb,
  '<main>',
  5,
  1,
  'The <main> element specifies the main content of a document. It should be unique per page and exclude content that is repeated across documents like headers, footers, and navigation.',
  NOW(),
  NOW()
),
(
  'a50e8400-e29b-41d4-a716-446655440002',
  '950e8400-e29b-41d4-a716-446655440001',
  'Which CSS property is used to create flexible box layouts?',
  'multiple_choice',
  '[{"text": "display: grid", "is_correct": false}, {"text": "display: flex", "is_correct": true}, {"text": "display: block", "is_correct": false}, {"text": "display: inline", "is_correct": false}]'::jsonb,
  'display: flex',
  5,
  2,
  'The display: flex property enables flexbox layout, which provides a more efficient way to lay out, align, and distribute space among items in a container.',
  NOW(),
  NOW()
),
(
  'a50e8400-e29b-41d4-a716-446655440003',
  '950e8400-e29b-41d4-a716-446655440001',
  'What does CSS Grid provide that Flexbox does not?',
  'multiple_choice',
  '[{"text": "Two-dimensional layout control", "is_correct": true}, {"text": "Mobile responsiveness", "is_correct": false}, {"text": "Animation capabilities", "is_correct": false}, {"text": "Text styling", "is_correct": false}]'::jsonb,
  'Two-dimensional layout control',
  5,
  3,
  'CSS Grid is a two-dimensional layout system that handles both columns and rows, while Flexbox is primarily a one-dimensional layout system that handles either columns OR rows.',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;