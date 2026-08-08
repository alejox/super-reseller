import type { ProviderAccount } from "@/modules/provider-accounts/domain/provider-account";
import type { SellablePlanListing } from "@/modules/catalog/domain/catalog-repository";
import { formatMoney } from "@/shared/money/money";

import { PurchaseBuyButton } from "./purchase-buy-button";

import { Table, Td, Th, Tr } from "@/app/_components/ui/table";

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

export function PurchaseSection({
  accounts,
  sellablePlans,
}: Readonly<{
  accounts: readonly ProviderAccount[];
  sellablePlans: readonly SellablePlanListing[];
}>) {
  return (
    <div className="mt-8 space-y-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Comprar o recargar
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {serviceName} — {account.label ?? account.panelUsername}
            </h3>
            {durations.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                No hay duraciones disponibles para este servicio en su lista de precios.
              </p>
            ) : (
              <div className="mt-3">
                <Table>
                  <thead>
                    <Tr head>
                      <Th scope="col">Duración</Th>
                      <Th scope="col">Precio</Th>
                      <Th scope="col">
                        <span className="sr-only">Comprar</span>
                      </Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {durations.map((entry) => (
                      <Tr key={entry.plan.id}>
                        <Td className="font-medium">{durationLabel(entry.plan.durationDays)}</Td>
                        <Td className="font-semibold">{formatMoney(entry.price, "es-CO")}</Td>
                        <Td>
                          <PurchaseBuyButton planId={entry.plan.id} providerAccountId={account.id} />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
