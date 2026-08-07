-- Hand-authored down migration for 0009_customer_orders.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs
-- this file as a single prepared statement). Raises when a CUSTOMER order
-- exists: the two original CHECKs being restored have no notion of
-- buyer_kind, AWAITING_PAYMENT, or provider_account_id, so a surviving
-- CUSTOMER row would be left in a state the restored constraints cannot
-- describe (no wallet entry, an AWAITING_PAYMENT status the old status
-- CHECK rejects outright).
--
-- On a table with no CUSTOMER row, drops the four buyer-discriminator
-- CHECKs and the two new columns, restores wallet_entry_id NOT NULL (safe:
-- every surviving row is a RESELLER order, which always carries one), and
-- restores the original two-CHECK shape byte-for-byte.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "sales_order" WHERE "buyer_kind" = 'CUSTOMER') THEN
    RAISE EXCEPTION 'Cannot roll back 0009_customer_orders: a CUSTOMER order exists';
  END IF;

  ALTER TABLE "sales_order" DROP CONSTRAINT IF EXISTS "sales_order_fulfilled_at_check";
  ALTER TABLE "sales_order" DROP CONSTRAINT IF EXISTS "sales_order_status_check";
  ALTER TABLE "sales_order" DROP CONSTRAINT IF EXISTS "sales_order_status_buyer_check";
  ALTER TABLE "sales_order" DROP CONSTRAINT IF EXISTS "sales_order_funding_check";
  ALTER TABLE "sales_order" DROP CONSTRAINT IF EXISTS "sales_order_buyer_kind_check";

  ALTER TABLE "sales_order" DROP CONSTRAINT IF EXISTS "sales_order_provider_account_id_provider_account_id_fk";
  ALTER TABLE "sales_order" DROP COLUMN IF EXISTS "provider_account_id";
  ALTER TABLE "sales_order" DROP COLUMN IF EXISTS "buyer_kind";

  ALTER TABLE "sales_order" ALTER COLUMN "wallet_entry_id" SET NOT NULL;

  ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_status_check"
    CHECK ("status" IN ('PENDING', 'FULFILLED', 'CANCELLED'));
  ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_fulfilled_at_check"
    CHECK (("status" = 'FULFILLED' AND "fulfilled_at" IS NOT NULL) OR ("status" <> 'FULFILLED' AND "fulfilled_at" IS NULL));
END $$;
