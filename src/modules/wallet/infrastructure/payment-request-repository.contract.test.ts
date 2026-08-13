import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { mintAdminScope, mintResellerScope } from "@/modules/identity/domain/access-scope";

import type { PaymentRequestRepository } from "../domain/payment-request-repository";
import type { WalletRepository } from "../domain/wallet-repository";
import { DrizzlePaymentRequestRepository } from "./drizzle-payment-request-repository";
import { DrizzleWalletRepository } from "./drizzle-wallet-repository";
import {
  InMemoryPaymentRequestRepository,
  InMemoryPaymentRequestStore,
} from "./in-memory-payment-request-repository";
import { InMemoryWalletRepository, InMemoryWalletStore } from "./in-memory-wallet-repository";

/**
 * One shared contract suite run twice — the fake proves the use case is
 * scoped, PGlite proves the SQL and every CHECK in 0016 are.
 *
 * The wallet repository is part of the fixture on purpose: the assertion that
 * matters most here is not "the request says APPROVED", it is "the BALANCE
 * moved, and only then". Those are two tables, and a test that only read one
 * of them would pass on the exact bug this module was written to remove.
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

type Scope = typeof adminScope | typeof scopeA;

interface Adapter {
  name: string;
  setup(scope: Scope): Promise<{ payments: PaymentRequestRepository; wallet: WalletRepository }>;
  teardown(): Promise<void>;
}

function inMemoryAdapter(): Adapter {
  let payments: InMemoryPaymentRequestStore | null = null;
  let wallet: InMemoryWalletStore | null = null;
  return {
    name: "in-memory fake",
    async setup(scope) {
      payments ??= new InMemoryPaymentRequestStore();
      wallet ??= new InMemoryWalletStore();
      return {
        payments: new InMemoryPaymentRequestRepository(payments, wallet, scope),
        wallet: new InMemoryWalletRepository(wallet, scope),
      };
    },
    async teardown() {
      payments = null;
      wallet = null;
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
        // `created_by` and `reviewed_by` are real foreign keys.
        await testDb.db.execute(
          sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN_USER}, 'admin@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
        );
      }
      return {
        payments: new DrizzlePaymentRequestRepository(testDb.db, scope),
        wallet: new DrizzleWalletRepository(testDb.db, scope),
      };
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
  "PaymentRequestRepository contract: $name",
  (adapter) => {
    let payments: PaymentRequestRepository;
    let wallet: WalletRepository;

    beforeEach(async () => {
      ({ payments, wallet } = await adapter.setup(adminScope));
    });

    afterEach(async () => {
      await adapter.teardown();
    });

    async function open(
      overrides: Partial<Parameters<PaymentRequestRepository["open"]>[0]> = {},
    ) {
      const outcome = await payments.open({
        resellerId: RESELLER_A,
        amountMinor: 250_000,
        currency: "COP",
        method: "BANK_TRANSFER",
        reference: "TRX-9981",
        proofUrl: "https://files.example.com/receipt.png",
        createdBy: ADMIN_USER,
        ...overrides,
      });

      if (!outcome.ok) throw new Error(`open failed: ${outcome.reason}`);
      return outcome.request;
    }

    async function balanceOf(resellerId: string): Promise<number> {
      return (await wallet.balancesByReseller()).get(resellerId) ?? 0;
    }

    it("opens PENDING with no credit attached", async () => {
      const request = await open();

      expect(request.status).toBe("PENDING");
      expect(request.walletEntryId).toBeNull();
      expect(await balanceOf(RESELLER_A)).toBe(0);
    });

    it("returns amount_minor as a JS number, not a string", async () => {
      const request = await open();

      // `pg` parses int8 as a STRING by default, and money lives in this
      // column. A silent string breaks every comparison and every sum.
      expect(typeof request.amountMinor).toBe("number");
    });

    it("moves the balance exactly when the request is approved", async () => {
      const request = await open();
      expect(await balanceOf(RESELLER_A)).toBe(0);

      const result = await payments.approve(request.id, ADMIN_USER, null);

      expect(result.ok).toBe(true);
      expect(await balanceOf(RESELLER_A)).toBe(250_000);
    });

    it("ties the approved request to the entry it appended", async () => {
      const request = await open();

      const result = await payments.approve(request.id, ADMIN_USER, null);

      if (!result.ok) throw new Error("expected approval");
      expect(result.request.walletEntryId).toBe(result.entry.id);
      const [entry] = await wallet.listEntries(RESELLER_A);
      expect(entry?.id).toBe(result.entry.id);
      expect(entry?.kind).toBe("TOPUP");
    });

    it("credits once when approved twice", async () => {
      const request = await open();
      await payments.approve(request.id, ADMIN_USER, null);

      const second = await payments.approve(request.id, ADMIN_USER, null);

      expect(second).toEqual({ ok: false, reason: "not-actionable" });
      expect(await balanceOf(RESELLER_A)).toBe(250_000);
      expect(await wallet.listEntries(RESELLER_A)).toHaveLength(1);
    });

    it("appends nothing at all when rejected", async () => {
      const request = await open();

      const rejected = await payments.reject(request.id, ADMIN_USER, "Comprobante ilegible");

      expect(rejected?.status).toBe("REJECTED");
      expect(rejected?.decisionNote).toBe("Comprobante ilegible");
      expect(rejected?.walletEntryId).toBeNull();
      // Not "credited then reversed" — never credited. There is no entry.
      expect(await wallet.listEntries(RESELLER_A)).toEqual([]);
      expect(await balanceOf(RESELLER_A)).toBe(0);
    });

    it("cannot reject what was already approved", async () => {
      const request = await open();
      await payments.approve(request.id, ADMIN_USER, null);

      expect(await payments.reject(request.id, ADMIN_USER, "tarde")).toBeNull();
      expect(await balanceOf(RESELLER_A)).toBe(250_000);
    });

    it("records the reviewer and the moment on every decision", async () => {
      const approved = await payments.approve((await open()).id, ADMIN_USER, "verificado");
      const rejected = await payments.reject(
        (await open({ reference: "TRX-2" })).id,
        ADMIN_USER,
        "sin fondos",
      );

      if (!approved.ok) throw new Error("expected approval");
      expect(approved.request.reviewedBy).toBe(ADMIN_USER);
      expect(approved.request.reviewedAt).toBeInstanceOf(Date);
      expect(rejected?.reviewedBy).toBe(ADMIN_USER);
      expect(rejected?.reviewedAt).toBeInstanceOf(Date);
    });

    it("refuses to open a claim reusing an APPROVED reference", async () => {
      await payments.approve((await open({ reference: "TRX-DUP" })).id, ADMIN_USER, null);

      const outcome = await payments.open({
        resellerId: RESELLER_A,
        amountMinor: 10_000,
        currency: "COP",
        method: "NEQUI",
        reference: "trx-dup",
        proofUrl: "https://files.example.com/other.png",
        createdBy: ADMIN_USER,
      });

      // Case-insensitive, matching `referenceKey` and `lower(reference)`.
      expect(outcome.ok).toBe(false);
    });

    it("refuses the SECOND approval of two claims sharing a reference", async () => {
      const first = await open({ reference: "TRX-TWIN" });
      const second = await open({ reference: "TRX-TWIN" });

      // Both may sit pending — uniqueness is scoped to approved rows.
      expect(first.status).toBe("PENDING");
      expect(second.status).toBe("PENDING");

      expect((await payments.approve(first.id, ADMIN_USER, null)).ok).toBe(true);
      expect(await payments.approve(second.id, ADMIN_USER, null)).toEqual({
        ok: false,
        reason: "reference-taken",
      });
      // The refused approval must not have credited on its way out.
      expect(await balanceOf(RESELLER_A)).toBe(250_000);
    });

    it("lets a rejected reference be resubmitted", async () => {
      const first = await open({ reference: "TRX-FIX" });
      await payments.reject(first.id, ADMIN_USER, "monto equivocado");

      const outcome = await payments.open({
        resellerId: RESELLER_A,
        amountMinor: 300_000,
        currency: "COP",
        method: "BANK_TRANSFER",
        reference: "TRX-FIX",
        proofUrl: "https://files.example.com/fixed.png",
        createdBy: ADMIN_USER,
      });

      expect(outcome.ok).toBe(true);
    });

    it("narrows the inbox to the pending claims", async () => {
      const approved = await open({ reference: "TRX-A" });
      await payments.approve(approved.id, ADMIN_USER, null);
      await open({ reference: "TRX-B" });

      const pending = await payments.list("PENDING");

      expect(pending.map((request) => request.reference)).toEqual(["TRX-B"]);
    });

    it("counts by status in one pass", async () => {
      await payments.approve((await open({ reference: "TRX-1" })).id, ADMIN_USER, null);
      await payments.reject((await open({ reference: "TRX-2" })).id, ADMIN_USER, "no");
      await open({ reference: "TRX-3" });

      const counts = await payments.countByStatus();

      expect(counts.get("APPROVED")).toBe(1);
      expect(counts.get("REJECTED")).toBe(1);
      expect(counts.get("PENDING")).toBe(1);
    });

    it("keeps one reseller's claims out of another's view", async () => {
      await open({ resellerId: RESELLER_B, reference: "TRX-B-ONLY" });
      await open({ reference: "TRX-A-ONLY" });

      const { payments: asA } = await adapter.setup(scopeA);

      expect((await asA.list()).map((request) => request.reference)).toEqual(["TRX-A-ONLY"]);
      expect([...(await asA.countByStatus()).values()].reduce((a, b) => a + b, 0)).toBe(1);
    });

    it("hides another tenant's claim behind the same not-actionable answer", async () => {
      const foreign = await open({ resellerId: RESELLER_B, reference: "TRX-FOREIGN" });

      const { payments: asA } = await adapter.setup(scopeA);

      expect(await asA.get(foreign.id)).toBeNull();
      // "Not yours" and "does not exist" must be indistinguishable, or the
      // endpoint answers "is this a real id?" for anyone who can reach it.
      expect(await asA.approve(foreign.id, ADMIN_USER, null)).toEqual({
        ok: false,
        reason: "not-actionable",
      });
      expect(await asA.reject(foreign.id, ADMIN_USER, "no")).toBeNull();
    });
  },
);
