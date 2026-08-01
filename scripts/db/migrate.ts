import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const MIGRATIONS_FOLDER = "./drizzle";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Export it (a Neon branch connection string) before running db:migrate.",
    );
  }

  const db = drizzle(neon(databaseUrl));

  console.log(`Applying migrations from ${MIGRATIONS_FOLDER}...`);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Migrations applied.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
