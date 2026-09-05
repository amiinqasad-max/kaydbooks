-- =========================================================================
-- 003_authorization_and_schema_fixes.sql
--
-- Fixes, in one authoritative migration, the issues found in the Phase 0
-- security/foundation audit of KaydBooks:
--
--   1. Any authenticated user could INSERT into `books` (no admin role
--      existed anywhere in the database).
--   2. `002_premium_subscription_system.sql` granted UPDATE on `users` to
--      every authenticated user with no RLS restricting which rows/columns
--      they could touch -- meaning a client could plausibly set their own
--      premium_access/subscription_status directly. Payment status must
--      only ever be written by server-side code that has verified a real
--      purchase.
--   3. Reading progress and audio progress were conflated (app code was
--      writing "page" progress into the `audio_progress` table because
--      `reading_progress` did not exist in the live database). This
--      migration creates a clean, chapter-aware version of both.
--   4. No single authoritative `subscriptions` table existed -- at least
--      four different, never-reconciled subscription designs are present
--      across database/*.sql (`user_subscriptions`, `purchase_transactions`
--      + altered `users` columns, and an ad hoc `local_payments` table
--      referenced only from an edge function). This migration adds ONE
--      canonical `subscriptions` table that only server-side code
--      (service_role, from an Edge Function) may write to, and marks the
--      older tables as deprecated without destructively dropping them
--      (they may hold real historical data -- verify and archive them by
--      hand once you've confirmed nothing still reads them).
--
-- This migration is written to be SAFE TO RUN even if you are not certain
-- exactly which of the older tables exist in your production database --
-- every statement is guarded (IF NOT EXISTS / IF EXISTS / DO blocks) so it
-- will not fail or destroy data if a given legacy table is present, absent,
-- or already partially migrated. It does not DROP any table that could
-- hold real data.
--
-- BEFORE running this against production: read
-- database/SCHEMA_DRIFT_REPORT.md, which documents exactly what this
-- migration assumes vs. what needs manual verification against your real
-- Supabase project (this repo's SQL files alone are not a reliable map of
-- what's actually deployed).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. Helper: updated_at trigger (idempotent, used by every table below)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 1. AUTHORIZATION MODEL: profiles.role + is_admin() helper
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- SECURITY DEFINER + STABLE so this can be used inside RLS policies
-- without recursively re-checking RLS on `profiles` (the standard,
-- documented Supabase pattern for role checks in RLS).
CREATE OR REPLACE FUNCTION is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = uid AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = uid AND role = 'super_admin'
  );
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Regular users may update their own profile row (name, etc). Role changes
-- specifically are blocked below by trigger regardless of this policy.
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_super_admin())
  WITH CHECK (auth.uid() = id OR is_super_admin());

-- Belt-and-braces: a non-super-admin cannot change `role`, even their own,
-- even if the UPDATE policy above is ever loosened later.
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only a super_admin can change a profile role.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();

-- -------------------------------------------------------------------------
-- 2. BOOKS: only admins can write; everyone (incl. anonymous) can read
-- -------------------------------------------------------------------------

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,     -- storage path (private bucket)
  ADD COLUMN IF NOT EXISTS audio_path TEXT,   -- storage path (private bucket)
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS books_updated_at ON books;
CREATE TRIGGER books_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view books" ON books;
DROP POLICY IF EXISTS "Authenticated users can insert books" ON books;
DROP POLICY IF EXISTS "Admins can insert books" ON books;
DROP POLICY IF EXISTS "Admins can update books" ON books;
DROP POLICY IF EXISTS "Admins can delete books" ON books;

CREATE POLICY "Anyone can view books" ON books
  FOR SELECT USING (true);

-- THE FIX: was `auth.role() = 'authenticated'` (any signed-up user).
CREATE POLICY "Admins can insert books" ON books
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update books" ON books
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete books" ON books
  FOR DELETE USING (is_admin());

-- -------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS: one authoritative table, server-write-only
--    (defined before storage policies below, which depend on it)
-- -------------------------------------------------------------------------
-- This is the ONLY table the app should read to decide "is this user
-- premium". It is written EXCLUSIVELY by the verify-receipt /
-- verify-local-payment Edge Functions (using the service_role key, which
-- lives only in the Edge Function runtime, never in the client). No RLS
-- policy below grants authenticated users INSERT or UPDATE -- a user
-- cannot make themselves premium by calling the Supabase client directly,
-- closing the exact gap opened by 002_premium_subscription_system.sql's
-- GRANT on `users` (cleaned up in section 8 below).

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('ios', 'android', 'local')),
  product_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('trial', 'monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'in_grace_period', 'revoked')),
  purchase_token TEXT,                  -- Android purchaseToken / Apple transactionId
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  raw_receipt JSONB,                    -- last verification response, for support/audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevents the same purchase/receipt being redeemed on more than one
  -- account (the "receipt replay" gap in the original verify-receipt fn).
  UNIQUE (provider, purchase_token)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expiry ON subscriptions(status, expires_at);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- Deliberately NO insert/update/delete policy for `authenticated` here.
-- Only `service_role` (bypasses RLS entirely, used only inside an Edge
-- Function) can write to this table. That is the point.

CREATE OR REPLACE FUNCTION has_active_subscription(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = uid
      AND status IN ('active', 'in_grace_period')
      AND expires_at > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION has_active_subscription(UUID) TO authenticated, anon;

-- -------------------------------------------------------------------------
-- 4. STORAGE: private content buckets, admin-only writes, gated reads
-- -------------------------------------------------------------------------
-- Manual step this migration cannot perform (bucket flags aren't a table):
--   Dashboard > Storage > books > bucket settings > "Public" = OFF, then
--   make sure covers live under `covers/` and gated content under
--   `pdfs/` / `audio/` so the prefixes below match your layout.
--
-- With the bucket private, `createSignedUrl` (used by the app/admin panel
-- to hand a reader a temporary link) itself requires the SELECT policy
-- below to pass for the calling user -- premium gating happens here, in
-- the database, not just in application code.

DROP POLICY IF EXISTS "Public can view covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can write any book asset" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read free content" ON storage.objects;
DROP POLICY IF EXISTS "Subscribers can read premium content" ON storage.objects;

CREATE POLICY "Public can view covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'books' AND name LIKE 'covers/%');

CREATE POLICY "Admins can write any book asset" ON storage.objects
  FOR ALL USING (bucket_id = 'books' AND is_admin())
  WITH CHECK (bucket_id = 'books' AND is_admin());

CREATE POLICY "Authenticated users can read free content" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'books'
    AND (name LIKE 'pdfs/%' OR name LIKE 'audio/%')
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM books b
      WHERE (b.pdf_path = storage.objects.name OR b.audio_path = storage.objects.name)
        AND b.is_premium = FALSE
    )
  );

CREATE POLICY "Subscribers can read premium content" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'books'
    AND (name LIKE 'pdfs/%' OR name LIKE 'audio/%')
    AND EXISTS (
      SELECT 1 FROM books b
      WHERE (b.pdf_path = storage.objects.name OR b.audio_path = storage.objects.name)
        AND b.is_premium = TRUE
    )
    AND has_active_subscription(auth.uid())
  );

-- -------------------------------------------------------------------------
-- 5. CHAPTERS: shared reference points for ebook <-> audiobook sync
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_index INTEGER NOT NULL,       -- 0-based order within the book
  title TEXT,
  start_page INTEGER,                   -- ebook: first page of this chapter
  end_page INTEGER,
  start_time_seconds NUMERIC,           -- audiobook: start offset
  end_time_seconds NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (book_id, chapter_index)
);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view chapters" ON chapters;
DROP POLICY IF EXISTS "Admins can manage chapters" ON chapters;

CREATE POLICY "Anyone can view chapters" ON chapters
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage chapters" ON chapters
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- -------------------------------------------------------------------------
-- 6. READING PROGRESS (ebook) vs AUDIO PROGRESS (audiobook) -- SEPARATED
-- -------------------------------------------------------------------------
-- Replaces the app's workaround of writing page progress into
-- `audio_progress`. Neither table is dropped/recreated destructively --
-- both are brought up to date in place.

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

ALTER TABLE reading_progress
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locator TEXT,        -- e.g. an EPUB CFI, if/when supported
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own reading progress" ON reading_progress;
CREATE POLICY "Users can manage own reading progress" ON reading_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS audio_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
  current_position DECIMAL DEFAULT 0,   -- seconds
  total_duration DECIMAL DEFAULT 0,     -- seconds
  progress_percentage DECIMAL DEFAULT 0,
  playback_rate DECIMAL DEFAULT 1.0,
  last_listened TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE audio_progress
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL;

ALTER TABLE audio_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audio progress" ON audio_progress;
DROP POLICY IF EXISTS "Users can insert their own audio progress" ON audio_progress;
DROP POLICY IF EXISTS "Users can update their own audio progress" ON audio_progress;
DROP POLICY IF EXISTS "Users can delete their own audio progress" ON audio_progress;

CREATE POLICY "Users can manage own audio progress" ON audio_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTE: the legacy `progress` table from schema.sql (page tracking,
-- redundant with `reading_progress`) is left untouched -- verify it holds
-- no rows your app still depends on, then drop it by hand:
--   SELECT count(*) FROM progress;   -- if 0, safe to: DROP TABLE progress;

-- -------------------------------------------------------------------------
-- 6b. READING SESSIONS: app code already calls this table; it never
--     existed, so every call was silently swallowed (see the
--     error-handling fixes in services/supabase.js). Creating it for real.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  pages_read INTEGER DEFAULT 0,
  session_duration INTEGER DEFAULT 0, -- seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_created
  ON reading_sessions(user_id, created_at);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own reading sessions" ON reading_sessions;
CREATE POLICY "Users can manage own reading sessions" ON reading_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- 7. LOCAL PAYMENTS (manual/bank-transfer style purchases): lock down
-- -------------------------------------------------------------------------
-- verify-local-payment/index.ts trusts that a `local_payments` row with a
-- given transaction_code was created by a TRUSTED party (staff reconciling
-- a manual payment), not by the end user -- otherwise a user could insert
-- their own row and immediately "verify" a free subscription. This table
-- is therefore staff/service-role-only for every operation; no policy for
-- `authenticated` is created at all, so RLS denies everything by default.

CREATE TABLE IF NOT EXISTS local_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE local_payments ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 8. DEFENSIVE CLEANUP of the vulnerability in 002_premium_subscription_system.sql
-- -------------------------------------------------------------------------
-- That migration ran `GRANT SELECT, INSERT, UPDATE ON users TO
-- authenticated` with no RLS policy restricting which columns/rows a user
-- could touch. If that table exists in your project, this revokes the
-- write grant so a client can no longer set its own premium flags, and
-- enables RLS with a safe, read-only-for-self policy. Wrapped in a guard
-- so this is a no-op if the table was never created in your project.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    EXECUTE 'REVOKE INSERT, UPDATE ON public.users FROM authenticated';
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own row" ON public.users';
    EXECUTE 'CREATE POLICY "Users can view own row" ON public.users FOR SELECT USING (auth.uid() = id OR is_admin())';
    RAISE NOTICE 'Locked down public.users: client-side INSERT/UPDATE revoked, RLS enabled. Premium flags on this legacy table can now only be changed by service_role. Migrate any remaining reads of users.premium_access to has_active_subscription(uid) instead.';
  END IF;
END $$;

-- =========================================================================
-- Summary of what changed, for the migration log / PR description:
--
--  * profiles: + role column, is_admin()/is_super_admin() helpers, role
--    self-escalation blocked by trigger.
--  * books: admin-only write via RLS (was: any authenticated user).
--  * subscriptions: new, single-source-of-truth table; NOT writable by
--    `authenticated` under any circumstance -- only service_role (Edge
--    Functions) can grant/revoke premium access.
--  * storage.objects (bucket "books"): covers public, pdfs/audio gated by
--    is_admin() for writes and by is_premium/has_active_subscription() for
--    reads -- requires the bucket's public flag be turned off by hand.
--  * chapters: new table, the basis for ebook<->audiobook position sync.
--  * reading_progress / audio_progress: kept as two separate tables (not
--    merged), each with a chapter_id, proper owner-only RLS.
--  * local_payments: created (if missing) and fully locked down.
--  * public.users (legacy, if present): client write access revoked.
-- =========================================================================
