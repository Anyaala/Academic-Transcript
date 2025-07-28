-- Create institutions table
CREATE TABLE public.institutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transcripts table
CREATE TABLE public.transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  blockchain_tx TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verification_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Create policies for institutions
CREATE POLICY "Institutions can view their own data" 
ON public.institutions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Institutions can create their own profile" 
ON public.institutions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Institutions can update their own data" 
ON public.institutions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policies for students
CREATE POLICY "Students can view their own data" 
ON public.students 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Students can create their own profile" 
ON public.students 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update their own data" 
ON public.students 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Institutions can view students in their institution" 
ON public.students 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.institutions 
    WHERE institutions.id = students.institution_id 
    AND institutions.user_id = auth.uid()
  )
);

-- Create policies for transcripts
CREATE POLICY "Students can view their own transcripts" 
ON public.transcripts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = transcripts.student_id 
    AND students.user_id = auth.uid()
  )
);

CREATE POLICY "Institutions can view transcripts for their students" 
ON public.transcripts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.students 
    JOIN public.institutions ON institutions.id = students.institution_id
    WHERE students.id = transcripts.student_id 
    AND institutions.user_id = auth.uid()
  )
);

CREATE POLICY "Institutions can create transcripts for their students" 
ON public.transcripts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students 
    JOIN public.institutions ON institutions.id = students.institution_id
    WHERE students.id = transcripts.student_id 
    AND institutions.user_id = auth.uid()
  )
);

CREATE POLICY "Institutions can update transcripts for their students" 
ON public.transcripts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.students 
    JOIN public.institutions ON institutions.id = students.institution_id
    WHERE students.id = transcripts.student_id 
    AND institutions.user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transcripts_updated_at
  BEFORE UPDATE ON public.transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();