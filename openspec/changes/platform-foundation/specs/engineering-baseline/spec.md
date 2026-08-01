# Engineering Baseline Specification

## Purpose

Test harness, module boundaries, money representation, and migration workflow underlying every later capability.

## Requirements

### Requirement: Test Command

The system MUST provide a working `npm test` command running Vitest before feature code is authored.

#### Scenario: A failing test can be written first

- GIVEN a fresh checkout with dependencies installed
- WHEN a developer runs `npm test`
- THEN Vitest executes and reports an intentionally failing test as a failure, not a runner error

### Requirement: Domain Layer Has No ORM Dependency

The `domain/` layer of the `identity` and `catalog` modules MUST NOT import Drizzle or any ORM-generated type.

#### Scenario: Domain source has no Drizzle import

- GIVEN the `domain/` directory of `identity` or `catalog`
- WHEN its imports are inspected
- THEN none reference `drizzle-orm` or a generated schema type

### Requirement: Money Is Integer Minor Units With Currency

Every monetary amount MUST be an integer minor-unit value paired with an ISO currency code. No monetary field MAY use a floating-point type.

#### Scenario: Money construction rejects non-integer amount or missing currency

- GIVEN the `Money` value object
- WHEN constructed with a non-integer amount, or without a currency code
- THEN construction MUST fail

### Requirement: Migrations Are Clean and Reversible

Migrations MUST apply cleanly to an empty database and MUST be reversible via a paired down migration.

#### Scenario: Migration applies and rolls back on an empty branch

- GIVEN an empty Neon database branch
- WHEN all migrations are applied in order and then rolled back
- THEN the schema matches the Drizzle definition after apply, and the database is empty after rollback

### Requirement: No Mutable Balance Column

No table in the schema MAY contain a mutable `balance` column; balance is reserved as a future fold over an append-only ledger, out of scope for this change.

#### Scenario: Schema has no balance column

- GIVEN the complete schema produced by this change
- WHEN all tables are inspected
- THEN no column represents a stored, mutable running balance
