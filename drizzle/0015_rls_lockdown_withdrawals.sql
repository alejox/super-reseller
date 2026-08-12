-- Re-closes the gap `0004_rls_lockdown.sql` opened for, on every table
-- created since.
--
-- 0004 installed TWO independent locks and said so: RLS-with-no-policies, and
-- REVOKE plus `ALTER DEFAULT PRIVILEGES`. The default-privileges half is
-- schema-wide and still holds, so `anon` receives no grants on new tables.
-- The RLS half is PER TABLE, and drizzle-kit — which knows nothing about
-- Supabase's roles — has emitted six `CREATE TABLE`s since without it:
--
--   tickets, ticket_messages          (0010)
--   inventory_accounts                (0011)
--   withdrawal_methods,
--   withdrawal_settings               (0013)
--   withdrawal_request                (0014)
--
-- One lock is not the design. A single `GRANT ... ON ALL TABLES IN SCHEMA
-- public` from the Supabase dashboard — the ordinary way somebody "fixes" a
-- permissions error — re-grants `anon` on all six at once, and only RLS would
-- still be standing. `withdrawal_methods.details` holds CBUs and crypto
-- wallet addresses; `inventory_accounts` holds provider credentials.
--
-- No policies are created, deliberately: no policy means no rows for any role
-- lacking BYPASSRLS. The application connects as `postgres`, which holds it,
-- so its own queries are unaffected. Same as 0004.

ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "withdrawal_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "withdrawal_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "withdrawal_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Re-run of 0004's revoke block. `ALTER DEFAULT PRIVILEGES` only governs
-- tables created AFTER it ran, and it has held — but re-asserting is free and
-- makes this file correct standalone, on a database restored from a dump
-- taken before 0004 as much as on production.
DO $$
BEGIN
  -- Guarded by a role-existence check so this file stays portable: the test
  -- suite applies these same migrations to PGlite, which has no `anon` or
  -- `authenticated` role and would fail on an unqualified REVOKE.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
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
