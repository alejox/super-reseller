-- Hand-authored down migration for 0015_rls_lockdown_withdrawals.sql
-- (design.md: "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). A DO block satisfies that while
-- looping over the six tables 0015 covers.
--
-- `to_regclass` guards each table because this file has to survive being run
-- against a database where a later rollback already removed one of them, and
-- because PGlite runs these same migrations in the test suite.
--
-- IT DELIBERATELY DOES NOT RESTORE ANY GRANTS, unlike 0004's down. 0015's
-- revoke block was a RE-ASSERTION of what 0004 already did, not a new lock —
-- so the state before 0015 still had 0004's revokes in place. Handing the
-- grants back here would roll back 0004 as a side effect of rolling back
-- 0015, and leave `anon` reading `withdrawal_methods.details` while everyone
-- believes only one migration came off.
--
-- Rolling this back still REOPENS row-level access on six tables for any role
-- that does hold a grant. It exists for symmetry, not because reverting is
-- ever a good idea in production.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'tickets',
    'ticket_messages',
    'inventory_accounts',
    'withdrawal_methods',
    'withdrawal_settings',
    'withdrawal_request'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', target_table);
    END IF;
  END LOOP;
END $$;
