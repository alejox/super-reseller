import { and, desc, eq, sql } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";
import { tenantWhere } from "@/shared/db/tenant";

import type { AccessScope } from "@/modules/identity/domain/access-scope";
import { plan as planTable, planPrice as planPriceTable, service as serviceTable } from "@/modules/catalog/infrastructure/catalog.schema";
import { users } from "@/modules/identity/infrastructure/identity.schema";
import { walletEntry } from "@/modules/wallet/infrastructure/wallet.schema";
import type {
  OrderingRepository,
  PlaceOrderOutcome,
  SalesOrderView,
} from "../domain/ordering-repository";
import {
  fulfilOrder as fulfilOrderEntity,
  type BuyerKind,
  type PlaceCustomerOrderCommand,
  type PlaceOrderCommand,
  type ResellerId,
  type SalesOrder,
  type SalesOrderId,
  type SalesOrderStatus,
} from "../domain/sales-order";
import { salesOrder } from "./ordering.schema";

/**
 * Drizzle-backed ordering, scoped at construction.
 */
export class DrizzleOrderingRepository implements OrderingRepository {
  constructor(
    private readonly db: ModuleDb,
    private readonly scope: AccessScope,
  ) {}

  /**
   * Balance check, debit and order insert as ONE transaction.
   *
   * The advisory lock is what makes the balance check trustworthy. Without
   * it, two concurrent orders both read the same balance under READ
   * COMMITTED — neither sees the other's uncommitted debit — and both pass
   * a check that only one should. Measured, not assumed: six concurrent
   * orders against a wallet holding funds for one drove the balance to
   * -65.000 before this line existed.
   *
   * `pg_advisory_xact_lock`, and NOT `SELECT ... FOR UPDATE` on the
   * reseller's rows. A row lock locks ROWS THAT EXIST: where none match, it
   * locks nothing and succeeds, so the guard would silently degrade to
   * nothing exactly when the data is unusual. An advisory lock is a pure
   * mutex on a number — it needs no row to exist, and Postgres releases it
   * at COMMIT or ROLLBACK with no cleanup path to forget.
   *
   * A hash collision between two reseller ids costs an unnecessary wait and
   * nothing else, which is the correct direction to be wrong in.
   *
   * A CTE cannot replace this. Data-modifying CTEs are atomic, but every
   * sub-query still reads the SAME snapshot taken at statement start, so two
   * concurrent statements would see the identical pre-debit balance and both
   * succeed. Atomicity is not isolation.
   *
   * Supabase's transaction pooler supports this: "transaction mode" holds
   * one backend for the duration of a transaction, and an xact-scoped
   * advisory lock lives exactly that long. Verified against port 6543,
   * which is what production uses.
   */
  async placeOrder(command: PlaceOrderCommand): Promise<PlaceOrderOutcome> {
    const orderId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    const now = new Date();

    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${command.resellerId}))`,
      );

      const balanceResult = await tx.execute<{ balance: number } & Record<string, unknown>>(
        sql`SELECT coalesce(sum(amount_minor), 0)::int AS balance FROM wallet_entry WHERE reseller_id = ${command.resellerId}`,
      );
      const balanceMinor = Number(balanceResult.rows[0]?.balance ?? 0);

      if (balanceMinor < command.amountMinor) {
        // Refusing INSIDE the transaction is what makes the check mean
        // something: the lock is still held, so no concurrent order can have
        // spent the difference between reading and deciding.
        return { ok: false, reason: "insufficient-funds", balanceMinor } as const;
      }

      await tx.insert(walletEntry).values({
        id: entryId,
        resellerId: command.resellerId,
        kind: "ORDER_DEBIT",
        // NEGATIVE: money left the wallet. The order's value is its opposite.
        amountMinor: -command.amountMinor,
        currency: command.currency,
        memo: null,
        createdBy: command.placedBy,
        createdAt: now,
      });

      await tx.insert(salesOrder).values({
        id: orderId,
        resellerId: command.resellerId,
        placedBy: command.placedBy,
        planId: command.planId,
        planPriceId: command.planPriceId,
        walletEntryId: entryId,
        // Explicit, not a column default: task 3.7 — the reseller path is
        // otherwise byte-for-byte unmodified, so the discriminator is set
        // here rather than relied upon to default correctly.
        buyerKind: "RESELLER",
        providerAccountId: null,
        status: "PENDING",
        placedAt: now,
        fulfilledAt: null,
        note: null,
      });

      return {
        ok: true,
        order: Object.freeze({
          id: orderId,
          resellerId: command.resellerId,
          placedBy: command.placedBy,
          planId: command.planId,
          planPriceId: command.planPriceId,
          buyerKind: "RESELLER" as const,
          walletEntryId: entryId,
          providerAccountId: null,
          status: "PENDING" as const,
          placedAt: now,
          fulfilledAt: null,
          note: null,
        }),
      } as const;
    });
  }

  /**
   * CUSTOMER purchase (CP: Customer Order Awaits Payment, No Wallet
   * Involvement). A single INSERT — no balance to check, no debit to make,
   * so there is no transaction and no advisory lock to take: two concurrent
   * purchases against the same tier's price cannot race each other into an
   * inconsistent balance, because there is no balance here at all.
   */
  async placeCustomerOrder(command: PlaceCustomerOrderCommand): Promise<SalesOrder> {
    const orderId = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(salesOrder).values({
      id: orderId,
      resellerId: command.resellerId,
      placedBy: command.placedBy,
      planId: command.planId,
      planPriceId: command.planPriceId,
      walletEntryId: null,
      buyerKind: "CUSTOMER",
      providerAccountId: command.providerAccountId,
      status: "AWAITING_PAYMENT",
      placedAt: now,
      fulfilledAt: null,
      note: null,
    });

    return Object.freeze({
      id: orderId,
      resellerId: command.resellerId,
      placedBy: command.placedBy,
      planId: command.planId,
      planPriceId: command.planPriceId,
      buyerKind: "CUSTOMER" as const,
      walletEntryId: null,
      providerAccountId: command.providerAccountId,
      status: "AWAITING_PAYMENT" as const,
      placedAt: now,
      fulfilledAt: null,
      note: null,
    });
  }

  private async views(extra?: ReturnType<typeof eq>): Promise<readonly SalesOrderView[]> {
    const rows = await this.db
      .select({
        order: salesOrder,
        amountMinor: planPriceTable.amountMinor,
        currency: planPriceTable.currency,
        planName: planTable.name,
        serviceName: serviceTable.name,
        resellerEmail: users.email,
      })
      .from(salesOrder)
      // The price is resolved through the anchor, never copied onto the
      // order: `plan_price` rows are never mutated, so this join returns the
      // amount the sale was actually made at even after the list price moved.
      .innerJoin(planPriceTable, eq(planPriceTable.id, salesOrder.planPriceId))
      .innerJoin(planTable, eq(planTable.id, salesOrder.planId))
      .innerJoin(serviceTable, eq(serviceTable.id, planTable.serviceId))
      .innerJoin(users, eq(users.id, salesOrder.placedBy))
      .where(and(tenantWhere(salesOrder, this.scope), extra))
      .orderBy(desc(salesOrder.placedAt));

    return rows.map((row) => ({
      order: Object.freeze({
        ...row.order,
        status: row.order.status as SalesOrderStatus,
        buyerKind: row.order.buyerKind as BuyerKind,
      }),
      amountMinor: Number(row.amountMinor),
      currency: row.currency,
      planName: row.planName,
      serviceName: row.serviceName,
      resellerEmail: row.resellerEmail,
    }));
  }

  async listOrders(status?: SalesOrderStatus): Promise<readonly SalesOrderView[]> {
    return this.views(status ? eq(salesOrder.status, status) : undefined);
  }

  async listOrdersForReseller(resellerId: ResellerId): Promise<readonly SalesOrderView[]> {
    return this.views(eq(salesOrder.resellerId, resellerId));
  }

  async fulfilOrder(orderId: SalesOrderId, note: string | null): Promise<SalesOrder | null> {
    const [existing] = await this.db
      .select()
      .from(salesOrder)
      .where(and(tenantWhere(salesOrder, this.scope), eq(salesOrder.id, orderId)));

    if (!existing) return null;

    const current = Object.freeze({
      ...existing,
      status: existing.status as SalesOrderStatus,
      buyerKind: existing.buyerKind as BuyerKind,
    });
    if (current.status !== "PENDING") return null;

    // The domain decides what fulfilment means and refuses a non-PENDING
    // order; the adapter only persists the result.
    const fulfilled = fulfilOrderEntity(current, new Date(), note);

    const [row] = await this.db
      .update(salesOrder)
      .set({
        status: fulfilled.status,
        fulfilledAt: fulfilled.fulfilledAt,
        note: fulfilled.note,
      })
      // `status = 'PENDING'` in the WHERE, not just in the read above: two
      // concurrent fulfilments would both pass the read, and only one should
      // win. The second matches no row.
      .where(
        and(
          tenantWhere(salesOrder, this.scope),
          eq(salesOrder.id, orderId),
          eq(salesOrder.status, "PENDING"),
        ),
      )
      .returning();

    return row
      ? Object.freeze({
          ...row,
          status: row.status as SalesOrderStatus,
          buyerKind: row.buyerKind as BuyerKind,
        })
      : null;
  }
}
