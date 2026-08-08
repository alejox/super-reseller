import type {
  PlaceCustomerOrderCommand,
  PlaceOrderCommand,
  ResellerId,
  SalesOrder,
  SalesOrderId,
  SalesOrderStatus,
} from "./sales-order";

/**
 * An order together with the facts a screen needs but the row does not
 * carry: the price it was sold at (resolved through `plan_price_id`) and
 * the names of what was sold.
 */
export type SalesOrderView = Readonly<{
  order: SalesOrder;
  amountMinor: number;
  currency: string;
  planName: string;
  serviceName: string;
  /** The reseller's login email — admin queue only; a reseller knows who it is. */
  resellerEmail: string | null;
}>;

export type PlaceOrderOutcome =
  | Readonly<{ ok: true; order: SalesOrder }>
  | Readonly<{ ok: false; reason: "insufficient-funds"; balanceMinor: number }>;

/**
 * The ordering port.
 *
 * `placeOrder` is ONE operation on purpose, and the only one in this
 * codebase that must be a real transaction. It reads the balance, refuses
 * the sale if it is short, debits the wallet and records the order — and
 * every one of those either happens or none does. Split in two, the failure
 * modes are "charged but nothing sold" and "sold but never charged", and
 * both are money.
 */
export interface OrderingRepository {
  placeOrder(command: PlaceOrderCommand): Promise<PlaceOrderOutcome>;

  /**
   * CUSTOMER purchase (CP: Customer Order Awaits Payment, No Wallet
   * Involvement). No balance check, no debit, no wallet entry — inserts a
   * `buyer_kind='CUSTOMER'`, `status='AWAITING_PAYMENT'` row with
   * `wallet_entry_id` NULL. Always succeeds or throws; there is no
   * "insufficient funds" outcome because no funds are checked.
   */
  placeCustomerOrder(command: PlaceCustomerOrderCommand): Promise<SalesOrder>;

  /** Orders visible to the current scope, newest first. */
  listOrders(status?: SalesOrderStatus): Promise<readonly SalesOrderView[]>;

  listOrdersForReseller(resellerId: ResellerId): Promise<readonly SalesOrderView[]>;

  /**
   * Marks an order delivered. Returns `null` when no PENDING order in scope
   * matches — an order already fulfilled, already cancelled, or belonging to
   * someone else are the same answer: nothing to do.
   */
  fulfilOrder(orderId: SalesOrderId, note: string | null): Promise<SalesOrder | null>;

  getOrder(orderId: SalesOrderId): Promise<SalesOrder | null>;
}
