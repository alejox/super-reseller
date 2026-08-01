import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Catalog schema (design.md "Schema" section — DDL is the specification;
// do not add columns beyond what is listed there). `id` columns have no DB
// default: identifiers are generated in the application via
// `crypto.randomUUID()` (design.md "Decision: identifiers are generated in
// the application, not by a DB default").

export const priceTier = pgTable("price_tier", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const service = pgTable("service", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  // CAT: Service Retirement Preserves Plans — soft delete only.
  retiredAt: timestamp("retired_at", { withTimezone: true }),
});

export const plan = pgTable(
  "plan",
  {
    id: uuid("id").primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // text + CHECK, deliberately not a Postgres enum — design.md "Decision:
    // role is a Postgres enum; plan.kind is text + CHECK".
    kind: text("kind").notNull(),
    // CAT: Duration Is a First-Class Field — never parsed from `name`.
    durationDays: integer("duration_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [
    // Prevents the legacy 56-SKU duplication from returning: only one
    // ACTIVE plan per (service, kind, duration) — a retired plan frees the
    // identity for a re-issued one.
    uniqueIndex("plan_identity_uniq")
      .on(table.serviceId, table.kind, table.durationDays)
      .where(sql`${table.retiredAt} IS NULL`),
    check("plan_kind_check", sql`${table.kind} IN ('SCREEN', 'FULL_ACCOUNT')`),
    check("plan_duration_days_check", sql`${table.durationDays} > 0`),
  ],
);

export const planPrice = pgTable(
  "plan_price",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    priceTierId: uuid("price_tier_id")
      .notNull()
      .references(() => priceTier.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
  },
  (table) => [
    // At most one CURRENT price per (plan, tier) — the mechanism that makes
    // "missing tier price blocks sale, no fallback" representable at all.
    uniqueIndex("plan_price_current_uniq")
      .on(table.planId, table.priceTierId)
      .where(sql`${table.effectiveTo} IS NULL`),
    check("plan_price_amount_minor_check", sql`${table.amountMinor} >= 0`),
    check("plan_price_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);
