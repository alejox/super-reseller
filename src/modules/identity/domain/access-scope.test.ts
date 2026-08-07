import { describe, expect, it } from "vitest";

import {
  mintAdminScope,
  mintCustomerScope,
  mintResellerScope,
  tenantIdOf,
} from "./access-scope";

/**
 * IT: Single-Level Tenant Ownership + Tenant Row Isolation. `tenantIdOf` is
 * "the ONE reader of a scope's tenant" (design.md interfaces) — every other
 * consumer (`tenantWhere`, the repository factory) goes through it, so its
 * exhaustive `switch` is what makes a fourth `AccessScope` variant a
 * compile error rather than a silently-unscoped query.
 */
describe("tenantIdOf", () => {
  it("returns null for an admin scope — sees every tenant", () => {
    const scope = mintAdminScope("admin-1");
    expect(tenantIdOf(scope)).toBeNull();
  });

  it("returns the reseller's own id for a reseller scope", () => {
    const scope = mintResellerScope("reseller-user-1", "reseller-tenant-1", "tier-1");
    expect(tenantIdOf(scope)).toBe("reseller-tenant-1");
  });

  it("returns the customer's own tenant id for a customer scope", () => {
    const scope = mintCustomerScope("customer-user-1", "customer-tenant-1", "tier-1");
    expect(tenantIdOf(scope)).toBe("customer-tenant-1");
  });

  it("distinguishes two customer scopes by tenant id (no cross-tenant collapse)", () => {
    const a = mintCustomerScope("customer-user-a", "customer-tenant-a", "tier-1");
    const b = mintCustomerScope("customer-user-b", "customer-tenant-b", "tier-1");
    expect(tenantIdOf(a)).not.toBe(tenantIdOf(b));
  });
});

describe("mintCustomerScope", () => {
  it("mints a customer scope with actingAdminUserId null by default (customer acting for itself)", () => {
    const scope = mintCustomerScope("customer-user-1", "customer-tenant-1", "tier-1");
    expect(scope.kind).toBe("customer");
    if (scope.kind !== "customer") return;
    expect(scope.userId).toBe("customer-user-1");
    expect(scope.tenantId).toBe("customer-tenant-1");
    expect(scope.priceTierId).toBe("tier-1");
    expect(scope.actingAdminUserId).toBeNull();
  });

  it("carries actingAdminUserId when an ADMIN mints on the customer's behalf", () => {
    const scope = mintCustomerScope(
      "customer-user-1",
      "customer-tenant-1",
      "tier-1",
      "admin-user-1",
    );
    if (scope.kind !== "customer") throw new Error("expected a customer scope");
    expect(scope.actingAdminUserId).toBe("admin-user-1");
  });
});
