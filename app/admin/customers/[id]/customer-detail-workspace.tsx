import { notFound } from "next/navigation";

import { adminCustomerDetailDeps } from "./admin-customer-detail";
import { CreateProviderAccountOnBehalfForm } from "./provider-account-on-behalf-form";

/**
 * The dynamic half of the admin customer-detail screen. Read-only listing
 * of the target customer's `provider_account` rows plus the on-behalf
 * create form (PA: ADMIN May Create A Provider Account On A Customer's
 * Behalf).
 */

const SECTION_CLASS = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

export async function CustomerDetailWorkspace({
  targetUserId,
}: Readonly<{ targetUserId: string }>) {
  const deps = await adminCustomerDetailDeps(targetUserId);

  if (deps.target === null) {
    notFound();
  }

  const [accounts, services] = await Promise.all([
    deps.providerAccounts.listForTenant(deps.target.resellerId ?? ""),
    deps.catalog.listServices(),
  ]);

  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return (
    <section aria-labelledby="customer-detail-heading" className={SECTION_CLASS}>
      <h2 className="text-lg font-semibold text-zinc-950" id="customer-detail-heading">
        {deps.target.email}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
        Cuentas de proveedor de este cliente. Solo lectura, salvo la creación de soporte.
      </p>

      <div className="mt-4">
        {accounts.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Este cliente todavía no tiene cuentas registradas.
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
          Cree un servicio antes de registrar cuentas de soporte.
        </p>
      ) : (
        <CreateProviderAccountOnBehalfForm
          services={services.map((service) => ({ id: service.id, name: service.name }))}
          targetUserId={deps.target.id}
        />
      )}
    </section>
  );
}

export function CustomerDetailWorkspaceFallback() {
  return (
    <div className={`${SECTION_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100" />
      <div className="mt-6 h-24 rounded bg-zinc-50" />
    </div>
  );
}
