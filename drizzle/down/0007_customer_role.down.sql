-- Hand-authored down migration for 0007_customer_role.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs
-- this file as a single prepared statement). A DO block satisfies that while
-- undoing both halves: the widened role (text + three-way CHECK), and the
-- dropped enum.
--
-- Raises when a CUSTOMER row exists: the enum being restored has no
-- 'CUSTOMER' value, so casting such a row back to it would either fail or
-- silently misrepresent the row. Recreating the type and casting to it in
-- the same transaction is explicitly permitted by Postgres (unlike casting
-- to a value just ADDED to an existing enum in the same transaction).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "role" = 'CUSTOMER') THEN
    RAISE EXCEPTION 'Cannot roll back 0007_customer_role: a CUSTOMER row exists';
  END IF;

  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tier_matches_role";

  CREATE TYPE "public"."user_role" AS ENUM ('ADMIN', 'RESELLER');
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role"
    USING "role"::"public"."user_role";

  ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
    CHECK ("role" IN ('ADMIN', 'RESELLER'));
  ALTER TABLE "users" ADD CONSTRAINT "users_reseller_requires_tier" CHECK (
       ("role" = 'RESELLER' AND "price_tier_id" IS NOT NULL)
    OR ("role" = 'ADMIN' AND "price_tier_id" IS NULL));
END $$;
