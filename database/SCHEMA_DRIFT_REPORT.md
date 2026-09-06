# Schema drift report

This documents where the application code, the SQL files in this repo, and
(as far as can be determined without live database access) the actual
deployed Supabase schema disagree. **I do not have credentials to connect to
the live production database in this pass** — everything in the "DB
actually has" column is inferred from code behavior (error-swallowing paths,
comments admitting a table "doesn't exist", a migration that assumes a
table already exists), not from a live introspection query. Before trusting
this table, run the verification query at the bottom against your real
project and correct any row that turns out wrong.

| Entity | App expects | DB likely has | Problem | Fix |
|---|---|---|---|---|
| `reading_progress` | `services/supabase.js`'s `updateReadingProgress`/`getReadingProgress` read/write it; `database/schema.sql` defines it | Likely **absent**, or present but unused — the app's own `getContinueReadingBooks`, `updateReadingProgressDetailed`, `getReadingProgressDetailed` all read/write `audio_progress` instead, with the comment *"Using audio_progress table since reading_progress doesn't exist"* | Ebook page progress and audiobook listening progress are the same column in the same table — they overwrite each other for the same book | Migration `003` brings `reading_progress` up to date (adds `chapter_id`, `locator`, `last_opened_at`) with correct RLS. `services/supabase.js` has been repointed to use it for ebook progress specifically (see code changes) — **once you confirm the table exists in prod (or after applying `003`), remove the `audio_progress` fallback path** |
| `progress` (schema.sql) | Nothing in the reviewed app code calls it | Unknown — defined in `schema.sql`, no code reference found | Dead weight, or a third silent copy of progress data nobody is looking at | Run `SELECT count(*) FROM progress;` — if `0`, drop it. If non-zero, someone else may be writing to it outside this codebase; investigate before dropping |
| `users` (referenced in `supabase/migrations/002_premium_subscription_system.sql` and both edge functions) | Both `verify-receipt` and `verify-local-payment` `UPDATE users SET premium = true, ...`; migration `002` does `ALTER TABLE users ADD COLUMN ...` (implying it must already exist) | Genuinely unclear — `database/schema.sql` never creates a `users` table (only `profiles`), yet `002` alters one, which means either (a) it was created by hand in the Supabase dashboard outside of any file in this repo, or (b) `002` has never successfully run and every deploy of it has been failing silently, or (c) it's simply a bug and the intended target was always `profiles` | **This is the highest-value thing to verify manually** — it directly determines whether real customer payments have been recording anywhere at all | Run the verification query below. If `users` exists and has real subscription data: reconcile it into the new `subscriptions` table (`003`) with a one-off data migration, then treat `users`'s premium columns as read-only/deprecated (migration `003` already revokes client write access to it as a safety net). If it doesn't exist: the two edge functions were failing on every single call in production — fixed in code to target `subscriptions` instead |
| `user_subscriptions` (`database/user_subscriptions_table.sql`) | Not referenced by any app code found in this pass | Unknown, possibly created and abandoned | A fourth parallel subscription design (references a `plans` table too) | Verify row count; if empty, delete the file and never apply it. If it has data, reconcile into `subscriptions` before removing |
| `purchase_transactions` / `subscription_history` / `premium_features` (`002`) | Only `verify-receipt` writes to `purchase_transactions`, targeting a `users(id)` FK | Unknown | Another subscription-adjacent table set that assumes the disputed `users` table | Same as above — verify before touching |
| `local_payments` | `verify-local-payment/index.ts` reads/updates it; no file in `database/` creates it | Unknown — likely created by hand, since nothing in this repo defines it | An edge function depends on a table whose schema, constraints, and RLS are not defined anywhere in version control | Migration `003` now creates it (`IF NOT EXISTS`) with RLS that blocks all client access, matching the trust model the edge function assumes (only staff should be able to insert an unverified transaction code) |
| `books.pdf_url` / `books.audio_url` | Every screen and both admin panels store/read a permanent public URL | Present, and — per `PDFViewScreen.js` — actively handed to a third-party (Google Docs Viewer) and to the WebView's network stack | Public, non-expiring URLs for content the app elsewhere claims is un-downloadable (`addToUserDownloads` throws for `download_type === 'pdf'`) | Migration `003` adds `pdf_path`/`audio_path` (storage paths) alongside the existing URL columns. New uploads should populate the path columns; the mobile app should resolve a short-lived signed URL at read/listen time instead of using the stored public URL. **This is additive, not a rename** — existing `pdf_url`/`audio_url` values keep working until you've moved every reader path over |
| `books.is_premium` / `books.is_featured` | `services/supabase.js`'s `updateBook` writes these columns already | Uncertain whether they exist — `createBook`'s own comments call some fields "optional... might exist" | If missing, every `updateBook` call silently drops these fields (Supabase ignores unknown columns in some client configurations) or throws | Migration `003` adds both with `ADD COLUMN IF NOT EXISTS`, so they're guaranteed to exist after applying it |
| `profiles.role` | Did not exist anywhere before this migration | N/A | No admin concept existed in the database at all — RLS could not distinguish an admin from any other signed-up user | Added in `003`; defaults every existing row to `'user'`. **You must manually promote at least one account to `'super_admin'`** after migrating (see the runbook below) or nobody will be able to grant the `admin` role to anyone |

## Manual verification query

Run this in the Supabase SQL editor against your real project **before**
applying `003_authorization_and_schema_fixes.sql`, and paste the result
into this file (or a ticket) so the row above marked "unclear"/"unknown"
can be corrected:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

And, for whichever of `users` / `profiles` actually holds subscription
data:

```sql
select count(*) filter (where premium_access is true or premium is true) as premium_rows,
       count(*) as total_rows
from public.users; -- or public.profiles, whichever exists
```

## Promoting the first admin (runbook)

After applying `003`, every existing account has `role = 'user'`, including
whoever built the admin panel. Run once, by hand, in the SQL editor:

```sql
update profiles set role = 'super_admin' where id = '<your-own-auth-uid>';
```

(Find your own UUID under Authentication > Users in the dashboard.) From
then on, a `super_admin` can promote other accounts through the same
`UPDATE`, or you can build a small "manage admins" screen once the app
side of this work is prioritized — it is not part of Phase 0.

## Phase 1.8 findings (schema reconciliation, static analysis only)

No live Supabase staging project was created this phase (declined twice by
the project owner — Phase 1.7 and 1.8 both — so every row below is
verified by reading migrations 001-004 and `database/schema.sql` against
every `.from(...)` call in the app, not by querying a real database).
Fixed in `supabase/migrations/005_schema_reconciliation.sql`:

| Severity | Entity | Finding | Fix |
|---|---|---|---|
| 🔴 CRITICAL (security) | `local_payments` | `001_subscription_tables.sql` created this table with `CREATE POLICY ... FOR INSERT WITH CHECK (auth.uid() = user_id)` and `GRANT SELECT, INSERT ON local_payments TO authenticated`. `003`'s later "staff/service-role-only" lockdown used `CREATE TABLE IF NOT EXISTS local_payments`, which is a no-op if `001` already ran — so it never dropped `001`'s policy or revoked its grant. Net effect: any signed-in user could INSERT their own `local_payments` row and then call `verify-local-payment` to grant themselves a subscription for $0 | `005` drops both of `001`'s policies and revokes `SELECT, INSERT, UPDATE, DELETE` on the table from `authenticated`/`anon`, leaving it writable only by `service_role` (the Edge Function) |
| 🔴 CRITICAL (functional) | `downloads` | `database/schema.sql` defines columns `file_type`, `local_path`, `downloaded_at`, no `file_size`. Every app function that touches downloads (`addDownloadRecord`, `addToUserDownloads`, `getUserDownloads`, `removeFromUserDownloads`, `checkIfDownloaded`, and the Phase 1 screens built on them) uses `download_type`, `file_path`, `file_size`, `download_date` instead — confirmed zero remaining references to the old names anywhere in the app | `005` renames the three mismatched columns and adds `file_size`, matching 100% of current app code |
| 🟡 MEDIUM | `profiles` | `SettingsScreen.js` reads/writes `theme_mode`, `language`, `notifications_enabled` — none of which any migration or `schema.sql` ever created | `005` adds all three as `ADD COLUMN IF NOT EXISTS`, covered by the existing owner-only `profiles` RLS policy from `003` (no new policy needed) |
| 🟢 LOW (documented, not changed) | `reading_goals` | `services/supabase.js`'s `updateReadingGoals`/`getReadingGoals` reference a table with no `CREATE TABLE` anywhere in this repo, but zero screens/components call either function | Left as dead code — build the table only if/when a reading-goals UI is actually implemented |
| 🟢 LOW (documented, not changed) | `reading_sessions` | Table and columns are correct as of `003`, but `addReadingSession` (the only writer) has zero callers anywhere in the app, so the table is always empty | `ReadingStatsScreen.js` was fixed this phase to query the *correct* table/columns instead of the wrong ones it had before, but its time-based stats will honestly read zero until something actually calls `addReadingSession` from the reader/player — that's a missing feature, not a schema bug |

Verified clean this phase (app code column usage matches the migration that
created the table, no fix needed): `favorites`, `book_bookmarks`,
`book_notes`, `audio_bookmarks`, `chapters`, `subscriptions`.

**Still true from Phase 0, still unresolved**: nobody has run the manual
verification query above against the real production database, so the
`users` vs `profiles` and dead-table questions in the table above remain
open. This phase's findings are about tables that *do* exist and *are*
actively used by the app; they don't supersede the older, still-open
"does `users` actually exist in prod" question.
