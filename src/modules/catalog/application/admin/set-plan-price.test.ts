import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogRepository } from "../../infrastructure/in-memory-catalog-repository";
import { setPlanPriceAsAdmin } from "./set-plan-price";

let catalog: InMemoryCatalogRepository;
let planId: string;
let mayorId: string;
let minorId: string;

beforeEach(async () => {
  catalog = new InMemoryCatalogRepository();
  const service = await catalog.createService({ slug: "netflix", name: "Netflix" });
  mayorId = (await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" })).id;
  minorId = (await catalog.createPriceTier({ code: "MINOR", name: "Minorista" })).id;
  planId = (
    await catalog.createPlanWithInitialPrice({
      serviceId: service.id,
      name: "1 Pantalla",
      kind: "SCREEN",
      durationDays: 30,
      priceTierId: mayorId,
      amountMinor: 12000,
      currency: "COP",
    })
  ).id;
});

describe("setPlanPriceAsAdmin", () => {
  it("adds a price at a tier that had none", async () => {
    const result = await setPlanPriceAsAdmin(
      { catalog },
      { planId, priceTierId: minorId, amountMinor: "15000" },
    );

    expect(result.ok).toBe(true);
    const current = await catalog.listCurrentPlanPrices();
    expect(current).toHaveLength(2);
    expect(current.find((price) => price.priceTierId === minorId)?.amountMinor).toBe(15000);
  });

  it("replaces an existing price without destroying the old one", async () => {
    const result = await setPlanPriceAsAdmin(
      { catalog },
      { planId, priceTierId: mayorId, amountMinor: "13000" },
    );

    expect(result.ok).toBe(true);

    // CAT: Price History Is Preserved. The superseded row stays, closed out,
    // because an order sold at the old amount still points at its id.
    const history = await catalog.listPlanPriceHistory(planId, mayorId);
    expect(history).toHaveLength(2);
    expect(history.filter((price) => price.effectiveTo === null)).toHaveLength(1);
    expect(history.find((price) => price.effectiveTo === null)?.amountMinor).toBe(13000);
    expect(history.find((price) => price.effectiveTo !== null)?.amountMinor).toBe(12000);
  });

  it("accepts zero", async () => {
    const result = await setPlanPriceAsAdmin(
      { catalog },
      { planId, priceTierId: minorId, amountMinor: "0" },
    );

    expect(result.ok).toBe(true);
  });

  it.each([
    ["-1", "amount-invalid"],
    ["1.5", "amount-invalid"],
    ["", "amount-invalid"],
    ["mucho", "amount-invalid"],
  ])("refuses the amount %j with reason %s", async (amountMinor, reason) => {
    const result = await setPlanPriceAsAdmin(
      { catalog },
      { planId, priceTierId: mayorId, amountMinor },
    );

    expect(result).toEqual({ ok: false, reason });
  });

  it("refuses an unknown plan", async () => {
    const result = await setPlanPriceAsAdmin(
      { catalog },
      { planId: crypto.randomUUID(), priceTierId: mayorId, amountMinor: "10000" },
    );

    expect(result).toEqual({ ok: false, reason: "plan-unknown" });
  });

  it("refuses an unknown tier", async () => {
    const result = await setPlanPriceAsAdmin(
      { catalog },
      { planId, priceTierId: crypto.randomUUID(), amountMinor: "10000" },
    );

    expect(result).toEqual({ ok: false, reason: "tier-unknown" });
  });

  it("writes nothing when validation fails", async () => {
    await setPlanPriceAsAdmin({ catalog }, { planId, priceTierId: mayorId, amountMinor: "-5" });

    const history = await catalog.listPlanPriceHistory(planId, mayorId);
    expect(history).toHaveLength(1);
    expect(history[0]?.amountMinor).toBe(12000);
  });
});
