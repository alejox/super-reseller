import type { SessionClaims } from "./session-token";

export const LOGIN_PATH = "/login";
export const ADMIN_HOME = "/admin";
export const RESELLER_HOME = "/panel";

export type RouteDecision =
  | Readonly<{ kind: "allow" }>
  | Readonly<{ kind: "redirect"; to: string }>;

/**
 * Routes reachable without any session. Everything else needs one.
 *
 * The root is NOT here: this product has no public marketing page, so `/`
 * is a doorway that forwards to the login form or to the caller's own home.
 */
const PUBLIC_PATHS: readonly string[] = [LOGIN_PATH];

/** Route prefixes and the role they demand. Order matters: first match wins. */
const ROLE_GATED_PREFIXES: ReadonlyArray<readonly [string, "ADMIN" | "RESELLER" | "ANY"]> = [
  [ADMIN_HOME, "ADMIN"],
  [RESELLER_HOME, "ANY"],
];

/**
 * Segment-aware prefix match. `/administration` is NOT under `/admin`, and
 * a plain `startsWith` would say otherwise — a bug that stays invisible
 * until the day such a route exists, and then silently mis-gates it.
 */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function homeFor(role: SessionClaims["role"]): string {
  return role === "ADMIN" ? ADMIN_HOME : RESELLER_HOME;
}

/**
 * AUTH: Proxy Performs an Optimistic Check Only.
 *
 * The ONLY inputs are the path and the claims already extracted from the
 * cookie — no database, by design: proxy runs on prefetched routes, so a DB
 * read here would multiply into queries for pages nobody visits.
 *
 * ACCEPTED AND DOCUMENTED PROPERTY: a validly-signed cookie whose session
 * has been revoked passes this check. It cannot be otherwise — knowing that
 * a session was revoked requires reading the database. The DAL rejects it
 * microseconds later, and every Server Action re-authorizes itself, because
 * Server Actions are public POST endpoints reachable without ever passing
 * through the page this function guards.
 */
export function decideRouteAccess(
  pathname: string,
  claims: SessionClaims | null,
): RouteDecision {
  if (pathname === "/") {
    return {
      kind: "redirect",
      to: claims === null ? LOGIN_PATH : homeFor(claims.role),
    };
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    // Someone already signed in has no business on the login form.
    if (pathname === LOGIN_PATH && claims !== null) {
      return { kind: "redirect", to: homeFor(claims.role) };
    }
    return { kind: "allow" };
  }

  const gate = ROLE_GATED_PREFIXES.find(([prefix]) => isUnder(pathname, prefix));
  if (gate === undefined) {
    // Unknown route: let it through and let the page 404. Guessing that an
    // unmapped path is private would break every future public page.
    return { kind: "allow" };
  }

  if (claims === null) {
    return { kind: "redirect", to: LOGIN_PATH };
  }

  const [, requiredRole] = gate;
  if (requiredRole !== "ANY" && claims.role !== requiredRole) {
    return { kind: "redirect", to: homeFor(claims.role) };
  }

  return { kind: "allow" };
}
