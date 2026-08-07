import { describe, expect, it } from "vitest";

import {
  ADMIN_HOME,
  CUSTOMER_HOME,
  LOGIN_PATH,
  RESELLER_HOME,
  decideRouteAccess,
} from "./route-access";
import type { SessionClaims } from "./session-token";

/**
 * AUTH: Proxy Performs an Optimistic Check Only. This is the whole decision
 * `proxy.ts` makes — a pure function of (path, cookie claims), with no
 * database access, because proxy runs on prefetched routes too (design.md
 * "proxy.ts").
 */

const ADMIN_CLAIMS: SessionClaims = {
  sid: "77777777-7777-4777-8777-777777777777",
  uid: "55555555-5555-4555-8555-555555555555",
  role: "ADMIN",
};

const RESELLER_CLAIMS: SessionClaims = {
  sid: "88888888-8888-4888-8888-888888888888",
  uid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: "RESELLER",
};

const CUSTOMER_CLAIMS: SessionClaims = {
  sid: "99999999-9999-4999-8999-999999999999",
  uid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  role: "CUSTOMER",
};

describe("decideRouteAccess", () => {
  it("sends an anonymous visitor on a protected route to the login page", () => {
    expect(decideRouteAccess("/admin", null)).toEqual({ kind: "redirect", to: LOGIN_PATH });
    expect(decideRouteAccess("/admin/users", null)).toEqual({ kind: "redirect", to: LOGIN_PATH });
    expect(decideRouteAccess("/panel", null)).toEqual({ kind: "redirect", to: LOGIN_PATH });
  });

  it("lets an anonymous visitor reach the login page", () => {
    expect(decideRouteAccess(LOGIN_PATH, null)).toEqual({ kind: "allow" });
  });

  it("sends the root to the login page when there is no session", () => {
    // There is no marketing site here: the root is a doorway, not a page.
    expect(decideRouteAccess("/", null)).toEqual({ kind: "redirect", to: LOGIN_PATH });
  });

  it("sends the root to each role's own home when there is a session", () => {
    expect(decideRouteAccess("/", ADMIN_CLAIMS)).toEqual({ kind: "redirect", to: ADMIN_HOME });
    expect(decideRouteAccess("/", RESELLER_CLAIMS)).toEqual({
      kind: "redirect",
      to: RESELLER_HOME,
    });
  });

  it("lets an ADMIN into the admin area", () => {
    expect(decideRouteAccess("/admin", ADMIN_CLAIMS)).toEqual({ kind: "allow" });
    expect(decideRouteAccess("/admin/users", ADMIN_CLAIMS)).toEqual({ kind: "allow" });
  });

  it("bounces a RESELLER out of the admin area", () => {
    expect(decideRouteAccess("/admin", RESELLER_CLAIMS)).toEqual({
      kind: "redirect",
      to: RESELLER_HOME,
    });
    expect(decideRouteAccess("/admin/users", RESELLER_CLAIMS)).toEqual({
      kind: "redirect",
      to: RESELLER_HOME,
    });
  });

  it("lets a RESELLER into the reseller panel", () => {
    expect(decideRouteAccess("/panel", RESELLER_CLAIMS)).toEqual({ kind: "allow" });
  });

  // Closes the second live bug design.md calls out: `/panel` moving from
  // "ANY" to "RESELLER" is a deliberate behaviour change — an ADMIN could
  // browse it before and see unfiltered reseller wallet/order data
  // (`tenantWhere` returns no filter for an admin scope). Admins are now
  // redirected to their own home instead.
  it("bounces an ADMIN OUT of the reseller panel — /panel is RESELLER-only now", () => {
    expect(decideRouteAccess("/panel", ADMIN_CLAIMS)).toEqual({ kind: "redirect", to: ADMIN_HOME });
    expect(decideRouteAccess("/panel/catalog", ADMIN_CLAIMS)).toEqual({
      kind: "redirect",
      to: ADMIN_HOME,
    });
  });

  it("bounces a CUSTOMER out of the reseller panel, to its own home", () => {
    expect(decideRouteAccess("/panel", CUSTOMER_CLAIMS)).toEqual({
      kind: "redirect",
      to: CUSTOMER_HOME,
    });
  });

  it("bounces a CUSTOMER out of the admin area, to its own home", () => {
    expect(decideRouteAccess("/admin", CUSTOMER_CLAIMS)).toEqual({
      kind: "redirect",
      to: CUSTOMER_HOME,
    });
  });

  it("lets a CUSTOMER into its own home, and bounces RESELLER/ADMIN out of it", () => {
    expect(decideRouteAccess(CUSTOMER_HOME, CUSTOMER_CLAIMS)).toEqual({ kind: "allow" });
    expect(decideRouteAccess(CUSTOMER_HOME, RESELLER_CLAIMS)).toEqual({
      kind: "redirect",
      to: RESELLER_HOME,
    });
    expect(decideRouteAccess(CUSTOMER_HOME, ADMIN_CLAIMS)).toEqual({
      kind: "redirect",
      to: ADMIN_HOME,
    });
  });

  it("sends a CUSTOMER's root visit to its own home", () => {
    expect(decideRouteAccess("/", CUSTOMER_CLAIMS)).toEqual({ kind: "redirect", to: CUSTOMER_HOME });
  });

  it("sends an already-signed-in visitor away from the login page, to their own home", () => {
    expect(decideRouteAccess(LOGIN_PATH, ADMIN_CLAIMS)).toEqual({
      kind: "redirect",
      to: ADMIN_HOME,
    });
    expect(decideRouteAccess(LOGIN_PATH, RESELLER_CLAIMS)).toEqual({
      kind: "redirect",
      to: RESELLER_HOME,
    });
  });

  it("does not treat /administration as an admin route (prefix match is on segments)", () => {
    // A naive `startsWith('/admin')` would protect — or expose — the wrong
    // routes the day one of them exists.
    expect(decideRouteAccess("/administration", RESELLER_CLAIMS)).toEqual({ kind: "allow" });
  });
});
