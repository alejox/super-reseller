import type { SellablePlanListing } from "@/modules/catalog/domain/catalog-repository";
import { getScope, verifySession } from "@/modules/identity/application/dal";
import { createDrizzleScopedCatalogRepositoryFactory } from "@/modules/identity/infrastructure/repository-factory";
import { formatMoney } from "@/shared/money/money";
import { Store, Flame } from "lucide-react";
import { BuyButton } from "./buy-button";
import { getDb } from "@/shared/db/client";

const PLAN_KIND_LABELS: Readonly<Record<string, string>> = {
  SCREEN: "Pantalla",
  FULL_ACCOUNT: "Cuenta",
};

export async function ResellerCatalog() {
  const session = await verifySession();
  const scope = await getScope();

  if (scope.kind !== "reseller") {
    return (
      <p className="text-sm text-[#958ea0]">
        Esta vista es para cuentas de revendedor.
      </p>
    );
  }

  const catalog = createDrizzleScopedCatalogRepositoryFactory(getDb()).for(scope);
  const plans = await catalog.listSellablePlans();

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-[#494454] bg-[#171f33] p-6 text-center">
        <p className="text-sm text-[#cbc3d7]">
          Todavía no hay planes disponibles para su lista de precios.
        </p>
      </div>
    );
  }

  return (
    <>
      <h3 className="text-2xl text-[#dae2fd] font-semibold flex items-center gap-2">
        <Store className="text-[#4cd7f6] h-6 w-6" />
        Available Services
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((entry, index) => {
          // Compute pseudo-random colors based on index for the glow effect
          const colors = ['bg-[#d0bcff]/10', 'bg-[#0055D4]/10', 'bg-[#5A0BB5]/10', 'bg-[#00A8E1]/10'];
          const hoverColors = ['group-hover:bg-[#d0bcff]/20', 'group-hover:bg-[#0055D4]/20', 'group-hover:bg-[#5A0BB5]/20', 'group-hover:bg-[#00A8E1]/20'];
          const bgGlow = colors[index % colors.length];
          const hoverGlow = hoverColors[index % hoverColors.length];
          const firstLetter = entry.plan.name.charAt(0).toUpperCase();

          return (
            <div key={entry.plan.id} className="bg-[#171f33] p-6 rounded-xl border border-[#494454] border-t-white/10 flex flex-col justify-between group hover:border-[#d0bcff]/50 transition-colors relative overflow-hidden min-h-[220px]">
              {/* Background accent */}
              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-2xl transition-all ${bgGlow} ${hoverGlow}`}></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-lg bg-[#0b1326] flex items-center justify-center border border-[#494454]">
                  <span className="font-bold text-2xl text-white">{firstLetter}</span>
                </div>
                {entry.plan.kind === 'FULL_ACCOUNT' && (
                  <span className="bg-[#4cd7f6]/15 text-[#4cd7f6] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Flame className="h-4 w-4" /> High Demand
                  </span>
                )}
              </div>
              
              <div className="mb-6 relative z-10">
                <h4 className="text-xl text-[#dae2fd] font-bold">{entry.plan.name}</h4>
                <p className="text-sm text-[#cbc3d7] mt-1">{PLAN_KIND_LABELS[entry.plan.kind] ?? entry.plan.kind} • {entry.plan.durationDays} Días</p>
              </div>
              
              <div className="flex items-center justify-between mt-auto relative z-10">
                <div>
                  <p className="text-xs font-semibold text-[#cbc3d7] line-through opacity-0">$0.00</p>
                  <p className="text-2xl text-[#d0bcff] font-bold">{formatMoney(entry.price, "es-CO")}</p>
                </div>
                {/* Wrap the standard BuyButton */}
                <BuyButton planId={entry.plan.id} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
