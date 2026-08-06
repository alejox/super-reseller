import type { Metadata } from "next";
import { Suspense } from "react";

import { getScope, requireRole } from "@/modules/identity/application/dal";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { formatMoney, money } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";

import { FulfilForm } from "./fulfil-form";

export const metadata: Metadata = { title: "Órdenes" };

const SECTION_CLASS = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: "Pendiente",
  FULFILLED: "Entregada",
  CANCELLED: "Cancelada",
};

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

async function OrdersWorkspace() {
  await requireRole("ADMIN");
  const scope = await getScope();
  const orders = await new DrizzleOrderingRepository(getDb(), scope).listOrders();

  const pending = orders.filter((view) => view.order.status === "PENDING");

  return (
    <section aria-labelledby="orders-heading" className={SECTION_CLASS}>
      <h2 className="text-lg font-semibold text-zinc-950" id="orders-heading">
        Órdenes
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
        {pending.length === 0
          ? "No hay órdenes pendientes de entrega."
          : `${pending.length} pendiente${pending.length === 1 ? "" : "s"} de entrega. Despache por fuera de la plataforma y marque aquí.`}
      </p>

      <div className="mt-4">
        {orders.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Todavía no hay órdenes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className={TH_CLASS} scope="col">Fecha</th>
                  <th className={TH_CLASS} scope="col">Revendedor</th>
                  <th className={TH_CLASS} scope="col">Servicio</th>
                  <th className={TH_CLASS} scope="col">Plan</th>
                  <th className={TH_CLASS} scope="col">Cobrado</th>
                  <th className={TH_CLASS} scope="col">Estado</th>
                  <th className={TH_CLASS} scope="col">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((view) => (
                  <tr className="border-b border-zinc-100 last:border-b-0" key={view.order.id}>
                    <td className={TD_CLASS}>{dateFormat.format(view.order.placedAt)}</td>
                    <td className={TD_CLASS}>{view.resellerEmail ?? "—"}</td>
                    <td className={TD_CLASS}>{view.serviceName}</td>
                    <td className={`${TD_CLASS} font-medium text-zinc-950`}>{view.planName}</td>
                    <td className={`${TD_CLASS} font-semibold`}>
                      {formatMoney(money(view.amountMinor, view.currency), "es-CO")}
                    </td>
                    <td className={TD_CLASS}>
                      {STATUS_LABELS[view.order.status] ?? view.order.status}
                    </td>
                    <td className={TD_CLASS}>
                      {view.order.status === "PENDING" ? (
                        <FulfilForm orderId={view.order.id} />
                      ) : (
                        (view.order.note ?? "—")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function OrdersFallback() {
  return (
    <div className={`${SECTION_CLASS} animate-pulse`}>
      <div className="h-5 w-40 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100" />
      <div className="mt-6 h-24 rounded bg-zinc-50" />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Ventas</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Órdenes</h1>
        <p className="max-w-2xl text-zinc-600">
          Cada orden ya fue cobrada del saldo del revendedor. La entrega ocurre fuera de la
          plataforma.
        </p>
      </header>
      <Suspense fallback={<OrdersFallback />}>
        <OrdersWorkspace />
      </Suspense>
    </main>
  );
}
