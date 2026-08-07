// @vitest-environment node
//
// Server-only: argon2 needs the Node realm (see provision-admin.test.ts).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../../tests/support/pglite-db";
import type { Argon2Params } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { DrizzleCredentialsRepository } from "@/modules/identity/infrastructure/drizzle-credentials-repository";
import { DrizzleUserProvisioning } from "@/modules/identity/infrastructure/drizzle-user-provisioning";
import type { CredentialsRepository, UserCredentials } from "@/modules/identity/domain/credentials-repository";
import type { NewCustomerUser, UserProvisioning } from "@/modules/identity/domain/user-provisioning";
import { provisionCustomer } from "./provision-customer";

/**
 * CI: Only ADMIN Provisions A Customer, Retail Tier Is A Prerequisite For
 * Provisioning. Mirrors `provision-reseller.test.ts`'s fake pattern exactly
 * — same shape of test double, same assertions, same use case structure,
 * because both roles are provisioned the same way behind the same CHECK.
 */

const TEST_PARAMS: Argon2Params = {
  memoryCost: 64,
  timeCost: 1,
  parallelism: 1,
  outputLen: 32,
};

const TIER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let created: NewCustomerUser[];
let existing: UserCredentials | null;

function deps(overrides: Partial<Parameters<typeof provisionCustomer>[0]> = {}) {
  const users: CredentialsRepository = { findByEmail: async () => existing };
  const provisioning: UserProvisioning = {
    createAdmin: async () => {
      throw new Error("createAdmin must not be called here");
    },
    createReseller: async () => {
      throw new Error("createReseller must not be called here");
    },
    createCustomer: async (user) => {
      created.push(user);
    },
  };

  return {
    users,
    provisioning,
    hasher: new NodeRsArgon2Hasher(TEST_PARAMS),
    tierExists: async () => true,
    newUserId: () => "11111111-1111-4111-8111-111111111111",
    newResellerId: () => "22222222-2222-4222-8222-222222222222",
    ...overrides,
  };
}

beforeEach(() => {
  created = [];
  existing = null;
});

describe("provisionCustomer", () => {
  it("creates a CUSTOMER carrying its tier and a fresh, freestanding tenant id (CI: Customer Gets Its Own Tenant Id)", async () => {
    const result = await provisionCustomer(deps(), {
      email: "cliente@example.com",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.email).toBe("cliente@example.com");
    expect(result.user.resellerId).toBe("22222222-2222-4222-8222-222222222222");

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      email: "cliente@example.com",
      priceTierId: TIER_ID,
      resellerId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("stores an argon2id hash, never the plaintext", async () => {
    await provisionCustomer(deps(), {
      email: "cliente@example.com",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(created[0]?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(created[0]?.passwordHash).not.toContain("una frase larga");
  });

  it("normalizes the email before storing it", async () => {
    await provisionCustomer(deps(), {
      email: "  Cliente@Example.COM  ",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(created[0]?.email).toBe("cliente@example.com");
  });

  it("refuses an email that already exists", async () => {
    existing = {
      id: "existing",
      role: "CUSTOMER",
      passwordHash: "$argon2id$stand-in",
      deactivatedAt: null,
    };

    const result = await provisionCustomer(deps(), {
      email: "cliente@example.com",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(result).toEqual({ ok: false, reason: "email-taken" });
    expect(created).toEqual([]);
  });

  it("refuses a password below the minimum length", async () => {
    const result = await provisionCustomer(deps(), {
      email: "cliente@example.com",
      password: "corta",
      priceTierId: TIER_ID,
    });

    expect(result).toEqual({ ok: false, reason: "password-too-short" });
    expect(created).toEqual([]);
  });

  it.each(["", "   ", "sin-arroba", "a@", "@b"])("refuses the email %j", async (email) => {
    const result = await provisionCustomer(deps(), {
      email,
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(result).toEqual({ ok: false, reason: "email-invalid" });
    expect(created).toEqual([]);
  });

  // CI: Retail Tier Is A Prerequisite For Provisioning.
  it("refuses a tier the catalog does not know, with a clear message reason — not a raw constraint violation", async () => {
    const tierExists = vi.fn().mockResolvedValue(false);

    const result = await provisionCustomer(deps({ tierExists }), {
      email: "cliente@example.com",
      password: "una frase larga",
      priceTierId: "unknown-tier",
    });

    expect(result).toEqual({ ok: false, reason: "tier-unknown" });
    expect(tierExists).toHaveBeenCalledWith("unknown-tier");
    expect(created).toEqual([]);
  });

  it("refuses provisioning with no price tier selected — zero retail tiers exist, so this is unselectable", async () => {
    const tierExists = vi.fn().mockResolvedValue(true);

    const result = await provisionCustomer(deps({ tierExists }), {
      email: "cliente@example.com",
      password: "una frase larga",
      priceTierId: "  ",
    });

    expect(result).toEqual({ ok: false, reason: "tier-required" });
    expect(tierExists).not.toHaveBeenCalled();
  });
});

/**
 * Runtime harness: the real `DrizzleUserProvisioning.createCustomer` path
 * against real Postgres (PGlite), proving `users_tier_matches_role` truly
 * accepts a tiered CUSTOMER row end to end — not just through the fake
 * above.
 */
describe("provisionCustomer — real Drizzle round trip (PGlite)", () => {
  const DRIZZLE_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "..",
    "..",
    "drizzle",
  );
  const REAL_TIER_ID = "33333333-3333-4333-8333-333333333333";

  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
    await testDb.db.execute(
      sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${REAL_TIER_ID}, 'RETAIL', 'Retail', now())`,
    );
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  it("persists a CUSTOMER row with role and tier through the real Drizzle adapter", async () => {
    const result = await provisionCustomer(
      {
        users: new DrizzleCredentialsRepository(testDb.db),
        provisioning: new DrizzleUserProvisioning(testDb.db),
        hasher: new NodeRsArgon2Hasher(TEST_PARAMS),
        tierExists: async (id) => id === REAL_TIER_ID,
        newUserId: () => "44444444-4444-4444-8444-444444444444",
        newResellerId: () => "55555555-5555-4555-8555-555555555555",
      },
      { email: "cliente@example.com", password: "una frase larga", priceTierId: REAL_TIER_ID },
    );

    expect(result.ok).toBe(true);

    const rows = await testDb.db.execute<{ role: string; price_tier_id: string; reseller_id: string }>(
      sql`SELECT role, price_tier_id, reseller_id FROM users WHERE id = '44444444-4444-4444-8444-444444444444'`,
    );
    expect(rows.rows).toEqual([
      { role: "CUSTOMER", price_tier_id: REAL_TIER_ID, reseller_id: "55555555-5555-4555-8555-555555555555" },
    ]);
  });
});
