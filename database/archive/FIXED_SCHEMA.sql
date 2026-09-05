-- 🔧 FIXED DATABASE SCHEMA - Run this to fix all issues

-- Drop existing tables if they have issues (optional - only if you have problems)
-- DROP TABLE IF EXISTS downloads CASCADE;
-- DROP TABLE IF EXISTS progress CASCADE;

-- Create downloads table (simplified - no created_at column)
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  UNIQUE(user_id, book_id)
);

-- Create progress table (simplified - no updated_at column)
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  current_page INTEGER DEFAULT 1,
  total_pages INTEGER,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  UNIQUE(user_id, book_id)
);

-- Create favorites table (if not exists)
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Enable RLS on all tables
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY "Users can manage own downloads" ON downloads
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own progress" ON progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- Clean up any duplicate progress entries (run this if you have duplicate key errors)
DELETE FROM progress 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM progress 
  GROUP BY user_id, book_id
);

-- Clean up any duplicate download entries
DELETE FROM downloads 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM downloads 
  GROUP BY user_id, book_id
);

-- Clean up any duplicate favorites entries
DELETE FROM favorites 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM favorites 
  GROUP BY user_id, book_id
);
