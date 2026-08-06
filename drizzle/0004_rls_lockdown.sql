-- Closes the default Supabase exposure of every table in `public`.
--
-- Supabase grants `anon` and `authenticated` full DML on any table created in
-- the `public` schema, and serves them over PostgREST with the anon key — a
-- key designed to be published. drizzle-kit emits portable Postgres DDL and
-- knows nothing about those roles, so every table landed readable and
-- writable by anonymous callers: `users` (Argon2 hashes) and `sessions`
-- (live session ids) included.
--
-- Two independent locks, because neither alone is sufficient:
--
--   1. RLS with no policies. No policy means no rows for any role lacking
--      BYPASSRLS. The application connects as `postgres`, which holds it, so
--      its own queries are unaffected.
--
--   2. REVOKE. RLS governs SELECT/INSERT/UPDATE/DELETE — it does NOT govern
--      TRUNCATE. Enabling RLS alone would still leave `anon` able to
--      `TRUNCATE users`. The grants have to go too.
--
-- This app never calls PostgREST; it speaks Postgres directly through `pg`.
-- Neither lock costs it anything.

ALTER TABLE "service" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "price_tier" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_price" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  -- Guarded by a role-existence check so this file stays portable: the test
  -- suite applies these same migrations to PGlite, which has no `anon` or
  -- `authenticated` role and would fail on an unqualified REVOKE.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    -- Without these, the next drizzle-kit migration creates another wide-open
    -- table: Supabase's default privileges re-grant on every CREATE TABLE.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
  END IF;
END $$;
