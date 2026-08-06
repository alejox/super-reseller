-- Hand-authored down migration for 0006_sales_orders.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs
-- this file as a single prepared statement). A DO block satisfies that while
-- undoing both halves: the table, and the widened wallet CHECK.
--
-- The CHECK is narrowed back only after the orders are gone, because any
-- surviving ORDER_DEBIT row would make the old constraint invalid. Dropping
-- those entries is deliberate and destructive: rolling this back removes the
-- record of every purchase AND the debits that paid for them, so balances
-- return to their pre-ordering values rather than being left overdrawn
-- against orders that no longer exist.
DO $$
BEGIN
  DROP TABLE IF EXISTS "sales_order";
  DELETE FROM "wallet_entry" WHERE "kind" = 'ORDER_DEBIT';
  ALTER TABLE "wallet_entry" DROP CONSTRAINT IF EXISTS "wallet_entry_kind_check";
  ALTER TABLE "wallet_entry" ADD CONSTRAINT "wallet_entry_kind_check"
    CHECK ("kind" IN ('TOPUP', 'ADJUSTMENT'));
END $$;
