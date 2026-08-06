"use server";

import { refresh } from "next/cache";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { placeOrderAsReseller } from "@/modules/ordering/application/place-order";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { formatMoney, money } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";

export type BuyFormState = { readonly error: string } | undefined;

/**
 * The reseller's purchase action.
 *
 * `requireRole("RESELLER")` first: a Server Action is a public POST endpoint,
 * so the fact that only the reseller panel renders a Buy button proves
 * nothing about the request that arrives here.
 */
export async function buyPlanAction(
  _state: BuyFormState,
  formData: FormData,
): Promise<BuyFormState> {
  await requireRole("RESELLER");
  const scope = await getScope();

  if (scope.kind !== "reseller") {
    // Narrowed before the factory, whose return type is conditional on the
    // scope's kind. Unreachable after `requireRole`.
    throw new Error("A RESELLER session did not produce a reseller scope.");
  }

  const db = getDb();
  const catalog = createDrizzleScopedCatalogRepositoryFactory(db).for(scope);

  const result = await placeOrderAsReseller(
    {
      ordering: new DrizzleOrderingRepository(db, scope),
      // The price comes from the SCOPED catalog, never from the form. The
      // repository is bound to this reseller's tier, so there is no tier to
      // pass and no price to submit.
      resolveSellablePlan: async (planId) => {
        const sellable = await catalog.findSellablePlan(planId);
        return sellable === null
          ? null
          : {
              planPriceId: sellable.planPriceId,
              amountMinor: sellable.price.amountMinor,
              currency: sellable.price.currency,
            };
      },
      resellerId: scope.resellerId,
      placedBy: scope.userId,
    },
    { planId: String(formData.get("planId") ?? "") },
  );

  if (!result.ok) {
    if (result.reason === "insufficient-funds") {
      const balance = formatMoney(money(result.balanceMinor ?? 0, "COP"), "es-CO");
      const price = formatMoney(money(result.priceMinor ?? 0, "COP"), "es-CO");
      // Naming both numbers turns "you cannot afford this" into something the
      // reseller can act on without leaving the page to go and count.
      return { error: `Saldo insuficiente. El plan cuesta ${price} y su saldo es ${balance}.` };
    }
    return {
      error:
        result.reason === "plan-unavailable"
          ? "Ese plan ya no está disponible para su lista de precios."
          : "Seleccione un plan.",
    };
  }

  refresh();
  return undefined;
}
