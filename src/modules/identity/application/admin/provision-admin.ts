import type { CredentialsRepository } from "@/modules/identity/domain/credentials-repository";
import type { UserId } from "@/modules/identity/domain/ids";
import type { PasswordHasher } from "@/modules/identity/domain/password-hasher";
import type { UserProvisioning } from "@/modules/identity/domain/user-provisioning";
import { normalizeEmail } from "../auth/authenticate";

/**
 * Minimum seed password length. This is a bootstrap guard, not a product
 * password policy: the first admin account is created from a shell, where
 * nothing else stops someone from typing "1234".
 *
 * Lowered from 12 to 10 on 2026-08-01 at the owner's explicit request, to
 * admit an existing credential. Nothing in the spec or design pins this
 * number — it is a local judgement call, which is exactly why the boundary
 * is pinned by literal-valued tests: the next person to lower it has to
 * change a test that says "9 characters is refused" and mean it.
 */
export const MINIMUM_PASSWORD_LENGTH = 10;

export type ProvisionAdminDeps = Readonly<{
  users: CredentialsRepository;
  provisioning: UserProvisioning;
  hasher: PasswordHasher;
  newUserId: () => UserId;
  now?: () => Date;
}>;

export type ProvisionAdminResult =
  | Readonly<{ ok: true; user: { id: UserId; email: string } }>
  | Readonly<{ ok: false; reason: "email-taken" | "password-too-short" }>;

/**
 * Creates the first ADMIN account (`npm run db:seed-admin`).
 *
 * Unlike login, this one DOES distinguish its failures: the caller is an
 * operator at a terminal who needs to know what to fix, not an anonymous
 * request that could be probing for accounts.
 */
export async function provisionAdmin(
  deps: ProvisionAdminDeps,
  input: Readonly<{ email: string; password: string }>,
): Promise<ProvisionAdminResult> {
  if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
    return { ok: false, reason: "password-too-short" };
  }

  const email = normalizeEmail(input.email);

  // `users_email_lower_uniq` would reject the duplicate anyway; checking
  // first turns a raw constraint violation into an answer a CLI can print.
  if ((await deps.users.findByEmail(email)) !== null) {
    return { ok: false, reason: "email-taken" };
  }

  const id = deps.newUserId();
  await deps.provisioning.createAdmin({
    id,
    email,
    passwordHash: await deps.hasher.hash(input.password),
    createdAt: deps.now?.() ?? new Date(),
  });

  return { ok: true, user: { id, email } };
}
