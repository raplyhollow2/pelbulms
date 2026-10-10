-- ============================================================
-- SAMPLE QUIZ DATA
-- ============================================================
-- This migration creates sample quizzes for testing the quiz system

-- First, let's get a lesson ID to attach the quiz to
-- For this example, we'll assume you have lessons in your database

-- Sample Quiz 1: Introduction to Programming
DO $$
DECLARE
    sample_lesson_id UUID;
    sample_quiz_id UUID;
BEGIN
    -- Get the first lesson ID (adjust this logic based on your actual data)
    SELECT id INTO sample_lesson_id FROM lessons LIMIT 1;

    IF sample_lesson_id IS NOT NULL THEN
        -- Create sample quiz
        INSERT INTO quizzes (
            id,
            lesson_id,
            title,
            description,
            time_limit_minutes,
            passing_score,
            max_attempts,
            is_published
        ) VALUES (
            gen_random_uuid(),
            sample_lesson_id,
            'Introduction to Programming Quiz',
            'Test your knowledge of basic programming concepts',
            15,
            70,
            3,
            true
        ) RETURNING id INTO sample_quiz_id;

        -- Add multiple choice questions
        INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, order_index, points) VALUES
            (sample_quiz_id, 'What does HTML stand for?', 'multiple_choice',
             '[{"text": "Hyper Text Markup Language", "is_correct": true}, {"text": "High Tech Modern Language", "is_correct": false}, {"text": "Hyperlinks and Text Markup Language", "is_correct": false}, {"text": "Home Tool Markup Language", "is_correct": false}]',
             'Hyper Text Markup Language', 'HTML is the standard markup language for creating web pages.', 1, 2),

            (sample_quiz_id, 'Which of the following are programming languages?', 'multiple_choice',
             '[{"text": "JavaScript", "is_correct": true}, {"text": "Python", "is_correct": true}, {"text": "HTML", "is_correct": false}, {"text": "CSS", "is_correct": false}]',
             'JavaScript,Python', 'JavaScript and Python are programming languages, while HTML and CSS are markup/styling languages.', 2, 3),

            (sample_quiz_id, 'A variable can store different types of data.', 'true_false',
             NULL, 'true', 'Variables can store numbers, strings, booleans, and other data types.', 3, 1),

            (sample_quiz_id, 'What is the correct way to declare a variable in JavaScript?', 'multiple_choice',
             '[{"text": "var myVariable = 5;", "is_correct": true}, {"text": "variable myVariable = 5;", "is_correct": false}, {"text": "v myVariable = 5;", "is_correct": false}, {"text": "declare myVariable = 5;", "is_correct": false}]',
             'var myVariable = 5;', 'The var keyword is used to declare variables in JavaScript (though let and const are preferred in modern JS).', 4, 2);

        RAISE NOTICE 'Sample quiz created successfully for lesson: %', sample_lesson_id;
    ELSE
        RAISE NOTICE 'No lessons found in database. Please create lessons first.';
    END IF;
END $$;

-- Sample Quiz 2: Web Development Basics
DO $$
DECLARE
    sample_lesson_id UUID;
    sample_quiz_id UUID;
BEGIN
    -- Get a different lesson (second one if exists)
    SELECT id INTO sample_lesson_id FROM lessons OFFSET 1 LIMIT 1;

    IF sample_lesson_id IS NOT NULL THEN
        -- Create sample quiz
        INSERT INTO quizzes (
            id,
            lesson_id,
            title,
            description,
            time_limit_minutes,
            passing_score,
            max_attempts,
            is_published
        ) VALUES (
            gen_random_uuid(),
            sample_lesson_id,
            'Web Development Fundamentals',
            'Basic web development concepts quiz',
            20,
            75,
            3,
            true
        ) RETURNING id INTO sample_quiz_id;

        -- Add questions
        INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, order_index, points) VALUES
            (sample_quiz_id, 'What is the purpose of CSS?', 'multiple_choice',
             '[{"text": "To structure web pages", "is_correct": false}, {"text": "To style web pages", "is_correct": true}, {"text": "To add interactivity", "is_correct": false}, {"text": "To create databases", "is_correct": false}]',
             'To style web pages', 'CSS (Cascading Style Sheets) is used to style and layout web pages.', 1, 2),

            (sample_quiz_id, 'JavaScript is only used in web browsers.', 'true_false',
             NULL, 'false', 'JavaScript can also be used on servers (Node.js), in mobile apps, and many other environments.', 2, 1),

            (sample_quiz_id, 'Explain the difference between GET and POST requests.', 'short_answer',
             NULL, NULL, 'GET requests retrieve data from the server, while POST requests send data to the server.', 3, 5);

        RAISE NOTICE 'Sample quiz 2 created successfully for lesson: %', sample_lesson_id;
    ELSE
        RAISE NOTICE 'Only one lesson found in database.';
    END IF;
END $$;

-- Verification
SELECT
    q.title as quiz_title,
    q.description,
    qq.question_text,
    qq.question_type,
    qq.points
FROM quizzes q
LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
WHERE q.is_published = true
ORDER BY q.title, qq.order_index;

SELECT 'Sample quiz data created successfully!' as result;