/**
 * Source-accounts identifiers. Plain `string` (UUID) aliases, mirroring
 * catalog/domain/ids.ts, wallet/domain/ids.ts and provider-accounts/domain/ids.ts.
 * Cross-module references are by id only, so `ServiceId` and `UserId` here are
 * structurally-identical local aliases — never an import of catalog's or
 * identity's entity types.
 *
 * There is deliberately NO `TenantId` here. A source account is owned by the
 * PLATFORM, not by a tenant: see the header of `source-account.ts`.
 */
export type SourceAccountId = string;
export type ServiceId = string;
export type UserId = string;
