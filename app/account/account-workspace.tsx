import { accountDeps } from "./account-deps";
import { CreateProviderAccountForm } from "./provider-account-form";
import { PurchaseSection } from "./purchase-section";

/**
 * The dynamic half of the customer panel — mirrors
 * `app/admin/customers/customers-workspace.tsx`'s `CustomersWorkspace`.
 * List + create only, like the customers screen: PA scope is provider
 * accounts, not orders (that seam belongs to `payment-gateway`/PR3).
 */

const SECTION_CLASS = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

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
    <section aria-labelledby="account-heading" className={SECTION_CLASS}>
      <h2 className="text-lg font-semibold text-zinc-950" id="account-heading">
        Mis cuentas de proveedor
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
        Registre el usuario real que usa en cada servicio. No solicitamos contraseñas.
      </p>

      <div className="mt-4">
        {accounts.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Todavía no tiene cuentas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className={TH_CLASS} scope="col">Servicio</th>
                  <th className={TH_CLASS} scope="col">Usuario</th>
                  <th className={TH_CLASS} scope="col">Etiqueta</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr className="border-b border-zinc-100 last:border-b-0" key={account.id}>
                    <td className={`${TD_CLASS} font-medium text-zinc-950`}>
                      {serviceNameById.get(account.serviceId) ?? account.serviceId}
                    </td>
                    <td className={TD_CLASS}>{account.panelUsername}</td>
                    <td className={TD_CLASS}>{account.label ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <p className="mt-6 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
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
    </section>
  );
}

export function AccountWorkspaceFallback() {
  return (
    <div className={`${SECTION_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100" />
      <div className="mt-6 h-24 rounded bg-zinc-50" />
    </div>
  );
}
