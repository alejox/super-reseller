import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

/**
 * PGlite test harness (design.md: "Testing Strategy" — real Postgres in
 * WASM, in-process, no Docker, no network). Every module's repository
 * contract suite (slice 3b onward) creates one instance per test via this
 * helper and disposes it afterward.
 */
export interface TestDb {
  client: PGlite;
  db: PgliteDatabase;
}

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client);
  return { client, db };
}

export async function closeTestDb(testDb: TestDb): Promise<void> {
  await testDb.client.close();
}
