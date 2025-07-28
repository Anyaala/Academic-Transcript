-- Add verification columns to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS verification_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS verification_limit INTEGER DEFAULT 5 NOT NULL;

-- Create verification_attempts table
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

-- Enable RLS on verification_attempts
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Enable all access for verification_attempts" ON verification_attempts;
CREATE POLICY "Enable all access for verification_attempts" 
ON verification_attempts FOR ALL USING (true);

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name IN ('verification_count', 'verification_limit');
