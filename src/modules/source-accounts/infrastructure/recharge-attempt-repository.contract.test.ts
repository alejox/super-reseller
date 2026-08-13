import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";

import {
  markSubmitted,
  markUnverifiable,
  openRechargeAttempt,
  settleAttempt,
  type RechargeAttempt,
} from "../domain/recharge-attempt";
import type { RechargeAttemptRepository } from "../domain/recharge-attempt-repository";
import { DrizzleRechargeAttemptRepository } from "./drizzle-recharge-attempt-repository";
import {
  InMemoryRechargeAttemptRepository,
  InMemoryRechargeAttemptStore,
} from "./in-memory-recharge-attempt-repository";
import { DrizzleSourceAccountRepository } from "./drizzle-source-account-repository";

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const ADMIN_USER = "aaaaaaaa-0000-4000-8000-000000000001";
const SOURCE_ID = "cccccccc-0000-4000-8000-000000000001";
const TARGET = "+573112329185";
const PLAN = "Plan de 1 Dispositivo";

interface Adapter {
  name: string;
  setup(): Promise<RechargeAttemptRepository>;
  teardown(): Promise<void>;
  /** Only PGlite can prove a CHECK constraint fires. */
  db(): TestDb | null;
}

function inMemoryAdapter(): Adapter {
  let store: InMemoryRechargeAttemptStore | null = null;
  return {
    name: "in-memory fake",
    async setup() {
      store ??= new InMemoryRechargeAttemptStore();
      return new InMemoryRechargeAttemptRepository(store);
    },
    async teardown() {
      store = null;
    },
    db: () => null,
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
        await testDb.db.execute(
          sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN_USER}, 'admin@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
        );
        // `source_account_id` is a real foreign key.
        const sources = new DrizzleSourceAccountRepository(testDb.db);
        const created = await sources.create({
          panelUrl: "https://syainj.pro-reventa.net/",
          panelUsername: "MGSALEJO",
          createdBy: ADMIN_USER,
        });
        if (!created.ok) throw new Error("fixture failed");
        await testDb.db.execute(
          sql`UPDATE source_account SET id = ${SOURCE_ID} WHERE id = ${created.account.id}`,
        );
      }
      return new DrizzleRechargeAttemptRepository(testDb.db);
    },
    async teardown() {
      if (testDb) {
        await closeTestDb(testDb);
        testDb = null;
      }
    },
    db: () => testDb,
  };
}

describe.each([inMemoryAdapter(), pgliteAdapter()])(
  "RechargeAttemptRepository contract: $name",
  (adapter) => {
    let repo: RechargeAttemptRepository;

    beforeEach(async () => {
      repo = await adapter.setup();
    });

    afterEach(async () => {
      await adapter.teardown();
    });

    const open = (overrides: Partial<Parameters<typeof openRechargeAttempt>[0]> = {}) =>
      openRechargeAttempt({
        sourceAccountId: SOURCE_ID,
        targetAccount: TARGET,
        plan: PLAN,
        period: "MONTHLY",
        points: 1,
        accumulatedBefore: 6125,
        createdBy: ADMIN_USER,
        createdAt: new Date("2026-08-13T10:00:00.000Z"),
        ...overrides,
      });

    async function persistThrough(attempt: RechargeAttempt): Promise<RechargeAttempt> {
      // The real sequence: PENDING, then SUBMITTED, then the verdict.
      await repo.save(attempt);
      return repo.save(markSubmitted(attempt, new Date("2026-08-13T10:00:01.000Z")));
    }

    it("round-trips an attempt through every state", async () => {
      const attempt = open();
      const submitted = await persistThrough(attempt);

      expect(submitted.status).toBe("SUBMITTED");
      expect((await repo.get(attempt.id))?.accumulatedBefore).toBe(6125);

      const settled = await repo.save(
        settleAttempt(submitted, 6126, new Date("2026-08-13T10:00:05.000Z")),
      );

      expect(settled.status).toBe("CONFIRMED");
      expect(settled.accumulatedAfter).toBe(6126);
      expect((await repo.get(attempt.id))?.status).toBe("CONFIRMED");
    });

    it("returns null for an attempt that does not exist", async () => {
      expect(await repo.get("00000000-0000-4000-8000-00000000dead")).toBeNull();
    });

    describe("listOpen — the recovery queue", () => {
      it("holds attempts still awaiting a verdict", async () => {
        const attempt = open();
        await persistThrough(attempt);

        const openAttempts = await repo.listOpen();

        expect(openAttempts.map((a) => a.id)).toEqual([attempt.id]);
      });

      it("drops them once settled", async () => {
        const submitted = await persistThrough(open());
        await repo.save(settleAttempt(submitted, 6126, new Date()));

        expect(await repo.listOpen()).toEqual([]);
      });

      it("narrows by supplier login when asked", async () => {
        const attempt = open();
        await persistThrough(attempt);

        expect(await repo.listOpen(SOURCE_ID)).toHaveLength(1);
        expect(await repo.listOpen("00000000-0000-4000-8000-00000000beef")).toEqual([]);
      });
    });

    it("keeps unverified attempts findable", async () => {
      const submitted = await persistThrough(open());
      await repo.save(markUnverifiable(submitted, "no se pudo reconsultar", new Date()));

      const unresolved = await repo.listUnverified();

      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].failureDetail).toBe("no se pudo reconsultar");
      // And it is NOT in the open queue — a human owns it now, not a retry.
      expect(await repo.listOpen()).toEqual([]);
    });

    it("lists recent history newest first", async () => {
      const older = open({ createdAt: new Date("2026-08-01T00:00:00.000Z") });
      const newer = open({ createdAt: new Date("2026-08-02T00:00:00.000Z") });
      await repo.save(older);
      await repo.save(newer);

      const recent = await repo.listRecent(SOURCE_ID, 10);

      expect(recent.map((a) => a.id)).toEqual([newer.id, older.id]);
    });

    // The anchor is written once, at PENDING, and must survive every later
    // write. An anchor that could be rewritten is not an anchor.
    it("never rewrites the anchor, the target or the amount", async () => {
      const attempt = open();
      const submitted = await persistThrough(attempt);
      await repo.save(
        Object.freeze({ ...submitted, accumulatedBefore: 999, points: 99, targetAccount: "+000" }),
      );

      const stored = await repo.get(attempt.id);

      // The fake stores what it is given; only Postgres enforces this, so the
      // assertion is scoped to the adapter that can.
      if (adapter.db()) {
        expect(stored?.accumulatedBefore).toBe(6125);
        expect(stored?.points).toBe(1);
        expect(stored?.targetAccount).toBe(TARGET);
      }
    });
  },
);

/**
 * The CHECK constraints, exercised directly.
 *
 * `recharge_attempt_confirmed_check` encodes what CONFIRMED MEANS: the counter
 * moved by exactly the points asked for. No repository method can produce a
 * violation — the domain will not build one — so the only honest way to prove
 * the constraint is armed is to go around the domain and try it in SQL.
 */
describe("recharge_attempt CHECK constraints (PGlite)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });
    await testDb.db.execute(
      sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN_USER}, 'admin@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
    );
    await testDb.db.execute(
      sql`INSERT INTO source_account (id, panel_url, panel_username, created_by, created_at) VALUES (${SOURCE_ID}, 'https://p.net/', 'MGSALEJO', ${ADMIN_USER}, now())`,
    );
  });

  afterEach(async () => {
    await closeTestDb(testDb);
  });

  const insert = (status: string, before: number, after: number | null, points = 1) =>
    testDb.db.execute(
      sql`INSERT INTO recharge_attempt (id, source_account_id, target_account, plan, period, points, status, accumulated_before, accumulated_after, created_by, created_at, submitted_at, settled_at)
          VALUES (gen_random_uuid(), ${SOURCE_ID}, ${TARGET}, ${PLAN}, 'MONTHLY', ${points}, ${status}, ${before}, ${after}, ${ADMIN_USER}, now(), now(), now())`,
    );

  it("accepts a CONFIRMED row whose arithmetic holds", async () => {
    await expect(insert("CONFIRMED", 6125, 6126)).resolves.toBeDefined();
  });

  it("REFUSES a CONFIRMED row whose counter did not move by the points", async () => {
    await expect(insert("CONFIRMED", 6125, 6125)).rejects.toThrow();
    await expect(insert("CONFIRMED", 6125, 6130)).rejects.toThrow();
  });

  it("REFUSES a FAILED row whose counter actually moved", async () => {
    await expect(insert("FAILED", 6125, 6126)).rejects.toThrow();
  });

  it("REFUSES an UNVERIFIED row with no reason", async () => {
    await expect(insert("UNVERIFIED", 6125, null)).rejects.toThrow();
  });

  it("REFUSES a settled row that is still marked open", async () => {
    await expect(
      testDb.db.execute(
        sql`INSERT INTO recharge_attempt (id, source_account_id, target_account, plan, period, points, status, accumulated_before, created_by, created_at, submitted_at, settled_at)
            VALUES (gen_random_uuid(), ${SOURCE_ID}, ${TARGET}, ${PLAN}, 'MONTHLY', 1, 'SUBMITTED', 6125, ${ADMIN_USER}, now(), now(), now())`,
      ),
    ).rejects.toThrow();
  });
});
