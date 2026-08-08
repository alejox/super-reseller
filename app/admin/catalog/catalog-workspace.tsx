import type { CatalogOverview, ServicePlans } from "@/modules/catalog/application/admin/catalog-overview";
import { loadCatalogOverview } from "@/modules/catalog/application/admin/catalog-overview";
import { formatMoney } from "@/shared/money/money";

import { adminCatalogRepository } from "./admin-catalog-repository";
import {
  CreatePlanForm,
  CreatePriceTierForm,
  CreateServiceForm,
  SetPlanPriceForm,
} from "./catalog-forms";

import { CARD_CLASS, Card } from "@/app/_components/ui/card";
import { Table, Td, Th, Tr } from "@/app/_components/ui/table";

const PLAN_KIND_LABELS: Readonly<Record<string, string>> = {
  SCREEN: "Pantalla",
  FULL_ACCOUNT: "Cuenta completa",
};

/**
 * The dynamic half of the catalog screen: it reads the session and the
 * database, so it renders behind a Suspense boundary while the surrounding
 * page shell prerenders (`cacheComponents: true` in next.config.ts).
 */

function EmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
      {children}
    </p>
  );
}

function PriceTierTable({ tiers }: Readonly<{ tiers: CatalogOverview["priceTiers"] }>) {
  if (tiers.length === 0) {
    return <EmptyState>Todavía no hay niveles de precio. Cree el primero para poder fijar precios.</EmptyState>;
  }

  return (
    // Tables are the one element that cannot shrink to fit: on a narrow
    // screen it scrolls inside its own box instead of widening the page.
    <Table>
      <thead>
        <Tr head>
          <Th scope="col">Código</Th>
          <Th scope="col">Nombre</Th>
          <Th scope="col">Estado</Th>
        </Tr>
      </thead>
      <tbody>
        {tiers.map((tier) => (
          <Tr key={tier.id}>
            <Td className="font-mono font-medium text-zinc-950 dark:text-zinc-50">{tier.code}</Td>
            <Td>{tier.name}</Td>
            <Td>{tier.archivedAt === null ? "Activo" : "Archivado"}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function ServiceTable({ services }: Readonly<{ services: CatalogOverview["services"] }>) {
  if (services.length === 0) {
    return <EmptyState>Todavía no hay servicios. Cree el primero para poder agregarle planes.</EmptyState>;
  }

  return (
    <Table>
      <thead>
        <Tr head>
          <Th scope="col">Identificador</Th>
          <Th scope="col">Nombre</Th>
          <Th scope="col">Descripción</Th>
          <Th scope="col">Estado</Th>
        </Tr>
      </thead>
      <tbody>
        {services.map((service) => (
          <Tr key={service.id}>
            <Td className="font-mono font-medium text-zinc-950 dark:text-zinc-50">
              {service.slug}
            </Td>
            <Td>{service.name}</Td>
            <Td>{service.description ?? "—"}</Td>
            <Td>{service.retiredAt === null ? "Activo" : "Retirado"}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * One service and its plans, as a plan × tier price matrix.
 *
 * Every tier gets a column even when the plan has no price there, because an
 * EMPTY cell is the screen's only way to show the fact that matters most:
 * that plan is invisible to every reseller on that tier (CAT: Missing Tier
 * Price Blocks Sale). A matrix with the gaps hidden would look complete.
 */
function ServicePlansTable({
  group,
  tiers,
}: Readonly<{ group: ServicePlans; tiers: CatalogOverview["priceTiers"] }>) {
  if (group.plans.length === 0) {
    return <EmptyState>Este servicio todavía no tiene planes.</EmptyState>;
  }

  return (
    <Table minWidth="2xl">
      <thead>
        <Tr head>
          <Th scope="col">Plan</Th>
          <Th scope="col">Tipo</Th>
          <Th scope="col">Duración</Th>
          {tiers.map((tier) => (
            <Th key={tier.id} scope="col">
              {tier.code}
            </Th>
          ))}
        </Tr>
      </thead>
      <tbody>
        {group.plans.map(({ plan, prices }) => (
          <Tr key={plan.id}>
            <Td className="font-medium text-zinc-950 dark:text-zinc-50">
              {plan.name}
              {plan.retiredAt !== null && (
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  Retirado
                </span>
              )}
            </Td>
            <Td>{PLAN_KIND_LABELS[plan.kind] ?? plan.kind}</Td>
            <Td>{plan.durationDays} días</Td>
            {tiers.map((tier) => {
              const price = prices[tier.id];
              return (
                <Td key={tier.id}>
                  <span className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
                    {price ? formatMoney(price, "es-CO") : "Sin precio — no se vende"}
                  </span>
                  <SetPlanPriceForm
                    currentAmount={price?.amountMinor ?? null}
                    planId={plan.id}
                    tierId={tier.id}
                  />
                </Td>
              );
            })}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

function PlansSection({ overview }: Readonly<{ overview: CatalogOverview }>) {
  const tierOptions = overview.priceTiers.map((tier) => ({
    id: tier.id,
    code: tier.code,
    name: tier.name,
  }));

  return (
    <Card as="section" aria-labelledby="plans-heading">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50" id="plans-heading">
        Planes
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Lo que se vende. Cada plan lleva un precio por nivel; sin precio en un nivel, ese
        revendedor no lo ve.
      </p>

      {overview.services.length === 0 ? (
        <div className="mt-4">
          <EmptyState>Cree un servicio antes de cargar planes.</EmptyState>
        </div>
      ) : overview.priceTiers.length === 0 ? (
        <div className="mt-4">
          {/* Ordering is forced by the domain: `createPlanWithInitialPrice`
              demands a tier, so offering the form first would only produce a
              rejection the operator cannot act on. */}
          <EmptyState>Cree un nivel de precio antes de cargar planes.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 space-y-8">
          {overview.plansByService.map((group) => (
            <div key={group.service.id}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {group.service.name}
                <span className="ml-2 font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  {group.service.slug}
                </span>
              </h3>
              <div className="mt-3">
                <ServicePlansTable group={group} tiers={overview.priceTiers} />
              </div>
              <CreatePlanForm serviceId={group.service.id} tiers={tierOptions} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export async function CatalogWorkspace() {
  const catalog = await adminCatalogRepository();
  const overview = await loadCatalogOverview({ catalog });

  return (
    <div className="space-y-6">
      {/* Tiers come first because the dependency runs that way: a plan cannot
          be priced without a tier, so an operator arriving at an empty
          catalog needs to meet this section before the others. */}
      <Card as="section" aria-labelledby="price-tiers-heading">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50" id="price-tiers-heading">
          Niveles de precio
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Cada revendedor se asigna a un nivel, y cada plan lleva un precio por nivel.
        </p>
        <div className="mt-4">
          <PriceTierTable tiers={overview.priceTiers} />
        </div>
        <CreatePriceTierForm />
      </Card>

      <Card as="section" aria-labelledby="services-heading">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50" id="services-heading">
          Servicios
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          El producto que se vende. Los planes se agrupan bajo un servicio.
        </p>
        <div className="mt-4">
          <ServiceTable services={overview.services} />
        </div>
        <CreateServiceForm />
      </Card>

      <PlansSection overview={overview} />
    </div>
  );
}

export function CatalogWorkspaceFallback() {
  return (
    <div className="space-y-6">
      {[0, 1].map((index) => (
        <div className={`${CARD_CLASS} animate-pulse`} key={index}>
          <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100 dark:bg-zinc-800/60" />
          <div className="mt-6 h-24 rounded bg-zinc-50 dark:bg-zinc-800/40" />
        </div>
      ))}
    </div>
  );
}
