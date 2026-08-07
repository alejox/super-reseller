# Delta for Identity and Tenancy

## MODIFIED Requirements

### Requirement: Exactly One Role Per User

Each user MUST have exactly one role: `ADMIN`, `RESELLER`, or `CUSTOMER`. No other role value is valid.
(Previously: only `ADMIN` or `RESELLER` were valid roles.)

#### Scenario: Invalid role is rejected

- GIVEN a user creation request with role `"SUPERADMIN"`
- WHEN the user is persisted
- THEN persistence MUST fail with a validation error

#### Scenario: CUSTOMER role is accepted

- GIVEN a user creation request with role `"CUSTOMER"` and an assigned price tier
- WHEN the user is persisted
- THEN persistence succeeds

### Requirement: Single-Level Tenant Ownership

Every tenant-owned row MUST carry a tenant id referencing exactly one `RESELLER` or `CUSTOMER` user, never an `ADMIN`. No `parent_id` or recursive ownership chain MAY exist in the schema. A `CUSTOMER`'s tenant id is minted the same way a `RESELLER`'s is today — a freestanding id, not derived from or nested under another user's id.
(Previously: only a `RESELLER` could be referenced by a tenant-owned row; "Single-Level Reseller Ownership".)

#### Scenario: Reseller-owned row carries reseller's tenant id, no hierarchy field

- GIVEN a row created under a `RESELLER` user
- WHEN the row is persisted
- THEN it carries that reseller's tenant id
- AND no column allows referencing another tenant as a parent

#### Scenario: Customer-owned row carries its own tenant id

- GIVEN a row created under a `CUSTOMER` user
- WHEN the row is persisted
- THEN it carries that customer's own tenant id
- AND no column links it to any reseller as a parent

### Requirement: Tenant Row Isolation

A tenant-scoped repository query (`RESELLER` or `CUSTOMER`) MUST NOT return rows owned by a different tenant, regardless of whether that other tenant is a reseller or a customer. An `ADMIN`-scoped query MUST return rows across every tenant.
(Previously: "Reseller Row Isolation" — isolation was defined only between resellers.)

#### Scenario: Reseller cannot read another reseller's rows

- GIVEN reseller A and reseller B each own distinct rows in the same repository
- WHEN reseller B's repository query runs scoped to reseller B's tenant id
- THEN the result set contains none of reseller A's rows

#### Scenario: Admin reads across all tenants

- GIVEN rows owned by multiple resellers and multiple customers
- WHEN an `ADMIN`-scoped repository query runs
- THEN the result set includes rows from every tenant, reseller and customer alike

#### Scenario: Customer cannot read another customer's rows

- GIVEN customer A and customer B each own distinct rows in the same repository
- WHEN customer B's repository query runs scoped to customer B's tenant id
- THEN the result set contains none of customer A's rows

#### Scenario: Reseller and customer scopes never cross

- GIVEN a reseller owns rows and a customer owns rows in the same repository
- WHEN the reseller's scoped query runs
- THEN it returns none of the customer's rows
- AND WHEN the customer's scoped query runs, it returns none of the reseller's rows

### Requirement: Tier Requirement Matches Role

A `RESELLER` or `CUSTOMER` user MUST be assigned exactly one price tier to be active. An `ADMIN` user MUST NOT have any price tier assigned. This is the full symmetry the `users_reseller_requires_tier` CHECK enforces: `(role IN ('RESELLER','CUSTOMER') AND tier IS NOT NULL) OR (role = 'ADMIN' AND tier IS NULL)`.
(Previously: "One Price Tier Per Reseller" — only `RESELLER` was required to carry a tier; the ADMIN tier-less rule existed in code but was not stated as part of this requirement.)

#### Scenario: Reseller without a tier cannot be activated

- GIVEN a `RESELLER` user with no assigned price tier
- WHEN the user is activated
- THEN activation MUST fail

#### Scenario: Customer without a tier cannot be activated

- GIVEN a `CUSTOMER` user with no assigned price tier
- WHEN the user is activated
- THEN activation MUST fail

#### Scenario: Admin with a tier assigned is rejected

- GIVEN an `ADMIN` user creation request that carries a price tier id
- WHEN the user is persisted
- THEN persistence MUST fail with a CHECK violation

### Requirement: Tenant Deactivation Preserves Data

Deactivating a `RESELLER` or `CUSTOMER` MUST soft-delete the user, not hard-delete, and MUST preserve their owned rows for accounting.
(Previously: "Reseller Deactivation Preserves Data" — stated for `RESELLER` only.)

#### Scenario: Deactivated reseller's rows remain

- GIVEN an active reseller with existing owned rows
- WHEN the reseller is deactivated
- THEN the reseller is marked inactive, not removed
- AND the reseller's owned rows are still present in the database

#### Scenario: Deactivated customer's awaiting-payment order remains

- GIVEN an active customer with an order in awaiting-payment status
- WHEN the customer is deactivated
- THEN the customer is marked inactive, not removed
- AND the awaiting-payment order row is still present in the database
