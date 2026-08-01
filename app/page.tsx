import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/modules/identity/application/auth/route-access";

/**
 * The root is a doorway, not a page: this product has no public marketing
 * site. `proxy.ts` normally forwards `/` before it ever renders — to the
 * login form for a visitor, or to the caller's own home when the cookie
 * carries a session.
 *
 * This redirect is the safety net for the cases the proxy does not cover
 * (its matcher, or a direct render). It deliberately does NOT read the
 * session: doing so would make the root a runtime route, and the proxy
 * already handles the signed-in case one hop earlier.
 */
export default function RootPage() {
  redirect(LOGIN_PATH);
}
