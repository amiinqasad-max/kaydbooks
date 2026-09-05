-- 🔧 FIX DOWNLOADS TABLE - Resolve PGRST204 Error

-- Drop existing downloads table if it has issues
DROP TABLE IF EXISTS downloads CASCADE;

-- Create downloads table with correct structure
CREATE TABLE downloads (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  download_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Enable RLS
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage own downloads" ON downloads
  FOR ALL USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_downloads_user_id ON downloads(user_id);
CREATE INDEX idx_downloads_book_id ON downloads(book_id);

-- Verify table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'downloads' 
ORDER BY ordinal_position;
