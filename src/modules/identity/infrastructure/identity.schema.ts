import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { priceTier } from "../../catalog/infrastructure/catalog.schema";

/**
 * Identity schema (design.md "Schema" section — DDL is the specification;
 * do not add columns beyond what is listed there). `id` columns have no DB
 * default: identifiers are generated in the application via
 * `crypto.randomUUID()` (design.md "Decision: identifiers are generated in
 * the application, not by a DB default").
 *
 * Cross-module reference by id only: `users.price_tier_id` points at
 * catalog's `price_tier` table. The relative import mirrors
 * `src/shared/db/schema.ts` on purpose — drizzle-kit loads that barrel
 * standalone and is not guaranteed to resolve `@/` aliases, and the lint
 * zone for `identity/{application,infrastructure}` forbids alias imports of
 * `@/modules/catalog/*`. This is a schema-level FK target, not an entity
 * type.
 */

// IT: Exactly One Role Per User — role is text + CHECK, not a Postgres enum
// (design.md "Decision: role becomes text + CHECK; the user_role enum is
// dropped" — drizzle-orm/pg-core/dialect.js wraps every pending migration
// file in ONE transaction, so `ALTER TYPE ... ADD VALUE` followed by a
// statement that names the new value in the SAME transaction is rejected by
// Postgres; widening by ALTER COLUMN TYPE text avoids that landmine
// entirely and matches this project's own precedent for anything the
// product can widen, e.g. `plan.kind`, `sales_order.status`).
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    // argon2id PHC string (design.md "Auth and Session"). NOT NULL: there is
    // no passwordless path in this change, so a credential-less user row is
    // not a state the application should be able to represent.
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    resellerId: uuid("reseller_id"),
    // IT: Price Tier Deletion Guard — ON DELETE RESTRICT, enforced by the
    // database, not app code (design.md "Schema-level answers").
    priceTierId: uuid("price_tier_id").references(() => priceTier.id, { onDelete: "restrict" }),
    // IT: Reseller Deactivation Preserves Data — soft delete only; no
    // redundant `is_active` boolean that could disagree with it.
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // IT: Globally Unique Email — case-insensitive uniqueness via a
    // functional index on lower(email). A plain UNIQUE(email) would let
    // "User@Example.com" and "user@example.com" coexist; only the
    // case-folded index rejects both spellings of the same address.
    // Non-partial, per design.md DDL: `UNIQUE INDEX users_email_lower_uniq
    // ON (lower(email))` (no WHERE clause).
    uniqueIndex("users_email_lower_uniq").on(sql`lower(${table.email})`),
    check("users_role_check", sql`${table.role} IN ('ADMIN', 'RESELLER', 'CUSTOMER')`),
    // IT: Tier Requirement Matches Role — the activation guard. There is no
    // `is_active` boolean (deactivated_at only), so "activating" a RESELLER
    // or CUSTOMER is the insert/update of an active row; this CHECK is what
    // makes a tier-less RESELLER or CUSTOMER unrepresentable. Symmetric per
    // design.md DDL: an ADMIN must carry no tier either. Enforced by the
    // database, not app code (design.md "Schema-level answers").
    check(
      "users_tier_matches_role",
      sql`(${table.role} IN ('RESELLER', 'CUSTOMER') AND ${table.priceTierId} IS NOT NULL) OR (${table.role} = 'ADMIN' AND ${table.priceTierId} IS NULL)`,
    ),
  ],
);

/**
 * DB-backed sessions (AUTH: Login Issues a DB-Backed Session). The row —
 * not the signed cookie — is the authority: a stateless token cannot be
 * revoked, and revocation on deactivation is a requirement here.
 *
 * `ON DELETE CASCADE` (unlike `price_tier_id`'s RESTRICT): a session has no
 * value without its user, and users are soft-deleted anyway, so a cascade
 * can only ever fire on a genuine hard delete.
 *
 * No IP and no user-agent columns — Ley 1581 data minimization (design.md
 * "Schema"). `revoked_at` is the revocation marker; a session is valid only
 * while `revoked_at IS NULL AND expires_at > now()` and its user is active.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  // Revocation updates every active session of one user (design.md
  // "Revocation"), which is a `WHERE user_id = $1` write on every
  // deactivation — the one access path that justifies its own index.
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);
