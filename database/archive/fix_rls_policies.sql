-- Fix Row Level Security Policies for Admin Web Panel
-- Run this in your Supabase SQL Editor

-- Option 1: Disable RLS for books table (Simple solution for admin panel)
ALTER TABLE books DISABLE ROW LEVEL SECURITY;

-- Also disable RLS for any other related tables if they exist
ALTER TABLE IF EXISTS user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audio_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS favorites DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, create permissive policies
-- (Uncomment the lines below if you prefer this approach)

-- ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- -- Allow all operations for authenticated users
-- CREATE POLICY "Allow all operations for authenticated users" ON books
--   FOR ALL USING (true) WITH CHECK (true);

-- -- Allow all operations for anonymous users (for admin panel)
-- CREATE POLICY "Allow all operations for anonymous users" ON books
--   FOR ALL USING (true) WITH CHECK (true);

-- Also check storage bucket policies
-- Make sure the 'books' bucket allows public access

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'books';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'books';
