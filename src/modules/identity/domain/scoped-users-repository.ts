import type { ResellerId, UserId } from "./ids";
import type { UserRole } from "./user-role";

/**
 * A row of the reseller-owned `users` table as exposed through a scoped
 * read. `resellerId` is the ownership axis (IT: Single-Level Reseller
 * Ownership — the only ownership axis; there is no `parent_id` anywhere).
 * `deactivatedAt` is the soft-delete marker (IT: Reseller Deactivation
 * Preserves Data — deactivated_at only, no redundant `is_active` boolean
 * that could disagree with it; design.md "Schema-level answers"). The port
 * stays drizzle-free (EB: Domain Layer Has No ORM Dependency).
 */
export type ScopedUserRow = Readonly<{
  id: UserId;
  email: string;
  role: UserRole;
  resellerId: ResellerId | null;
  deactivatedAt: Date | null;
}>;

/**
 * Soft-delete marker for a `users` row (mirrors catalog's `retireService`
 * domain function). Returns a new row with `deactivatedAt` set — the row
 * is never removed, so owned rows (rows sharing the same `reseller_id`)
 * are untouched by construction.
 */
export function deactivateUser(row: ScopedUserRow, deactivatedAt: Date = new Date()): ScopedUserRow {
  return Object.freeze({ ...row, deactivatedAt });
}

/**
 * Scoped identity read port (IT: Reseller Row Isolation). Every read path
 * MUST force `tenantWhere(users, scope)` on the reseller-owned table: a
 * RESELLER scope reads only the rows it owns, an ADMIN scope reads across
 * every reseller. The scope is consumed at construction — never accepted
 * per call — so an unscoped read is not expressible.
 */
export interface ScopedUsersRepository {
  listUsers(): Promise<readonly ScopedUserRow[]>;

  /**
   * IT: Reseller Deactivation Preserves Data — soft delete only, never a
   * hard delete: sets `deactivated_at` on the target row and returns the
   * updated row; the row stays selectable and owned rows remain untouched.
   * The write path is isolated exactly like the read path (`tenantWhere`
   * applies to the UPDATE): a RESELLER scope can only deactivate a row it
   * owns, so the match is impossible for another reseller's row. Returns
   * `null` when no row in scope matches — the operation is a no-op, not an
   * error. The session-revocation half of deactivation lives in the DAL
   * transaction (5b.4), which composes this repository method.
   */
  deactivateUser(userId: UserId): Promise<ScopedUserRow | null>;
}
