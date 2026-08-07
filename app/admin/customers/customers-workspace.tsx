import { adminCustomerDeps } from "./admin-customers";
import { CreateCustomerForm } from "./customer-form";

/**
 * The dynamic half of the customers screen — mirrors
 * `app/admin/resellers/resellers-workspace.tsx`'s `ResellersWorkspace`.
 * Customers carry no wallet (that seam belongs to `payment-gateway`,
 * out of scope here — design.md "Untouched: src/modules/wallet/**"), so
 * this screen is list + create only, unlike the reseller one.
 */

const SECTION_CLASS = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

export async function CustomersWorkspace() {
  const deps = await adminCustomerDeps();

  const [allUsers, tiers] = await Promise.all([
    deps.users.listUsers(),
    deps.catalog.listPriceTiers(),
  ]);

  // An ADMIN scope reads every row; this screen is about customers, so
  // resellers and other admins are filtered out here rather than by
  // narrowing the repository — the isolation rule belongs to the scope,
  // not to a presentation filter.
  const customers = allUsers
    .filter((user) => user.role === "CUSTOMER")
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

  return (
    <section aria-labelledby="customers-heading" className={SECTION_CLASS}>
      <h2 className="text-lg font-semibold text-zinc-950" id="customers-heading">
        Cuentas de cliente
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
        Cada cliente queda fijado a un nivel de precio y recibe su propia identidad de cuenta,
        igual que un revendedor.
      </p>

      <div className="mt-4">
        {customers.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Todavía no hay clientes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className={TH_CLASS} scope="col">Correo electrónico</th>
                  <th className={TH_CLASS} scope="col">Nivel</th>
                  <th className={TH_CLASS} scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const tier = customer.priceTierId ? tierById.get(customer.priceTierId) : undefined;
                  return (
                    <tr className="border-b border-zinc-100 last:border-b-0" key={customer.id}>
                      <td className={`${TD_CLASS} font-medium text-zinc-950`}>{customer.email}</td>
                      <td className={TD_CLASS}>{tier ? `${tier.code} · ${tier.name}` : "—"}</td>
                      <td className={TD_CLASS}>
                        {customer.deactivatedAt === null ? "Activo" : "Desactivado"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tiers.length === 0 ? (
        <p className="mt-6 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
          {/* CI: Retail Tier Is A Prerequisite For Provisioning — the form
              cannot be offered before a tier exists; it could only ever be
              rejected. */}
          Cree un nivel de precio antes de dar de alta clientes.
        </p>
      ) : (
        <CreateCustomerForm
          tiers={tiers.map((tier) => ({ id: tier.id, code: tier.code, name: tier.name }))}
        />
      )}
    </section>
  );
}

export function CustomersWorkspaceFallback() {
  return (
    <div className={`${SECTION_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100" />
      <div className="mt-6 h-24 rounded bg-zinc-50" />
    </div>
  );
}
