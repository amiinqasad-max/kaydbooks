# This document is deprecated and its advice must not be followed

This file previously instructed operators to paste a Supabase **service-role
key** into client-side JavaScript (`config_service.js`) to "bypass RLS", and
alternatively to run `ALTER TABLE books DISABLE ROW LEVEL SECURITY;`.

**Both of those are critical security vulnerabilities, not fixes.** A
service-role key in any code that reaches a browser is equivalent to
publishing your database's root password — anyone who opens dev tools has
full read/write/delete access to every table. Disabling RLS on a table with
user-owned or gated data removes the only access boundary Postgres was
enforcing.

The key that was previously committed here must be treated as **compromised**
and rotated in the Supabase dashboard (Settings → API → "Roll" next to
`service_role`) regardless of anything else in this repository.

## What replaced this

The admin panel now signs the operator in as a normal Supabase Auth user
(`admin_web/supabase.js`, using only the public anon key) and every
book-management action is authorized by a Row Level Security policy that
checks `profiles.role IN ('admin', 'super_admin')` — see
`supabase/migrations/003_authorization_and_schema_fixes.sql`.

If an admin action fails with a "row-level security policy" error, the fix
is to grant that account the `admin` role in the `profiles` table (as a
`super_admin`, via the app or a one-off `UPDATE profiles SET role = 'admin'
WHERE id = '<uuid>'` run in the Supabase SQL editor) — never to reach for a
service-role key in client code again.
