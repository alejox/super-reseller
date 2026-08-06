import { describe, it, expect } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { bigint, pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * design.md open question: confirm the production driver returns bigint as a
 * JS number under Drizzle's `mode: 'number'`.
 *
 * This matters more on node-postgres than it did on Neon HTTP. `pg` parses
 * int8 (OID 20) as a STRING by default, because a 64-bit integer does not fit
 * in a JS number without loss. Drizzle's `mode: 'number'` is what converts it
 * back. Money is stored as `amount_minor bigint`, so a silent string here
 * would poison every price comparison in the catalog.
 *
 * Self-skips when DATABASE_URL is absent so it never fails CI on a missing
 * environment variable. To run it against Supabase:
 *   DATABASE_URL='<session pooler string>' npm test -- tests/migrations/pg-bigint-mode.test.ts
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("node-postgres driver bigint mode: 'number'", () => {
  it("returns a bigint column as a JS number, not a string or bigint", async () => {
    const pool = new Pool({ connectionString: databaseUrl as string });
    const db = drizzle(pool);
    const probe = pgTable("bigint_mode_probe", {
      amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    });

    try {
      await db.execute(
        sql`CREATE TABLE IF NOT EXISTS bigint_mode_probe (amount_minor bigint NOT NULL)`,
      );
      await db.execute(sql`DELETE FROM bigint_mode_probe`);
      await db.insert(probe).values({ amountMinor: 12345 });

      const [row] = await db.select().from(probe);

      expect(typeof row?.amountMinor).toBe("number");
      expect(row?.amountMinor).toBe(12345);

      await db.execute(sql`DROP TABLE bigint_mode_probe`);
    } finally {
      // A leaked pool keeps the vitest process alive after the assertions pass.
      await pool.end();
    }
  });
});
