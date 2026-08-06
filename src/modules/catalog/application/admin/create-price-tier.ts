import type { CatalogRepository } from "../../domain/catalog-repository";
import type { PriceTier } from "../../domain/price-tier";

/**
 * ADMIN use case: add a price tier.
 *
 * Tiers come first in the catalog's dependency chain — a plan cannot be
 * created without one, because `createPlanWithInitialPrice` demands a tier to
 * price it at (CAT: Missing Tier Price Blocks Sale).
 *
 * Like `provisionAdmin` and unlike `logIn`, this one names its failures: the
 * caller is an authenticated operator filling in a form who needs to know
 * what to fix, not an anonymous request that could be probing.
 */

export type CreatePriceTierDeps = Readonly<{
  catalog: Pick<CatalogRepository, "createPriceTier" | "listPriceTiers">;
}>;

export type CreatePriceTierResult =
  | Readonly<{ ok: true; tier: PriceTier }>
  | Readonly<{
      ok: false;
      reason: "code-required" | "code-invalid" | "name-required" | "code-taken";
    }>;

/**
 * Codes are machine-facing identifiers, so they stay ASCII, upper-case, and
 * separator-free: they end up in URLs, exports, and operator conversation.
 * A display label belongs in `name`, which has no such restriction.
 */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export async function createPriceTierAsAdmin(
  deps: CreatePriceTierDeps,
  input: Readonly<{ code: string; name: string }>,
): Promise<CreatePriceTierResult> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (code === "") {
    return { ok: false, reason: "code-required" };
  }
  if (!CODE_PATTERN.test(code)) {
    return { ok: false, reason: "code-invalid" };
  }
  if (name === "") {
    return { ok: false, reason: "name-required" };
  }

  // `price_tier.code` is UNIQUE, and Postgres compares text case-sensitively.
  // Normalizing to upper case above is what makes "MAYOR" and "mayor" collide
  // here instead of becoming two indistinguishable tiers; this lookup then
  // turns that collision into an answer a form can render.
  const existing = await deps.catalog.listPriceTiers();
  if (existing.some((tier) => tier.code === code)) {
    return { ok: false, reason: "code-taken" };
  }

  return { ok: true, tier: await deps.catalog.createPriceTier({ code, name }) };
}
