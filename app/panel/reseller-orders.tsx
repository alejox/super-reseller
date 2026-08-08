import { getScope } from "@/modules/identity/application/dal";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { formatMoney, money } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";
import { Package, MoreVertical } from "lucide-react";

export async function ResellerOrders() {
  const scope = await getScope();
  if (scope.kind !== "reseller") return null;

  const orders = await new DrizzleOrderingRepository(getDb(), scope).listOrdersForReseller(
    scope.resellerId,
  );

  return (
    <>
      <h3 className="text-2xl text-[#dae2fd] font-semibold flex items-center gap-2">
        <Package className="text-[#d0bcff] h-6 w-6" />
        My Subscriptions
      </h3>
      <div className="bg-[#222a3d] rounded-xl border border-[#494454] border-t-white/10 overflow-hidden flex flex-col h-[calc(100%-3rem)]">
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {orders.length === 0 ? (
            <p className="text-sm text-[#cbc3d7]">No active subscriptions.</p>
          ) : (
            orders.map((view) => (
              <div key={view.order.id} className="p-3 bg-[#0b1326] rounded-lg border border-[#494454] flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#c4c1fb] flex items-center justify-center text-[#3c0091] font-bold text-xs uppercase">
                  {view.serviceName.substring(0, 2)}
                </div>
                <div className="flex-1">
                  <h5 className="text-base font-bold text-[#dae2fd]">{view.serviceName}</h5>
                  <p className="text-xs font-semibold text-[#cbc3d7] tracking-wider">{view.planName}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${view.order.status === 'PENDING' ? 'bg-[#ffb4ab]/15 text-[#ffb4ab]' : 'bg-[#4cd7f6]/15 text-[#4cd7f6]'}`}>
                    {view.order.status}
                  </span>
                  <button className="text-[#cbc3d7] hover:text-[#d0bcff] transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-6 bg-[#171f33] border-t border-[#494454]">
          <div className="flex justify-between items-center mb-4">
            <span className="text-base text-[#cbc3d7]">Monthly Burn</span>
            <span className="text-2xl font-bold text-[#dae2fd]">$0.00</span>
          </div>
          <button className="w-full py-2 border border-[#494454] text-[#dae2fd] hover:bg-[#2d3449] rounded-lg text-xs font-semibold tracking-wider transition-colors">
            View Full Inventory
          </button>
        </div>
      </div>
    </>
  );
}
