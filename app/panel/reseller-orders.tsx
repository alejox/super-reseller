import { getScope } from "@/modules/identity/application/dal";
import { DrizzleOrderingRepository } from "@/modules/ordering/infrastructure/drizzle-ordering-repository";
import { formatMoney, money } from "@/shared/money/money";
import { getDb } from "@/shared/db/client";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: "Pendiente de entrega",
  FULFILLED: "Entregada",
  CANCELLED: "Cancelada",
};

const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200";

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

export async function ResellerOrders() {
  const scope = await getScope();
  if (scope.kind !== "reseller") return null;

  const orders = await new DrizzleOrderingRepository(getDb(), scope).listOrdersForReseller(
    scope.resellerId,
  );

  if (orders.length === 0) return null;

  return (
    <section aria-labelledby="orders-heading" className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100" id="orders-heading">
        Mis órdenes
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-md border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className={TH_CLASS} scope="col">Fecha</th>
              <th className={TH_CLASS} scope="col">Servicio</th>
              <th className={TH_CLASS} scope="col">Plan</th>
              <th className={TH_CLASS} scope="col">Precio</th>
              <th className={TH_CLASS} scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((view) => (
              <tr
                className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                key={view.order.id}
              >
                <td className={TD_CLASS}>{dateFormat.format(view.order.placedAt)}</td>
                <td className={TD_CLASS}>{view.serviceName}</td>
                <td className={`${TD_CLASS} font-medium`}>{view.planName}</td>
                <td className={`${TD_CLASS} font-semibold`}>
                  {/* Resolved through `plan_price_id`, so this shows what the
                      order was SOLD at even after the list price changed. */}
                  {formatMoney(money(view.amountMinor, view.currency), "es-CO")}
                </td>
                <td className={TD_CLASS}>
                  {STATUS_LABELS[view.order.status] ?? view.order.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        La entrega se coordina por fuera de la plataforma; el administrador marca cada orden como
        entregada.
      </p>
    </section>
  );
}
