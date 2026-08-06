import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryCatalogRepository } from "../../infrastructure/in-memory-catalog-repository";
import { createPlanAsAdmin } from "./create-plan";

let catalog: InMemoryCatalogRepository;
let serviceId: string;
let priceTierId: string;

beforeEach(async () => {
  catalog = new InMemoryCatalogRepository();
  serviceId = (await catalog.createService({ slug: "netflix", name: "Netflix" })).id;
  priceTierId = (await catalog.createPriceTier({ code: "MAYOR", name: "Mayorista" })).id;
});

function validInput(overrides: Partial<Record<string, string>> = {}) {
  return {
    serviceId,
    name: "1 Pantalla",
    kind: "SCREEN",
    durationDays: "30",
    priceTierId,
    amountMinor: "12000",
    ...overrides,
  };
}

describe("createPlanAsAdmin", () => {
  it("creates a plan together with its first price", async () => {
    const result = await createPlanAsAdmin({ catalog }, validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.name).toBe("1 Pantalla");
    expect(result.plan.kind).toBe("SCREEN");
    expect(result.plan.durationDays).toBe(30);

    // The plan and its first price are one operation on purpose: a plan with
    // no price at any tier is invisible to every reseller, so creating one
    // would be creating something nobody can buy.
    const prices = await catalog.listCurrentPlanPrices();
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ amountMinor: 12000, currency: "COP", priceTierId });
  });

  it("accepts a zero price", async () => {
    const result = await createPlanAsAdmin({ catalog }, validInput({ amountMinor: "0" }));

    // `plan_price_amount_minor_check` allows >= 0. A free plan is a real
    // product decision, not a mistake to guess at.
    expect(result.ok).toBe(true);
  });

  it("trims the name", async () => {
    const result = await createPlanAsAdmin({ catalog }, validInput({ name: "  1 Pantalla  " }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.name).toBe("1 Pantalla");
  });

  it("rejects a second ACTIVE plan with the same service, kind and duration", async () => {
    await createPlanAsAdmin({ catalog }, validInput());

    const result = await createPlanAsAdmin({ catalog }, validInput({ name: "Otro nombre" }));

    // `plan_identity_uniq` — the constraint that stops the legacy 56-SKU
    // duplication from coming back. A raw constraint violation is not
    // something a form can render.
    expect(result).toEqual({ ok: false, reason: "duplicate-plan" });
    expect(await catalog.listPlans()).toHaveLength(1);
  });

  it("allows re-issuing the identity after the original is retired", async () => {
    const first = await createPlanAsAdmin({ catalog }, validInput());
    if (!first.ok) throw new Error("setup failed");
    await catalog.retirePlan(first.plan.id);

    const result = await createPlanAsAdmin({ catalog }, validInput({ name: "Reemplazo" }));

    expect(result.ok).toBe(true);
  });

  it.each([
    [{ name: "   " }, "name-required"],
    [{ kind: "PANTALLA" }, "kind-invalid"],
    [{ kind: "" }, "kind-invalid"],
    [{ durationDays: "0" }, "duration-invalid"],
    [{ durationDays: "-30" }, "duration-invalid"],
    [{ durationDays: "30.5" }, "duration-invalid"],
    [{ durationDays: "treinta" }, "duration-invalid"],
    [{ durationDays: "" }, "duration-invalid"],
    [{ amountMinor: "-1" }, "amount-invalid"],
    [{ amountMinor: "12000.50" }, "amount-invalid"],
    [{ amountMinor: "gratis" }, "amount-invalid"],
    [{ amountMinor: "" }, "amount-invalid"],
  ])("refuses %j with reason %s", async (overrides, reason) => {
    const result = await createPlanAsAdmin({ catalog }, validInput(overrides));

    expect(result).toEqual({ ok: false, reason });
  });

  it("refuses a service that does not exist", async () => {
    const result = await createPlanAsAdmin(
      { catalog },
      validInput({ serviceId: crypto.randomUUID() }),
    );

    // Checking beats letting the FK raise: `service_id REFERENCES service(id)`
    // would reject it anyway, with an error no form can read.
    expect(result).toEqual({ ok: false, reason: "service-unknown" });
  });

  it("refuses a price tier that does not exist", async () => {
    const result = await createPlanAsAdmin(
      { catalog },
      validInput({ priceTierId: crypto.randomUUID() }),
    );

    expect(result).toEqual({ ok: false, reason: "tier-unknown" });
  });

  it("writes nothing when validation fails", async () => {
    await createPlanAsAdmin({ catalog }, validInput({ durationDays: "0" }));

    expect(await catalog.listPlans()).toEqual([]);
    expect(await catalog.listCurrentPlanPrices()).toEqual([]);
  });
});
