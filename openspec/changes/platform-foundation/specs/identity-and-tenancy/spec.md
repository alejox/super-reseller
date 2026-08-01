# Identity and Tenancy Specification

## Purpose

Users, roles, single-level reseller ownership, and reseller row isolation.

## Requirements

### Requirement: Exactly One Role Per User

Each user MUST have exactly one role, ADMIN or RESELLER. No other role value is valid.

#### Scenario: Invalid role is rejected

- GIVEN a user creation request with role `"SUPERADMIN"`
- WHEN the user is persisted
- THEN persistence MUST fail with a validation error

### Requirement: Globally Unique Email

A user's email MUST be unique across all users regardless of role.

#### Scenario: Duplicate email is rejected

- GIVEN an existing user with email `owner@example.com`
- WHEN a second user is created with the same email
- THEN creation MUST fail with a uniqueness violation

### Requirement: Single-Level Reseller Ownership

Every reseller-owned row MUST carry a `reseller_id` referencing exactly one RESELLER user. No `parent_id` or recursive ownership chain MAY exist in the schema.

#### Scenario: Reseller-owned row carries reseller_id, no hierarchy field

- GIVEN a row created under a RESELLER user
- WHEN the row is persisted
- THEN it carries that reseller's `reseller_id`
- AND no column allows referencing another reseller as a parent

### Requirement: Reseller Row Isolation

A reseller-scoped repository query MUST NOT return rows owned by a different reseller. An ADMIN-scoped query MUST return rows across all resellers.

#### Scenario: Reseller cannot read another reseller's rows

- GIVEN reseller A and reseller B each own distinct rows in the same repository
- WHEN reseller B's repository query runs scoped to reseller B's `reseller_id`
- THEN the result set contains none of reseller A's rows

#### Scenario: Admin reads across all resellers

- GIVEN rows owned by multiple resellers
- WHEN an ADMIN-scoped repository query runs
- THEN the result set includes rows from every reseller

### Requirement: One Price Tier Per Reseller

Each RESELLER user MUST be assigned exactly one price tier to be active.

#### Scenario: Reseller without a tier cannot be activated

- GIVEN a RESELLER user with no assigned price tier
- WHEN the user is activated
- THEN activation MUST fail

### Requirement: Price Tier Deletion Guard

A price tier assigned to one or more resellers MUST NOT be deletable.

#### Scenario: Deleting an in-use tier is blocked

- GIVEN a price tier with resellers assigned
- WHEN deletion of that tier is attempted
- THEN the operation MUST fail and the tier MUST remain

### Requirement: Reseller Deactivation Preserves Data

Deactivating a reseller MUST soft-delete the user, not hard-delete, and MUST preserve their owned rows for accounting.

#### Scenario: Deactivated reseller's rows remain

- GIVEN an active reseller with existing owned rows
- WHEN the reseller is deactivated
- THEN the reseller is marked inactive, not removed
- AND the reseller's owned rows are still present in the database
