import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { mintAdminScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import type { WalletRepository } from "../domain/wallet-repository";
import { walletBalance } from "../domain/wallet-entry";
import { DrizzleWalletRepository } from "./drizzle-wallet-repository";
import { InMemoryWalletRepository, InMemoryWalletStore } from "./in-memory-wallet-repository";

/**
 * One shared contract suite run twice — the in-memory fake proves the use
 * case is scoped, PGlite proves the SQL is. Same assertions, both backends.
 */
const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const ADMIN_USER = "aaaaaaaa-0000-4000-8000-000000000001";
const RESELLER_A = "11111111-1111-4111-8111-111111111111";
const RESELLER_B = "22222222-2222-4222-8222-222222222222";
const TIER = "99999999-9999-4999-8999-999999999999";

const adminScope = mintAdminScope(ADMIN_USER);
const scopeA = mintResellerScope("user-a", RESELLER_A, TIER);

interface Adapter {
  name: string;
  setup(scope: typeof adminScope | typeof scopeA): Promise<WalletRepository>;
  teardown(): Promise<void>;
}

function inMemoryAdapter(): Adapter {
  let store: InMemoryWalletStore | null = null;
  return {
    name: "in-memory fake",
    async setup(scope) {
      // One store across scopes, exactly like the one database the PGlite
      // adapter reuses: isolation can only be observed when both scopes are
      // looking at the same rows.
      store ??= new InMemoryWalletStore();
      return new InMemoryWalletRepository(store, scope);
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
        // `wallet_entry.created_by` is a real foreign key, so the author has
        // to exist before any movement can be recorded.
        await testDb.db.execute(
          sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN_USER}, 'admin@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
        );
      }
      return new DrizzleWalletRepository(testDb.db, scope);
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
  "WalletRepository contract: $name",
  (adapter) => {
    let admin: WalletRepository;

    beforeEach(async () => {
      admin = await adapter.setup(adminScope);
    });

    afterEach(async () => {
      await adapter.teardown();
    });

    async function credit(resellerId: string, amountMinor: number) {
      return admin.append({
        resellerId,
        kind: amountMinor >= 0 ? "TOPUP" : "ADJUSTMENT",
        amountMinor,
        currency: "COP",
        memo: null,
        createdBy: ADMIN_USER,
      });
    }

    it("has no movements and no balance for a fresh reseller", async () => {
      expect(await admin.listEntries(RESELLER_A)).toEqual([]);
      // ABSENT, not zero: "never had movements" and "netted to nothing" are
      // different facts, and only the caller knows which to display.
      expect((await admin.balancesByReseller()).has(RESELLER_A)).toBe(false);
    });

    it("derives the balance from the movements, credits and debits alike", async () => {
      await credit(RESELLER_A, 250_000);
      await credit(RESELLER_A, -15_000);

      expect((await admin.balancesByReseller()).get(RESELLER_A)).toBe(235_000);
    });

    it("returns amount_minor as a JS number, not a string", async () => {
      await credit(RESELLER_A, 250_000);

      const [entry] = await admin.listEntries(RESELLER_A);

      // `pg` parses int8 as a STRING by default. Money lives in this column,
      // so a silent string would break every comparison and every sum.
      expect(typeof entry?.amountMinor).toBe("number");
      expect(typeof (await admin.balancesByReseller()).get(RESELLER_A)).toBe("number");
    });

    it("keeps a correction beside the entry it corrects", async () => {
      await credit(RESELLER_A, 250_000);
      await credit(RESELLER_A, -250_000);

      // Append-only: the mistake and its fix both stay visible, and the
      // balance nets to zero rather than the row disappearing.
      expect(await admin.listEntries(RESELLER_A)).toHaveLength(2);
      expect((await admin.balancesByReseller()).get(RESELLER_A)).toBe(0);
    });

    it("sums a ledger into Money through the domain", async () => {
      await credit(RESELLER_A, 250_000);
      await credit(RESELLER_A, -15_000);

      const entries = await admin.listEntries(RESELLER_A);

      expect(walletBalance(entries, "COP")).toEqual({ amountMinor: 235_000, currency: "COP" });
    });

    it("keeps one reseller's ledger out of another's", async () => {
      await credit(RESELLER_A, 250_000);
      await credit(RESELLER_B, 999_000);

      const balances = await admin.balancesByReseller();

      expect(balances.get(RESELLER_A)).toBe(250_000);
      expect(balances.get(RESELLER_B)).toBe(999_000);
    });

    it("shows a RESELLER scope only its own ledger", async () => {
      await credit(RESELLER_A, 250_000);
      await credit(RESELLER_B, 999_000);

      const asA = await adapter.setup(scopeA);

      expect((await asA.listEntries(RESELLER_A)).map((e) => e.amountMinor)).toEqual([250_000]);
      expect([...(await asA.balancesByReseller()).keys()]).toEqual([RESELLER_A]);
    });

    it("returns nothing when a RESELLER scope asks for another reseller's ledger", async () => {
      await credit(RESELLER_B, 999_000);

      const asA = await adapter.setup(scopeA);

      // The scope predicate is ANDed with the requested id, so asking for
      // someone else's ledger matches no rows instead of returning theirs.
      expect(await asA.listEntries(RESELLER_B)).toEqual([]);
    });

    it("refuses a zero movement", async () => {
      await expect(credit(RESELLER_A, 0)).rejects.toThrow();
    });
  },
);
