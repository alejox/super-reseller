/**
 * Provider-accounts identifiers. Plain `string` (UUID) aliases, mirroring
 * catalog/domain/ids.ts, identity/domain/ids.ts and wallet/domain/ids.ts.
 * Cross-module references are by id only (design.md: "Technical Approach"),
 * so `ServiceId`, `UserId` and `TenantId` here are structurally-identical
 * local aliases — never an import of catalog's or identity's entity types.
 */
export type ProviderAccountId = string;
export type ServiceId = string;
export type UserId = string;
/** The owning CUSTOMER's tenant id — `tenantIdOf(scope)` for a customer scope. */
export type TenantId = string;
