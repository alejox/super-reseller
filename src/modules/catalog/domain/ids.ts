/**
 * Catalog identifiers. Plain `string` (UUID) aliases — no `AccessScope`
 * branding here (that lands in slice 4, identity/tenancy). These exist so
 * repository and entity signatures read intention-revealing instead of
 * `string` everywhere.
 */
export type PriceTierId = string;
export type ServiceId = string;
export type PlanId = string;
export type PlanPriceId = string;
