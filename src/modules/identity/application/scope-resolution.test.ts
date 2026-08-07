import { describe, expect, it } from "vitest";

import { ForbiddenError } from "./authorization";
import type { VerifiedSession } from "./session-verifier";
import { resolveActingCustomerScopeInput, scopeInputFromSession } from "./scope-resolution";
import type { ScopedUserRow } from "../domain/scoped-users-repository";

/**
 * Pure DAL decision logic, extracted from `dal.ts` so it can be
 * unit-tested without `"server-only"`, `next/headers`, or a database —
 * `dal.ts` itself throws on import outside a Server Component. `dal.ts`
 * stays a thin glue layer over these functions, calling the sealed mint
 * functions itself for whichever `kind` this module decided on.
 */

const ADMIN_SESSION: VerifiedSession = {
  sessionId: "session-admin",
  userId: "admin-1",
  role: "ADMIN",
  resellerId: null,
  priceTierId: null,
};

const RESELLER_SESSION: VerifiedSession = {
  sessionId: "session-reseller",
  userId: "reseller-user-1",
  role: "RESELLER",
  resellerId: "reseller-tenant-1",
  priceTierId: "tier-1",
};

const CUSTOMER_SESSION: VerifiedSession = {
  sessionId: "session-customer",
  userId: "customer-user-1",
  role: "CUSTOMER",
  resellerId: "customer-tenant-1",
  priceTierId: "tier-2",
};

describe("scopeInputFromSession (AUTH: Data Access Layer Enforces Authorization)", () => {
  it("decides an admin scope for an ADMIN session", () => {
    expect(scopeInputFromSession(ADMIN_SESSION)).toEqual({ kind: "admin", userId: "admin-1" });
  });

  it("decides a reseller scope for a RESELLER session", () => {
    expect(scopeInputFromSession(RESELLER_SESSION)).toEqual({
      kind: "reseller",
      userId: "reseller-user-1",
      resellerId: "reseller-tenant-1",
      priceTierId: "tier-1",
    });
  });

  it("decides a customer scope for a CUSTOMER session, carrying its own tenant id", () => {
    expect(scopeInputFromSession(CUSTOMER_SESSION)).toEqual({
      kind: "customer",
      userId: "customer-user-1",
      tenantId: "customer-tenant-1",
      priceTierId: "tier-2",
      actingAdminUserId: null,
    });
  });

  it("throws for a RESELLER session missing its tenant id or price tier (unrepresentable row)", () => {
    expect(() => scopeInputFromSession({ ...RESELLER_SESSION, resellerId: null })).toThrow();
    expect(() => scopeInputFromSession({ ...RESELLER_SESSION, priceTierId: null })).toThrow();
  });

  it("throws for a CUSTOMER session missing its tenant id or price tier (same guard shape as reseller)", () => {
    expect(() => scopeInputFromSession({ ...CUSTOMER_SESSION, resellerId: null })).toThrow();
    expect(() => scopeInputFromSession({ ...CUSTOMER_SESSION, priceTierId: null })).toThrow();
  });
});

const ACTIVE_CUSTOMER_ROW: ScopedUserRow = {
  id: "customer-user-1",
  email: "customer@example.com",
  role: "CUSTOMER",
  resellerId: "customer-tenant-1",
  priceTierId: "tier-2",
  deactivatedAt: null,
};

/**
 * AUTH: Actor-Subject Distinction For ADMIN-On-Behalf Operations. Design.md
 * "Decision: ADMIN-acting-as-customer is a scope downgrade": the acting
 * ADMIN ends up NARROWER than an admin scope — every query is filtered to
 * one customer's tenant.
 */
describe("resolveActingCustomerScopeInput (design.md: ADMIN-acting-as-customer is a scope downgrade)", () => {
  it("decides a customer scope carrying the acting admin's id for a real, active CUSTOMER target", () => {
    expect(resolveActingCustomerScopeInput("admin-1", ACTIVE_CUSTOMER_ROW)).toEqual({
      kind: "customer",
      userId: "customer-user-1",
      tenantId: "customer-tenant-1",
      priceTierId: "tier-2",
      actingAdminUserId: "admin-1",
    });
  });

  it("rejects when the target user does not exist", () => {
    expect(() => resolveActingCustomerScopeInput("admin-1", null)).toThrow(ForbiddenError);
  });

  it("rejects a target that is not a CUSTOMER (e.g. a RESELLER)", () => {
    const resellerTarget: ScopedUserRow = { ...ACTIVE_CUSTOMER_ROW, role: "RESELLER" };
    expect(() => resolveActingCustomerScopeInput("admin-1", resellerTarget)).toThrow(ForbiddenError);
  });

  it("rejects a deactivated CUSTOMER target", () => {
    const deactivatedTarget: ScopedUserRow = {
      ...ACTIVE_CUSTOMER_ROW,
      deactivatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(() => resolveActingCustomerScopeInput("admin-1", deactivatedTarget)).toThrow(
      ForbiddenError,
    );
  });
});
