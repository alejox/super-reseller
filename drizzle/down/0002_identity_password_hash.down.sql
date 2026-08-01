-- Hand-authored down migration for 0002_identity_password_hash.sql
-- (design.md: "Decision: hand-authored down migrations").
--
-- One statement, as the migrator requires: rollbackLast() runs this file as
-- a single prepared statement (src/shared/db/migrator.ts).
--
-- Dropping the column DESTROYS every stored credential; rolling 0002 back on
-- a database that has users means all of them must set a new password.
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
