import type { CatalogOverview } from "@/modules/catalog/application/admin/catalog-overview";
import { loadCatalogOverview } from "@/modules/catalog/application/admin/catalog-overview";

import { adminCatalogRepository } from "./admin-catalog-repository";
import { CreatePriceTierForm, CreateServiceForm } from "./catalog-forms";

/**
 * The dynamic half of the catalog screen: it reads the session and the
 * database, so it renders behind a Suspense boundary while the surrounding
 * page shell prerenders (`cacheComponents: true` in next.config.ts).
 */

const SECTION_CLASS = "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8";
const TH_CLASS = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TD_CLASS = "px-3 py-2 text-sm text-zinc-800";

function EmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">{children}</p>;
}

function PriceTierTable({ tiers }: Readonly<{ tiers: CatalogOverview["priceTiers"] }>) {
  if (tiers.length === 0) {
    return <EmptyState>Todavía no hay niveles de precio. Cree el primero para poder fijar precios.</EmptyState>;
  }

  return (
    // Tables are the one element that cannot shrink to fit: on a narrow
    // screen it scrolls inside its own box instead of widening the page.
    <div className="overflow-x-auto">
      <table className="w-full min-w-md border-collapse">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className={TH_CLASS} scope="col">Código</th>
            <th className={TH_CLASS} scope="col">Nombre</th>
            <th className={TH_CLASS} scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr className="border-b border-zinc-100 last:border-b-0" key={tier.id}>
              <td className={`${TD_CLASS} font-mono font-medium text-zinc-950`}>{tier.code}</td>
              <td className={TD_CLASS}>{tier.name}</td>
              <td className={TD_CLASS}>{tier.archivedAt === null ? "Activo" : "Archivado"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceTable({ services }: Readonly<{ services: CatalogOverview["services"] }>) {
  if (services.length === 0) {
    return <EmptyState>Todavía no hay servicios. Cree el primero para poder agregarle planes.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-md border-collapse">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className={TH_CLASS} scope="col">Identificador</th>
            <th className={TH_CLASS} scope="col">Nombre</th>
            <th className={TH_CLASS} scope="col">Descripción</th>
            <th className={TH_CLASS} scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr className="border-b border-zinc-100 last:border-b-0" key={service.id}>
              <td className={`${TD_CLASS} font-mono font-medium text-zinc-950`}>{service.slug}</td>
              <td className={TD_CLASS}>{service.name}</td>
              <td className={TD_CLASS}>{service.description ?? "—"}</td>
              <td className={TD_CLASS}>{service.retiredAt === null ? "Activo" : "Retirado"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      <section aria-labelledby="price-tiers-heading" className={SECTION_CLASS}>
        <h2 className="text-lg font-semibold text-zinc-950" id="price-tiers-heading">
          Niveles de precio
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
          Cada revendedor se asigna a un nivel, y cada plan lleva un precio por nivel.
        </p>
        <div className="mt-4">
          <PriceTierTable tiers={overview.priceTiers} />
        </div>
        <CreatePriceTierForm />
      </section>

      <section aria-labelledby="services-heading" className={SECTION_CLASS}>
        <h2 className="text-lg font-semibold text-zinc-950" id="services-heading">
          Servicios
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
          El producto que se vende. Los planes se agrupan bajo un servicio.
        </p>
        <div className="mt-4">
          <ServiceTable services={overview.services} />
        </div>
        <CreateServiceForm />
      </section>
    </div>
  );
}

export function CatalogWorkspaceFallback() {
  return (
    <div className="space-y-6">
      {[0, 1].map((index) => (
        <div className={`${SECTION_CLASS} animate-pulse`} key={index}>
          <div className="h-5 w-48 rounded bg-zinc-200" />
          <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100" />
          <div className="mt-6 h-24 rounded bg-zinc-50" />
        </div>
      ))}
    </div>
  );
}
