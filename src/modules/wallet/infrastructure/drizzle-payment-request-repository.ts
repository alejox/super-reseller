import { and, desc, eq, sql } from "drizzle-orm";

import type { AccessScope } from "@/modules/identity/domain/access-scope";
import type { ModuleDb } from "@/shared/db/module-db";
import { tenantWhere } from "@/shared/db/tenant";

import type { UserId } from "../domain/ids";
import {
  referenceKey,
  type PaymentMethod,
  type PaymentRequest,
  type PaymentRequestId,
  type PaymentRequestStatus,
} from "../domain/payment-request";
import type {
  ApprovePaymentRequestOutcome,
  OpenPaymentRequestCommand,
  OpenPaymentRequestOutcome,
  PaymentRequestRepository,
} from "../domain/payment-request-repository";
import type { WalletEntry, WalletEntryKind } from "../domain/wallet-entry";
import { paymentRequest, walletEntry } from "./wallet.schema";

type Row = typeof paymentRequest.$inferSelect;

function toDomain(row: Row): PaymentRequest {
  return Object.freeze({
    ...row,
    amountMinor: Number(row.amountMinor),
    method: row.method as PaymentMethod,
    status: row.status as PaymentRequestStatus,
  });
}

/**
 * Postgres' unique-violation SQLSTATE. The partial index on
 * `lower(reference) WHERE status = 'APPROVED'` is the real enforcement of
 * backlog A8 — the SELECT below is only a courtesy that produces a nicer
 * message. Two admins approving twin references in the same millisecond both
 * pass their SELECT and one of them lands here.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

/**
 * Drizzle-backed payment validation, scoped at construction like every other
 * adapter in this module.
 */
export class DrizzlePaymentRequestRepository implements PaymentRequestRepository {
  constructor(
    private readonly db: ModuleDb,
    private readonly scope: AccessScope,
  ) {}

  async open(command: OpenPaymentRequestCommand): Promise<OpenPaymentRequestOutcome> {
    const clash = await this.findApprovedByReference(command.reference);
    if (clash) {
      return { ok: false, reason: "reference-taken", conflictingRequestId: clash };
    }

    const [row] = await this.db
      .insert(paymentRequest)
      .values({
        id: crypto.randomUUID(),
        resellerId: command.resellerId,
        amountMinor: command.amountMinor,
        currency: command.currency,
        method: command.method,
        reference: command.reference.trim(),
        proofUrl: command.proofUrl.trim(),
        status: "PENDING",
        // NULL, and it stays NULL until somebody approves this. The whole
        // feature is this column being empty right now.
        walletEntryId: null,
        createdBy: command.createdBy,
        createdAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        decisionNote: null,
      })
      .returning();

    return { ok: true, request: toDomain(row) };
  }

  /**
   * Reads ACROSS tenants on purpose, unlike every other query here: a
   * reference already used by another reseller is still a duplicate payment,
   * and scoping this lookup would let one tenant approve a second claim
   * against another tenant's transfer. It returns only an id, never a row, so
   * nothing about the other tenant leaks past this method.
   */
  private async findApprovedByReference(reference: string): Promise<PaymentRequestId | null> {
    const [row] = await this.db
      .select({ id: paymentRequest.id })
      .from(paymentRequest)
      .where(
        and(
          eq(paymentRequest.status, "APPROVED"),
          sql`lower(${paymentRequest.reference}) = ${referenceKey(reference)}`,
        ),
      )
      .limit(1);

    return row?.id ?? null;
  }

  async list(status?: PaymentRequestStatus): Promise<readonly PaymentRequest[]> {
    const rows = await this.db
      .select()
      .from(paymentRequest)
      .where(
        and(
          tenantWhere(paymentRequest, this.scope),
          status ? eq(paymentRequest.status, status) : undefined,
        ),
      )
      .orderBy(desc(paymentRequest.createdAt));

    return rows.map(toDomain);
  }

  async get(id: PaymentRequestId): Promise<PaymentRequest | null> {
    const [row] = await this.db
      .select()
      .from(paymentRequest)
      .where(and(tenantWhere(paymentRequest, this.scope), eq(paymentRequest.id, id)));

    return row ? toDomain(row) : null;
  }

  /**
   * The credit and the status change are ONE transaction.
   *
   * A credit without the status flip is money handed out that the queue still
   * shows as pending — approve it again and the reseller is paid twice. The
   * status flip without the credit is the opposite lie: a request marked
   * approved against a balance that never moved. `payment_request_credit_check`
   * refuses to store either half, so the transaction is what makes the write
   * possible at all, not merely tidy.
   */
  async approve(
    id: PaymentRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<ApprovePaymentRequestOutcome> {
    const entryId = crypto.randomUUID();
    const now = new Date();

    try {
      return await this.db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(paymentRequest)
          .where(
            and(
              tenantWhere(paymentRequest, this.scope),
              eq(paymentRequest.id, id),
              // In the WHERE, not checked beforehand: two concurrent
              // approvals would both pass a read-then-write, and only one
              // may credit.
              eq(paymentRequest.status, "PENDING"),
            ),
          )
          // The row is known to exist here — the SELECT just found it — so a
          // row lock is the right tool and an advisory lock would be overkill.
          .for("update");

        if (!existing) {
          return { ok: false, reason: "not-actionable" } as const;
        }

        const [clash] = await tx
          .select({ id: paymentRequest.id })
          .from(paymentRequest)
          .where(
            and(
              eq(paymentRequest.status, "APPROVED"),
              sql`lower(${paymentRequest.reference}) = ${referenceKey(existing.reference)}`,
            ),
          )
          .limit(1);

        if (clash) {
          return { ok: false, reason: "reference-taken" } as const;
        }

        const [entryRow] = await tx
          .insert(walletEntry)
          .values({
            id: entryId,
            resellerId: existing.resellerId,
            // POSITIVE: this is the moment the money enters the platform.
            kind: "TOPUP",
            amountMinor: Number(existing.amountMinor),
            currency: existing.currency,
            // The memo is what ties a ledger line back to the transfer that
            // produced it when somebody audits the statement a year from now.
            memo: `Pago ${existing.reference}`,
            createdBy: reviewedBy,
            createdAt: now,
          })
          .returning();

        const [row] = await tx
          .update(paymentRequest)
          .set({
            status: "APPROVED",
            walletEntryId: entryId,
            reviewedBy,
            reviewedAt: now,
            decisionNote: note,
          })
          .where(eq(paymentRequest.id, id))
          .returning();

        const entry: WalletEntry = Object.freeze({
          ...entryRow,
          amountMinor: Number(entryRow.amountMinor),
          kind: entryRow.kind as WalletEntryKind,
        });

        return { ok: true, request: toDomain(row), entry } as const;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // The transaction rolled back, so no entry was appended. Reporting
        // the same reason the SELECT would have is what keeps the race
        // invisible to the caller.
        return { ok: false, reason: "reference-taken" };
      }
      throw error;
    }
  }

  /**
   * Touches no ledger, and that is the entire implementation. There was never
   * a credit, so there is nothing to reverse — the asymmetry with
   * `DrizzleWithdrawalRequestRepository.reject`, which must append a
   * compensating entry, is the point.
   */
  async reject(
    id: PaymentRequestId,
    reviewedBy: UserId,
    reason: string,
  ): Promise<PaymentRequest | null> {
    const [row] = await this.db
      .update(paymentRequest)
      .set({
        status: "REJECTED",
        reviewedBy,
        reviewedAt: new Date(),
        decisionNote: reason.trim(),
      })
      .where(
        and(
          tenantWhere(paymentRequest, this.scope),
          eq(paymentRequest.id, id),
          eq(paymentRequest.status, "PENDING"),
        ),
      )
      .returning();

    return row ? toDomain(row) : null;
  }

  async countByStatus(): Promise<ReadonlyMap<PaymentRequestStatus, number>> {
    const rows = await this.db
      .select({
        status: paymentRequest.status,
        // `count(*)` comes back as int8, which `pg` parses as a STRING. The
        // cast is the same trap `mode: 'number'` handles on money columns.
        total: sql<number>`count(*)::int`,
      })
      .from(paymentRequest)
      .where(tenantWhere(paymentRequest, this.scope))
      .groupBy(paymentRequest.status);

    return new Map(rows.map((row) => [row.status as PaymentRequestStatus, Number(row.total)]));
  }
}
