import { eq, sql } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";

import type {
  CredentialsRepository,
  UserCredentials,
} from "../domain/credentials-repository";
import { users } from "./identity.schema";


/**
 * Drizzle-backed credential lookup for login. Deliberately NOT an
 * `AccessScope` consumer: login is the one read that precedes any scope,
 * and it selects a single row by a unique key — never a listing.
 */
export class DrizzleCredentialsRepository implements CredentialsRepository {
  constructor(private readonly db: ModuleDb) {}

  async findByEmail(normalizedEmail: string): Promise<UserCredentials | null> {
    // `lower(email) = $1` matches the expression indexed by
    // `users_email_lower_uniq`, so this stays an index scan AND agrees with
    // the exact key Postgres enforces uniqueness on. Comparing `email = $1`
    // would miss a row stored as "Owner@Example.com" that the database
    // already considers the same address.
    const [row] = await this.db
      .select({
        id: users.id,
        role: users.role,
        passwordHash: users.passwordHash,
        deactivatedAt: users.deactivatedAt,
      })
      .from(users)
      .where(eq(sql`lower(${users.email})`, normalizedEmail))
      .limit(1);

    return row ? Object.freeze({ ...row }) : null;
  }
}
