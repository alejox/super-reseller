-- Hand-authored down migration for 0017_source_accounts.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). The indexes, the CHECKs, the foreign
-- keys and the RLS flag all belong to the tables, so they go with them.
--
-- `source_account_credit` is dropped first and explicitly, even though the
-- CASCADE on its foreign key would take it anyway: relying on the cascade
-- would make this file's correctness depend on a clause in the OTHER file.
--
-- Nothing of value is lost here, which is unusual for a down migration and
-- worth stating. These tables hold no ledger and no history — the balances are
-- a cached read of the supplier's own numbers, and the supplier still has
-- them. Re-applying 0017 and running one sync restores the whole picture.
DO $$
BEGIN
  DROP TABLE IF EXISTS "source_account_credit";
  DROP TABLE IF EXISTS "source_account";
END $$;
