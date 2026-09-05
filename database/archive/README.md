# Archived, superseded SQL files

These files were never reconciled with each other or with `schema.sql` --
at least four overlapping designs for "subscription/premium" data existed
side by side (`user_subscriptions_table.sql`, `plans_table.sql`, plus the
altered-`users`-table approach in `supabase/migrations/002_...sql`), and
several ad hoc "fix" scripts (`QUICK_FIX.sql`, `SIMPLE_SCHEMA_FIX.sql`,
`FIX_DOWNLOADS_TABLE.sql`, `FIXED_SCHEMA.sql`, `COMPLETE_SCHEMA.sql`)
existed with no record of which, if any, were actually run against
production.

They are archived here rather than deleted because **it could not be
verified in this pass whether any of them hold data or were ever applied**
(no live database access) -- see `../SCHEMA_DRIFT_REPORT.md`.

`supabase/migrations/003_authorization_and_schema_fixes.sql` is now the
single authoritative migration going forward. Do not apply anything from
this folder to production without first checking `SCHEMA_DRIFT_REPORT.md`
and confirming against a real introspection of your Supabase project.
