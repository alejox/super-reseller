import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createTestDb, closeTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import type { CatalogRepository } from "../domain/catalog-repository";
import { DrizzleCatalogRepository } from "./drizzle-catalog-repository";
import { InMemoryCatalogRepository } from "./in-memory-catalog-repository";

/**
 * design.md "Testing Strategy": one shared contract suite run twice — the
 * in-memory fake proves the USE CASE is correct, PGlite proves the SQL
 * actually enforces it. Same assertions, both backends.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

interface Adapter {
  name: string;
  setup(): Promise<CatalogRepository>;
  teardown(): Promise<void>;
}

function inMemoryAdapter(): Adapter {
  return {
    name: "in-memory fake",
    async setup() {
      return new InMemoryCatalogRepository();
    },
    async teardown() {
      // nothing to dispose
    },
  };
}

function pgliteAdapter(): Adapter {
  let testDb: TestDb | null = null;
  return {
    name: "PGlite (real Postgres)",
    async setup() {
      testDb = await createTestDb();
      await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
      return new DrizzleCatalogRepository(testDb.db);
    },
    async teardown() {
      if (testDb) {
        await closeTestDb(testDb);
        testDb = null;
      }
    },
  };
}

describe.each([inMemoryAdapter(), pgliteAdapter()])("CatalogRepository contract: $name", (adapter) => {
  let repo: CatalogRepository;

  beforeEach(async () => {
    repo = await adapter.setup();
  });

  afterEach(async () => {
    await adapter.teardown();
  });

  it("resolves different absolute prices for the same plan at two tiers (CAT: Per-Tier Absolute Pricing)", async () => {
    const service = await repo.createService({ slug: "netflix", name: "Netflix" });
    const tierA = await repo.createPriceTier({ code: "TIER_A", name: "Tier A" });
    const tierB = await repo.createPriceTier({ code: "TIER_B", name: "Tier B" });
    const plan = await repo.createPlan({
      serviceId: service.id,
      name: "Netflix Pantalla 30 días",
      kind: "SCREEN",
      durationDays: 30,
    });

    await repo.setPlanPrice({ planId: plan.id, priceTierId: tierA.id, amountMinor: 10_000, currency: "COP" });
    await repo.setPlanPrice({ planId: plan.id, priceTierId: tierB.id, amountMinor: 15_000, currency: "COP" });

    const sellableA = await repo.findSellablePlan(plan.id, tierA.id);
    const sellableB = await repo.findSellablePlan(plan.id, tierB.id);

    expect(sellableA?.price.amountMinor).toBe(10_000);
    expect(sellableB?.price.amountMinor).toBe(15_000);
  });

  it("reports a plan with no tier-B price as unsellable at tier B, without falling back to tier A (CAT: Missing Tier Price Blocks Sale)", async () => {
    const service = await repo.createService({ slug: "hbo-max", name: "HBO Max" });
    const tierA = await repo.createPriceTier({ code: "TIER_A2", name: "Tier A2" });
    const tierB = await repo.createPriceTier({ code: "TIER_B2", name: "Tier B2" });
    const plan = await repo.createPlan({
      serviceId: service.id,
      name: "HBO Max Pantalla 30 días",
      kind: "SCREEN",
      durationDays: 30,
    });

    await repo.setPlanPrice({ planId: plan.id, priceTierId: tierA.id, amountMinor: 8_000, currency: "COP" });

    const sellableB = await repo.findSellablePlan(plan.id, tierB.id);

    expect(sellableB).toBeNull();
  });

  it("keeps a retired service's plans readable with prices intact (CAT: Service Retirement Preserves Plans)", async () => {
    const service = await repo.createService({ slug: "disney-plus", name: "Disney+" });
    const tier = await repo.createPriceTier({ code: "TIER_C", name: "Tier C" });
    const plan = await repo.createPlan({
      serviceId: service.id,
      name: "Disney+ Pantalla 30 días",
      kind: "SCREEN",
      durationDays: 30,
    });
    await repo.setPlanPrice({ planId: plan.id, priceTierId: tier.id, amountMinor: 9_000, currency: "COP" });

    await repo.retireService(service.id);

    const retired = await repo.findServiceById(service.id);
    const stillReadablePlan = await repo.findPlanById(plan.id);
    const stillSellable = await repo.findSellablePlan(plan.id, tier.id);

    expect(retired?.retiredAt).not.toBeNull();
    expect(stillReadablePlan).not.toBeNull();
    expect(stillSellable?.price.amountMinor).toBe(9_000);
  });

  it("keeps the prior price row stored and addressable when a new price is set (CAT: Price History Is Preserved)", async () => {
    const service = await repo.createService({ slug: "spotify", name: "Spotify" });
    const tier = await repo.createPriceTier({ code: "TIER_D", name: "Tier D" });
    const plan = await repo.createPlan({
      serviceId: service.id,
      name: "Spotify Individual 30 días",
      kind: "FULL_ACCOUNT",
      durationDays: 30,
    });

    const first = await repo.setPlanPrice({ planId: plan.id, priceTierId: tier.id, amountMinor: 7_000, currency: "COP" });
    const second = await repo.setPlanPrice({ planId: plan.id, priceTierId: tier.id, amountMinor: 7_500, currency: "COP" });

    const history = await repo.listPlanPriceHistory(plan.id, tier.id);

    expect(history).toHaveLength(2);
    expect(history.find((row) => row.id === first.id)?.amountMinor).toBe(7_000);
    expect(history.find((row) => row.id === first.id)?.effectiveTo).not.toBeNull();
    expect(history.find((row) => row.id === second.id)?.effectiveTo).toBeNull();

    const sellable = await repo.findSellablePlan(plan.id, tier.id);
    expect(sellable?.planPriceId).toBe(second.id);
    expect(sellable?.price.amountMinor).toBe(7_500);
  });

  it("rejects a second active plan with the same service/kind/duration (plan_identity_uniq — the legacy 56-SKU duplication guard)", async () => {
    const service = await repo.createService({ slug: "amazon-prime", name: "Amazon Prime Video" });
    await repo.createPlan({
      serviceId: service.id,
      name: "Prime Pantalla 30 días",
      kind: "SCREEN",
      durationDays: 30,
    });

    await expect(
      repo.createPlan({
        serviceId: service.id,
        name: "Prime Pantalla 30 días (duplicado)",
        kind: "SCREEN",
        durationDays: 30,
      }),
    ).rejects.toThrow();
  });

  it("lists administrative rows including retired services, and lists every price tier", async () => {
    const active = await repo.createService({ slug: "paramount-plus", name: "Paramount+" });
    const retired = await repo.createService({ slug: "apple-tv", name: "Apple TV+" });
    const firstTier = await repo.createPriceTier({ code: "TIER_LIST_A", name: "List A" });
    const secondTier = await repo.createPriceTier({ code: "TIER_LIST_B", name: "List B" });
    await repo.retireService(retired.id);
    const services = await repo.listServices();
    const tiers = await repo.listPriceTiers();
    expect(services.map((service) => service.id)).toEqual(expect.arrayContaining([active.id, retired.id]));
    expect(services.find((service) => service.id === retired.id)?.retiredAt).not.toBeNull();
    expect(tiers.map((tier) => tier.id)).toEqual(expect.arrayContaining([firstTier.id, secondTier.id]));
  });

  it("creates a plan with its first price atomically and keeps exactly one current row", async () => {
    const service = await repo.createService({ slug: "crunchyroll", name: "Crunchyroll" });
    const tier = await repo.createPriceTier({ code: "TIER_INITIAL", name: "Initial" });

    const plan = await repo.createPlanWithInitialPrice({ serviceId: service.id, name: "Crunchyroll Pantalla 30 días", kind: "SCREEN", durationDays: 30, priceTierId: tier.id, amountMinor: 150_000, currency: "COP" });
    const history = await repo.listPlanPriceHistory(plan.id, tier.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ amountMinor: 150_000, currency: "COP", effectiveTo: null });
    await repo.setPlanPrice({ planId: plan.id, priceTierId: tier.id, amountMinor: 160_000, currency: "COP" });
    const replacedHistory = await repo.listPlanPriceHistory(plan.id, tier.id);
    expect(replacedHistory.filter((price) => price.effectiveTo === null)).toHaveLength(1);
  });

  it("soft-retires a plan and frees its active identity without deleting the retired row", async () => {
    const service = await repo.createService({ slug: "mubi", name: "MUBI" });
    const original = await repo.createPlan({ serviceId: service.id, name: "MUBI Pantalla 30 días", kind: "SCREEN", durationDays: 30 });
    await repo.retirePlan(original.id);
    const replacement = await repo.createPlan({ serviceId: service.id, name: "MUBI Pantalla nueva 30 días", kind: "SCREEN", durationDays: 30 });
    expect((await repo.findPlanById(original.id))?.retiredAt).not.toBeNull();
    expect(replacement.id).not.toBe(original.id);
  });

  // The admin catalog screen renders a plan × tier price matrix. Reading it
  // through `listPlansByService` + `findSellablePlan` would cost one query
  // per service plus one per (plan, tier) cell; these two methods make it two
  // queries regardless of catalog size.
  it("lists every plan across all services, retired ones included", async () => {
    const netflix = await repo.createService({ slug: "netflix", name: "Netflix" });
    const spotify = await repo.createService({ slug: "spotify", name: "Spotify" });
    const kept = await repo.createPlan({ serviceId: netflix.id, name: "Netflix 30", kind: "SCREEN", durationDays: 30 });
    const other = await repo.createPlan({ serviceId: spotify.id, name: "Spotify 30", kind: "FULL_ACCOUNT", durationDays: 30 });
    const gone = await repo.createPlan({ serviceId: netflix.id, name: "Netflix 60", kind: "SCREEN", durationDays: 60 });
    await repo.retirePlan(gone.id);

    const plans = await repo.listPlans();

    // Retired plans stay visible to the ADMIN: they still hold price history
    // and, per CAT: Service Retirement Preserves Plans, remain sellable.
    expect(plans.map((plan) => plan.id).sort()).toEqual([kept.id, other.id, gone.id].sort());
    expect(plans.find((plan) => plan.id === gone.id)?.retiredAt).not.toBeNull();
  });

  it("lists only the CURRENT price row for every (plan, tier) pair", async () => {
    const service = await repo.createService({ slug: "netflix", name: "Netflix" });
    const tierA = await repo.createPriceTier({ code: "TIER_A", name: "Tier A" });
    const tierB = await repo.createPriceTier({ code: "TIER_B", name: "Tier B" });
    const plan = await repo.createPlanWithInitialPrice({
      serviceId: service.id,
      name: "Netflix 30",
      kind: "SCREEN",
      durationDays: 30,
      priceTierId: tierA.id,
      amountMinor: 100_000,
      currency: "COP",
    });
    await repo.setPlanPrice({ planId: plan.id, priceTierId: tierA.id, amountMinor: 120_000, currency: "COP" });
    await repo.setPlanPrice({ planId: plan.id, priceTierId: tierB.id, amountMinor: 150_000, currency: "COP" });

    const current = await repo.listCurrentPlanPrices();

    // `plan_price` is append-only, so tier A now has TWO rows and only the
    // newer one is current. A superseded price leaking into this list would
    // put a stale amount on the screen.
    expect(current).toHaveLength(2);
    expect(current.every((price) => price.effectiveTo === null)).toBe(true);
    expect(current.find((price) => price.priceTierId === tierA.id)?.amountMinor).toBe(120_000);
    expect(current.find((price) => price.priceTierId === tierB.id)?.amountMinor).toBe(150_000);
  });

  it("returns no current prices for a fresh catalog", async () => {
    expect(await repo.listCurrentPlanPrices()).toEqual([]);
    expect(await repo.listPlans()).toEqual([]);
  });
});
