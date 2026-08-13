-- Hand-authored down migration for 0013_new_lila_cheney.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). A DO block satisfies that while
-- undoing both halves: the two withdrawal tables, and the widened wallet
-- CHECK.
--
-- The CHECK is narrowed back only after the WITHDRAWAL entries are gone —
-- exactly the shape 0006's down uses for ORDER_DEBIT, and for the same reason:
-- any surviving row of the removed kind makes the old constraint invalid, so
-- Postgres would refuse to add it.
--
-- Deliberately destructive, and asymmetric in a way worth understanding.
-- Deleting the WITHDRAWAL entries GIVES THE MONEY BACK: those rows are
-- negative, so removing them raises every affected reseller's balance by
-- whatever they had taken out. That is the correct pre-0013 state — the
-- platform had no way to withdraw, so no balance had ever been reduced by one
-- — but it means a rollback after real withdrawals have been PAID leaves
-- balances crediting money that already left the bank. 0014 drops
-- `withdrawal_request` before this runs, so the record of those payouts is
-- already gone by the time the entries are.
DO $$
BEGIN
  DROP TABLE IF EXISTS "withdrawal_settings";
  DROP TABLE IF EXISTS "withdrawal_methods";

  DELETE FROM "wallet_entry" WHERE "kind" = 'WITHDRAWAL';
  ALTER TABLE "wallet_entry" DROP CONSTRAINT IF EXISTS "wallet_entry_kind_check";
  ALTER TABLE "wallet_entry" ADD CONSTRAINT "wallet_entry_kind_check"
    CHECK ("kind" IN ('TOPUP', 'ADJUSTMENT', 'ORDER_DEBIT'));
END $$;
