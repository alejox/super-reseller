import { describe, expect, it } from "vitest";

import { ForbiddenError, UnauthenticatedError, assertRole, requireSession } from "./authorization";
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
