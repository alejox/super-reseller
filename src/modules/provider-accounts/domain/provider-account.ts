import type { ProviderAccountId, ServiceId, TenantId, UserId } from "./ids";

/**
 * A customer-owned record of a streaming/provider account (spec.md
 * "Purpose"): which provider, the REAL identifier the customer uses on that
 * provider's panel, and a customer-facing label — with no credential, no
 * secret, and no expiry lifecycle (PA: No Credential Or Lifecycle Fields
 * Exist).
 */
export type ProviderAccount = Readonly<{
  id: ProviderAccountId;
  /** The owning CUSTOMER's tenant id — never a reseller's. */
  tenantId: TenantId;
  serviceId: ServiceId;
  /** The REAL panel identifier (obs #422's correction) — never a credential. */
  panelUsername: string;
  /** Optional customer-facing nickname, distinct from the real identifier. */
  label: string | null;
  /** The customer itself, or the ADMIN acting on its behalf. */
  createdBy: UserId;
  createdAt: Date;
  /** Soft delete: an archived identity frees itself for re-registration. */
  archivedAt: Date | null;
}>;

export type NewProviderAccountInput = Readonly<{
  tenantId: TenantId;
  serviceId: ServiceId;
  panelUsername: string;
  label?: string | null;
  createdBy: UserId;
  createdAt?: Date;
}>;

export class InvalidProviderAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProviderAccountError";
  }
}

/**
 * PA: Provider Account Identifies A Real Panel Login. `panelUsername` must
 * be a real, non-blank identifier — the same shape the schema-level
 * `provider_account_panel_username_check` enforces at the database layer.
 *
 * Deliberately does NOT reject a duplicate (same tenant, same service, same
 * panel username): PA: Duplicate Provider Is Allowed lets two accounts for
 * the same provider coexist; the SAME identity registered twice is a
 * repository/schema concern (`provider_account_identity_uniq`), not a rule
 * this pure constructor can or should know about.
 */
export function createProviderAccount(input: NewProviderAccountInput): ProviderAccount {
  const panelUsername = input.panelUsername.trim();
  if (panelUsername === "") {
    throw new InvalidProviderAccountError(
      "A provider_account requires a real panel username.",
    );
  }

  const label = input.label?.trim();

  return Object.freeze({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    serviceId: input.serviceId,
    panelUsername,
    label: label === undefined || label === "" ? null : label,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
    archivedAt: null,
  });
}
