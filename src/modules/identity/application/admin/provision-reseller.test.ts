// @vitest-environment node
//
// Server-only: argon2 needs the Node realm (see provision-admin.test.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Argon2Params } from "@/modules/identity/domain/password-hasher";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import type { CredentialsRepository, UserCredentials } from "@/modules/identity/domain/credentials-repository";
import type { NewResellerUser, UserProvisioning } from "@/modules/identity/domain/user-provisioning";
import { provisionReseller } from "./provision-reseller";

const TEST_PARAMS: Argon2Params = {
  memoryCost: 64,
  timeCost: 1,
  parallelism: 1,
  outputLen: 32,
};

const TIER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let created: NewResellerUser[];
let existing: UserCredentials | null;

function deps(overrides: Partial<Parameters<typeof provisionReseller>[0]> = {}) {
  const users: CredentialsRepository = { findByEmail: async () => existing };
  const provisioning: UserProvisioning = {
    createAdmin: async () => {
      throw new Error("createAdmin must not be called here");
    },
    createReseller: async (user) => {
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

describe("provisionReseller", () => {
  it("creates a RESELLER carrying its tier and a fresh reseller id", async () => {
    const result = await provisionReseller(deps(), {
      email: "juan@example.com",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.email).toBe("juan@example.com");
    expect(result.user.resellerId).toBe("22222222-2222-4222-8222-222222222222");

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      email: "juan@example.com",
      priceTierId: TIER_ID,
      // A top-level reseller owns its own tenant: `users.reseller_id` is the
      // ownership axis `tenantWhere` filters on, so the row has to carry the
      // id or the reseller cannot read itself back.
      resellerId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("stores an argon2id hash, never the plaintext", async () => {
    await provisionReseller(deps(), {
      email: "juan@example.com",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(created[0]?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(created[0]?.passwordHash).not.toContain("una frase larga");
  });

  it("normalizes the email before storing it", async () => {
    await provisionReseller(deps(), {
      email: "  Juan@Example.COM  ",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    // `users_email_lower_uniq` is a functional index on lower(email), so a
    // non-normalized write would be rejected by a duplicate the application
    // cannot see coming.
    expect(created[0]?.email).toBe("juan@example.com");
  });

  it("refuses an email that already exists", async () => {
    existing = {
      id: "existing",
      role: "RESELLER",
      passwordHash: "$argon2id$stand-in",
      deactivatedAt: null,
    };

    const result = await provisionReseller(deps(), {
      email: "juan@example.com",
      password: "una frase larga",
      priceTierId: TIER_ID,
    });

    expect(result).toEqual({ ok: false, reason: "email-taken" });
    expect(created).toEqual([]);
  });

  it("refuses a password below the minimum length", async () => {
    const result = await provisionReseller(deps(), {
      email: "juan@example.com",
      password: "corta",
      priceTierId: TIER_ID,
    });

    expect(result).toEqual({ ok: false, reason: "password-too-short" });
    expect(created).toEqual([]);
  });

  it.each(["", "   ", "sin-arroba", "a@", "@b"])(
    "refuses the email %j",
    async (email) => {
      const result = await provisionReseller(deps(), {
        email,
        password: "una frase larga",
        priceTierId: TIER_ID,
      });

      expect(result).toEqual({ ok: false, reason: "email-invalid" });
      expect(created).toEqual([]);
    },
  );

  it("refuses a tier the catalog does not know", async () => {
    const tierExists = vi.fn().mockResolvedValue(false);

    const result = await provisionReseller(deps({ tierExists }), {
      email: "juan@example.com",
      password: "una frase larga",
      priceTierId: "unknown-tier",
    });

    // `price_tier_id REFERENCES price_tier(id)` would reject it anyway, as a
    // raw FK violation no form can render. The check is injected rather than
    // imported: eslint forbids identity from importing catalog at all, and a
    // reseller's tier is catalog's fact.
    expect(result).toEqual({ ok: false, reason: "tier-unknown" });
    expect(tierExists).toHaveBeenCalledWith("unknown-tier");
    expect(created).toEqual([]);
  });

  it("refuses a missing tier without asking the catalog", async () => {
    const tierExists = vi.fn().mockResolvedValue(true);

    const result = await provisionReseller(deps({ tierExists }), {
      email: "juan@example.com",
      password: "una frase larga",
      priceTierId: "  ",
    });

    // `users_reseller_requires_tier` makes a tier-less RESELLER
    // unrepresentable in the database; refusing here keeps that from
    // surfacing as a CHECK violation.
    expect(result).toEqual({ ok: false, reason: "tier-required" });
    expect(tierExists).not.toHaveBeenCalled();
  });
});
