-- Database Schema Check for Kayd Books App
-- Run this in your Supabase SQL editor to check the current schema

-- Check if books table exists and show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'books' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if audio_progress table exists and show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audio_progress' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if favorites table exists and show its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'favorites' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show all tables in the public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check storage buckets (if you have access to storage schema)
SELECT name, public 
FROM storage.buckets 
ORDER BY name;
