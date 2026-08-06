import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import type { ModuleDb } from "./module-db";

/**
 * node-postgres over Supabase's connection pooler.
 *
 * `pg` was chosen over `postgres-js` (Drizzle's usual Supabase default) for
 * one concrete reason: result shape. `db.execute()` on postgres-js returns a
 * bare `RowList` array, while `pg` and PGlite both return an object carrying
 * `.rows`. Every caller here — `migrator.ts`'s `RollbackableDb`,
 * `DrizzleAccountAdministration`, the whole migration test suite — reads
 * `.rows`, and `ModuleDb` unions the production and test handles into one
 * type. `pg` keeps that union honest; postgres-js would have forced a rewrite
 * of every call site to buy nothing.
 *
 * Unlike the previous Neon HTTP driver, this one DOES support transactions.
 * Existing single-statement CTE writes stay as they are: they were correct on
 * every driver, and still are.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy the Supabase connection string (Transaction pooler, port 6543) into DATABASE_URL before using src/shared/db/client.",
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
 * The instance is memoized, so repeated calls share one pool. That memo is
 * what makes a pool safe here: Vercel's Fluid Compute reuses a function
 * instance across concurrent requests, so the pool is created once per
 * instance rather than once per request.
 */
export function getDb(): ModuleDb {
  client ??= drizzle(
    new Pool({
      connectionString: getDatabaseUrl(),
      // Supabase's transaction pooler already multiplexes across clients;
      // a large per-instance pool on top of it just burns pooler slots.
      max: 5,
    }),
    { schema },
  );
  return client;
}
