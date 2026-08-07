import { describe, expect, it } from "vitest";

import {
  mintAdminScope,
  mintCustomerScope,
  mintResellerScope,
} from "@/modules/identity/domain/access-scope";
import {
  ForbiddenError,
  UnauthenticatedError,
  assertActorAuthorizedForSubject,
  assertRole,
  requireSession,
} from "./authorization";
import type { VerifiedSession } from "./session-verifier";

const ADMIN: VerifiedSession = {
  sessionId: "77777777-7777-4777-8777-777777777777",
  userId: "55555555-5555-4555-8555-555555555555",
  role: "ADMIN",
  resellerId: null,
  priceTierId: null,
};

const RESELLER: VerifiedSession = {
  sessionId: "88888888-8888-4888-8888-888888888888",
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: "RESELLER",
  resellerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  priceTierId: "99999999-9999-4999-8999-999999999999",
};

describe("assertRole (AUTH: Role-Aware Authorization)", () => {
  it("lets a matching role through and returns the session", () => {
    expect(assertRole(ADMIN, "ADMIN")).toBe(ADMIN);
    expect(assertRole(RESELLER, "RESELLER")).toBe(RESELLER);
  });

  it("denies a RESELLER an ADMIN-only operation", () => {
    expect(() => assertRole(RESELLER, "ADMIN")).toThrow(ForbiddenError);
  });

  it("denies an ADMIN a RESELLER-only operation — the check is symmetric, not a privilege ladder", () => {
    expect(() => assertRole(ADMIN, "RESELLER")).toThrow(ForbiddenError);
  });

  it("does not leak the required role or the caller's identity in the message", () => {
    // An authorization error is shown to the caller; naming the missing
    // role or the user id turns a denial into a probe.
    expect(() => assertRole(RESELLER, "ADMIN")).toThrow(/^Forbidden$/);
  });
});

/**
 * AUTH: Actor-Subject Distinction For ADMIN-On-Behalf Operations. Two
 * identities, evaluated separately — the acting session's role (actor) and
 * the tenant id the operation targets (subject) — never conflated.
 */
describe("assertActorAuthorizedForSubject", () => {
  it("authorizes an ADMIN actor for any customer subject", () => {
    const admin = mintAdminScope("admin-1");
    expect(() => assertActorAuthorizedForSubject(admin, "customer-tenant-1")).not.toThrow();
    expect(() => assertActorAuthorizedForSubject(admin, "customer-tenant-2")).not.toThrow();
  });

  it("authorizes a customer actor only for its own tenant as subject", () => {
    const customer = mintCustomerScope("customer-user-1", "customer-tenant-1", "tier-1");
    expect(() => assertActorAuthorizedForSubject(customer, "customer-tenant-1")).not.toThrow();
  });

  it("denies a customer actor naming a DIFFERENT tenant as subject", () => {
    const customer = mintCustomerScope("customer-user-1", "customer-tenant-1", "tier-1");
    expect(() => assertActorAuthorizedForSubject(customer, "customer-tenant-2")).toThrow(
      ForbiddenError,
    );
  });

  it("denies a reseller actor regardless of subject", () => {
    const reseller = mintResellerScope("reseller-user-1", "reseller-tenant-1", "tier-1");
    expect(() => assertActorAuthorizedForSubject(reseller, "reseller-tenant-1")).toThrow(
      ForbiddenError,
    );
    expect(() => assertActorAuthorizedForSubject(reseller, "customer-tenant-1")).toThrow(
      ForbiddenError,
    );
  });
});

describe("requireSession", () => {
  it("returns the session when there is one", () => {
    expect(requireSession(ADMIN)).toBe(ADMIN);
  });

  it("throws UnauthenticatedError for a null session", () => {
    expect(() => requireSession(null)).toThrow(UnauthenticatedError);
  });

  it("distinguishes unauthenticated from forbidden", () => {
    // 401 vs 403: "who are you?" and "not you" are different answers, and
    // the login redirect only makes sense for the first.
    expect(new UnauthenticatedError()).not.toBeInstanceOf(ForbiddenError);
    expect(new ForbiddenError()).not.toBeInstanceOf(UnauthenticatedError);
  });
});
