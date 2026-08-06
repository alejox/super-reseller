import { adminResellerDeps } from "./admin-resellers";
import { CreateResellerForm } from "./reseller-form";

/**
 * The dynamic half of the resellers screen: it reads the session and the
 * database, so it renders behind a Suspense boundary while the page shell
 * prerenders (`cacheComponents: true`).
 */

const SECTION_CLASS = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

export async function ResellersWorkspace() {
  const deps = await adminResellerDeps();

  const [allUsers, tiers] = await Promise.all([
    deps.users.listUsers(),
    deps.catalog.listPriceTiers(),
  ]);

  // An ADMIN scope reads every row, admins included; this screen is about
  // resellers, so the platform's own accounts are filtered out here rather
  // than by narrowing the repository — the isolation rule belongs to the
  // scope, not to a presentation filter.
  const resellers = allUsers
    .filter((user) => user.role === "RESELLER")
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

  const tierByeId = new Map(tiers.map((tier) => [tier.id, tier]));

  return (
    <section aria-labelledby="resellers-heading" className={SECTION_CLASS}>
      <h2 className="text-lg font-semibold text-zinc-950" id="resellers-heading">
        Cuentas de revendedor
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
        Cada cuenta queda fijada a un nivel de precio. Ese nivel decide todos los precios que ve,
        y no puede elegir otro.
      </p>

      <div className="mt-4">
        {resellers.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Todavía no hay revendedores.
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
                {resellers.map((reseller) => {
                  const tier = reseller.priceTierId
                    ? tierByeId.get(reseller.priceTierId)
                    : undefined;
                  return (
                    <tr className="border-b border-zinc-100 last:border-b-0" key={reseller.id}>
                      <td className={`${TD_CLASS} font-medium text-zinc-950`}>{reseller.email}</td>
                      <td className={TD_CLASS}>
                        {tier ? `${tier.code} · ${tier.name}` : "—"}
                      </td>
                      <td className={TD_CLASS}>
                        {reseller.deactivatedAt === null ? "Activo" : "Desactivado"}
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
          {/* `users_reseller_requires_tier` makes a tier-less RESELLER
              unrepresentable, so the form cannot be offered before a tier
              exists — it could only ever be rejected. */}
          Cree un nivel de precio antes de dar de alta revendedores.
        </p>
      ) : (
        <CreateResellerForm
          tiers={tiers.map((tier) => ({ id: tier.id, code: tier.code, name: tier.name }))}
        />
      )}
    </section>
  );
}

export function ResellersWorkspaceFallback() {
  return (
    <div className={`${SECTION_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100" />
      <div className="mt-6 h-24 rounded bg-zinc-50" />
    </div>
  );
}
