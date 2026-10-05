# supabase/

- `migrations/` — run in filename order; see the main README §7.
- `bootstrap_admin.sql` — promote the first admin; see the main README §9.
- `tests/` — local database tests (`npm run test:db`). They need PostgreSQL 15/16 and use a minimal stand-in for Supabase's `auth` and `storage`. **Do not run anything in `tests/` against a real project.**
