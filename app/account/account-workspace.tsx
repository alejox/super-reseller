import { accountDeps } from "./account-deps";
import { CreateProviderAccountForm } from "./provider-account-form";
import { PurchaseSection } from "./purchase-section";

import { CARD_CLASS, Card } from "@/app/_components/ui/card";
import { Table, Td, Th, Tr } from "@/app/_components/ui/table";

/**
 * The dynamic half of the customer panel — mirrors
 * `app/admin/customers/customers-workspace.tsx`'s `CustomersWorkspace`.
 * List + create only, like the customers screen: PA scope is provider
 * accounts, not orders (that seam belongs to `payment-gateway`/PR3).
 */

export async function AccountWorkspace() {
  const deps = await accountDeps();

  const [accounts, sellablePlans] = await Promise.all([
    deps.providerAccounts.listForTenant(deps.tenantId),
    deps.catalog.listSellablePlans(),
  ]);

  // Provider identity, not plan identity: several sellable plans can share
  // one service, so this dedupes to the services actually offered at this
  // customer's tier.
  const services = [
    ...new Map(
      sellablePlans.map((entry) => [entry.plan.serviceId, entry.serviceName] as const),
    ).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return (
    <Card as="section" aria-labelledby="account-heading">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50" id="account-heading">
        Mis cuentas de proveedor
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Registre el usuario real que usa en cada servicio. No solicitamos contraseñas.
      </p>

      <div className="mt-4">
        {accounts.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            Todavía no tiene cuentas registradas.
          </p>
        ) : (
          <Table minWidth="lg">
            <thead>
              <Tr head>
                <Th scope="col">Servicio</Th>
                <Th scope="col">Usuario</Th>
                <Th scope="col">Etiqueta</Th>
              </Tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <Tr key={account.id}>
                  <Td className="font-medium text-zinc-950 dark:text-zinc-50">
                    {serviceNameById.get(account.serviceId) ?? account.serviceId}
                  </Td>
                  <Td>{account.panelUsername}</Td>
                  <Td>{account.label ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {services.length === 0 ? (
        <p className="mt-6 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          Todavía no hay servicios disponibles en su lista de precios.
        </p>
      ) : (
        <CreateProviderAccountForm services={services} />
      )}

      {/* CP: Purchase Flow Opens On Account Creation When Empty — with no
          accounts there is nothing to buy a duration FOR, so this section
          simply does not render rather than showing an empty selector. */}
      {accounts.length > 0 && (
        <PurchaseSection accounts={accounts} sellablePlans={sellablePlans} />
      )}
    </Card>
  );
}

export function AccountWorkspaceFallback() {
  return (
    <div className={`${CARD_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100 dark:bg-zinc-800/60" />
      <div className="mt-6 h-24 rounded bg-zinc-50 dark:bg-zinc-800/40" />
    </div>
  );
}
