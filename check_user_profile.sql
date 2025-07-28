-- Check if user exists in students table
SELECT 'student' as user_type, id, full_name, email, institution_id, created_at 
FROM students 
WHERE user_id = '7336c784-f2ac-42e1-ab80-d9b7938b388b'

UNION ALL

-- Check if user exists in institutions table  
SELECT 'institution' as user_type, id, name as full_name, email, null as institution_id, created_at
FROM institutions 
WHERE user_id = '7336c784-f2ac-42e1-ab80-d9b7938b388b';
