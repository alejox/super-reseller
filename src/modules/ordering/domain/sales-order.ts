import type { CurrencyCode } from "@/shared/money/money";

/**
 * Ordering identifiers. Plain `string` (UUID) aliases — cross-module
 * references are by id only, so `PlanId`, `PlanPriceId`, `ResellerId`,
 * `UserId` and `WalletEntryId` here are structurally-identical local
 * aliases, never imports of another module's entity types.
 */
export type SalesOrderId = string;
export type PlanId = string;
export type PlanPriceId = string;
export type ResellerId = string;
export type UserId = string;
export type WalletEntryId = string;

/**
 * Fulfilment happens entirely off-platform, over WhatsApp, by the owner
 * (proposal.md). The platform never holds a streaming account, so this
 * status is a record of what the owner says they did — not something the
 * system can observe or verify for itself.
 *
 * `text` + CHECK rather than a Postgres enum: statuses are the kind of thing
 * a product adds to, and an enum value can never be removed once shipped.
 */
export type SalesOrderStatus = "PENDING" | "FULFILLED" | "CANCELLED";

export type SalesOrder = Readonly<{
  id: SalesOrderId;
  resellerId: ResellerId;
  /** The user account that placed it — a reseller may later have several. */
  placedBy: UserId;
  planId: PlanId;
  /**
   * The order-time price anchor (design.md: "plan_price is append-only and
   * individually addressable"). The order stores this ID, never a copied
   * amount: `plan_price` rows are never mutated, so this id resolves to the
   * exact amount the sale was made at, for as long as the row exists.
   */
  planPriceId: PlanPriceId;
  /**
   * The ledger row that paid for it. Storing the link — rather than trusting
   * that a debit happened — is what makes the pairing auditable: an order
   * with no wallet entry, or a wallet entry with no order, is visible as an
   * inconsistency instead of a silent one.
   */
  walletEntryId: WalletEntryId;
  status: SalesOrderStatus;
  placedAt: Date;
  fulfilledAt: Date | null;
  /** Owner's delivery note: the WhatsApp reference, the account handed over. */
  note: string | null;
}>;

export class OrderNotPendingError extends Error {
  constructor(
    public readonly orderId: SalesOrderId,
    public readonly status: SalesOrderStatus,
  ) {
    super(`Order ${orderId} is ${status}, not PENDING.`);
    this.name = "OrderNotPendingError";
  }
}

export function isPending(order: SalesOrder): boolean {
  return order.status === "PENDING";
}

/**
 * Marks an order delivered. Only a PENDING order can be fulfilled: marking a
 * CANCELLED one would assert a delivery that contradicts the refund, and
 * re-marking a FULFILLED one would silently move `fulfilledAt` to a date the
 * delivery did not happen on.
 */
export function fulfilOrder(
  order: SalesOrder,
  fulfilledAt: Date = new Date(),
  note: string | null = null,
): SalesOrder {
  if (!isPending(order)) {
    throw new OrderNotPendingError(order.id, order.status);
  }
  return Object.freeze({ ...order, status: "FULFILLED", fulfilledAt, note });
}

/**
 * The money an order is worth, as recorded on its own ledger entry.
 *
 * The debit is stored NEGATIVE (money left the wallet), so the order's value
 * is its opposite. Deriving it from the ledger rather than from a column on
 * the order keeps one number, not two that can disagree.
 */
export function orderAmountMinor(walletEntryAmountMinor: number): number {
  return Math.abs(walletEntryAmountMinor);
}

export type PlaceOrderCommand = Readonly<{
  resellerId: ResellerId;
  placedBy: UserId;
  planId: PlanId;
  planPriceId: PlanPriceId;
  amountMinor: number;
  currency: CurrencyCode;
}>;
