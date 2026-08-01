import { describe, expect, it } from "vitest";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";

import * as catalogSchema from "./catalog.schema";

/**
 * CAT: No Inventory or Subscription Entities. Inspects the complete
 * catalog schema produced by this slice (identity's schema, added in
 * slice 4, needs the equivalent check there — this test is scoped to what
 * slice 3b actually ships).
 */
describe("catalog schema", () => {
  const tables = Object.values(catalogSchema) as PgTable[];
  const tableConfigs = tables.map((table) => getTableConfig(table));

  it("does not contain a StockAccount, ProfileSlot, or Subscription table", () => {
    const forbiddenTableNames = ["stock_account", "profile_slot", "subscription"];
    const actualTableNames = tableConfigs.map((config) => config.name);

    for (const forbidden of forbiddenTableNames) {
      expect(actualTableNames).not.toContain(forbidden);
    }
  });

  it("does not contain any column storing a username, password, or credential", () => {
    const forbiddenColumnPattern = /(username|password|credential|secret)/i;

    for (const config of tableConfigs) {
      for (const column of config.columns) {
        expect(column.name).not.toMatch(forbiddenColumnPattern);
      }
    }
  });

  it("ships exactly the four catalog tables the design specifies", () => {
    const actualTableNames = tableConfigs.map((config) => config.name).sort();
    expect(actualTableNames).toEqual(["plan", "plan_price", "price_tier", "service"]);
  });
});
