import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import type * as schema from "./schema";

/**
 * The database handle every module adapter accepts: the real Postgres client
 * in production, PGlite in tests (design.md "Testing Strategy" — the contract
 * suite runs against both).
 *
 * The schema generic matters. `src/shared/db/client.ts` builds its client as
 * `drizzle(pool, { schema })`, so its type is `NodePgDatabase<typeof schema>`
 * — NOT the bare `NodePgDatabase`, whose generic defaults to
 * `Record<string, never>` and is therefore incompatible with it. Spelling the
 * schema out here is what lets one adapter take both handles; the bare form
 * compiled only while nothing had wired the production client yet.
 *
 * Both members expose `execute()` results as `{ rows }`. That shared shape is
 * why `pg` is the production driver rather than `postgres-js`, whose
 * `execute()` returns a bare array — see `client.ts`.
 */
export type ModuleDb = NodePgDatabase<typeof schema> | PgliteDatabase;
