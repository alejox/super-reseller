import { describe, expect, it } from "vitest";

import { InMemoryCatalogRepository } from "../../infrastructure/in-memory-catalog-repository";
import { loadCatalogOverview } from "./catalog-overview";

describe("loadCatalogOverview", () => {
  it("returns empty collections for a fresh catalog", async () => {
    const overview = await loadCatalogOverview({ catalog: new InMemoryCatalogRepository() });

    expect(overview).toEqual({ priceTiers: [], services: [] });
  });

  it("orders price tiers by code and services by name, case-insensitively", async () => {
    const catalog = new InMemoryCatalogRepository();
    await catalog.createPriceTier({ code: "MINOR", name: "Minorista" });
    await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" });
    await catalog.createService({ slug: "spotify", name: "Spotify" });
    await catalog.createService({ slug: "netflix", name: "netflix" });
    await catalog.createService({ slug: "disney", name: "Disney+" });

    const overview = await loadCatalogOverview({ catalog });

    // Insertion order is whatever the database happened to return. A screen
    // whose rows reshuffle between reloads is unusable, so the order is
    // decided here rather than left to the query planner.
    expect(overview.priceTiers.map((tier) => tier.code)).toEqual(["MAYOR", "MINOR"]);
    expect(overview.services.map((service) => service.slug)).toEqual([
      "disney",
      "netflix",
      "spotify",
    ]);
  });

  it("includes retired services so the operator can see them", async () => {
    const catalog = new InMemoryCatalogRepository();
    const service = await catalog.createService({ slug: "netflix", name: "Netflix" });
    await catalog.retireService(service.id);

    const overview = await loadCatalogOverview({ catalog });

    // A retired service still owns its slug and its plans; hiding it would
    // leave the operator unable to explain why that slug is refused.
    expect(overview.services).toHaveLength(1);
    expect(overview.services[0]?.retiredAt).toBeInstanceOf(Date);
  });
});
