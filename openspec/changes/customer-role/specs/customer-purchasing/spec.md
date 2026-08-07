# Customer Purchasing Specification

## Purpose

Account selection, a fixed 1/3/6/12-month duration selector, a server-resolved price from the catalog at the customer's tier, and an order recorded awaiting payment — the seam `payment-gateway` will later settle. Purchases may be started by the owning customer, or by an ADMIN acting on that customer's behalf. Reseller ordering behavior MUST NOT regress.

## Requirements

### Requirement: Price Resolves From The Catalog At Purchase Time

The system MUST resolve the order's price from `plan_price` at the customer's assigned tier for the selected duration. A client-submitted price MUST be rejected; only the server-resolved price MAY be used. A duration with no current price at the customer's tier MUST NOT be offered, with no fallback to another tier.

#### Scenario: Server-resolved price is used regardless of submitted value

- GIVEN a customer at retail tier T selecting a 3-month duration priced at $10 in `plan_price`
- WHEN the purchase request is submitted carrying a different, tampered price value
- THEN the order is recorded at the $10 price resolved from `plan_price`, not the submitted value

#### Scenario: Unpriced duration is not offered

- GIVEN a plan with no current price at the customer's tier for the 12-month duration
- WHEN the customer views the duration selector
- THEN the 12-month duration is not purchasable, and no other tier's price is substituted

### Requirement: Order Anchors To A Resolved Price Row

The recorded order MUST reference the resolved `plan_price_id`, so a later price change cannot retroactively alter an already-placed order.

#### Scenario: A later price change does not affect an existing order

- GIVEN a customer order recorded against a specific `plan_price_id`
- WHEN the plan's price is subsequently replaced
- THEN the existing order's amount remains anchored to the original `plan_price_id`

### Requirement: Customer Order Awaits Payment, No Wallet Involvement

A customer order MUST be recorded in an awaiting-payment status. It MUST NOT debit any wallet and MUST NOT create a `wallet_entry` row.

#### Scenario: Purchase records an order with no wallet side effect

- GIVEN a customer with a `provider_account` and a resolved price
- WHEN the customer completes the purchase flow
- THEN an order row is recorded with awaiting-payment status
- AND no `wallet_entry` row is created and no wallet balance changes

### Requirement: Reseller Ordering Invariant Is Unchanged

A reseller order MUST carry a `wallet_entry_id` and MUST NOT be awaiting payment. The existing `wallet_entry_id` `NOT NULL UNIQUE` double-spend guard MUST continue to reject a reused wallet entry exactly as before this change. A customer order MUST NOT carry a `wallet_entry_id`.

#### Scenario: Reused wallet entry is still rejected for reseller orders

- GIVEN a reseller order already recorded against a wallet entry
- WHEN a second reseller order is submitted referencing the same wallet entry
- THEN persistence MUST fail with a uniqueness violation, as it did before this change

#### Scenario: Customer order carries no wallet entry

- GIVEN a customer order recorded through the purchase flow
- WHEN the order row is inspected
- THEN its `wallet_entry_id` is absent

### Requirement: A Customer Starts Their Own Purchase

An authenticated `CUSTOMER` MAY start a purchase against a `provider_account` they own. They MUST NOT be able to start a purchase against a `provider_account` they do not own.

#### Scenario: Customer purchases against their own account

- GIVEN an authenticated `CUSTOMER` who owns a `provider_account`
- WHEN that customer starts a purchase against it
- THEN the order is recorded, owned by that customer's tenant id

#### Scenario: Customer cannot purchase against an account they do not own

- GIVEN customer A does not own a given `provider_account`
- WHEN customer A attempts to start a purchase against it
- THEN the operation is denied

### Requirement: ADMIN May Start A Purchase On A Customer's Behalf

An authenticated `ADMIN` MAY start a purchase against a specified customer's own `provider_account`, for support purposes; the recorded order MUST be owned by the customer's tenant id, not the admin's. A `RESELLER` MUST NOT be able to start a purchase for any customer.

#### Scenario: Admin purchases on behalf of a named customer

- GIVEN an authenticated `ADMIN` and a customer who owns a `provider_account`
- WHEN the ADMIN starts a purchase specifying that customer and that account
- THEN the order is recorded, owned by the customer's tenant id, not the admin's

#### Scenario: Reseller cannot start a purchase for a customer

- GIVEN an authenticated `RESELLER` session
- WHEN that session attempts to start a purchase naming any customer as the subject
- THEN the operation is denied

### Requirement: Order Isolation

A customer-scoped order query MUST NOT return another customer's orders. A reseller-scoped order query MUST NOT return any customer order.

#### Scenario: Customer cannot read another customer's order

- GIVEN customer A and customer B each have recorded orders
- WHEN customer B's scoped query runs
- THEN it returns none of customer A's orders

#### Scenario: Reseller query returns no customer orders

- GIVEN one or more customers have recorded orders
- WHEN a reseller-scoped order query runs
- THEN it returns none of those customer orders

### Requirement: Purchase Flow Opens On Account Creation When Empty

When a customer has zero `provider_account` records, the purchase flow MUST open on account creation, not an empty account selector.

#### Scenario: Zero accounts opens creation, not an empty picker

- GIVEN a customer with no `provider_account` rows
- WHEN that customer opens the purchase flow
- THEN they are presented with account creation, not an empty selector
