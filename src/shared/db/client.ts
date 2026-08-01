import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";
import type { ModuleDb } from "./module-db";

/**
 * Neon HTTP driver: one statement per HTTP request, no transaction
 * continuity across calls. This is why Postgres RLS via `SET LOCAL` is
 * rejected for this change (design.md: "Postgres RLS is rejected"), and why
 * `DrizzleAccountAdministration` expresses its transaction as a single
 * statement with data-modifying CTEs.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision a Neon branch and export DATABASE_URL before using src/shared/db/client.",
    );
  }
  return url;
}

let client: ModuleDb | undefined;

/**
 * Lazily built, and deliberately NOT a module-level `export const db`.
 *
 * `next build` evaluates every module reachable from a page while
 * collecting page data. A connection created at import time therefore threw
 * "DATABASE_URL is not set" during the build itself — before a single
 * request existed to need it. Building the client on first use keeps the
 * requirement where it belongs: at runtime, in the request that actually
 * queries.
 *
 * The instance is memoized, so repeated calls share one client.
 */
export function getDb(): ModuleDb {
  client ??= drizzle(neon(getDatabaseUrl()), { schema });
  return client;
}
