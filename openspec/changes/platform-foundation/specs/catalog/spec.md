# Catalog Specification

## Purpose

Services, plans with first-class duration, and absolute per-tier pricing.

## Requirements

### Requirement: Duration Is a First-Class Field

A plan's duration MUST be stored in a `duration_days` integer field. Duration MUST NOT be parsed from any name or free-text field.

#### Scenario: Duration is read from duration_days

- GIVEN a plan with `duration_days` set to 30
- WHEN the plan's term is read
- THEN the returned duration is 30 days, independent of the plan's display name

### Requirement: Per-Tier Absolute Pricing

Each sellable plan-tier combination MUST have an explicit price row: `plan_id`, `tier_id`, `amount_minor`, `currency`.

#### Scenario: Same plan resolves different prices per tier

- GIVEN a plan with a price row for tier A and a different price row for tier B
- WHEN the plan's price is resolved for each tier
- THEN tier A and tier B return different absolute amounts

### Requirement: Missing Tier Price Blocks Sale

A plan with no price row for a tier MUST NOT be sellable at that tier and MUST NOT fall back to another tier's price.

#### Scenario: Plan without a tier price is unsellable

- GIVEN a plan with a price row for tier A but none for tier B
- WHEN the plan's sellability is checked for tier B
- THEN it is reported not sellable and no price is returned from tier A

### Requirement: Service Retirement Preserves Plans

Retiring a service MUST soft-delete it. Existing plans referencing it MUST remain readable.

#### Scenario: Retired service's plans stay readable

- GIVEN a service with existing plans
- WHEN the service is retired
- THEN the service is marked retired, not removed
- AND its plans remain readable with their prices intact

### Requirement: Price History Is Preserved

Changing a plan's price for a tier MUST NOT overwrite the prior price row. Each price row MUST remain individually addressable so a future order can capture the price in effect at its creation time.

#### Scenario: Prior price row survives a price change

- GIVEN a price row for a plan and tier
- WHEN a new price is set for the same plan and tier
- THEN the prior price row remains stored and addressable by its own identity

### Requirement: No Inventory or Subscription Entities

The schema MUST NOT contain a `StockAccount`, `ProfileSlot`, or `Subscription` table, and MUST NOT contain any column for storing third-party streaming-account credentials.

#### Scenario: Schema has no forbidden entities or credential columns

- GIVEN the complete schema produced by this change
- WHEN all tables and columns are inspected
- THEN no `StockAccount`, `ProfileSlot`, or `Subscription` table exists
- AND no column stores a username, password, or credential for a streaming account
