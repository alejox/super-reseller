import type { CatalogRepository } from "../../domain/catalog-repository";
import { DuplicatePlanIdentityError, type Plan, type PlanKind } from "../../domain/plan";
import { CATALOG_CURRENCY, parseAmountMinor, parseDurationDays } from "./catalog-amounts";

/**
 * ADMIN use case: add a plan together with its first price.
 *
 * The two are ONE operation because a plan with no price at any tier is
 * invisible to every reseller (CAT: Missing Tier Price Blocks Sale) — the
 * repository would happily create one, and it would be a product nobody can
 * buy and nobody can see is broken.
 */

export type CreatePlanDeps = Readonly<{
  catalog: Pick<
    CatalogRepository,
    "createPlanWithInitialPrice" | "findServiceById" | "listPriceTiers"
  >;
}>;

export type CreatePlanResult =
  | Readonly<{ ok: true; plan: Plan }>
  | Readonly<{
      ok: false;
      reason:
        | "service-unknown"
        | "name-required"
        | "kind-invalid"
        | "duration-invalid"
        | "tier-unknown"
        | "amount-invalid"
        | "duplicate-plan";
    }>;

/** Mirrors `plan_kind_check`; a third kind may be licensed later. */
const PLAN_KINDS: readonly string[] = ["SCREEN", "FULL_ACCOUNT"];

/** Everything a form submits is a string; parsing is part of the use case. */
export type CreatePlanInput = Readonly<{
  serviceId: string;
  name: string;
  kind: string;
  durationDays: string;
  priceTierId: string;
  amountMinor: string;
}>;

export async function createPlanAsAdmin(
  deps: CreatePlanDeps,
  input: CreatePlanInput,
): Promise<CreatePlanResult> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, reason: "name-required" };
  }
  if (!PLAN_KINDS.includes(input.kind)) {
    return { ok: false, reason: "kind-invalid" };
  }

  const durationDays = parseDurationDays(input.durationDays);
  if (durationDays === null) {
    return { ok: false, reason: "duration-invalid" };
  }

  const amountMinor = parseAmountMinor(input.amountMinor);
  if (amountMinor === null) {
    return { ok: false, reason: "amount-invalid" };
  }

  // Both foreign keys are checked before writing. The database would reject a
  // bad id anyway (`service_id`/`price_tier_id` REFERENCES ... ON DELETE
  // restrict), but as a raw constraint violation no form can render.
  if ((await deps.catalog.findServiceById(input.serviceId)) === null) {
    return { ok: false, reason: "service-unknown" };
  }
  const tiers = await deps.catalog.listPriceTiers();
  if (!tiers.some((tier) => tier.id === input.priceTierId)) {
    return { ok: false, reason: "tier-unknown" };
  }

  try {
    const plan = await deps.catalog.createPlanWithInitialPrice({
      serviceId: input.serviceId,
      name,
      kind: input.kind as PlanKind,
      durationDays,
      priceTierId: input.priceTierId,
      amountMinor,
      currency: CATALOG_CURRENCY,
    });
    return { ok: true, plan };
  } catch (error: unknown) {
    // `plan_identity_uniq` is a partial unique index over ACTIVE plans, so
    // this cannot be pre-checked without racing the insert. Catching the
    // repository's own typed error is the honest translation.
    if (error instanceof DuplicatePlanIdentityError) {
      return { ok: false, reason: "duplicate-plan" };
    }
    throw error;
  }
}
