import type { UserId } from "./ids";

export type NewAdminUser = Readonly<{
  id: UserId;
  /** Already normalized — see `normalizeEmail`. */
  email: string;
  /** argon2id PHC string. The plaintext password never reaches this port. */
  passwordHash: string;
  createdAt: Date;
}>;

/**
 * Account creation. Separate from `ScopedUsersRepository` because it runs
 * before any session exists — this is the bootstrap path that creates the
 * FIRST admin, when there is nobody to authorize it.
 *
 * ADMIN only, deliberately: creating resellers requires a price tier and
 * belongs to the admin panel, behind a real session.
 */
export interface UserProvisioning {
  createAdmin(user: NewAdminUser): Promise<void>;
}
