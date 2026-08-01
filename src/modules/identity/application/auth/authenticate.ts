import type {
  CredentialsRepository,
  UserCredentials,
} from "@/modules/identity/domain/credentials-repository";
import type { PasswordHasher } from "@/modules/identity/domain/password-hasher";
import type { UserId } from "@/modules/identity/domain/ids";
import type { UserRole } from "@/modules/identity/domain/user-role";

export type AuthenticatedUser = Readonly<{
  id: UserId;
  role: UserRole;
}>;

/**
 * Every failure collapses to one reason on purpose. Unknown email, wrong
 * password, and deactivated account are indistinguishable to the caller —
 * separating them would hand back the user-enumeration oracle that the
 * dummy-hash path below exists to close.
 */
export type AuthenticationResult =
  | Readonly<{ ok: true; user: AuthenticatedUser }>
  | Readonly<{ ok: false; reason: "invalid-credentials" }>;

export type AuthenticateDeps = Readonly<{
  users: CredentialsRepository;
  hasher: PasswordHasher;
  /**
   * A real argon2id hash of an unguessable password, produced with the same
   * parameters as stored hashes. It is verified against when the email is
   * unknown, so the failing path costs the same as the succeeding one.
   */
  dummyPasswordHash: string;
}>;

export type AuthenticateInput = Readonly<{
  email: string;
  password: string;
}>;

/**
 * Case-folds and trims an email to the form `users_email_lower_uniq`
 * indexes. Exported because every write path that inserts a user has to
 * agree with the lookup, or a "duplicate" would be rejected by Postgres
 * after passing an application-level check.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Constant-path login verification (design.md "Auth and Session"): exactly
 * one `hasher.verify` call runs on every branch, against the stored hash
 * when the email is known and against `dummyPasswordHash` when it is not.
 * The result is only inspected *after* that verify completes, so an
 * attacker timing the response cannot tell which emails exist.
 */
export async function authenticate(
  deps: AuthenticateDeps,
  input: AuthenticateInput,
): Promise<AuthenticationResult> {
  const found: UserCredentials | null = await deps.users.findByEmail(normalizeEmail(input.email));

  // Chosen before verifying, never conditionally skipped: an early return
  // for the unknown-email case is exactly the timing leak being avoided.
  const passwordHash = found?.passwordHash ?? deps.dummyPasswordHash;
  const passwordMatches = await deps.hasher.verify(passwordHash, input.password);

  if (found === null || !passwordMatches || found.deactivatedAt !== null) {
    return { ok: false, reason: "invalid-credentials" };
  }

  return { ok: true, user: { id: found.id, role: found.role } };
}
