import type { CredentialsRepository } from "@/modules/identity/domain/credentials-repository";
import type { PriceTierId, ResellerId, UserId } from "@/modules/identity/domain/ids";
import type { PasswordHasher } from "@/modules/identity/domain/password-hasher";
import type { UserProvisioning } from "@/modules/identity/domain/user-provisioning";
import { normalizeEmail } from "../auth/authenticate";
import { MINIMUM_PASSWORD_LENGTH } from "./provision-admin";

/**
 * ADMIN use case: create a reseller account.
 *
 * Unlike `provisionAdmin` — the bootstrap path that runs from a shell with no
 * session — this one always runs behind an authenticated ADMIN, from the
 * admin panel, because a reseller needs a price tier and a tier is something
 * only an operator looking at the catalog can choose.
 */

export type ProvisionResellerDeps = Readonly<{
  users: CredentialsRepository;
  provisioning: UserProvisioning;
  hasher: PasswordHasher;
  /**
   * Injected rather than imported. A price tier is CATALOG's fact, and
   * eslint.config.mjs forbids identity from importing `@/modules/catalog/*`
   * at all — cross-module references are by id only. The composition root
   * supplies the lookup, so this use case still owns the rule without owning
   * the dependency.
   */
  tierExists: (priceTierId: PriceTierId) => Promise<boolean>;
  newUserId: () => UserId;
  newResellerId: () => ResellerId;
  now?: () => Date;
}>;

export type ProvisionResellerResult =
  | Readonly<{ ok: true; user: { id: UserId; email: string; resellerId: ResellerId } }>
  | Readonly<{
      ok: false;
      reason:
        | "email-invalid"
        | "email-taken"
        | "password-too-short"
        | "tier-required"
        | "tier-unknown";
    }>;

/**
 * Deliberately shallow: it rejects what is obviously not an address, and
 * leaves the rest to delivery. A stricter pattern would reject valid
 * addresses, and no pattern can prove an address receives mail.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

export async function provisionReseller(
  deps: ProvisionResellerDeps,
  input: Readonly<{ email: string; password: string; priceTierId: string }>,
): Promise<ProvisionResellerResult> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_SHAPE.test(email)) {
    return { ok: false, reason: "email-invalid" };
  }
  if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
    return { ok: false, reason: "password-too-short" };
  }

  const priceTierId = input.priceTierId.trim();
  if (priceTierId === "") {
    return { ok: false, reason: "tier-required" };
  }
  if (!(await deps.tierExists(priceTierId))) {
    return { ok: false, reason: "tier-unknown" };
  }

  // `users_email_lower_uniq` would reject the duplicate anyway; checking
  // first turns a raw constraint violation into an answer a form can render.
  if ((await deps.users.findByEmail(email)) !== null) {
    return { ok: false, reason: "email-taken" };
  }

  const id = deps.newUserId();
  // A top-level reseller owns its own tenant. Every account this reseller
  // later gets will share this id, which is what `tenantWhere` filters on.
  const resellerId = deps.newResellerId();

  await deps.provisioning.createReseller({
    id,
    email,
    passwordHash: await deps.hasher.hash(input.password),
    resellerId,
    priceTierId,
    createdAt: deps.now?.() ?? new Date(),
  });

  return { ok: true, user: { id, email, resellerId } };
}
