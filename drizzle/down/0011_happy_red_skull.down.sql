-- Hand-authored down migration for 0011_happy_red_skull.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). The indexes, CHECKs and three foreign
-- keys all belong to the table, so they go with it; the enum has to be dropped
-- separately because a type outlives the column that used it.
--
-- 0012 adds a column to this same table and is rolled back first, so by the
-- time this runs the table is back to its 0011 shape.
--
-- Destructive: `inventory_accounts` holds the provider credentials that were
-- sold to customers — email, password and profile slot. Rolling this back
-- destroys the record of what was delivered to whom.
DO $$
BEGIN
  DROP TABLE IF EXISTS "inventory_accounts";
  DROP TYPE IF EXISTS "public"."inventory_status";
END $$;
