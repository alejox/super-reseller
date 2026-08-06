-- Hand-authored down migration for 0004_rls_lockdown.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). A DO block satisfies that while still
-- undoing seven forward statements, and lets the Supabase-only role work stay
-- guarded exactly as it is on the way up.
--
-- Rolling this back REOPENS anonymous read/write access on a Supabase project.
-- It exists for symmetry with the other down migrations, not because reverting
-- is ever a good idea in production.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['service', 'plan', 'price_tier', 'plan_price', 'users', 'sessions']
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', target_table);
  END LOOP;

  -- Restores the grants Supabase applies by default, so the schema returns to
  -- the exact state 0004 found it in rather than a half-locked hybrid.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
  END IF;
END $$;
