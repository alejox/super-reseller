import { tenantIdOf, type AccessScope } from "../domain/access-scope";
import type { UserId } from "../domain/ids";
import {
  deactivateUser,
  type ScopedUserRow,
  type ScopedUsersRepository,
} from "../domain/scoped-users-repository";

/**
 * Test double for `ScopedUsersRepository` (design.md "Testing Strategy":
 * "the fake proves the use case is scoped, PGlite proves the SQL is").
 * Mirrors `tenantWhere(users, scope)` semantics exactly: ADMIN scope →
 * every row; RESELLER scope → only rows whose `resellerId` equals the
 * scope's reseller id. `deactivateUser` mutates only the matched row
 * (soft delete — the row stays selectable), applying the same scope
 * filter so the write path is isolated exactly like the read path.
 */
export class InMemoryScopedUsersRepository implements ScopedUsersRepository {
  private readonly rows: ScopedUserRow[];

  constructor(
    rows: readonly ScopedUserRow[],
    private readonly scope: AccessScope,
  ) {
    this.rows = [...rows];
  }

  async listUsers(): Promise<readonly ScopedUserRow[]> {
    // `tenantIdOf` is the one function that knows how to read a scope's own
    // tenant id, whatever its kind (admin/reseller/customer) — mirrors
    // `tenantWhere`'s SQL-side semantics exactly.
    const tenantId = tenantIdOf(this.scope);
    if (tenantId === null) return [...this.rows];
    return this.rows.filter((row) => row.resellerId === tenantId);
  }

  async deactivateUser(userId: UserId): Promise<ScopedUserRow | null> {
    const tenantId = tenantIdOf(this.scope);
    const index = this.rows.findIndex(
      (row) => row.id === userId && (tenantId === null || row.resellerId === tenantId),
    );
    if (index === -1) return null;
    const updated = deactivateUser(this.rows[index]);
    this.rows[index] = updated;
    return updated;
  }
}
