import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { mintCustomerScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import type { AccessScope } from "@/modules/identity/domain/access-scope";
import type { ProviderAccountRepository } from "../domain/provider-account-repository";
import { DrizzleProviderAccountRepository } from "./drizzle-provider-account-repository";
import {
  InMemoryProviderAccountRepository,
  InMemoryProviderAccountStore,
} from "./in-memory-provider-account-repository";

/**
 * One shared contract suite run twice (design.md "Testing Strategy"): the
 * in-memory fake proves the use case is scoped, PGlite proves the SQL is —
 * mirrors `wallet-repository.contract.test.ts` and `catalog-repository.
 * contract.test.ts`.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const TIER = "99999999-9999-4999-8999-999999999999";
const CUSTOMER_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CUSTOMER_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RESELLER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SERVICE_STELLA = "11111111-1111-4111-8111-111111111111";
const SERVICE_OTHER = "22222222-2222-4222-8222-222222222222";
const CREATOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const customerAScope = mintCustomerScope(CUSTOMER_A, CUSTOMER_A, TIER);
const customerBScope = mintCustomerScope(CUSTOMER_B, CUSTOMER_B, TIER);
const resellerAScope = mintResellerScope(RESELLER_A, RESELLER_A, TIER);

interface Adapter {
  name: string;
  setup(scope: AccessScope): Promise<ProviderAccountRepository>;
  teardown(): Promise<void>;
}

function inMemoryAdapter(): Adapter {
  let store: InMemoryProviderAccountStore | null = null;
  return {
    name: "in-memory fake",
    async setup(scope) {
      // One store across scopes, exactly like the one database the PGlite
      // adapter reuses: isolation can only be observed when both scopes are
      // looking at the same rows.
      store ??= new InMemoryProviderAccountStore();
      return new InMemoryProviderAccountRepository(store, scope);
    },
    async teardown() {
      store = null;
    },
  };
}

function pgliteAdapter(): Adapter {
  let testDb: TestDb | null = null;
  return {
    name: "PGlite (real Postgres)",
    async setup(scope) {
      if (testDb === null) {
        testDb = await createTestDb();
        await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
        await testDb.db.execute(
          sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${TIER}, 'SEED', 'Seed tier', now())`,
        );
        // `provider_account.created_by` is a real foreign key to `users`.
        await testDb.db.execute(
          sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${CREATOR}, 'creator@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
        );
        // `provider_account.service_id` is a real foreign key to `service`.
        await testDb.db.execute(
          sql`INSERT INTO service (id, slug, name, created_at, updated_at) VALUES (${SERVICE_STELLA}, 'stella-tv', 'Stella TV', now(), now())`,
        );
        await testDb.db.execute(
          sql`INSERT INTO service (id, slug, name, created_at, updated_at) VALUES (${SERVICE_OTHER}, 'other-tv', 'Other TV', now(), now())`,
        );
      }
      return new DrizzleProviderAccountRepository(testDb.db, scope);
    },
    async teardown() {
      if (testDb) {
        await closeTestDb(testDb);
        testDb = null;
      }
    },
  };
}

describe.each([inMemoryAdapter(), pgliteAdapter()])(
  "ProviderAccountRepository contract: $name",
  (adapter) => {
    let asCustomerA: ProviderAccountRepository;

    beforeEach(async () => {
      asCustomerA = await adapter.setup(customerAScope);
    });

    afterEach(async () => {
      await adapter.teardown();
    });

    // PA: Provider Account Identifies A Real Panel Login.
    it("persists the provider, real panel username, and label with no credential populated", async () => {
      const created = await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "stella_juan_2024",
        label: "Cuenta principal",
        createdBy: CREATOR,
      });

      const [found] = await asCustomerA.listForTenant(CUSTOMER_A);

      expect(found).toMatchObject({
        id: created.id,
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "stella_juan_2024",
        label: "Cuenta principal",
      });
    });

    // PA: Duplicate provider is allowed — two accounts for the SAME
    // provider under the SAME customer.
    it("allows a second account for the same provider under the same customer", async () => {
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "stella_first",
        createdBy: CREATOR,
      });
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "stella_second",
        createdBy: CREATOR,
      });

      expect(await asCustomerA.listForTenant(CUSTOMER_A)).toHaveLength(2);
    });

    // provider_account_identity_uniq: the SAME (tenant, service, lower(panel
    // username)) registered twice IS rejected.
    it("rejects registering the exact same (service, panel_username) pair twice for one customer", async () => {
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "stella_juan_2024",
        createdBy: CREATOR,
      });

      await expect(
        asCustomerA.create({
          tenantId: CUSTOMER_A,
          serviceId: SERVICE_STELLA,
          panelUsername: "stella_juan_2024",
          createdBy: CREATOR,
        }),
      ).rejects.toThrow();
    });

    it("treats the identity uniqueness case-insensitively, matching lower(panel_username)", async () => {
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "Stella_Juan_2024",
        createdBy: CREATOR,
      });

      await expect(
        asCustomerA.create({
          tenantId: CUSTOMER_A,
          serviceId: SERVICE_STELLA,
          panelUsername: "stella_juan_2024",
          createdBy: CREATOR,
        }),
      ).rejects.toThrow();
    });

    it("allows the same panel username under a DIFFERENT provider (not a duplicate identity)", async () => {
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "shared_username",
        createdBy: CREATOR,
      });

      await expect(
        asCustomerA.create({
          tenantId: CUSTOMER_A,
          serviceId: SERVICE_OTHER,
          panelUsername: "shared_username",
          createdBy: CREATOR,
        }),
      ).resolves.toBeDefined();

      expect(await asCustomerA.listForTenant(CUSTOMER_A)).toHaveLength(2);
    });

    // PA: Provider Account Isolation.
    it("excludes another customer's accounts from this customer's listing", async () => {
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "a-account",
        createdBy: CREATOR,
      });
      const asCustomerB = await adapter.setup(customerBScope);
      await asCustomerB.create({
        tenantId: CUSTOMER_B,
        serviceId: SERVICE_STELLA,
        panelUsername: "b-account",
        createdBy: CREATOR,
      });

      const bListing = await asCustomerB.listForTenant(CUSTOMER_B);

      expect(bListing.map((row) => row.panelUsername)).toEqual(["b-account"]);
    });

    it("returns an empty result for a reseller-scoped listing, even when customers own rows", async () => {
      await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "a-account",
        createdBy: CREATOR,
      });

      const asReseller = await adapter.setup(resellerAScope);

      expect(await asReseller.listForTenant(CUSTOMER_A)).toEqual([]);
    });

    it("findById returns null for a row outside the caller's scope", async () => {
      const created = await asCustomerA.create({
        tenantId: CUSTOMER_A,
        serviceId: SERVICE_STELLA,
        panelUsername: "a-account",
        createdBy: CREATOR,
      });

      const asCustomerB = await adapter.setup(customerBScope);

      expect(await asCustomerB.findById(created.id)).toBeNull();
      expect(await asCustomerA.findById(created.id)).not.toBeNull();
    });
  },
);
