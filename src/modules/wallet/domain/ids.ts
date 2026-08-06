/**
 * Wallet identifiers. Plain `string` (UUID) aliases, mirroring
 * catalog/domain/ids.ts and identity/domain/ids.ts. Cross-module references
 * are by id only (design.md: "Technical Approach"), so `ResellerId` and
 * `UserId` here are structurally-identical local aliases — never an import
 * of identity's entity types.
 */
export type WalletEntryId = string;
export type ResellerId = string;
export type UserId = string;
