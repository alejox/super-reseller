-- Hand-authored down migration for 0010_majestic_starhawk.sql (design.md:
-- "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires (src/shared/db/migrator.ts runs this
-- file as a single prepared statement). A DO block satisfies that while
-- undoing four forward statements: two tables and the two enums they are the
-- only users of.
--
-- `ticket_messages` goes first: its `ticket_id` foreign key is ON DELETE
-- CASCADE, so dropping `tickets` first would work — and would be the kind of
-- ordering that quietly stops working the day somebody changes that clause.
-- The enums come last because a type cannot be dropped while a column is
-- still declared with it.
--
-- Destructive, and worth saying out loud: this removes every support ticket
-- and every message on it. There is no other copy of that conversation.
DO $$
BEGIN
  DROP TABLE IF EXISTS "ticket_messages";
  DROP TABLE IF EXISTS "tickets";
  DROP TYPE IF EXISTS "public"."ticket_status";
  DROP TYPE IF EXISTS "public"."ticket_priority";
END $$;
