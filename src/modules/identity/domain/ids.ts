/**
 * Identity identifiers. Plain `string` (UUID) aliases, mirroring
 * catalog/domain/ids.ts. Cross-module references are by id only
 * (design.md: "Technical Approach"), so the `price_tier_id` carried by a
 * RESELLER scope is a structurally-identical local alias — never an
 * import of catalog's entity types.
 */
export type UserId = string;
export type ResellerId = string;
export type PriceTierId = string;
/** `sessions.id` — the value carried inside the session cookie. */
export type SessionId = string;
