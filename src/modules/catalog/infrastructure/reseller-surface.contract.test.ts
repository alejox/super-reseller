import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createTestDb, closeTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import {
  mintAdminScope,
  mintResellerScope,
  type AccessScope,
} from "../../identity/domain/access-scope";
import {
  createDrizzleScopedCatalogRepositoryFactory,
  ScopedRepositoryFactory,
  type CatalogRepositoryFactory,
} from "../../identity/infrastructure/repository-factory";
import type { AdminCatalogRepository } from "../domain/catalog-repository";
import type { PlanId } from "../domain/ids";
import { InMemoryCatalogRepository } from "./in-memory-catalog-repository";
import { InMemoryResellerCatalogRepository } from "./in-memory-reseller-catalog-repository";

/**
 * RESELLER catalog surface contract (tasks 4.8–4.9), run twice like the
 * admin suite: the in-memory fake proves the USE CASE, PGlite proves the
 * SQL. The reseller surface is tier-free by design — the tier is read from
 * the scope and NEVER accepted as a parameter (design.md "Decision:
 * AccessScope is an opaque branded token minted only by the DAL"), so
 * "price me at the cheapest tier" is not expressible and a reseller at
 * tier B cannot resolve tier A's prices.
 *
 * Task 4.8 RED: the reseller adapters do not exist yet and
 * `factory.for(resellerScope)` throws — this suite is expected to fail.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

/** Minted at runtime per test; the minters are sealed to dal.ts + tests. */
function resellerScopeAt(tierId: string): Extract<AccessScope, { kind: "reseller" }> {
  return mintResellerScope(`user-${tierId}`, `reseller-${tierId}`, tierId) as Extract<
    AccessScope,
    { kind: "reseller" }
  >;
}

async function seedCatalog(admin: AdminCatalogRepository): Promise<{
  tierAId: string;
  tierBId: string;
  serviceId: string;
  planP1Id: PlanId;
  planP2Id: PlanId;
}> {
  const service = await admin.createService({ slug: "netflix", name: "Netflix" });
  const tierA = await admin.createPriceTier({ code: "TIER_A", name: "Tier A" });
  const tierB = await admin.createPriceTier({ code: "TIER_B", name: "Tier B" });
  const planP1 = await admin.createPlan({
    serviceId: service.id,
    name: "Plan 1 pantalla 30d",
    kind: "SCREEN",
    durationDays: 30,
  });
  const planP2 = await admin.createPlan({
    serviceId: service.id,
    name: "Plan 2 full 30d",
    kind: "FULL_ACCOUNT",
    durationDays: 30,
  });
  // P1 is priced at TIER_A only; P2 at both tiers — a tier-B reseller must
  // never see P1, and must see P2 at B's absolute price.
  await admin.setPlanPrice({ planId: planP1.id, priceTierId: tierA.id, amountMinor: 10_000, currency: "COP" });
  await admin.setPlanPrice({ planId: planP2.id, priceTierId: tierA.id, amountMinor: 10_000, currency: "COP" });
  await admin.setPlanPrice({ planId: planP2.id, priceTierId: tierB.id, amountMinor: 15_000, currency: "COP" });
  return { tierAId: tierA.id, tierBId: tierB.id, serviceId: service.id, planP1Id: planP1.id, planP2Id: planP2.id };
}

interface Adapter {
  name: string;
  setup(): Promise<{ admin: AdminCatalogRepository; factory: CatalogRepositoryFactory }>;
  teardown(): Promise<void>;
}

function inMemoryAdapter(): Adapter {
  return {
    name: "in-memory fake",
    async setup() {
      const store = new InMemoryCatalogRepository();
      const factory = new ScopedRepositoryFactory(
        store,
        (scope) => new InMemoryResellerCatalogRepository(store, scope.priceTierId),
      );
      return { admin: store, factory };
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
      const factory = createDrizzleScopedCatalogRepositoryFactory(testDb.db);
      const admin = factory.for(
        mintAdminScope("00000000-0000-4000-8000-000000000000") as Extract<
          AccessScope,
          { kind: "admin" }
        >,
      );
      return { admin, factory };
    },
    async teardown() {
      if (testDb) {
        await closeTestDb(testDb);
        testDb = null;
      }
    },
  };
}

describe.each([inMemoryAdapter(), pgliteAdapter()])("ResellerCatalogRepository surface: $name", (adapter) => {
  let admin: AdminCatalogRepository;
  let factory: CatalogRepositoryFactory;

  beforeEach(async () => {
    ({ admin, factory } = await adapter.setup());
  });

  afterEach(async () => {
    await adapter.teardown();
  });

  it("lists every plan sellable at the scope's tier, at that tier's price (tier comes from the scope)", async () => {
    const { tierAId, planP1Id, planP2Id } = await seedCatalog(admin);
    const reseller = factory.for(resellerScopeAt(tierAId));

    const sellable = await reseller.listSellablePlans();

    const byName = [...sellable].sort((a, b) => a.plan.name.localeCompare(b.plan.name));
    expect(byName.map((entry) => [entry.plan.id, entry.price.amountMinor])).toEqual([
      [planP1Id, 10_000],
      [planP2Id, 10_000],
    ]);
  });

  it("returns NONE of tier A's exclusive rows for a tier-B reseller (reseller B's query is isolated from reseller A's surface)", async () => {
    const { tierBId, planP1Id, planP2Id } = await seedCatalog(admin);
    const resellerB = factory.for(resellerScopeAt(tierBId));

    const sellable = await resellerB.listSellablePlans();

    // P1 is priced at tier A only — a tier-B reseller must not see it.
    // P2 is the single plan sellable at tier B, at B's absolute price.
    expect(sellable.map((entry) => entry.plan.id)).toEqual([planP2Id]);
    expect(sellable[0]?.price.amountMinor).toBe(15_000);
    // The A-only plan is invisible to B even though it exists in the same store.
    expect(sellable.some((entry) => entry.plan.id === planP1Id)).toBe(false);
  });

  it("resolves the CURRENT price at the scope's tier without the caller passing a tier", async () => {
    const { tierAId, tierBId, planP2Id } = await seedCatalog(admin);
    const resellerB = factory.for(resellerScopeAt(tierBId));

    const sellable = await resellerB.findSellablePlan(planP2Id);

    // The exact current price row anchor matches what the admin surface
    // resolves for tier B — the tier was read from the scope.
    const adminSellable = await admin.findSellablePlan(planP2Id, tierBId);
    expect(sellable?.price.amountMinor).toBe(15_000);
    expect(sellable?.planPriceId).toBe(adminSellable?.planPriceId);
    expect(sellable?.plan.id).toBe(planP2Id);
    expect(tierAId).not.toBe(tierBId);
  });

  it("reports a plan with no price at the scope's tier as unsellable — no fallback to another tier (CAT: Missing Tier Price Blocks Sale, reseller surface)", async () => {
    const { tierBId, planP1Id } = await seedCatalog(admin);
    const resellerB = factory.for(resellerScopeAt(tierBId));

    const sellable = await resellerB.findSellablePlan(planP1Id);

    expect(sellable).toBeNull();
  });

  it("keeps a retired service's plan sellable at the scope's tier (parity with the admin surface)", async () => {
    const { tierBId, serviceId, planP2Id, planP1Id } = await seedCatalog(admin);
    await admin.retireService(serviceId);
    const resellerB = factory.for(resellerScopeAt(tierBId));

    const sellable = await resellerB.listSellablePlans();

    expect(sellable.map((entry) => entry.plan.id)).toEqual([planP2Id]);
    expect(sellable[0]?.price.amountMinor).toBe(15_000);
    expect(sellable.some((entry) => entry.plan.id === planP1Id)).toBe(false);
  });

  it("hands an ADMIN scope the full admin repository instance and a RESELLER scope a working tier-bound surface (factory wiring)", async () => {
    const { tierAId } = await seedCatalog(admin);

    // ADMIN scope → the very same admin adapter (no wrapper, no throw).
    expect(factory.for(mintAdminScope("00000000-0000-4000-8000-000000000000"))).toBe(admin);

    // RESELLER scope → a working sellable-only surface bound to the scope's
    // tier — the 4.8-era throw must be gone.
    const reseller = factory.for(resellerScopeAt(tierAId));
    expect(await reseller.listSellablePlans()).toHaveLength(2);
  });
});
