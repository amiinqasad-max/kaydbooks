# 🛠️ Database Setup Instructions

## ⚠️ IMPORTANT: Run These SQL Commands in Supabase

The app is showing errors because the new database tables haven't been created yet. Follow these steps:

### 1. Open Supabase Dashboard
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Open your project
4. Go to **SQL Editor** (left sidebar)

### 2. Run These SQL Commands

Copy and paste **each block** separately into the SQL Editor and run them:

#### Block 1: Create Tables
```sql
-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Create reading progress table
CREATE TABLE IF NOT EXISTS reading_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  last_page INTEGER DEFAULT 1,
  total_pages INTEGER,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Create downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL, -- 'pdf' or 'audio'
  local_path TEXT NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id, file_type)
);
```

#### Block 2: Enable Row Level Security
```sql
-- Enable RLS on new tables
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
```

#### Block 3: Create Security Policies
```sql
-- Favorites policies
CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- Reading progress policies  
CREATE POLICY "Users can manage own reading progress" ON reading_progress
  FOR ALL USING (auth.uid() = user_id);

-- Downloads policies
CREATE POLICY "Users can manage own downloads" ON downloads
  FOR ALL USING (auth.uid() = user_id);
```

#### Block 4: Create Random Books Function (Optional)
```sql
-- Function to get random books
CREATE OR REPLACE FUNCTION get_random_books(book_count INTEGER DEFAULT 3)
RETURNS SETOF books AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM books
  ORDER BY RANDOM()
  LIMIT book_count;
END;
$$ LANGUAGE plpgsql;
```

### 3. Verify Tables Created
After running the commands, check that the tables exist:

1. Go to **Table Editor** (left sidebar)
2. You should see these new tables:
   - ✅ `favorites`
   - ✅ `reading_progress` 
   - ✅ `downloads`

### 4. Restart Your App
After creating the tables:
1. Stop the app (Ctrl+C)
2. Run `npm start` again
3. The errors should be gone! ✅

## 🎯 Expected Result
After setup, your app will have:
- ❤️ Working favorites system
- 📊 Reading progress tracking
- 📱 Download management
- 🔍 Advanced search and filtering
- 📚 Personal library features

## 🆘 Troubleshooting

### If you get "table already exists" errors:
This is normal - it means some tables were already created. Continue with the next blocks.

### If you get permission errors:
Make sure you're the owner of the Supabase project and have admin access.

### If the app still shows errors:
1. Check that all 4 SQL blocks ran successfully
2. Verify tables exist in Table Editor
3. Restart the app completely
4. Clear app cache if needed

## 📞 Need Help?
If you encounter issues, the error messages in the app console will help identify which table is missing.
