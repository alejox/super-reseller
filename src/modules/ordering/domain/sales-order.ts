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
export type ProviderAccountId = string;

/**
 * The buyer discriminator (design.md "Decision: `sales_order` gains a buyer
 * discriminator; no `customer_order` table"). `text` + CHECK, not a Postgres
 * enum — same reasoning as `SalesOrderStatus` below.
 */
export type BuyerKind = "RESELLER" | "CUSTOMER";

/**
 * Fulfilment happens entirely off-platform, over WhatsApp, by the owner
 * (proposal.md). The platform never holds a streaming account, so this
 * status is a record of what the owner says they did — not something the
 * system can observe or verify for itself.
 *
 * `text` + CHECK rather than a Postgres enum: statuses are the kind of thing
 * a product adds to, and an enum value can never be removed once shipped.
 *
 * `AWAITING_PAYMENT` is the seam `payment-gateway` will settle from
 * (design.md). It is unreachable for a RESELLER order — `sales_order_
 * status_buyer_check` — so it cannot park an unpaid reseller order.
 */
export type SalesOrderStatus = "AWAITING_PAYMENT" | "PENDING" | "FULFILLED" | "CANCELLED";

export type SalesOrder = Readonly<{
  id: SalesOrderId;
  /**
   * The ownership axis `tenantWhere` filters on. For a RESELLER order, the
   * reseller's own tenant id; for a CUSTOMER order, the customer's own
   * tenant id (design.md "Single-Level Tenant Ownership" — `reseller_id` is
   * the generalized tenancy column, reused rather than renamed, mirroring
   * `provider_account.reseller_id`).
   */
  resellerId: ResellerId;
  /** The user account that placed it — the acting ADMIN's id when placed on a customer's behalf. */
  placedBy: UserId;
  planId: PlanId;
  /**
   * The order-time price anchor (design.md: "plan_price is append-only and
   * individually addressable"). The order stores this ID, never a copied
   * amount: `plan_price` rows are never mutated, so this id resolves to the
   * exact amount the sale was made at, for as long as the row exists.
   */
  planPriceId: PlanPriceId;
  buyerKind: BuyerKind;
  /**
   * The ledger row that paid for it — RESELLER orders only. `null` for a
   * CUSTOMER order: it never spends a reseller's ledger row at all
   * (`sales_order_funding_check`). Storing the link — rather than trusting
   * that a debit happened — is what makes the pairing auditable: an order
   * with no wallet entry, or a wallet entry with no order, is visible as an
   * inconsistency instead of a silent one.
   */
  walletEntryId: WalletEntryId | null;
  /** The provider account being purchased for — CUSTOMER orders only. */
  providerAccountId: ProviderAccountId | null;
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

/**
 * The CUSTOMER purchase command. No `amountMinor`/`currency`: a customer
 * order creates no wallet entry, so the sale amount lives ENTIRELY on the
 * `plan_price` row `planPriceId` anchors — there is no second number here
 * that could disagree with it.
 */
export type PlaceCustomerOrderCommand = Readonly<{
  /** The customer's own tenant id (`tenantIdOf(scope)` for a customer scope). */
  resellerId: ResellerId;
  /** `actingAdminUserId ?? userId` — the acting ADMIN's id on a support purchase. */
  placedBy: UserId;
  planId: PlanId;
  planPriceId: PlanPriceId;
  providerAccountId: ProviderAccountId;
}>;
