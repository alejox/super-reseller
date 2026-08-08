import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/modules/identity/application/dal";
import { ResellerCatalog } from "./reseller-catalog";
import { ResellerOrders } from "./reseller-orders";
import { ResellerWallet } from "./reseller-wallet";

export const metadata: Metadata = {
  title: "StreamPanel Customer Portal",
};

async function PanelAccessStatus() {
  await requireRole("RESELLER");
  return <p className="sr-only">Acceso de revendedor verificado</p>;
}

export default function PanelPage() {
  return (
    <div className="p-6 md:p-10 flex-1 overflow-y-auto">
      <Suspense fallback={null}>
        <PanelAccessStatus />
      </Suspense>

      {/* Top Section: Balance & Quick Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[#dae2fd] mb-2">Service Marketplace</h2>
          <p className="text-base text-[#cbc3d7]">Browse available platforms and manage your active subscriptions.</p>
        </div>
        
        <Suspense fallback={<div className="h-24 w-64 bg-[#222a3d] animate-pulse rounded-xl border border-[#494454]"></div>}>
          <ResellerWallet />
        </Suspense>
      </div>

      {/* Main Content Layout (Bento Grid approach) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left/Main Column: Available Services (Marketplace) */}
        <div className="xl:col-span-2 space-y-6">
          <Suspense fallback={<div className="h-64 bg-[#222a3d] animate-pulse rounded-xl border border-[#494454]"></div>}>
            <ResellerCatalog />
          </Suspense>
        </div>

        {/* Right Column: My Subscriptions */}
        <div className="space-y-6">
          <Suspense fallback={<div className="h-64 bg-[#222a3d] animate-pulse rounded-xl border border-[#494454]"></div>}>
            <ResellerOrders />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
