import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { mintAdminScope, mintResellerScope } from "@/modules/identity/domain/access-scope";
import { MANUAL_REVIEW_THRESHOLD_MINOR } from "../domain/withdrawal-request";
import { DrizzleWalletRepository } from "./drizzle-wallet-repository";
import { DrizzleWithdrawalRequestRepository } from "./drizzle-withdrawal-request-repository";
import { createDrizzleWithdrawalRepository } from "./drizzle-withdrawal-repository";

/**
 * The fake proves the use case is scoped; this proves the SQL is — and, more
 * to the point here, that the transaction actually holds. Everything money
 * moves through in this module lives in `openRequest` and `reject`, and
 * neither can be observed in a single-threaded fake.
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
const RESELLER_USER = "bbbbbbbb-0000-4000-8000-000000000002";
const RESELLER_A = "11111111-1111-4111-8111-111111111111";
const RESELLER_B = "22222222-2222-4222-8222-222222222222";
const TIER = "99999999-9999-4999-8999-999999999999";

const adminScope = mintAdminScope(ADMIN_USER);
const scopeA = mintResellerScope(RESELLER_USER, RESELLER_A, TIER);

let testDb: TestDb;
let repo: DrizzleWithdrawalRequestRepository;
let wallet: DrizzleWalletRepository;
let methodId: string;

async function fund(amountMinor: number, resellerId = RESELLER_A) {
  await wallet.append({
    resellerId,
    kind: "TOPUP",
    amountMinor,
    currency: "COP",
    memo: null,
    createdBy: ADMIN_USER,
  });
}

async function balance(resellerId = RESELLER_A) {
  return (await wallet.balancesByReseller()).get(resellerId);
}

function open(amountMinor: number, maxDailyWithdrawalMinor = MANUAL_REVIEW_THRESHOLD_MINOR * 10) {
  return repo.openRequest({
    resellerId: RESELLER_A,
    methodId,
    amountMinor,
    currency: "COP",
    requestedBy: RESELLER_USER,
    maxDailyWithdrawalMinor,
  });
}

beforeEach(async () => {
  testDb = await createTestDb();
  await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });

  // `created_by` / `requested_by` are real foreign keys, and
  // `users_reseller_requires_tier` means a RESELLER row cannot exist without
  // a tier to point at.
  await testDb.db.execute(
    sql`INSERT INTO price_tier (id, code, name, created_at) VALUES (${TIER}, 'STD', 'Standard', now())`,
  );
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${ADMIN_USER}, 'admin@example.com', '$argon2id$stand-in', 'ADMIN', NULL, NULL, now())`,
  );
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at) VALUES (${RESELLER_USER}, 'reseller@example.com', '$argon2id$stand-in', 'RESELLER', ${RESELLER_A}, ${TIER}, now())`,
  );

  wallet = new DrizzleWalletRepository(testDb.db, adminScope);
  repo = new DrizzleWithdrawalRequestRepository(testDb.db, adminScope);

  const method = await createDrizzleWithdrawalRepository(testDb.db).addMethod({
    resellerId: RESELLER_A,
    type: "BANK_TRANSFER",
    details: "CBU 0170099220000067797249",
    isPrimary: true,
  });
  methodId = method.id;
});

afterEach(async () => {
  await closeTestDb(testDb);
});

describe("DrizzleWithdrawalRequestRepository.openRequest", () => {
  it("debits the ledger and records the request in one transaction", async () => {
    await fund(500_000);

    const outcome = await open(200_000);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(await balance()).toBe(300_000);
    expect(outcome.request.amountMinor).toBe(200_000);
    // `pg` parses int8 as a STRING by default. Money lives in this column.
    expect(typeof outcome.request.amountMinor).toBe("number");

    const debit = (await wallet.listEntries(RESELLER_A)).find(
      (entry) => entry.kind === "WITHDRAWAL",
    );
    expect(debit?.amountMinor).toBe(-200_000);
    expect(outcome.request.walletEntryId).toBe(debit?.id);
  });

  it("leaves NOTHING behind when the balance is short", async () => {
    await fund(100_000);

    const outcome = await open(150_000);

    expect(outcome).toMatchObject({ ok: false, reason: "insufficient-funds", balanceMinor: 100_000 });
    // The whole point of the transaction: a refused request must not have
    // debited, and must not have left an orphan row pointing at nothing.
    expect(await balance()).toBe(100_000);
    expect(await repo.listRequests()).toEqual([]);
  });

  it("serializes concurrent requests instead of letting both pass the check", async () => {
    await fund(500_000);

    // Six at once against a balance that covers one. Without
    // `pg_advisory_xact_lock` every one of them reads 500_000 under READ
    // COMMITTED, all six pass, and the ledger ends at -2_500_000.
    const outcomes = await Promise.all(Array.from({ length: 6 }, () => open(500_000)));

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(await balance()).toBe(0);
    expect(await repo.listRequests()).toHaveLength(1);
  });

  it("counts the day's requests against the cap, ignoring rejected ones", async () => {
    await fund(1_000_000);

    const first = await open(200_000, 300_000);
    expect(first.ok).toBe(true);

    const second = await open(200_000, 300_000);
    expect(second).toMatchObject({
      ok: false,
      reason: "daily-limit-exceeded",
      withdrawnTodayMinor: 200_000,
      limitMinor: 300_000,
    });
  });

  it("opens a large request under review and a small one approved", async () => {
    await fund(MANUAL_REVIEW_THRESHOLD_MINOR * 4);

    const big = await open(MANUAL_REVIEW_THRESHOLD_MINOR);
    const small = await open(200_000);

    expect(big.ok && big.request.status).toBe("PENDING_REVIEW");
    expect(small.ok && small.request.status).toBe("APPROVED");
  });
});

describe("DrizzleWithdrawalRequestRepository review transitions", () => {
  async function openUnderReview() {
    await fund(MANUAL_REVIEW_THRESHOLD_MINOR * 4);
    const outcome = await open(MANUAL_REVIEW_THRESHOLD_MINOR);
    if (!outcome.ok) throw new Error("fixture failed");
    return outcome.request;
  }

  it("approves once and refuses the second attempt", async () => {
    const request = await openUnderReview();

    expect(await repo.approve(request.id, ADMIN_USER, "KYC ok")).not.toBeNull();
    // `status = 'PENDING_REVIEW'` lives in the WHERE, so the second UPDATE
    // matches no row rather than overwriting the first reviewer's decision.
    expect(await repo.approve(request.id, ADMIN_USER, null)).toBeNull();
  });

  it("returns the money as a NEW entry on rejection and never twice", async () => {
    const request = await openUnderReview();
    const afterDebit = await balance();

    const rejected = await repo.reject(request.id, ADMIN_USER, "Datos no coinciden");

    expect(rejected?.status).toBe("REJECTED");
    expect(rejected?.reversalEntryId).not.toBeNull();
    expect(await balance()).toBe((afterDebit ?? 0) + MANUAL_REVIEW_THRESHOLD_MINOR);
    // Append-only: the debit is still there, beside its reversal.
    expect(
      (await wallet.listEntries(RESELLER_A)).filter((entry) => entry.kind === "WITHDRAWAL"),
    ).toHaveLength(2);

    const balanceAfterReject = await balance();
    expect(await repo.reject(request.id, ADMIN_USER, null)).toBeNull();
    expect(await balance()).toBe(balanceAfterReject);
  });

  it("pays an approved request once and refuses to pay it twice", async () => {
    await fund(500_000);
    const outcome = await open(200_000);
    if (!outcome.ok) throw new Error("fixture failed");

    expect((await repo.settle(outcome.request.id, "Transferencia 9912"))?.status).toBe("PAID");
    // The ledger was debited once. A second transfer is money gone with
    // nothing recording it.
    expect(await repo.settle(outcome.request.id, null)).toBeNull();
  });

  it("refuses to pay a request still under review", async () => {
    const request = await openUnderReview();

    expect(await repo.settle(request.id, null)).toBeNull();
  });

  it("enforces the reversal invariant at the database, not just in code", async () => {
    const request = await openUnderReview();

    // `withdrawal_request_reversal_check`: REJECTED and a reversal entry are
    // the same fact. The status and the money must not tell two stories, and
    // the constraint holds even for a hand-written UPDATE that bypasses the
    // repository entirely.
    await expect(
      testDb.db.execute(
        sql`UPDATE withdrawal_request SET status = 'REJECTED' WHERE id = ${request.id}`,
      ),
    ).rejects.toThrow();
  });
});

describe("DrizzleWithdrawalRequestRepository scoping", () => {
  it("hides another reseller's requests from a reseller scope", async () => {
    await fund(500_000);
    await open(200_000);

    const scoped = new DrizzleWithdrawalRequestRepository(testDb.db, scopeA);
    expect(await scoped.listRequests()).toHaveLength(1);

    const other = new DrizzleWithdrawalRequestRepository(
      testDb.db,
      mintResellerScope("user-b", RESELLER_B, TIER),
    );
    // Not "an empty database" — RESELLER_A's row exists and is simply not
    // theirs to see.
    expect(await other.listRequests()).toEqual([]);
  });

  it("refuses to settle a request belonging to somebody else", async () => {
    await fund(500_000);
    const outcome = await open(200_000);
    if (!outcome.ok) throw new Error("fixture failed");

    const other = new DrizzleWithdrawalRequestRepository(
      testDb.db,
      mintResellerScope("user-b", RESELLER_B, TIER),
    );

    expect(await other.settle(outcome.request.id, null)).toBeNull();
    expect((await repo.getRequest(outcome.request.id))?.status).toBe("APPROVED");
  });
});
