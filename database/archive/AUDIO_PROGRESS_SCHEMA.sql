-- 🎵 Audio Progress Tracking Schema

-- Create audio_progress table for tracking listening progress
CREATE TABLE IF NOT EXISTS audio_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  current_position DECIMAL DEFAULT 0, -- Current playback position in seconds
  total_duration DECIMAL DEFAULT 0, -- Total audio duration in seconds
  progress_percentage DECIMAL DEFAULT 0, -- Progress percentage (0-100)
  last_listened TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one progress record per user per book
  UNIQUE(user_id, book_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audio_progress_user_id ON audio_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_progress_book_id ON audio_progress(book_id);
CREATE INDEX IF NOT EXISTS idx_audio_progress_last_listened ON audio_progress(last_listened);

-- Enable RLS (Row Level Security)
ALTER TABLE audio_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own audio progress" ON audio_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audio progress" ON audio_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own audio progress" ON audio_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own audio progress" ON audio_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audio_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_progress_updated_at
  BEFORE UPDATE ON audio_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_progress_updated_at();

-- Add audio_duration column to books table if it doesn't exist
ALTER TABLE books ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT NULL;

-- Update existing books with sample audio durations (optional)
-- You can update these with real durations later
UPDATE books SET audio_duration = 7200 WHERE audio_url IS NOT NULL AND audio_duration IS NULL; -- 2 hours default

-- Create function to get user's listening statistics
CREATE OR REPLACE FUNCTION get_user_listening_stats(user_uuid UUID)
RETURNS TABLE (
  total_books INTEGER,
  total_listening_time DECIMAL,
  completed_books INTEGER,
  in_progress_books INTEGER,
  average_progress DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_books,
    COALESCE(SUM(current_position), 0) as total_listening_time,
    COUNT(CASE WHEN progress_percentage >= 95 THEN 1 END)::INTEGER as completed_books,
    COUNT(CASE WHEN progress_percentage > 0 AND progress_percentage < 95 THEN 1 END)::INTEGER as in_progress_books,
    COALESCE(AVG(progress_percentage), 0) as average_progress
  FROM audio_progress 
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_listening_stats(UUID) TO authenticated;

-- Create view for recently listened audiobooks
CREATE OR REPLACE VIEW recent_audiobooks AS
SELECT 
  ap.*,
  b.title,
  b.author,
  b.category,
  b.cover_url,
  b.audio_url,
  b.description,
  b.audio_duration
FROM audio_progress ap
JOIN books b ON ap.book_id = b.id
WHERE ap.current_position > 0
ORDER BY ap.last_listened DESC;

-- Grant access to the view
GRANT SELECT ON recent_audiobooks TO authenticated;

-- Sample data insertion (optional - for testing)
-- INSERT INTO audio_progress (user_id, book_id, current_position, total_duration, progress_percentage, last_listened)
-- VALUES 
--   ('your-user-id', 1, 1800, 7200, 25.0, NOW() - INTERVAL '1 day'),
--   ('your-user-id', 2, 3600, 5400, 66.7, NOW() - INTERVAL '2 hours');

-- Success message
SELECT 'Audio progress tracking schema created successfully!' as message;
