import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { rollbackLast } from "../../src/shared/db/migrator";

const MIGRATIONS_FOLDER = "./drizzle";

/** Same connection rule as `migrate.ts`: session pooler, port 5432. */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Export the Supabase session-pooler connection string (port 5432) before running db:rollback.",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(pool);
    const tag = await rollbackLast(db, MIGRATIONS_FOLDER);
    console.log(`Rolled back migration: ${tag}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
