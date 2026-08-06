import { describe, expect, it } from "vitest";

import { InMemoryCatalogRepository } from "../../infrastructure/in-memory-catalog-repository";
import { loadCatalogOverview } from "./catalog-overview";

describe("loadCatalogOverview", () => {
  it("returns empty collections for a fresh catalog", async () => {
    const overview = await loadCatalogOverview({ catalog: new InMemoryCatalogRepository() });

    expect(overview).toEqual({ priceTiers: [], services: [], plansByService: [] });
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

  it("groups plans under their service with the current price at each tier", async () => {
    const catalog = new InMemoryCatalogRepository();
    const netflix = await catalog.createService({ slug: "netflix", name: "Netflix" });
    const mayor = await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" });
    const minor = await catalog.createPriceTier({ code: "MINOR", name: "Minorista" });
    const plan = await catalog.createPlanWithInitialPrice({
      serviceId: netflix.id,
      name: "1 Pantalla",
      kind: "SCREEN",
      durationDays: 30,
      priceTierId: mayor.id,
      amountMinor: 12000,
      currency: "COP",
    });
    await catalog.setPlanPrice({ planId: plan.id, priceTierId: minor.id, amountMinor: 15000, currency: "COP" });

    const overview = await loadCatalogOverview({ catalog });

    expect(overview.plansByService).toHaveLength(1);
    const group = overview.plansByService[0];
    expect(group?.service.slug).toBe("netflix");
    expect(group?.plans).toHaveLength(1);
    expect(group?.plans[0]?.prices[mayor.id]).toEqual({ amountMinor: 12000, currency: "COP" });
    expect(group?.plans[0]?.prices[minor.id]).toEqual({ amountMinor: 15000, currency: "COP" });
  });

  it("leaves a tier without a current price absent rather than zero", async () => {
    const catalog = new InMemoryCatalogRepository();
    const netflix = await catalog.createService({ slug: "netflix", name: "Netflix" });
    const mayor = await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" });
    const minor = await catalog.createPriceTier({ code: "MINOR", name: "Minorista" });
    await catalog.createPlanWithInitialPrice({
      serviceId: netflix.id,
      name: "1 Pantalla",
      kind: "SCREEN",
      durationDays: 30,
      priceTierId: mayor.id,
      amountMinor: 12000,
      currency: "COP",
    });

    const overview = await loadCatalogOverview({ catalog });

    // "No price at this tier" and "costs nothing at this tier" are opposite
    // facts: the first blocks the sale, the second gives it away. `undefined`
    // is what lets the screen say so.
    expect(overview.plansByService[0]?.plans[0]?.prices[minor.id]).toBeUndefined();
    expect(overview.plansByService[0]?.plans[0]?.prices[mayor.id]).toEqual({
      amountMinor: 12000,
      currency: "COP",
    });
  });

  it("shows only the current price after one is replaced", async () => {
    const catalog = new InMemoryCatalogRepository();
    const netflix = await catalog.createService({ slug: "netflix", name: "Netflix" });
    const mayor = await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" });
    const plan = await catalog.createPlanWithInitialPrice({
      serviceId: netflix.id,
      name: "1 Pantalla",
      kind: "SCREEN",
      durationDays: 30,
      priceTierId: mayor.id,
      amountMinor: 12000,
      currency: "COP",
    });
    await catalog.setPlanPrice({ planId: plan.id, priceTierId: mayor.id, amountMinor: 13000, currency: "COP" });

    const overview = await loadCatalogOverview({ catalog });

    expect(overview.plansByService[0]?.plans[0]?.prices[mayor.id]).toEqual({
      amountMinor: 13000,
      currency: "COP",
    });
  });

  it("keeps a service with no plans in the list", async () => {
    const catalog = new InMemoryCatalogRepository();
    await catalog.createService({ slug: "netflix", name: "Netflix" });

    const overview = await loadCatalogOverview({ catalog });

    // Dropping it would hide the very service the operator needs to click to
    // add its first plan.
    expect(overview.plansByService).toHaveLength(1);
    expect(overview.plansByService[0]?.plans).toEqual([]);
  });

  it("orders plans by duration inside a service", async () => {
    const catalog = new InMemoryCatalogRepository();
    const netflix = await catalog.createService({ slug: "netflix", name: "Netflix" });
    const mayor = await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" });
    for (const durationDays of [90, 30, 60]) {
      await catalog.createPlanWithInitialPrice({
        serviceId: netflix.id,
        name: `Pantalla ${durationDays}`,
        kind: "SCREEN",
        durationDays,
        priceTierId: mayor.id,
        amountMinor: 1000 * durationDays,
        currency: "COP",
      });
    }

    const overview = await loadCatalogOverview({ catalog });

    expect(overview.plansByService[0]?.plans.map((row) => row.plan.durationDays)).toEqual([30, 60, 90]);
  });
});
