import type { CredentialsRepository } from "@/modules/identity/domain/credentials-repository";
import type { PriceTierId, ResellerId, UserId } from "@/modules/identity/domain/ids";
import type { PasswordHasher } from "@/modules/identity/domain/password-hasher";
import type { UserProvisioning } from "@/modules/identity/domain/user-provisioning";
import { normalizeEmail } from "../auth/authenticate";
import { MINIMUM_PASSWORD_LENGTH } from "./provision-admin";

/**
 * ADMIN use case: create a customer account (CI: Only ADMIN Provisions A
 * Customer — there is no self-registration path).
 *
 * Mirrors `provisionReseller` exactly: both roles are provisioned the same
 * way behind the same `users_tier_matches_role` CHECK, and a customer needs
 * a retail price tier for the same reason a reseller needs one — a tier is
 * something only an operator looking at the catalog can choose (CI: Retail
 * Tier Is A Prerequisite For Provisioning).
 */

export type ProvisionCustomerDeps = Readonly<{
  users: CredentialsRepository;
  provisioning: UserProvisioning;
  hasher: PasswordHasher;
  /**
   * Injected rather than imported — same reason as `provisionReseller`:
   * eslint.config.mjs forbids identity from importing `@/modules/catalog/*`
   * at all. The composition root supplies the lookup.
   */
  tierExists: (priceTierId: PriceTierId) => Promise<boolean>;
  newUserId: () => UserId;
  /** The customer's own freestanding tenant id (CI: Customer Gets Its Own Tenant Id). */
  newResellerId: () => ResellerId;
  now?: () => Date;
}>;

export type ProvisionCustomerResult =
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

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

export async function provisionCustomer(
  deps: ProvisionCustomerDeps,
  input: Readonly<{ email: string; password: string; priceTierId: string }>,
): Promise<ProvisionCustomerResult> {
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
  // A customer owns its own tenant, exactly as a top-level reseller does
  // (design.md "Single-Level Tenant Ownership") — never derived from, or
  // nested under, any other user's id.
  const resellerId = deps.newResellerId();

  await deps.provisioning.createCustomer({
    id,
    email,
    passwordHash: await deps.hasher.hash(input.password),
    resellerId,
    priceTierId,
    createdAt: deps.now?.() ?? new Date(),
  });

  return { ok: true, user: { id, email, resellerId } };
}
