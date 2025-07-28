-- Add verification_count and verification_limit columns to students table
DO $$ 
BEGIN
    -- Add verification_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'verification_count') THEN
        ALTER TABLE students ADD COLUMN verification_count INTEGER DEFAULT 0 NOT NULL;
    END IF;
    
    -- Add verification_limit column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'verification_limit') THEN
        ALTER TABLE students ADD COLUMN verification_limit INTEGER DEFAULT 5 NOT NULL;
    END IF;
END $$;

-- Create verification_attempts table if it doesn't exist
CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  verification_id TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Add policies if they don't exist
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Students can view own verification attempts" ON verification_attempts;
    DROP POLICY IF EXISTS "Institutions can view student verification attempts" ON verification_attempts;
    DROP POLICY IF EXISTS "System can insert verification attempts" ON verification_attempts;
    
    -- Create new policies
    CREATE POLICY "Students can view own verification attempts" ON verification_attempts
    FOR SELECT USING (
      student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    );

    CREATE POLICY "Institutions can view student verification attempts" ON verification_attempts
    FOR SELECT USING (
      student_id IN (
        SELECT s.id FROM students s
        JOIN institutions i ON s.institution_id = i.id
        WHERE i.user_id = auth.uid()
      )
    );

    CREATE POLICY "System can insert verification attempts" ON verification_attempts
    FOR INSERT WITH CHECK (true);
END $$;
