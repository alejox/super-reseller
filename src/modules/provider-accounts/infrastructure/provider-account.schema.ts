import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { service } from "../../catalog/infrastructure/catalog.schema";
import { users } from "../../identity/infrastructure/identity.schema";

/**
 * Provider-accounts schema (design.md "Decision: `provider-accounts` is its
 * own module, and its column is `reseller_id`"). DDL is the specification —
 * do not add columns beyond what is listed there.
 *
 * Relative imports (not `@/modules/*`) on purpose, mirroring
 * `identity.schema.ts`'s own header: `drizzle-kit generate` loads this file
 * standalone via `src/shared/db/schema.ts` and is not guaranteed to resolve
 * tsconfig path aliases, and the eslint zone for this module's
 * `infrastructure/` mirrors wallet/ordering by barring `@/modules/catalog/*`
 * and `@/modules/identity/*` ALIAS imports — a schema-level FK target is not
 * an entity type import.
 *
 * The tenant column is named `reseller_id` — not `tenant_id` — on purpose:
 * `TableWithResellerId = PgTable & { resellerId: PgColumn }` (`tenant.ts:23`)
 * requires exactly that column name for `tenantWhere` to accept this table.
 * It holds the owning CUSTOMER's tenant id (`tenantIdOf(scope)` for a
 * customer scope), never a reseller's.
 */
export const providerAccount = pgTable(
  "provider_account",
  {
    id: uuid("id").primaryKey(),
    resellerId: uuid("reseller_id").notNull(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "restrict" }),
    // The REAL identifier the customer uses on the provider's panel (obs
    // #422's correction to the original "customer-facing label only"
    // assumption) — never a credential, never a secret.
    panelUsername: text("panel_username").notNull(),
    // Optional customer-facing nickname, distinct from the real identifier.
    label: text("label"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    // Soft delete, project convention (mirrors `service.retired_at`,
    // `users.deactivated_at`).
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    // Every read is "this tenant's accounts" — mirrors
    // `wallet_entry_reseller_idx`.
    index("provider_account_tenant_idx").on(table.resellerId, table.createdAt),
    // PA: Duplicate provider is allowed — two accounts for the same provider
    // under the same customer are NOT rejected. The SAME (provider, real
    // identifier) pair registered twice IS: partial unique on
    // (reseller_id, service_id, lower(panel_username)) WHERE archived_at IS
    // NULL, mirroring `plan_identity_uniq`'s shape — an archived account
    // frees its identity for a re-registered one.
    uniqueIndex("provider_account_identity_uniq")
      .on(table.resellerId, table.serviceId, sql`lower(${table.panelUsername})`)
      .where(sql`${table.archivedAt} IS NULL`),
    check(
      "provider_account_panel_username_check",
      sql`length(btrim(${table.panelUsername})) > 0`,
    ),
    // NO password, credential, secret, token, or expires_at/subscription_id
    // column — PA: No Credential Or Lifecycle Fields Exist, enforced by
    // provider-account.schema.test.ts's information_schema tripwire.
  ],
);
