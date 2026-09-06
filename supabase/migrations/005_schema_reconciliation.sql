-- =========================================================================
-- 005_schema_reconciliation.sql
--
-- Phase 1.8: reconciles the actual application code against the schema
-- created by database/schema.sql + migrations 001-004. Found by mapping
-- every `.from(...)` call in the app against every `CREATE TABLE` in this
-- repo -- not by re-reading the SQL files in isolation, which is exactly
-- how these went unnoticed through five prior audit passes.
--
-- Three real, independent findings fixed here:
--
--   1. CRITICAL SECURITY: migration 001_subscription_tables.sql created
--      `local_payments` with a policy that lets any authenticated user
--      INSERT their own row:
--        CREATE POLICY "Users can insert their own local payments" ...
--          FOR INSERT WITH CHECK (auth.uid() = user_id);
--      plus `GRANT SELECT, INSERT ON local_payments TO authenticated;`.
--      Migration 003 (Phase 0) documented local_payments as "staff/
--      service-role-only, no policy for authenticated is created at all,
--      so RLS denies everything by default" -- which is TRUE only in
--      isolation. Because 003 used `CREATE TABLE IF NOT EXISTS`, it never
--      actually created the table (001 already had), and it never
--      DROPped 001's policy or REVOKEd 001's grant. The result: a user
--      could self-insert a `local_payments` row (their own user_id, any
--      transaction_code, an amount/plan matching one of the two valid
--      prices) and then call verify-local-payment/index.ts with that same
--      code to grant themselves a real subscription for $0 -- the exact
--      client-side entitlement bypass Phase 1.5 closed for the App/Play
--      Store path, still open here because migration 001 was never
--      cross-checked against migration 003 until this pass.
--
--   2. CRITICAL FUNCTIONAL BUG: database/schema.sql's `downloads` table
--      has columns `file_type`, `local_path`, `downloaded_at`. Every
--      single application function that touches downloads --
--      addDownloadRecord, addToUserDownloads, getUserDownloads,
--      removeFromUserDownloads, getDownloadRecord/getDownloadRecord,
--      checkIfDownloaded, and every screen built on them in Phase 1
--      (BookDetailScreen, DownloadsLibraryScreen, PremiumAudioPlayerScreen)
--      -- uses `download_type`, `file_path`, `file_size`, `download_date`
--      instead. Confirmed by grep: there are ZERO remaining references to
--      the old column names anywhere in the app. Every download-tracking
--      database write introduced in Phase 1 would fail with a
--      "column does not exist" error against the table schema.sql
--      actually defines. The local file itself still downloads fine
--      (services/downloadManager.js writes straight to the filesystem) --
--      it's the "is this downloaded" bookkeeping that was broken.
--
--   3. MEDIUM: SettingsScreen.js reads/writes `profiles.theme_mode`,
--      `.language`, `.notifications_enabled` -- columns database/schema.sql
--      and every migration never created. Added as plain, low-risk,
--      owner-only preference columns (already covered by profiles' existing
--      RLS policy from migration 003) rather than removing the feature.
--
-- Also documented, NOT changed here (see the chat report for why):
--   - `reading_goals` (referenced by services/supabase.js's
--     updateReadingGoals/getReadingGoals) has no CREATE TABLE anywhere in
--     this repo. Confirmed unreachable: no screen or component calls
--     either function. Left as dead code rather than building out a table
--     for a feature nothing exercises -- revisit if/when a reading-goals
--     UI is actually built.
--   - `reading_sessions` (created correctly by migration 003) is still
--     never written to by any code path (services/supabase.js's
--     addReadingSession has zero callers) -- ReadingStatsScreen.js was
--     fixed this phase to query the *correct* table/columns, but the
--     numbers will honestly read zero until something actually calls
--     addReadingSession from the reader/player. That's a missing feature
--     (session-level time tracking), not a schema bug, and is out of
--     scope for a schema-reconciliation pass.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Close the local_payments self-service entitlement bypass
-- -------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own local payments" ON local_payments;
DROP POLICY IF EXISTS "Users can insert their own local payments" ON local_payments;

REVOKE SELECT, INSERT, UPDATE, DELETE ON local_payments FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON local_payments FROM anon;

-- Belt-and-braces: RLS with zero policies already denies all access for
-- non-service_role callers, but the REVOKE above means even a future
-- accidental policy addition can't grant access without also re-granting
-- table privileges -- two separate things now have to go wrong together.
ALTER TABLE local_payments ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 2. Fix the downloads table to match what the application actually writes
-- -------------------------------------------------------------------------
-- Renames (not additive duplicate columns) because grep confirms zero
-- remaining references to the old names anywhere in the app -- this is
-- the actual, currently-intended schema, not a second parallel one.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'downloads' AND column_name = 'file_type') THEN
    ALTER TABLE downloads RENAME COLUMN file_type TO download_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'downloads' AND column_name = 'local_path') THEN
    ALTER TABLE downloads RENAME COLUMN local_path TO file_path;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'downloads' AND column_name = 'downloaded_at') THEN
    ALTER TABLE downloads RENAME COLUMN downloaded_at TO download_date;
  END IF;
END $$;

ALTER TABLE downloads
  ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_type TEXT DEFAULT 'audio',
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS download_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- schema.sql's original UNIQUE(user_id, book_id, file_type) constraint was
-- renamed along with its column automatically by the RENAME COLUMN above
-- (Postgres keeps constraints attached through a column rename) -- no
-- further action needed there.

-- -------------------------------------------------------------------------
-- 3. Add the profile preference columns SettingsScreen.js actually uses
-- -------------------------------------------------------------------------
-- Plain per-user preferences, already covered by the existing
-- "Users can update own profile" policy from migration 003 (owner-only) --
-- no new RLS needed.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark')),
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

-- =========================================================================
-- Summary:
--  * local_payments: client access fully revoked (policy + grant) --
--    closes a real, live entitlement-bypass vector.
--  * downloads: file_type/local_path/downloaded_at renamed to
--    download_type/file_path/download_date to match 100% of the
--    application code; file_size added.
--  * profiles: + theme_mode, language, notifications_enabled.
-- =========================================================================
