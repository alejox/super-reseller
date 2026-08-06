import { describe, expect, it } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";

import * as schema from "./schema";

/**
 * EB-5: No Mutable Balance Column. `verify-report.md` CRITICAL 1: a
 * repo-wide grep confirms zero occurrences of `balance` today, but grep is
 * not a covering test — nothing stopped a future migration from adding a
 * mutable balance column while every other test stayed green.
 *
 * This scans `shared/db/schema.ts`, the single barrel every module's
 * `infrastructure/*.schema.ts` is required to re-export through (see that
 * file's own header — drizzle-kit's `drizzle.config.ts` has exactly one
 * schema entry point). A future module that skips the barrel does not ship
 * a real migration either, so this is the correct — and only — place to
 * assert the invariant once for the whole product, not once per module.
 *
 * Asserted against the actual Drizzle table definitions via
 * `getTableConfig`, not a hand-maintained table/column list: adding a table
 * or a column requires no change here.
 */
describe("complete schema barrel (EB-5: No Mutable Balance Column)", () => {
  const tables = (Object.values(schema) as unknown[]).filter((value) => is(value, PgTable)) as PgTable[];
  const tableConfigs = tables.map((table) => getTableConfig(table));

  it("re-exports at least one table, so this guard is not vacuous", () => {
    expect(tableConfigs.length).toBeGreaterThan(0);
  });

  it("contains no column whose name matches /balance/i, in any table", () => {
    const forbiddenColumnPattern = /balance/i;

    for (const config of tableConfigs) {
      for (const column of config.columns) {
        expect(`${config.name}.${column.name}`).not.toMatch(forbiddenColumnPattern);
      }
    }
  });
});
