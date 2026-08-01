import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import type * as schema from "./schema";

/**
 * The database handle every module adapter accepts: the real Neon client in
 * production, PGlite in tests (design.md "Testing Strategy" — the contract
 * suite runs against both).
 *
 * The schema generic matters. `src/shared/db/client.ts` builds its client as
 * `drizzle(sqlClient, { schema })`, so its type is
 * `NeonHttpDatabase<typeof schema>` — NOT the bare `NeonHttpDatabase`, whose
 * generic defaults to `Record<string, never>` and is therefore incompatible
 * with it. Spelling the schema out here is what lets one adapter take both
 * handles; the bare form compiled only while nothing had wired the
 * production client yet.
 */
export type ModuleDb = NeonHttpDatabase<typeof schema> | PgliteDatabase;
