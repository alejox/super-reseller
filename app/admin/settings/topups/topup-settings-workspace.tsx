import Link from "next/link";
import { Sliders } from "lucide-react";

import { adminTopUpSettingsDeps } from "./admin-topup-settings";
import { TopUpLimitsForm } from "./topup-settings-form";

/**
 * The limits screen (backlog A9).
 *
 * These values are enforced by `requestTopUp` on the server for every claim.
 * The gateway page next door still shows a static mockup of Stripe and Binance
 * credentials; the "Mínimo/Máximo Recarga" fields it used to carry were never
 * wired to anything, so they now point here instead of quietly disagreeing
 * with the real setting.
 */
export async function TopUpSettingsWorkspace() {
  const deps = await adminTopUpSettingsDeps();

  const [limits, users] = await Promise.all([deps.topUpSettings.read(), deps.users.listUsers()]);

  const updatedByEmail = limits.updatedBy
    ? (users.find((user) => user.id === limits.updatedBy)?.email ?? null)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] p-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="mb-1 text-3xl font-semibold text-[#dae2fd]">Límites de Recarga</h2>
          <p className="text-sm text-[#cbc3d7]">
            Monto mínimo y máximo que puede tener una solicitud de recarga. Se validan en el
            servidor cada vez que se registra un pago.
          </p>
        </div>
        <Link
          className="rounded-lg border border-[#494454] bg-[#222a3d] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#dae2fd] transition-colors hover:bg-[#31394d]"
          href="/admin/settings"
        >
          Volver a Pasarelas
        </Link>
      </div>

      <div className="max-w-3xl rounded-xl border border-[#494454] bg-[#0b1326] p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2 border-b border-[#494454]/50 pb-4">
          <Sliders className="h-4 w-4 text-[#d0bcff]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#d0bcff]">
            Rango permitido ({limits.currency})
          </h3>
        </div>

        <TopUpLimitsForm
          maxAmountMinor={limits.maxAmountMinor}
          minAmountMinor={limits.minAmountMinor}
        />

        <p className="mt-6 text-[11px] text-[#958ea0]">
          {limits.updatedAt
            ? `Última modificación: ${limits.updatedAt.toLocaleString("es-CO")}${
                updatedByEmail ? ` por ${updatedByEmail}` : ""
              }.`
            : "Todavía sin configurar: se están usando los valores por defecto."}
        </p>
      </div>
    </div>
  );
}

export function TopUpSettingsWorkspaceFallback() {
  return (
    <div className="mx-auto w-full max-w-[1440px] animate-pulse p-10">
      <div className="mb-8 h-9 w-72 rounded bg-[#2d3449]" />
      <div className="h-72 max-w-3xl rounded-xl bg-[#0b1326]" />
    </div>
  );
}
