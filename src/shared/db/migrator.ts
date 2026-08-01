import { sql, type SQL } from "drizzle-orm";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Hand-authored down migrations (design.md: "Decision: hand-authored down
 * migrations"). `drizzle-kit generate` is forward-only, so every generated
 * `drizzle/<tag>.sql` needs a matching `drizzle/down/<tag>.down.sql`
 * written by hand. This module reads the same `meta/_journal.json` that
 * `drizzle-orm`'s own migrator reads, correlates applied migrations by
 * position, and runs the matching down file.
 */

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

// Non-generic on purpose: PgliteDatabase#execute and NeonHttpDatabase#execute
// return a `PgRaw<Results<TRow>>` thenable whose own `.then()` overload is
// narrower than the plain `Promise` this interface would otherwise declare.
// A generic `TRow` on this method makes TS treat that overload as unsound
// ("TRow could be instantiated with an arbitrary type") and reject both
// concrete drivers as incompatible. Fixing the row shape to
// `Record<string, unknown>` matches each driver's own default and keeps
// this interface structurally assignable from both.
export interface RollbackableDb {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

interface JournalEntry {
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

export class NoMigrationsToRollbackError extends Error {
  constructor() {
    super("No applied migrations remain to roll back.");
    this.name = "NoMigrationsToRollbackError";
  }
}

export class MissingDownMigrationError extends Error {
  constructor(
    public readonly tag: string,
    public readonly expectedPath: string,
  ) {
    super(
      `Missing hand-authored down migration for "${tag}" at ${expectedPath}`,
    );
    this.name = "MissingDownMigrationError";
  }
}

function readJournalTags(migrationsFolder: string): string[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as Journal;
  return journal.entries.map((entry) => entry.tag);
}

/**
 * Number of migrations currently recorded as applied. Returns 0 without
 * error when `migrate()` has never run yet, since drizzle only creates the
 * `__drizzle_migrations` table lazily on first apply.
 */
export async function appliedMigrationCount(db: RollbackableDb): Promise<number> {
  const existsResult = await db.execute(
    sql.raw(
      `SELECT to_regclass('"${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"') IS NOT NULL AS exists`,
    ),
  );
  if (!existsResult.rows[0]?.exists) {
    return 0;
  }

  const result = await db.execute(
    sql.raw(
      `SELECT count(*)::int AS count FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
    ),
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Rolls back the most recently applied migration: runs its hand-authored
 * down file, then deletes the corresponding `__drizzle_migrations` row.
 * Returns the tag of the migration that was rolled back.
 */
export async function rollbackLast(
  db: RollbackableDb,
  migrationsFolder: string,
): Promise<string> {
  const tags = readJournalTags(migrationsFolder);
  const appliedCount = await appliedMigrationCount(db);

  if (appliedCount === 0) {
    throw new NoMigrationsToRollbackError();
  }

  const tag = tags[appliedCount - 1];
  if (!tag) {
    throw new NoMigrationsToRollbackError();
  }

  const downPath = path.join(migrationsFolder, "down", `${tag}.down.sql`);
  let downSql: string;
  try {
    downSql = readFileSync(downPath, "utf-8");
  } catch {
    throw new MissingDownMigrationError(tag, downPath);
  }

  await db.execute(sql.raw(downSql));
  await db.execute(
    sql.raw(
      `DELETE FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" WHERE id = (SELECT id FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ORDER BY id DESC LIMIT 1)`,
    ),
  );

  return tag;
}

/** Rolls back every applied migration, most recent first. */
export async function rollbackAll(
  db: RollbackableDb,
  migrationsFolder: string,
): Promise<string[]> {
  const rolledBack: string[] = [];
  while ((await appliedMigrationCount(db)) > 0) {
    rolledBack.push(await rollbackLast(db, migrationsFolder));
  }
  return rolledBack;
}
