-- Add verification_count and verification_limit fields to students table
ALTER TABLE students 
ADD COLUMN verification_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN verification_limit INTEGER DEFAULT 5 NOT NULL;

-- Add index for better performance
CREATE INDEX idx_students_verification_count ON students(verification_count);

-- Create a table to track verification attempts for auditing
CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  verification_id TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for verification_attempts
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Allow students to read their own verification attempts
CREATE POLICY "Students can view own verification attempts" ON verification_attempts
FOR SELECT USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Allow institutions to view verification attempts for their students
CREATE POLICY "Institutions can view student verification attempts" ON verification_attempts
FOR SELECT USING (
  student_id IN (
    SELECT s.id FROM students s
    JOIN institutions i ON s.institution_id = i.id
    WHERE i.user_id = auth.uid()
  )
);

-- Allow system to insert verification attempts
CREATE POLICY "System can insert verification attempts" ON verification_attempts
FOR INSERT WITH CHECK (true);

-- Add index for better performance
CREATE INDEX idx_verification_attempts_student_id ON verification_attempts(student_id);
CREATE INDEX idx_verification_attempts_attempted_at ON verification_attempts(attempted_at);
