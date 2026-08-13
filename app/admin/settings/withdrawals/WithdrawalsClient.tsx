"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  Download,
  CalendarDays,
  Plus,
  MoreVertical,
  Landmark,
  Bitcoin,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Banknote,
  CheckCircle2
} from "lucide-react";
import { DEFAULT_WITHDRAWAL_SETTINGS, type WithdrawalMethod, type WithdrawalSettings } from "@/modules/wallet/domain/withdrawal";
import { MANUAL_REVIEW_THRESHOLD_MINOR } from "@/modules/wallet/domain/withdrawal-request";
import { WALLET_CURRENCY } from "@/modules/wallet/domain/wallet-entry";
import { formatMoney, money } from "@/shared/money/money";
import { updateWithdrawalSettingsAction } from "@/modules/wallet/application/reseller/withdrawals.actions";

interface Props {
  initialMethods: readonly WithdrawalMethod[];
  initialSettings: WithdrawalSettings | null;
  balanceMinor: number;
}

/** The locale every other money figure in this app is rendered in. */
const LOCALE = "es-CO";

const SCHEDULE_LABEL: Record<WithdrawalSettings["scheduleFrequency"], string> = {
  WEEKLY: "Semanal (Lunes)",
  BIWEEKLY: "Quincenal (Días 1 y 15)",
  MONTHLY: "Mensual (Día 1)",
};

function display(amountMinor: number): string {
  return formatMoney(money(amountMinor, WALLET_CURRENCY), LOCALE);
}

export default function WithdrawalsClient({ initialMethods, initialSettings, balanceMinor }: Props) {
  const [isPending, startTransition] = useTransition();
  const settings = initialSettings ?? DEFAULT_WITHDRAWAL_SETTINGS;

  const handleUpdateSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateWithdrawalSettingsAction({
        autoWithdraw: formData.get("autoWithdraw") === "on",
        condition: formData.get("condition") as WithdrawalSettings["condition"],
        scheduleFrequency: formData.get("scheduleFrequency") as WithdrawalSettings["scheduleFrequency"],
        // NO scaling. COP's smallest practical unit is the peso itself
        // (`formatMoney` resolves it to 0 fraction digits), so what the user
        // types IS the stored minor amount. The `* 100` that used to live
        // here multiplied every limit by 100 on each save, and the matching
        // `/ 100` on display hid it until the next round trip.
        thresholdAmountMinor: Number(formData.get("thresholdAmount")),
        minWithdrawalMinor: Number(formData.get("minWithdrawal")),
        maxDailyWithdrawalMinor: Number(formData.get("maxDailyWithdrawal")),
      });
    });
  };
  return (
    <div className="w-full max-w-[1440px] mx-auto p-10 flex flex-col">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#dae2fd]">Configuración de Retiros</h2>
          <p className="text-base text-[#cbc3d7] mt-1">
            Gestiona tus métodos de pago, límites y automatización de cobros.
          </p>
        </div>
        <div className="flex gap-4">
          <Link 
            href="/admin/settings"
            className="px-4 py-2 flex items-center justify-center rounded-lg bg-[#222a3d] border border-[#494454] text-[#dae2fd] hover:bg-[#31394d] transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Pasarelas de Pago
          </Link>
          <button className="bg-[#171f33] text-[#dae2fd] border border-[#494454] px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-[#2d3449] transition-colors">
            Historial de Retiros
          </button>
          <button className="bg-gradient-to-r from-[#d0bcff] to-[#a078ff] text-[#3c0091] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2">
            <Download className="w-4 h-4" />
            Retirar Ahora
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Columna Izquierda (Resumen y Métodos) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Tarjeta de Saldo (Glassmorphism / Gradient) */}
          <div className="bg-[#c4c1fb] p-6 rounded-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Abstract Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#a078ff] rounded-full blur-3xl opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#4cd7f6] rounded-full blur-3xl opacity-20 transform -translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10 w-full md:w-auto">
              <p className="text-xs font-semibold text-[#444173] mb-1 uppercase tracking-wider">Saldo Disponible para Retiro</p>
              <h3 className="text-5xl font-bold text-[#2d2a5b]">
                {display(balanceMinor)} <span className="text-xl font-normal opacity-75">{WALLET_CURRENCY}</span>
              </h3>
              <p className="text-sm text-[#444173] mt-2">
                Mínimo por retiro: {display(settings.minWithdrawalMinor)} · Tope diario:{" "}
                {display(settings.maxDailyWithdrawalMinor)}
              </p>
            </div>

            <div className="relative z-10 bg-[#0b1326]/10 backdrop-blur-md border border-[#444173]/20 p-4 rounded-lg w-full md:w-64">
              <p className="text-xs font-semibold text-[#444173] mb-1 uppercase tracking-wider flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                Retiro Automático
              </p>
              {settings.autoWithdraw ? (
                <>
                  <p className="text-xl font-semibold text-[#2d2a5b]">
                    {settings.condition === "THRESHOLD" ? "Al alcanzar el umbral" : SCHEDULE_LABEL[settings.scheduleFrequency]}
                  </p>
                  <p className="text-sm text-[#444173] mt-1">
                    {settings.condition === "THRESHOLD"
                      ? `Umbral: ${display(settings.thresholdAmountMinor)}`
                      : "Según la frecuencia configurada"}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-semibold text-[#2d2a5b]">Desactivado</p>
                  <p className="text-sm text-[#444173] mt-1">Los retiros se piden manualmente</p>
                </>
              )}
            </div>
          </div>

          {/* Métodos de Retiro (Bento Grid Style) */}
          <section className="bg-[#171f33] p-6 rounded-xl border-t border-[#009eb9] shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold text-[#dae2fd]">Métodos de Retiro</h3>
              <button className="text-[#d0bcff] hover:text-[#a078ff] text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <Plus className="w-4 h-4" /> Añadir Método
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {initialMethods.length === 0 ? (
                <p className="text-sm text-[#cbc3d7] py-4">No tienes métodos configurados.</p>
              ) : (
                initialMethods.map((method) => (
                  <div key={method.id} className={`bg-[#222a3d] border ${method.isPrimary ? "border-[#d0bcff]/50 hover:border-[#d0bcff]" : "border-[#494454] hover:border-[#cbc3d7]"} p-4 rounded-lg relative overflow-hidden group cursor-pointer transition-colors`}>
                    <div className="absolute top-2 right-2 flex gap-1 items-center">
                      {method.isPrimary && (
                        <span className="bg-[#d0bcff]/20 text-[#d0bcff] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Principal</span>
                      )}
                      <button className="text-[#cbc3d7] hover:text-[#dae2fd] transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mb-4 mt-2">
                      <div className="w-12 h-12 bg-[#0b1326] rounded-full flex items-center justify-center border border-[#494454] text-[#dae2fd]">
                        {method.type === "BANK_TRANSFER" ? <Landmark className="w-6 h-6 text-[#dae2fd]" /> : method.type === "CRYPTO" ? <Bitcoin className="w-6 h-6 text-[#F7931A]" /> : <Banknote className="w-6 h-6 text-[#4cd7f6]" />}
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-[#dae2fd]">{method.type}</h4>
                        <p className="text-sm text-[#cbc3d7] truncate w-32">{method.details}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#494454]/30">
                      <span className="text-[11px] font-semibold text-[#cbc3d7] uppercase tracking-wider">Fee: Standard</span>
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${method.isActive ? "text-[#4cd7f6]" : "text-red-400"}`}>
                        {method.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Columna Derecha (Ajustes y Automatización) */}
        <form onSubmit={handleUpdateSettings} className="flex flex-col gap-6">
          
          {/* Retiros Automáticos */}
          <section className="bg-[#171f33] p-6 rounded-xl border-t border-[#009eb9] shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-[#494454]/50 pb-4">
              <h3 className="text-lg font-semibold text-[#dae2fd] flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#d0bcff]" />
                Automatización
              </h3>
              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="autoWithdraw" className="sr-only peer" defaultChecked={settings.autoWithdraw} />
                <div className="w-11 h-6 bg-[#2d3449] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d0bcff]"></div>
              </label>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#cbc3d7] block mb-2 uppercase tracking-wider">Condición de Retiro</label>
                <select name="condition" defaultValue={settings.condition} className="w-full bg-[#222a3d] border border-[#494454] rounded-lg px-3 py-2 text-[#dae2fd] text-sm focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors appearance-none cursor-pointer">
                  <option value="SCHEDULED">Por Fecha Programada</option>
                  <option value="THRESHOLD">Al alcanzar un Umbral</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-[#cbc3d7] block mb-2 uppercase tracking-wider">Frecuencia</label>
                <select name="scheduleFrequency" defaultValue={settings.scheduleFrequency} className="w-full bg-[#222a3d] border border-[#494454] rounded-lg px-3 py-2 text-[#dae2fd] text-sm focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors appearance-none cursor-pointer">
                  <option value="BIWEEKLY">Quincenal (Días 1 y 15)</option>
                  <option value="MONTHLY">Mensual (Día 1)</option>
                  <option value="WEEKLY">Semanal (Lunes)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Límites y Frecuencia */}
          <section className="bg-[#171f33] p-6 rounded-xl border-t border-[#009eb9] shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-[#dae2fd] flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#d0bcff]" />
                Límites
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Mínimo de Retiro</label>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#cbc3d7] text-sm">$</span>
                  <input
                    type="number"
                    name="minWithdrawal"
                    min={1}
                    step={1}
                    defaultValue={settings.minWithdrawalMinor}
                    className="w-full bg-[#222a3d] border border-[#494454] rounded-lg pl-7 pr-3 py-2 text-[#dae2fd] text-sm focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Umbral Automático</label>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#cbc3d7] text-sm">$</span>
                  <input
                    type="number"
                    name="thresholdAmount"
                    min={1}
                    step={1}
                    defaultValue={settings.thresholdAmountMinor}
                    className="w-full bg-[#222a3d] border border-[#494454] rounded-lg pl-7 pr-3 py-2 text-[#dae2fd] text-sm focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-[#cbc3d7] uppercase tracking-wider">Límite Máximo Diario</label>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#cbc3d7] text-sm">$</span>
                  <input
                    type="number"
                    name="maxDailyWithdrawal"
                    min={1}
                    step={1}
                    defaultValue={settings.maxDailyWithdrawalMinor}
                    className="w-full bg-[#222a3d] border border-[#494454] rounded-lg pl-7 pr-3 py-2 text-[#dae2fd] text-sm focus:border-[#d0bcff] focus:ring-1 focus:ring-[#d0bcff] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Read from MANUAL_REVIEW_THRESHOLD_MINOR, never retyped: this
                  copy previously named a figure ($10,000 USD) that no code
                  enforced, so the promise and the rule could drift silently.
                  The 2FA half of that promise is not implemented at all and
                  is deliberately not claimed here. */}
              <div className="bg-[#93000a]/20 border border-[#ffb4ab]/30 p-3 rounded-lg flex gap-3 mt-4">
                <ShieldCheck className="text-[#ffb4ab] w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-[11px] font-semibold text-[#cbc3d7] leading-tight">
                  Los retiros desde {display(MANUAL_REVIEW_THRESHOLD_MINOR)} quedan en revisión manual del equipo de finanzas antes de pagarse.
                </p>
              </div>

              {settings.maxDailyWithdrawalMinor < MANUAL_REVIEW_THRESHOLD_MINOR && (
                <div className="bg-[#0b1326]/40 border border-[#494454] p-3 rounded-lg flex gap-3">
                  <Sliders className="text-[#cbc3d7] w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-semibold text-[#cbc3d7] leading-tight">
                    Tu tope diario ({display(settings.maxDailyWithdrawalMinor)}) es menor que el monto de revisión manual, así que ningún retiro llegará a revisión: el tope lo rechaza antes.
                  </p>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-[#494454]/30 flex justify-end">
                <button type="submit" disabled={isPending} className="bg-[#d0bcff] text-[#3c0091] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#a078ff] transition-colors flex items-center gap-2">
                  {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Guardar Cambios
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
