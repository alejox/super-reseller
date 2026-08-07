# Provider Accounts Specification

## Purpose

A customer-owned record of a streaming/provider account: which provider, the real identifier the customer uses on that provider's panel, and a customer-facing label — with no credential, no secret, and no expiry lifecycle. Creation may be performed by the owning customer, or by an ADMIN acting on that customer's behalf for support purposes.

## Requirements

### Requirement: Provider Account Identifies A Real Panel Login

A `provider_account` MUST record which provider/service it belongs to, the real username/identifier used on that provider's panel, and a customer-facing label. It MUST NOT store any credential, secret, or panel password. Two accounts for the same provider under the same customer MUST be allowed.

#### Scenario: Creating an account requires a real panel identifier

- GIVEN a customer creating a `provider_account`
- WHEN the account is submitted with a provider, a real panel username, and a label
- THEN the account is persisted with no credential or secret field populated

#### Scenario: Duplicate provider is allowed

- GIVEN a customer who already owns one Stella TV `provider_account`
- WHEN that customer creates a second Stella TV `provider_account`
- THEN both accounts are persisted with no uniqueness violation

### Requirement: No Credential Or Lifecycle Fields Exist

The `provider_account` schema MUST NOT contain any credential, secret, password, or expiry/subscription-lifecycle column.

#### Scenario: Schema exposes no credential or expiry column

- GIVEN the `provider_account` table definition
- WHEN its columns are inspected
- THEN no credential, secret, password, or expiry column is present

### Requirement: A Customer Creates Their Own Provider Account

An authenticated `CUSTOMER` MAY create a `provider_account` owned by their own tenant id. They MUST NOT be able to create one owned by a different customer's tenant id.

#### Scenario: Customer creates their own account

- GIVEN an authenticated `CUSTOMER` session
- WHEN that customer creates a `provider_account`
- THEN the account's tenant id equals that customer's own tenant id

#### Scenario: Customer cannot create an account for another customer

- GIVEN an authenticated `CUSTOMER` session for customer A
- WHEN customer A submits a create request naming customer B as the owning tenant
- THEN the operation is denied

### Requirement: ADMIN May Create A Provider Account On A Customer's Behalf

An authenticated `ADMIN` MAY create a `provider_account` owned by a specified customer's tenant id, for support purposes. A `RESELLER` MUST NOT be able to create a `provider_account` for any customer or for itself.

#### Scenario: Admin creates an account for a named customer

- GIVEN an authenticated `ADMIN` session and an existing customer
- WHEN the ADMIN creates a `provider_account` naming that customer as owner
- THEN the account's tenant id equals that customer's tenant id, not the admin's

#### Scenario: Reseller cannot create a provider account

- GIVEN an authenticated `RESELLER` session
- WHEN that session attempts to create a `provider_account`, naming itself or any customer as owner
- THEN the operation is denied

### Requirement: Provider Account Isolation

A customer-scoped `provider_account` query MUST NOT return another customer's rows. A reseller-scoped `provider_account` query MUST return zero rows.

#### Scenario: Customer listing excludes other customers' accounts

- GIVEN customer A and customer B each own `provider_account` rows
- WHEN customer B lists their `provider_account` rows
- THEN the result contains none of customer A's accounts

#### Scenario: Reseller listing is always empty

- GIVEN one or more customers own `provider_account` rows
- WHEN a reseller-scoped query lists `provider_account` rows
- THEN the result set is empty
