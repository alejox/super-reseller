# Customer Identity Specification

## Purpose

The `CUSTOMER` role, ADMIN-driven provisioning, a customer's own tenant id and access scope, and the isolation guarantees between customers and between customers and resellers.

## Requirements

### Requirement: Only ADMIN Provisions A Customer

Creating a `CUSTOMER` user MUST only be reachable through ADMIN-invoked provisioning. There is no self-registration path.

#### Scenario: Admin provisions a customer

- GIVEN an authenticated `ADMIN` session and an existing retail price tier
- WHEN the ADMIN submits a new customer with that tier
- THEN a `CUSTOMER` user is created and assigned that tier

#### Scenario: Non-admin cannot provision a customer

- GIVEN an authenticated `RESELLER` or `CUSTOMER` session
- WHEN that session attempts to provision a customer
- THEN the operation is denied and no user is created

### Requirement: Customer Gets Its Own Tenant Id

A provisioned `CUSTOMER` MUST be minted its own freestanding tenant id, exactly as a `RESELLER` is today — not derived from, or nested under, any other user's id.

#### Scenario: Two customers get distinct, unrelated tenant ids

- GIVEN two customers are provisioned
- WHEN their tenant ids are compared
- THEN they are distinct
- AND neither id references the other, or any reseller, as a parent

### Requirement: Customer Row Isolation

A customer-scoped repository query MUST NOT return another customer's owned rows (`provider_account`, orders). A reseller-scoped repository query MUST NOT return any customer-owned rows.

#### Scenario: Customer cannot read another customer's rows

- GIVEN customer A and customer B each own `provider_account` and order rows
- WHEN customer B's repository query runs scoped to customer B's tenant id
- THEN the result set contains none of customer A's rows

#### Scenario: Reseller cannot read any customer's rows

- GIVEN a customer owns `provider_account` and order rows
- WHEN a reseller-scoped repository query runs
- THEN the result set contains none of that customer's rows

### Requirement: Retail Tier Is A Prerequisite For Provisioning

The system MUST NOT permit customer provisioning while zero retail price tiers exist, and MUST surface a clear message rather than a raw constraint violation.

#### Scenario: Provisioning is blocked with no price tier

- GIVEN a database with no price tiers
- WHEN an ADMIN attempts to provision a customer
- THEN provisioning is rejected with a clear, readable message, not a database error
