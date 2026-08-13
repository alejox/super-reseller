import { tenantIdOf, type AccessScope } from "@/modules/identity/domain/access-scope";

import type { UserId } from "../domain/ids";
import {
  approvePaymentRequest,
  createPaymentRequest,
  referenceKey,
  rejectPaymentRequest,
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
import { createWalletEntry } from "../domain/wallet-entry";
import type { InMemoryWalletStore } from "./in-memory-wallet-repository";

/**
 * The rows, independent of who is reading them — same split, and same reason,
 * as `InMemoryWalletStore`: two scopes must be able to read ONE set of
 * requests, or the isolation test passes for the wrong reason.
 */
export class InMemoryPaymentRequestStore {
  readonly requests: PaymentRequest[] = [];
}

/**
 * Test double for `PaymentRequestRepository`.
 *
 * It writes its credit into the SAME `InMemoryWalletStore` the wallet fake
 * reads. A fake that kept its own ledger would happily "approve" a request
 * without the balance ever moving — which is the one behaviour this whole
 * feature exists to guarantee, and the one a test must be able to catch.
 */
export class InMemoryPaymentRequestRepository implements PaymentRequestRepository {
  constructor(
    private readonly store: InMemoryPaymentRequestStore,
    private readonly wallet: InMemoryWalletStore,
    private readonly scope: AccessScope,
  ) {}

  /** Mirrors `tenantWhere(paymentRequest, scope)`: ADMIN sees all, RESELLER its own. */
  private visible(): PaymentRequest[] {
    const tenantId = tenantIdOf(this.scope);
    return tenantId === null
      ? this.store.requests
      : this.store.requests.filter((request) => request.resellerId === tenantId);
  }

  private approvedReference(reference: string): PaymentRequest | undefined {
    const key = referenceKey(reference);
    return this.store.requests.find(
      (request) => request.status === "APPROVED" && referenceKey(request.reference) === key,
    );
  }

  private replace(next: PaymentRequest): PaymentRequest {
    const index = this.store.requests.findIndex((request) => request.id === next.id);
    this.store.requests[index] = next;
    return next;
  }

  async open(command: OpenPaymentRequestCommand): Promise<OpenPaymentRequestOutcome> {
    const clash = this.approvedReference(command.reference);
    if (clash) {
      return { ok: false, reason: "reference-taken", conflictingRequestId: clash.id };
    }

    const request = createPaymentRequest(command);
    this.store.requests.push(request);
    return { ok: true, request };
  }

  async list(status?: PaymentRequestStatus): Promise<readonly PaymentRequest[]> {
    return this.visible()
      .filter((request) => status === undefined || request.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async get(id: PaymentRequestId): Promise<PaymentRequest | null> {
    return this.visible().find((request) => request.id === id) ?? null;
  }

  async approve(
    id: PaymentRequestId,
    reviewedBy: UserId,
    note: string | null,
  ): Promise<ApprovePaymentRequestOutcome> {
    const request = await this.get(id);
    // One reason for "gone", "already decided" and "not yours" — see
    // `review-payment-request.ts` for why they collapse.
    if (request === null || request.status !== "PENDING") {
      return { ok: false, reason: "not-actionable" };
    }

    if (this.approvedReference(request.reference)) {
      return { ok: false, reason: "reference-taken" };
    }

    const entry = createWalletEntry({
      resellerId: request.resellerId,
      kind: "TOPUP",
      amountMinor: request.amountMinor,
      currency: request.currency,
      memo: `Pago ${request.reference}`,
      createdBy: reviewedBy,
    });
    this.wallet.entries.push(entry);

    const approved = this.replace(
      approvePaymentRequest(request, reviewedBy, new Date(), entry.id, note),
    );

    return { ok: true, request: approved, entry };
  }

  async reject(
    id: PaymentRequestId,
    reviewedBy: UserId,
    reason: string,
  ): Promise<PaymentRequest | null> {
    const request = await this.get(id);
    if (request === null || request.status !== "PENDING") return null;

    return this.replace(rejectPaymentRequest(request, reviewedBy, new Date(), reason));
  }

  async countByStatus(): Promise<ReadonlyMap<PaymentRequestStatus, number>> {
    const counts = new Map<PaymentRequestStatus, number>();
    for (const request of this.visible()) {
      counts.set(request.status, (counts.get(request.status) ?? 0) + 1);
    }
    return counts;
  }
}
