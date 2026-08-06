import { describe, expect, it } from "vitest";

import { InMemoryCatalogRepository } from "../../infrastructure/in-memory-catalog-repository";
import { createPriceTierAsAdmin } from "./create-price-tier";

function deps() {
  return { catalog: new InMemoryCatalogRepository() };
}

describe("createPriceTierAsAdmin", () => {
  it("creates a tier and returns it", async () => {
    const d = deps();

    const result = await createPriceTierAsAdmin(d, { code: "MAYOR", name: "Mayorista" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier.code).toBe("MAYOR");
    expect(result.tier.name).toBe("Mayorista");
    expect(await d.catalog.listPriceTiers()).toHaveLength(1);
  });

  it("upper-cases and trims the code before storing it", async () => {
    const d = deps();

    const result = await createPriceTierAsAdmin(d, { code: "  mayor  ", name: "  Mayorista  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tier.code).toBe("MAYOR");
    expect(result.tier.name).toBe("Mayorista");
  });

  it("rejects a duplicate code that differs only by case", async () => {
    const d = deps();
    await createPriceTierAsAdmin(d, { code: "MAYOR", name: "Mayorista" });

    const result = await createPriceTierAsAdmin(d, { code: "mayor", name: "Otro" });

    // `price_tier.code` is UNIQUE and case-SENSITIVE in Postgres, so without
    // the normalization above "MAYOR" and "mayor" would both be stored and
    // become two tiers an operator cannot tell apart.
    expect(result).toEqual({ ok: false, reason: "code-taken" });
    expect(await d.catalog.listPriceTiers()).toHaveLength(1);
  });

  it.each([
    ["", "code-required"],
    ["   ", "code-required"],
    ["MI TIER", "code-invalid"],
    ["mi-tier", "code-invalid"],
    ["ácido", "code-invalid"],
  ])("refuses the code %j with reason %s", async (code, reason) => {
    const result = await createPriceTierAsAdmin(deps(), { code, name: "Nombre" });

    expect(result).toEqual({ ok: false, reason });
  });

  it("refuses an empty name", async () => {
    const result = await createPriceTierAsAdmin(deps(), { code: "MAYOR", name: "   " });

    expect(result).toEqual({ ok: false, reason: "name-required" });
  });

  it("writes nothing when validation fails", async () => {
    const d = deps();

    await createPriceTierAsAdmin(d, { code: "no válido", name: "Nombre" });

    expect(await d.catalog.listPriceTiers()).toEqual([]);
  });
});
