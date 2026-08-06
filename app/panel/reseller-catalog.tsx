import type { SellablePlanListing } from "@/modules/catalog/domain/catalog-repository";
import { getScope, verifySession } from "@/modules/identity/application/dal";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { formatMoney } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";

/**
 * The reseller's catalog.
 *
 * There is no tier parameter anywhere in this file, and there cannot be: the
 * factory hands a RESELLER scope a repository already bound to that scope's
 * tier, on a type that has no method taking one. "Show me another tier's
 * prices" is not a question this page is able to ask.
 */

const PLAN_KIND_LABELS: Readonly<Record<string, string>> = {
  SCREEN: "Pantalla",
  FULL_ACCOUNT: "Cuenta completa",
};

const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200";

function groupByService(
  plans: readonly SellablePlanListing[],
): readonly (readonly [string, readonly SellablePlanListing[]])[] {
  const groups = new Map<string, SellablePlanListing[]>();
  for (const entry of plans) {
    const forService = groups.get(entry.serviceName) ?? [];
    forService.push(entry);
    groups.set(entry.serviceName, forService);
  }

  return [...groups.entries()]
    .map(([name, entries]) => {
      const sorted = [...entries].sort(
        (a, b) => a.plan.durationDays - b.plan.durationDays,
      );
      return [name, sorted] as const;
    })
    .sort((a, b) => a[0].localeCompare(b[0], "es"));
}

export async function ResellerCatalog() {
  const session = await verifySession();
  const scope = await getScope();

  // The narrowing has to happen BEFORE `.for(scope)`, not after: the factory's
  // return type is conditional on the scope's kind, so calling it with the
  // un-narrowed union yields a union of both surfaces on which neither
  // surface's methods exist. Narrowing first is what selects the reseller
  // repository — and with it, the tier binding.
  if (scope.kind !== "reseller") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Esta vista es para cuentas de revendedor. Su cuenta es de administración.
      </p>
    );
  }

  const catalog = createDrizzleScopedCatalogRepositoryFactory(getDb()).for(scope);
  const plans = await catalog.listSellablePlans();

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Todavía no hay planes disponibles para su lista de precios.
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {/* The honest explanation of an empty catalog: a plan without a
              current price at THIS tier is not sellable, and the join that
              builds this list drops it rather than showing another tier's
              price (CAT: Missing Tier Price Blocks Sale). */}
          Un plan sin precio asignado a su lista no aparece aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Precios de su lista asignada ({session.priceTierId ? "activa" : "sin asignar"}).
      </p>
      {groupByService(plans).map(([serviceName, entries]) => (
        <section key={serviceName}>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{serviceName}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-md border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className={TH_CLASS} scope="col">Plan</th>
                  <th className={TH_CLASS} scope="col">Tipo</th>
                  <th className={TH_CLASS} scope="col">Duración</th>
                  <th className={TH_CLASS} scope="col">Precio</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                    key={entry.plan.id}
                  >
                    <td className={`${TD_CLASS} font-medium`}>{entry.plan.name}</td>
                    <td className={TD_CLASS}>
                      {PLAN_KIND_LABELS[entry.plan.kind] ?? entry.plan.kind}
                    </td>
                    <td className={TD_CLASS}>{entry.plan.durationDays} días</td>
                    <td className={`${TD_CLASS} font-semibold`}>
                      {formatMoney(entry.price, "es-CO")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
