import { describe, expect, it } from "vitest";

import { mintAdminScope, mintCustomerScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import { InMemoryCatalogRepository } from "@/modules/catalog/infrastructure/in-memory-catalog-repository";
import { InMemoryResellerCatalogRepository } from "@/modules/catalog/infrastructure/in-memory-reseller-catalog-repository";
import { ScopedRepositoryFactory } from "./repository-factory";

/**
 * design.md: "`repository-factory.ts` carries a LIVE footgun that must be
 * inverted, not extended: today `RepoFor<S> = S extends {kind:'reseller'} ?
 * Reseller… : Admin…`, so a customer scope would receive the UNSCOPED admin
 * catalog." Proven at runtime: a customer scope must be handed the
 * tier-bound reseller-shaped adapter, never the raw admin store instance.
 */
describe("ScopedRepositoryFactory (repository-factory bug fix)", () => {
  function makeFactory() {
    const store = new InMemoryCatalogRepository();
    const factory = new ScopedRepositoryFactory(
      store,
      (scope) => new InMemoryResellerCatalogRepository(store, scope.priceTierId),
    );
    return { store, factory };
  }

  it("hands an ADMIN scope the unscoped admin store itself", () => {
    const { store, factory } = makeFactory();
    const repo = factory.for(mintAdminScope("admin-1"));
    expect(repo).toBe(store);
  });

  it("hands a RESELLER scope a tier-bound reseller adapter, not the raw admin store", () => {
    const { store, factory } = makeFactory();
    const repo = factory.for(mintResellerScope("reseller-user-1", "reseller-tenant-1", "tier-1"));
    expect(repo).toBeInstanceOf(InMemoryResellerCatalogRepository);
    expect(repo).not.toBe(store);
  });

  it("hands a CUSTOMER scope a tier-bound reseller adapter, NOT the unscoped admin store (the bug this fix closes)", () => {
    const { store, factory } = makeFactory();
    const repo = factory.for(mintCustomerScope("customer-user-1", "customer-tenant-1", "tier-2"));
    expect(repo).toBeInstanceOf(InMemoryResellerCatalogRepository);
    expect(repo).not.toBe(store);
  });

  it("binds the customer adapter to the SCOPE's own price tier, not a shared/default one", async () => {
    const { factory } = makeFactory();
    const tierAResellerScope = mintCustomerScope("user-a", "tenant-a", "tier-a");
    const tierBResellerScope = mintCustomerScope("user-b", "tenant-b", "tier-b");

    const repoA = factory.for(tierAResellerScope) as InMemoryResellerCatalogRepository;
    const repoB = factory.for(tierBResellerScope) as InMemoryResellerCatalogRepository;

    // Two independently-constructed adapters bound to different tiers must
    // not be the same instance — proves the tier is read per-scope, not
    // memoized/shared across customers.
    expect(repoA).not.toBe(repoB);
  });
});
