import type { AccessScope } from "../domain/access-scope";
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
    // Local const so the discriminated-union narrowing of the scope's
    // `kind` survives into the filter callback (property narrowing on
    // `this.scope` does not propagate into closures).
    const scope = this.scope;
    if (scope.kind === "admin") return [...this.rows];
    return this.rows.filter((row) => row.resellerId === scope.resellerId);
  }

  async deactivateUser(userId: UserId): Promise<ScopedUserRow | null> {
    const scope = this.scope;
    const index = this.rows.findIndex(
      (row) => row.id === userId && (scope.kind === "admin" || row.resellerId === scope.resellerId),
    );
    if (index === -1) return null;
    const updated = deactivateUser(this.rows[index]);
    this.rows[index] = updated;
    return updated;
  }
}
