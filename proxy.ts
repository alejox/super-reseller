import { NextResponse, type NextRequest } from "next/server";

import { decideRouteAccess } from "@/modules/identity/application/auth/route-access";
import { SESSION_COOKIE } from "@/modules/identity/application/dal";
import { sessionSecretKey, verifySessionToken } from "@/modules/identity/application/auth/session-token";

/**
 * AUTH: Proxy Performs an Optimistic Check Only.
 *
 * This file reads the cookie, verifies its SIGNATURE, and matches the role
 * claim against a static route table. That is all it does — no database
 * access, ever. Proxy runs on prefetched routes too, so a query here would
 * fan out into reads for pages the user never opens.
 *
 * ACCEPTED AND DOCUMENTED PROPERTY: a validly-signed cookie for a session
 * that has ALREADY BEEN REVOKED passes this check. It has to — detecting
 * revocation means reading the database. The Data Access Layer rejects the
 * same request microseconds later, and every Server Action re-authorizes
 * itself independently, because Server Actions are public POST endpoints
 * reachable without ever rendering the page this guards.
 *
 * In other words: this is a redirect optimization, NOT a security boundary.
 * Deleting this file must not make the application insecure — only chattier.
 *
 * Runtime note: Proxy defaults to Node.js in Next 16 and the `runtime`
 * config option throws if set here, so it is deliberately absent.
 */
export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // A malformed or unsigned cookie is simply "no session" as far as routing
  // is concerned; the DAL is what turns that into an actual rejection.
  const claims = token ? await verifySessionToken(token, sessionSecretKey()) : null;

  const decision = decideRouteAccess(request.nextUrl.pathname, claims);
  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's internals and static assets. Without a matcher
  // the proxy would run on `_next/static`, image optimization and files in
  // `public/`, where a redirect would break CSS, JS and images rather than
  // protect anything.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
