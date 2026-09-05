-- =========================================================================
-- 004_bookmarks_notes_and_read_listen_sync.sql
--
-- Phase 1 additions, built on top of 003's authorization model and the
-- reading_progress / audio_progress / chapters tables it created.
--
-- Adds real, persisted (not in-memory, not simulated) bookmarks and notes
-- for both formats:
--   - book_bookmarks / book_notes: page-anchored (PDF has no text layer in
--     the renderer this app uses -- react-native-pdf rasterizes pages --
--     so a "location" for a PDF is honestly a page number, not a text
--     range. True text-anchored highlights are an EPUB-only capability and
--     are intentionally NOT implemented here; see PDFViewScreen.js for why).
--   - audio_bookmarks: a timestamp in a specific book's audio.
--
-- All four tables are owner-only (RLS), same pattern as reading_progress /
-- audio_progress in 003.
-- =========================================================================

CREATE TABLE IF NOT EXISTS book_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  label TEXT, -- optional user-given label; defaults to "Page N" client-side
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_bookmarks_user_book ON book_bookmarks(user_id, book_id);

ALTER TABLE book_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own book bookmarks" ON book_bookmarks;
CREATE POLICY "Users can manage own book bookmarks" ON book_bookmarks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- A note is anchored to a page (honest for a rasterized PDF), optionally
-- linked to a bookmark for quick navigation from the bookmarks list.
CREATE TABLE IF NOT EXISTS book_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  bookmark_id UUID REFERENCES book_bookmarks(id) ON DELETE SET NULL,
  page INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_notes_user_book ON book_notes(user_id, book_id);

DROP TRIGGER IF EXISTS book_notes_updated_at ON book_notes;
CREATE TRIGGER book_notes_updated_at BEFORE UPDATE ON book_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own book notes" ON book_notes;
CREATE POLICY "Users can manage own book notes" ON book_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS audio_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position_seconds NUMERIC NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_bookmarks_user_book ON audio_bookmarks(user_id, book_id);

ALTER TABLE audio_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own audio bookmarks" ON audio_bookmarks;
CREATE POLICY "Users can manage own audio bookmarks" ON audio_bookmarks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- Read <-> Listen mapping support
-- -------------------------------------------------------------------------
-- `chapters` (from 003) already carries both a page range and a time range
-- per chapter. This view makes "which chapter is page P in" / "which
-- chapter is second S in" a single indexed lookup instead of app-side
-- linear scans, which is what utils/readListenSync.js (Phase 1 app code)
-- calls into via the two helper functions below.

CREATE OR REPLACE FUNCTION chapter_for_page(p_book_id INTEGER, p_page INTEGER)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM chapters
  WHERE book_id = p_book_id
    AND start_page IS NOT NULL
    AND p_page >= start_page
    AND (end_page IS NULL OR p_page <= end_page)
  ORDER BY chapter_index DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION chapter_for_time(p_book_id INTEGER, p_seconds NUMERIC)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM chapters
  WHERE book_id = p_book_id
    AND start_time_seconds IS NOT NULL
    AND p_seconds >= start_time_seconds
    AND (end_time_seconds IS NULL OR p_seconds <= end_time_seconds)
  ORDER BY chapter_index DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION chapter_for_page(INTEGER, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION chapter_for_time(INTEGER, NUMERIC) TO authenticated, anon;
