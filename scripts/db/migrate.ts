import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const MIGRATIONS_FOLDER = "./drizzle";

/**
 * Run this against Supabase's SESSION pooler (port 5432), not the transaction
 * pooler the app uses. Drizzle's migrator wraps each migration in a
 * transaction and holds session state across statements; transaction-mode
 * pooling hands out a different backend per statement and breaks that.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Export the Supabase session-pooler connection string (port 5432) before running db:migrate.",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const db = drizzle(pool);
    console.log(`Applying migrations from ${MIGRATIONS_FOLDER}...`);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Migrations applied.");
  } finally {
    // An open pool keeps the Node process alive forever; the previous HTTP
    // driver held no socket, so this was not needed before.
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
