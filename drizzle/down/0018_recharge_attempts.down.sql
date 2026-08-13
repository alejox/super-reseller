-- Hand-authored down migration for 0018_recharge_attempts.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). The indexes, the CHECKs, the foreign
-- keys and the RLS flag all belong to the table, so they go with it.
--
-- THIS ONE DESTROYS EVIDENCE, unlike 0017's, and the difference is worth
-- stating plainly. `source_account_credit` is a cached read of numbers the
-- supplier still holds, so dropping it loses nothing. This table is the only
-- record that a given recharge was attempted, whether it landed, and who asked
-- for it — the supplier's panel shows a total, never our attribution. Rolling
-- back past 0018 with unresolved UNVERIFIED rows in here throws away the exact
-- list of recharges a human still had to check by hand.
DO $$
BEGIN
  DROP TABLE IF EXISTS "recharge_attempt";
END $$;
