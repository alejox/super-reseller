import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { rollbackLast } from "../../src/shared/db/migrator";

const MIGRATIONS_FOLDER = "./drizzle";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Export it (a Neon branch connection string) before running db:rollback.",
    );
  }

  const db = drizzle(neon(databaseUrl));

  const tag = await rollbackLast(db, MIGRATIONS_FOLDER);
  console.log(`Rolled back migration: ${tag}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
