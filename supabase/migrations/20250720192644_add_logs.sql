-- Make user_id nullable in students table since students may not have accounts yet
ALTER TABLE public.students ALTER COLUMN user_id DROP NOT NULL;