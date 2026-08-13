import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";

import { pointsAvailable, type CreditBalance } from "../domain/source-account";
import type { SourceAccountRepository } from "../domain/source-account-repository";
import { DrizzleSourceAccountRepository } from "./drizzle-source-account-repository";
import {
  InMemorySourceAccountRepository,
  InMemorySourceAccountStore,
} from "./in-memory-source-account-repository";

/**
 * One shared contract suite run twice — the fake proves the use cases are
 * written against the port, PGlite proves the SQL and every CHECK in 0017 are.
 *
 * The assertions that earn their keep are the balance ones. `credits` is a
 * MIRROR of the supplier's numbers, replaced wholesale on every successful
 * sync, and "replaced" is exactly the behaviour a merge-by-accident
 * implementation gets wrong while still passing everything else.
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
const PANEL = "https://syainj.pro-reventa.net/";

/** The two buckets this operator actually buys, as the panel reports them. */
const credits = (oneDevice: number, threeDevices: number): CreditBalance[] => [
  { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: oneDevice },
  { plan: "Plan de 3 Dispositivos", period: "MONTHLY", points: threeDevices },
];

interface Adapter {
  name: string;
  setup(): Promise<SourceAccountRepository>;
  teardown(): Promise<void>;
}

function inMemoryAdapter(): Adapter {
  let store: InMemorySourceAccountStore | null = null;
  return {
    name: "in-memory fake",
    async setup() {
      store ??= new InMemorySourceAccountStore();
      return new InMemorySourceAccountRepository(store);
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
    async setup() {
      if (testDb === null) {
        testDb = await createTestDb();
        await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
        // `created_by` is a real foreign key.
        await testDb.db.execute(
          sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN_USER}, 'admin@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
        );
      }
      return new DrizzleSourceAccountRepository(testDb.db);
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
  "SourceAccountRepository contract: $name",
  (adapter) => {
    let repo: SourceAccountRepository;

    beforeEach(async () => {
      repo = await adapter.setup();
    });

    afterEach(async () => {
      await adapter.teardown();
    });

    async function create(
      overrides: Partial<Parameters<SourceAccountRepository["create"]>[0]> = {},
    ) {
      const outcome = await repo.create({
        panelUrl: PANEL,
        panelUsername: "MGSALEJO",
        createdBy: ADMIN_USER,
        ...overrides,
      });
      if (!outcome.ok) throw new Error(`expected create to succeed: ${outcome.reason}`);
      return outcome.account;
    }

    describe("create", () => {
      it("stores an account that has never connected and knows no balances", async () => {
        const account = await create();

        expect(account.connectionStatus).toBe("NEVER_CONNECTED");
        expect(account.lastSyncAt).toBeNull();
        expect(account.credits).toEqual([]);
        expect(await repo.get(account.id)).toEqual(account);
      });

      it("rejects the same username on the same panel", async () => {
        await create({ panelUsername: "DUPE" });

        const outcome = await repo.create({
          panelUrl: PANEL,
          // Case difference on purpose: the unique index is on lower(...).
          panelUsername: "dupe",
          createdBy: ADMIN_USER,
        });

        expect(outcome.ok).toBe(false);
        if (outcome.ok) return;
        expect(outcome.reason).toBe("identity-taken");
      });

      it("allows the same username on a DIFFERENT supplier panel", async () => {
        await create({ panelUsername: "SHARED" });

        const outcome = await repo.create({
          panelUrl: "https://otro-proveedor.net/",
          panelUsername: "SHARED",
          createdBy: ADMIN_USER,
        });

        expect(outcome.ok).toBe(true);
      });

      it("frees the identity once the account is archived", async () => {
        const first = await create({ panelUsername: "RECYCLED" });
        await repo.archive(first.id);

        const outcome = await repo.create({
          panelUrl: PANEL,
          panelUsername: "RECYCLED",
          createdBy: ADMIN_USER,
        });

        expect(outcome.ok).toBe(true);
      });
    });

    describe("recordSync — success carries the balances", () => {
      it("mirrors what the supplier reported", async () => {
        const account = await create();
        const at = new Date("2026-08-13T15:00:00.000Z");

        const synced = await repo.recordSync(account.id, { ok: true, credits: credits(193, 99) }, at);

        expect(synced?.connectionStatus).toBe("CONNECTED");
        expect(synced?.lastSyncAt).toEqual(at);
        expect(pointsAvailable(synced!, "Plan de 1 Dispositivo", "MONTHLY")).toBe(193);
        expect(pointsAvailable(synced!, "Plan de 3 Dispositivos", "MONTHLY")).toBe(99);
      });

      it("survives a round trip through `get`", async () => {
        const account = await create();
        await repo.recordSync(account.id, { ok: true, credits: credits(193, 99) });

        const reloaded = await repo.get(account.id);

        expect(pointsAvailable(reloaded!, "Plan de 1 Dispositivo", "MONTHLY")).toBe(193);
      });

      // The mirror rule. A merge would keep a bucket alive after the supplier
      // stopped reporting it, showing points that are not there.
      it("REPLACES the balances instead of accumulating them", async () => {
        const account = await create();
        await repo.recordSync(account.id, { ok: true, credits: credits(193, 99) });

        const second = await repo.recordSync(account.id, {
          ok: true,
          credits: [{ plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: 12 }],
        });

        expect(second?.credits).toHaveLength(1);
        expect(pointsAvailable(second!, "Plan de 1 Dispositivo", "MONTHLY")).toBe(12);
        expect(pointsAvailable(second!, "Plan de 3 Dispositivos", "MONTHLY")).toBeNull();
      });

      it("accepts a balance of zero — that is a real answer, not a missing one", async () => {
        const account = await create();

        const synced = await repo.recordSync(account.id, { ok: true, credits: credits(0, 0) });

        expect(pointsAvailable(synced!, "Plan de 1 Dispositivo", "MONTHLY")).toBe(0);
      });

      // A scrape that read the same row twice must not become a constraint
      // violation on `source_account_credit_bucket_uniq`.
      it("tolerates a duplicated bucket in one report", async () => {
        const account = await create();

        const synced = await repo.recordSync(account.id, {
          ok: true,
          credits: [
            { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: 5 },
            { plan: "plan de 1 dispositivo", period: "MONTHLY", points: 5 },
          ],
        });

        expect(synced?.credits).toHaveLength(1);
      });
    });

    describe("recordSync — failure", () => {
      it("moves status, clock and streak together", async () => {
        const account = await create();
        const at = new Date("2026-08-13T15:00:00.000Z");

        const synced = await repo.recordSync(
          account.id,
          { ok: false, reason: "REQUIRES_2FA", detail: "pide código de verificación" },
          at,
        );

        expect(synced?.connectionStatus).toBe("REQUIRES_2FA");
        expect(synced?.lastSyncAt).toEqual(at);
        expect(synced?.lastSyncError).toBe("pide código de verificación");
        expect(synced?.consecutiveFailures).toBe(1);
      });

      // Stale, not wrong. Blanking the screen the moment something breaks is
      // the opposite of helpful.
      it("keeps the last known balances", async () => {
        const account = await create();
        await repo.recordSync(account.id, { ok: true, credits: credits(193, 99) });

        const failed = await repo.recordSync(account.id, { ok: false, reason: "LOGIN_ERROR" });

        expect(pointsAvailable(failed!, "Plan de 1 Dispositivo", "MONTHLY")).toBe(193);
      });

      it("accumulates the streak and clears it on recovery", async () => {
        const account = await create();
        await repo.recordSync(account.id, { ok: false, reason: "LOGIN_ERROR" });
        const twice = await repo.recordSync(account.id, { ok: false, reason: "LOGIN_ERROR" });
        expect(twice?.consecutiveFailures).toBe(2);

        const recovered = await repo.recordSync(account.id, { ok: true, credits: credits(1, 1) });

        expect(recovered?.connectionStatus).toBe("CONNECTED");
        expect(recovered?.consecutiveFailures).toBe(0);
        expect(recovered?.lastSyncError).toBeNull();
      });

      it("returns null for an account that does not exist", async () => {
        expect(
          await repo.recordSync("00000000-0000-4000-8000-00000000dead", {
            ok: true,
            credits: [],
          }),
        ).toBeNull();
      });
    });

    describe("list, archive and counts", () => {
      it("lists live accounts newest first, with their balances, and drops the archived", async () => {
        // Explicit clocks: three inserts in the same millisecond would make
        // "newest first" untestable rather than merely flaky.
        const first = await create({
          panelUsername: "A",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        });
        const second = await create({
          panelUsername: "B",
          createdAt: new Date("2026-08-02T00:00:00.000Z"),
        });
        const third = await create({
          panelUsername: "C",
          createdAt: new Date("2026-08-03T00:00:00.000Z"),
        });
        await repo.recordSync(first.id, { ok: true, credits: credits(193, 99) });
        await repo.archive(second.id);

        const listed = await repo.list();

        expect(listed.map((a) => a.id)).toEqual([third.id, first.id]);
        expect(pointsAvailable(listed[1], "Plan de 1 Dispositivo", "MONTHLY")).toBe(193);
        expect(listed[0].credits).toEqual([]);
      });

      it("counts by connection status", async () => {
        const a = await create({ panelUsername: "ONE" });
        const b = await create({ panelUsername: "TWO" });
        await create({ panelUsername: "THREE" });
        await repo.recordSync(a.id, { ok: true, credits: credits(1, 1) });
        await repo.recordSync(b.id, { ok: false, reason: "LOGIN_ERROR" });

        const counts = await repo.countByConnectionStatus();

        expect(counts.get("CONNECTED")).toBe(1);
        expect(counts.get("LOGIN_ERROR")).toBe(1);
        expect(counts.get("NEVER_CONNECTED")).toBe(1);
      });
    });
  },
);
