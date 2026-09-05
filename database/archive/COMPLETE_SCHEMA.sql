-- 🚀 COMPLETE DATABASE SCHEMA - Settings, Goals, and Statistics

-- Create profiles table for user settings
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  theme_mode TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'English',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reading goals table
CREATE TABLE IF NOT EXISTS reading_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_minutes INTEGER DEFAULT 30,
  monthly_books INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create reading sessions table for time tracking
CREATE TABLE IF NOT EXISTS reading_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id, date)
);

-- Create downloads table (simplified)
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  UNIQUE(user_id, book_id)
);

-- Create progress table (simplified)
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  current_page INTEGER DEFAULT 1,
  total_pages INTEGER,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for reading_goals
CREATE POLICY "Users can manage own reading goals" ON reading_goals
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for reading_sessions
CREATE POLICY "Users can manage own reading sessions" ON reading_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for downloads
CREATE POLICY "Users can manage own downloads" ON downloads
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for progress
CREATE POLICY "Users can manage own progress" ON progress
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for favorites
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_reading_goals_user_id ON reading_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_date ON reading_sessions(date);
CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_percentage ON progress(progress_percentage);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up any existing duplicate entries
-- For profiles table (UUID primary key)
DELETE FROM profiles a USING profiles b 
WHERE a.id = b.id AND a.ctid < b.ctid;

-- For reading_goals table (UUID primary key, unique constraint on user_id)
DELETE FROM reading_goals a USING reading_goals b 
WHERE a.user_id = b.user_id AND a.id != b.id AND a.created_at < b.created_at;

-- For reading_sessions table (unique constraint on user_id, book_id, date)
DELETE FROM reading_sessions a USING reading_sessions b 
WHERE a.user_id = b.user_id AND a.book_id = b.book_id AND a.date = b.date 
AND a.id != b.id AND a.created_at < b.created_at;

-- For downloads table (unique constraint on user_id, book_id)
DELETE FROM downloads a USING downloads b 
WHERE a.user_id = b.user_id AND a.book_id = b.book_id 
AND a.id != b.id AND a.id < b.id;

-- For progress table (unique constraint on user_id, book_id)
DELETE FROM progress a USING progress b 
WHERE a.user_id = b.user_id AND a.book_id = b.book_id 
AND a.id != b.id AND a.id < b.id;

-- For favorites table (unique constraint on user_id, book_id)
DELETE FROM favorites a USING favorites b 
WHERE a.user_id = b.user_id AND a.book_id = b.book_id 
AND a.id != b.id AND a.id < b.id;

-- Insert sample reading goals for existing users (optional)
-- INSERT INTO reading_goals (user_id, daily_minutes, monthly_books)
-- SELECT id, 30, 2 FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;

-- Create view for user statistics (optional - for easier querying)
CREATE OR REPLACE VIEW user_reading_stats AS
SELECT 
  u.id as user_id,
  u.email,
  p.name,
  COALESCE(completed_books.count, 0) as books_completed,
  COALESCE(total_time.minutes, 0) as total_reading_minutes,
  COALESCE(total_pages.pages, 0) as total_pages_read,
  COALESCE(favorite_cat.category, 'Fiction') as favorite_category
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN (
  SELECT user_id, COUNT(*) as count
  FROM progress 
  WHERE progress_percentage = 100
  GROUP BY user_id
) completed_books ON u.id = completed_books.user_id
LEFT JOIN (
  SELECT user_id, SUM(duration_minutes) as minutes
  FROM reading_sessions
  GROUP BY user_id
) total_time ON u.id = total_time.user_id
LEFT JOIN (
  SELECT user_id, SUM(current_page) as pages
  FROM progress
  GROUP BY user_id
) total_pages ON u.id = total_pages.user_id
LEFT JOIN (
  SELECT 
    pr.user_id,
    b.category,
    ROW_NUMBER() OVER (PARTITION BY pr.user_id ORDER BY COUNT(*) DESC) as rn
  FROM progress pr
  JOIN books b ON pr.book_id = b.id
  WHERE pr.progress_percentage = 100
  GROUP BY pr.user_id, b.category
) favorite_cat ON u.id = favorite_cat.user_id AND favorite_cat.rn = 1;
