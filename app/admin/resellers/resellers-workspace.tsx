import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";

import { adminResellerDeps } from "./admin-resellers";
import { CreateResellerForm, TopUpForm } from "./reseller-form";

/**
 * The dynamic half of the resellers screen: it reads the session and the
 * database, so it renders behind a Suspense boundary while the page shell
 * prerenders (`cacheComponents: true`).
 */

export async function ResellersWorkspace() {
  const deps = await adminResellerDeps();

  const [allUsers, tiers, balances, limits] = await Promise.all([
    deps.users.listUsers(),
    deps.catalog.listPriceTiers(),
    // One grouped query for every reseller's balance, not one per row.
    deps.wallet.balancesByReseller(),
    // Read once for the whole table: the form shows the range, the server
    // enforces it again on submit.
    deps.topUpSettings.read(),
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
    <div className="bg-[#171f33] border border-[#494454] rounded-xl flex flex-col overflow-hidden shadow-sm" aria-labelledby="resellers-heading">
      <div className="p-6 border-b border-[#494454]">
        <h2 className="text-xl font-semibold text-[#dae2fd]" id="resellers-heading">
          Cuentas de Revendedor
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#cbc3d7]">
          Cada cuenta queda fijada a un nivel de precio. Ese nivel decide todos los precios que ve,
          y no puede elegir otro. Registrar un pago no acredita saldo: crea una solicitud que se
          aprueba en <span className="font-semibold text-[#dae2fd]">Pagos por validar</span>.
        </p>
      </div>

      <div>
        {resellers.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#cbc3d7]">
            Todavía no hay revendedores.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#2d3449] border-b border-[#494454]">
                  <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Correo electrónico</th>
                  <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Nivel</th>
                  <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-right">Saldo</th>
                  <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-center">Registrar pago</th>
                  <th className="p-4 text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#dae2fd] divide-y divide-[#494454]/50">
                {resellers.map((reseller) => {
                  const tier = reseller.priceTierId
                    ? tierByeId.get(reseller.priceTierId)
                    : undefined;
                  const balanceMinor = reseller.resellerId
                    ? (balances.get(reseller.resellerId) ?? 0)
                    : 0;
                  return (
                    <tr key={reseller.id} className="hover:bg-[#2d3449]/50 transition-colors">
                      <td className="p-4 font-medium text-[#dae2fd]">
                        {reseller.email}
                      </td>
                      <td className="p-4 text-[#cbc3d7]">
                        {tier ? (
                          <span className="inline-block px-2 py-1 rounded bg-[#222a3d] border border-[#494454] text-[11px] font-bold tracking-wider">
                            {tier.code} · {tier.name}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-4 text-right font-semibold text-[#4cd7f6]">
                        {formatMoney(money(balanceMinor, WALLET_CURRENCY), "es-CO")}
                      </td>
                      <td className="p-4 text-center">
                        {reseller.resellerId ? (
                          <TopUpForm
                            balanceMinor={balanceMinor}
                            maxAmountMinor={limits.maxAmountMinor}
                            minAmountMinor={limits.minAmountMinor}
                            resellerEmail={reseller.email}
                            resellerId={reseller.resellerId}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {reseller.deactivatedAt === null ? (
                          <span className="inline-block px-2 py-1 rounded bg-[#009eb9]/20 text-[#4cd7f6] border border-[#4cd7f6]/30 text-[10px] uppercase font-bold tracking-wider">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 rounded bg-[#93000a]/20 text-[#ffb4ab] border border-[#ffb4ab]/30 text-[10px] uppercase font-bold tracking-wider">
                            Desactivado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-[#494454] bg-[#0b1326]/50">
        {tiers.length === 0 ? (
          <p className="text-center text-sm text-[#cbc3d7]">
            Cree un nivel de precio antes de dar de alta revendedores.
          </p>
        ) : (
          <CreateResellerForm
            tiers={tiers.map((tier) => ({ id: tier.id, code: tier.code, name: tier.name }))}
          />
        )}
      </div>
    </div>
  );
}

export function ResellersWorkspaceFallback() {
  return (
    <div className="bg-[#171f33] border border-[#494454] rounded-xl flex flex-col overflow-hidden animate-pulse p-6">
      <div className="h-5 w-56 rounded bg-[#2d3449]" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-[#222a3d]" />
      <div className="mt-6 h-24 rounded bg-[#0b1326]" />
    </div>
  );
}
