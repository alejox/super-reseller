import { describe, it, expect } from "vitest";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { bigint, pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * design.md open question: "Confirm at slice 2 that @neondatabase/serverless
 * HTTP mode returns bigint as a JS number under Drizzle's mode: 'number'."
 *
 * BLOCKED in this batch: no Neon branch is provisioned and DATABASE_URL is
 * not set (explicit instruction for this apply run — do not provision one).
 * This probe is written and ready to run the moment a real branch exists;
 * it self-skips when DATABASE_URL is absent so it never fails CI on a
 * missing environment variable. To unblock: provision a Neon branch, export
 * DATABASE_URL, and run `npm test -- tests/migrations/neon-bigint-mode.test.ts`.
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("Neon HTTP driver bigint mode: 'number'", () => {
  it("returns a bigint column as a JS number, not a string or bigint", async () => {
    const db = drizzle(neon(databaseUrl as string));
    const probe = pgTable("bigint_mode_probe", {
      amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    });

    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS bigint_mode_probe (amount_minor bigint NOT NULL)`,
    );
    await db.execute(sql`DELETE FROM bigint_mode_probe`);
    await db.insert(probe).values({ amountMinor: 12345 });

    const [row] = await db.select().from(probe);

    expect(typeof row?.amountMinor).toBe("number");
    expect(row?.amountMinor).toBe(12345);

    await db.execute(sql`DROP TABLE bigint_mode_probe`);
  });
});
