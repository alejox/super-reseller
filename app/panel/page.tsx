import type { Metadata } from "next";
import { Suspense } from "react";

import { requireRole, verifySession } from "@/modules/identity/application/dal";
import { LogoutButton } from "../logout-button";
import { PanelField, PanelGrid, PanelSkeleton } from "../session-panel";
import { ResellerCatalog } from "./reseller-catalog";
import { ResellerOrders } from "./reseller-orders";
import { ResellerWallet } from "./reseller-wallet";

export const metadata: Metadata = {
  title: "Panel",
};

/**
 * Same `<Suspense>` rule as the admin panel: session reads are runtime data
 * and would otherwise block the route from prerendering.
 *
 * `verifySession` redirects to the login page when the session is missing,
 * expired, revoked, or its user has been deactivated — all four are the
 * same answer here.
 */
async function PanelSession() {
  const session = await verifySession();

  return (
    <PanelGrid>
      <PanelField label="Rol" value={session.role} />
      <PanelField label="Lista de precios" value={session.priceTierId ?? "—"} />
    </PanelGrid>
  );
}

/**
 * Defense in depth, mirroring `app/admin/page.tsx`'s `AdminAccessStatus`.
 * `route-access.ts`'s proxy gate is an "optimistic check only" (AUTH: Proxy
 * Performs an Optimistic Check Only — no database read), and this page
 * previously called only `verifySession()`, so an ADMIN could render it and
 * see unfiltered reseller wallet/order data: `tenantWhere` returns no
 * filter for an admin scope. `requireRole("RESELLER")` closes that.
 */
async function PanelAccessStatus() {
  await requireRole("RESELLER");
  return <p className="sr-only">Acceso de revendedor verificado</p>;
}

export default function PanelPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Panel
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            El catálogo se mostrará al precio de tu lista asignada.
          </p>
        </div>
        <LogoutButton />
      </header>

      <Suspense fallback={<PanelSkeleton />}>
        <PanelSession />
      </Suspense>

      <Suspense fallback={null}>
        <PanelAccessStatus />
      </Suspense>

      <Suspense fallback={<PanelSkeleton />}>
        <ResellerWallet />
      </Suspense>

      <Suspense fallback={<PanelSkeleton />}>
        <ResellerCatalog />
      </Suspense>

      <Suspense fallback={<PanelSkeleton />}>
        <ResellerOrders />
      </Suspense>
    </main>
  );
}
