-- Hand-authored down migration for 0016_payment_requests.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). The indexes — including the partial
-- unique index on approved references — the CHECKs, the foreign keys and the
-- RLS flag all belong to the tables, so they go with them.
--
-- The TOPUP wallet entries these requests produced are NOT deleted, and that
-- is the one decision in this file worth arguing about. Unlike 0006 and 0013,
-- which drop the ledger rows they introduced, the credits here are money that
-- genuinely arrived: a reseller paid, an admin verified the receipt, and the
-- balance is correct. Before 0016, `topUpBalance` created exactly these
-- entries with no request row behind them — so leaving them is a return to the
-- real pre-0016 state, not a leak. What is lost is the proof: who approved
-- each payment, when, and against which receipt.
DO $$
BEGIN
  DROP TABLE IF EXISTS "payment_request";
  DROP TABLE IF EXISTS "topup_settings";
END $$;
