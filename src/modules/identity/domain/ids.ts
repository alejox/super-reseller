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
/**
 * The tenancy axis, generalized beyond `ResellerId` (design.md "Decision:
 * `role` becomes `text` + CHECK" + "Single-Level Tenant Ownership"). A
 * `RESELLER`'s tenant id and a `CUSTOMER`'s tenant id are both `TenantId` —
 * a freestanding id minted the same way, never derived from or nested under
 * another user's id. `tenantIdOf(scope)` is the one function that reads it.
 */
export type TenantId = string;
