import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { mintAdminScope, mintCustomerScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import { users } from "@/modules/identity/infrastructure/identity.schema";
import { tenantWhere } from "./tenant";

const dialect = new PgDialect();

/**
 * IT: Tenant Row Isolation — `tenantWhere` is the type-system-enforced
 * tenant gate every scoped repository composes. Generalized (design.md
 * "shared/db/tenant.ts — binary switch → admin-vs-tenant") to delegate to
 * `tenantIdOf`: ADMIN → no filter; RESELLER and CUSTOMER → each filtered to
 * their OWN tenant id, read through the one function that knows how to find
 * it on any scope kind.
 */
describe("tenantWhere", () => {
  it("returns undefined for an admin scope — no reseller_id filter", () => {
    expect(tenantWhere(users, mintAdminScope("admin-1"))).toBeUndefined();
  });

  it("returns a reseller_id = <reseller's own tenant id> predicate for a reseller scope", () => {
    const clause = tenantWhere(users, mintResellerScope("reseller-user-1", "reseller-tenant-1", "tier-1"));
    expect(clause).toBeDefined();
    const { sql, params } = dialect.sqlToQuery(clause!);
    expect(sql).toContain('"reseller_id" =');
    expect(params).toEqual(["reseller-tenant-1"]);
  });

  it("returns a reseller_id = <customer's own tenant id> predicate for a customer scope", () => {
    const clause = tenantWhere(users, mintCustomerScope("customer-user-1", "customer-tenant-1", "tier-1"));
    expect(clause).toBeDefined();
    const { sql, params } = dialect.sqlToQuery(clause!);
    expect(sql).toContain('"reseller_id" =');
    expect(params).toEqual(["customer-tenant-1"]);
  });

  it("produces DIFFERENT predicates for two different customer tenants (real filtering, not a constant)", () => {
    const clauseA = tenantWhere(users, mintCustomerScope("user-a", "tenant-a", "tier-1"));
    const clauseB = tenantWhere(users, mintCustomerScope("user-b", "tenant-b", "tier-1"));
    expect(dialect.sqlToQuery(clauseA!).params).not.toEqual(dialect.sqlToQuery(clauseB!).params);
  });
});
