import { eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { tenantIdOf, type AccessScope } from "@/modules/identity/domain/access-scope";

/**
 * The type-system-enforced tenant gate (design.md: "A table lacking
 * `reseller_id` cannot be passed to it — the type system, not a
 * convention, requires the column").
 *
 * Only a PgTable that declares a `resellerId` column property satisfies
 * this constraint. Catalog's `plan` / `service` / `price_tier` /
 * `plan_price` do not, so passing one is a compile error (proven in
 * tests/types/access-scope-negative.ts). The identity `users` table does —
 * IT: Single-Level Reseller Ownership — and that is the only ownership
 * axis: there is no `parent_id` / hierarchy column anywhere.
 *
 * The type-only `AccessScope` import is sanctioned by eslint.config.mjs
 * (`importNames` keeps the type importable everywhere; only the minters
 * are sealed to dal.ts).
 */
export type TableWithResellerId = PgTable & { resellerId: PgColumn };

/**
 * Builds the tenant-isolation WHERE clause for a reseller-owned table.
 *
 * - ADMIN scope → `undefined` (no reseller filter — sees every row).
 * - RESELLER or CUSTOMER scope → `reseller_id = <that scope's own tenant id>`.
 *
 * Delegates to `tenantIdOf` — the ONE reader of a scope's tenant (design.md
 * interfaces) — rather than reaching for a scope field directly: keeping
 * this an admin-vs-tenant binary switch on `tenantIdOf`'s result is what
 * makes a future fourth `AccessScope` variant a compile error inside
 * `tenantIdOf` instead of a silently-unscoped query here.
 *
 * Returning `undefined` for ADMIN is intentional: it is drizzle's
 * "no where clause" value, and `and()` / `.where()` both accept it, so
 * callers compose this result unconditionally.
 */
export function tenantWhere(
  table: TableWithResellerId,
  scope: AccessScope,
): SQL | undefined {
  const tenantId = tenantIdOf(scope);
  return tenantId === null ? undefined : eq(table.resellerId, tenantId);
}
