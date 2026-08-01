import type { UserId } from "./ids";
import type { UserRole } from "./user-role";

/**
 * The credential row login needs, and nothing more: no email, no tier, no
 * reseller id. Login is the one read that legitimately happens *before* an
 * `AccessScope` exists, so this port is deliberately separate from
 * `ScopedUsersRepository` — it is the narrowest possible unscoped surface,
 * and keeping it narrow is what stops it from becoming a tenancy hole.
 */
export type UserCredentials = Readonly<{
  id: UserId;
  role: UserRole;
  /** argon2id PHC string from `users.password_hash`. */
  passwordHash: string;
  /** Soft-delete marker; a non-null value denies login. */
  deactivatedAt: Date | null;
}>;

export interface CredentialsRepository {
  /**
   * Looks a user up by an already-normalized email (see `normalizeEmail`).
   * Callers MUST pass the normalized form: the database's uniqueness is
   * `UNIQUE INDEX users_email_lower_uniq ON (lower(email))`, so a
   * case-sensitive lookup could miss the very row Postgres treats as the
   * duplicate. Returns `null` when no user matches.
   */
  findByEmail(normalizedEmail: string): Promise<UserCredentials | null>;
}
