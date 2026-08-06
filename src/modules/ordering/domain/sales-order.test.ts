import { describe, expect, it } from "vitest";

import {
  fulfilOrder,
  isPending,
  orderAmountMinor,
  OrderNotPendingError,
  type SalesOrder,
} from "./sales-order";

function order(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return Object.freeze({
    id: "order-1",
    resellerId: "reseller-1",
    placedBy: "user-1",
    planId: "plan-1",
    planPriceId: "price-1",
    walletEntryId: "entry-1",
    status: "PENDING",
    placedAt: new Date("2026-08-06T10:00:00Z"),
    fulfilledAt: null,
    note: null,
    ...overrides,
  });
}

describe("fulfilOrder", () => {
  it("marks a pending order delivered without mutating the original", () => {
    const pending = order();

    const fulfilled = fulfilOrder(pending, new Date("2026-08-07T12:00:00Z"), "Entregado por WhatsApp");

    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.fulfilledAt).toEqual(new Date("2026-08-07T12:00:00Z"));
    expect(fulfilled.note).toBe("Entregado por WhatsApp");
    expect(pending.status).toBe("PENDING");
    expect(pending.fulfilledAt).toBeNull();
  });

  it("refuses to fulfil an order that is already fulfilled", () => {
    const already = order({ status: "FULFILLED", fulfilledAt: new Date("2026-08-06T11:00:00Z") });

    // Re-marking would move `fulfilledAt` to a date the delivery did not
    // happen on, quietly rewriting the record of when it did.
    expect(() => fulfilOrder(already)).toThrow(OrderNotPendingError);
  });

  it("refuses to fulfil a cancelled order", () => {
    // Asserting a delivery for an order that was refunded contradicts the
    // refund; the two records would tell opposite stories.
    expect(() => fulfilOrder(order({ status: "CANCELLED" }))).toThrow(OrderNotPendingError);
  });

  it("names the offending status in the error", () => {
    const error = (() => {
      try {
        fulfilOrder(order({ status: "CANCELLED" }));
      } catch (e: unknown) {
        return e as InstanceType<typeof OrderNotPendingError>;
      }
    })();

    expect(error?.status).toBe("CANCELLED");
    expect(error?.orderId).toBe("order-1");
  });
});

describe("isPending", () => {
  it.each([
    ["PENDING", true],
    ["FULFILLED", false],
    ["CANCELLED", false],
  ] as const)("is %s -> %s", (status, expected) => {
    expect(isPending(order({ status }))).toBe(expected);
  });
});

describe("orderAmountMinor", () => {
  it("reads the order's value off its NEGATIVE ledger entry", () => {
    // The debit is stored negative because money left the wallet; the order
    // is worth its opposite. One number, derived — never a second column
    // that can drift from the ledger.
    expect(orderAmountMinor(-15_000)).toBe(15_000);
  });
});
