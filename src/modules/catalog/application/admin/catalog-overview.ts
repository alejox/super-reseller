import type { CatalogRepository } from "../../domain/catalog-repository";
import type { PriceTier } from "../../domain/price-tier";
import type { Service } from "../../domain/service";

/**
 * The ADMIN catalog screen's read model: everything the page needs, in a
 * fixed order, fetched in one place.
 */

export type CatalogOverviewDeps = Readonly<{
  catalog: Pick<CatalogRepository, "listPriceTiers" | "listServices">;
}>;

export type CatalogOverview = Readonly<{
  priceTiers: readonly PriceTier[];
  services: readonly Service[];
}>;

/**
 * `localeCompare` rather than `<`: service names are operator-supplied and
 * accented ("Disney+", "Fútbol"), and raw code-point ordering would file
 * every accented name after "Z".
 */
function byText(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export async function loadCatalogOverview(
  deps: CatalogOverviewDeps,
): Promise<CatalogOverview> {
  // Independent reads, so they overlap instead of queueing — two sequential
  // awaits would cost two round trips to Postgres for no reason.
  const [priceTiers, services] = await Promise.all([
    deps.catalog.listPriceTiers(),
    deps.catalog.listServices(),
  ]);

  return {
    priceTiers: [...priceTiers].sort((a, b) => byText(a.code, b.code)),
    services: [...services].sort((a, b) => byText(a.name, b.name)),
  };
}
