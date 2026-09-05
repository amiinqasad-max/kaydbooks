-- 📥 User Downloads Library Schema

-- Create user_downloads table for tracking user's downloaded content
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  download_type VARCHAR(20) DEFAULT 'audio', -- 'audio', 'pdf', 'epub'
  file_path TEXT NOT NULL, -- Local file path on device
  file_size BIGINT DEFAULT 0, -- File size in bytes
  download_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_available BOOLEAN DEFAULT true, -- If file is still available
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one download record per user per book per type
  UNIQUE(user_id, book_id, download_type)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_downloads_user_id ON user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_book_id ON user_downloads(book_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_type ON user_downloads(download_type);
CREATE INDEX IF NOT EXISTS idx_user_downloads_date ON user_downloads(download_date);
CREATE INDEX IF NOT EXISTS idx_user_downloads_available ON user_downloads(is_available);

-- Enable RLS (Row Level Security)
ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own downloads" ON user_downloads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own downloads" ON user_downloads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own downloads" ON user_downloads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own downloads" ON user_downloads
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_downloads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_downloads_updated_at
  BEFORE UPDATE ON user_downloads
  FOR EACH ROW
  EXECUTE FUNCTION update_user_downloads_updated_at();

-- Create view for user downloads with book details
CREATE OR REPLACE VIEW user_downloads_with_books AS
SELECT 
  ud.*,
  b.title,
  b.author,
  b.category,
  b.cover_url,
  b.audio_url,
  b.pdf_url,
  b.description,
  b.pages,
  b.language,
  b.audio_duration
FROM user_downloads ud
JOIN books b ON ud.book_id = b.id
WHERE ud.is_available = true
ORDER BY ud.download_date DESC;

-- Grant access to the view
GRANT SELECT ON user_downloads_with_books TO authenticated;

-- Create function to get user's download statistics
CREATE OR REPLACE FUNCTION get_user_download_stats(user_uuid UUID)
RETURNS TABLE (
  total_downloads INTEGER,
  audio_downloads INTEGER,
  pdf_downloads INTEGER,
  total_size_mb DECIMAL,
  latest_download TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_downloads,
    COUNT(CASE WHEN download_type = 'audio' THEN 1 END)::INTEGER as audio_downloads,
    COUNT(CASE WHEN download_type = 'pdf' THEN 1 END)::INTEGER as pdf_downloads,
    COALESCE(ROUND(SUM(file_size) / 1024.0 / 1024.0, 2), 0) as total_size_mb,
    MAX(download_date) as latest_download
  FROM user_downloads 
  WHERE user_id = user_uuid AND is_available = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_download_stats(UUID) TO authenticated;

-- Create function to clean up old downloads (optional)
CREATE OR REPLACE FUNCTION cleanup_old_downloads(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE user_downloads 
  SET is_available = false, updated_at = NOW()
  WHERE download_date < NOW() - INTERVAL '1 day' * days_old
    AND is_available = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on cleanup function to service role only
-- GRANT EXECUTE ON FUNCTION cleanup_old_downloads(INTEGER) TO service_role;

-- Sample data insertion (optional - for testing)
-- INSERT INTO user_downloads (user_id, book_id, download_type, file_path, file_size)
-- VALUES 
--   ('your-user-id', 1, 'audio', '/path/to/audio.mp3', 5242880),
--   ('your-user-id', 2, 'pdf', '/path/to/book.pdf', 2097152);

-- Success message
SELECT 'User downloads library schema created successfully!' as message;
