import type { ProviderAccount } from "@/modules/provider-accounts/domain/provider-account";
import type { SellablePlanListing } from "@/modules/catalog/domain/catalog-repository";
import { formatMoney } from "@/shared/money/money";

import { PurchaseBuyButton } from "./purchase-buy-button";

/**
 * CP: Purchase Flow Opens On Account Creation When Empty — this section is
 * rendered only when `accounts` is non-empty; `AccountWorkspace` decides
 * that, not this component.
 *
 * The duration selector confirmed by the maintainer (1/3/6/12 months) IS
 * `plan.durationDays` (30/90/180/365) — this maps the exact days a sellable
 * plan already carries to the label the customer picks, rather than parsing
 * a duration out of anything.
 */
const DURATION_LABELS: Readonly<Record<number, string>> = {
  30: "1 mes",
  90: "3 meses",
  180: "6 meses",
  365: "12 meses",
};

function durationLabel(days: number): string {
  return DURATION_LABELS[days] ?? `${days} días`;
}

const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

export function PurchaseSection({
  accounts,
  sellablePlans,
}: Readonly<{
  accounts: readonly ProviderAccount[];
  sellablePlans: readonly SellablePlanListing[];
}>) {
  return (
    <div className="mt-8 space-y-6 border-t border-zinc-200 pt-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950">Comprar o recargar</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Elija la duración para la cuenta que quiere recargar. El precio es el de su lista.
        </p>
      </div>

      {accounts.map((account) => {
        // A provider_account belongs to exactly one service — a duration
        // sellable for a different service does not apply to it.
        const durations = sellablePlans.filter(
          (entry) => entry.plan.serviceId === account.serviceId,
        );

        const serviceName = durations[0]?.serviceName ?? account.serviceId;

        return (
          <section key={account.id}>
            <h3 className="text-sm font-semibold text-zinc-900">
              {serviceName} — {account.label ?? account.panelUsername}
            </h3>
            {durations.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                No hay duraciones disponibles para este servicio en su lista de precios.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-md border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className={TH_CLASS} scope="col">Duración</th>
                      <th className={TH_CLASS} scope="col">Precio</th>
                      <th className={TH_CLASS} scope="col">
                        <span className="sr-only">Comprar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {durations.map((entry) => (
                      <tr className="border-b border-zinc-100 last:border-b-0" key={entry.plan.id}>
                        <td className={`${TD_CLASS} font-medium`}>
                          {durationLabel(entry.plan.durationDays)}
                        </td>
                        <td className={`${TD_CLASS} font-semibold`}>
                          {formatMoney(entry.price, "es-CO")}
                        </td>
                        <td className={TD_CLASS}>
                          <PurchaseBuyButton planId={entry.plan.id} providerAccountId={account.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
