-- Fix RLS policies for quiz_attempts table
-- Allow users to submit quiz attempts and view their own attempts

-- Enable RLS
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Users can update their own quiz attempts" ON quiz_attempts;

-- Create policy for inserting quiz attempts
CREATE POLICY "Users can insert their own quiz attempts"
ON quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for selecting quiz attempts
CREATE POLICY "Users can view their own quiz attempts"
ON quiz_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for updating quiz attempts
CREATE POLICY "Users can update their own quiz attempts"
ON quiz_attempts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);