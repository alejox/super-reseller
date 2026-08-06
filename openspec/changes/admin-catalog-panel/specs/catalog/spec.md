# Delta for Catalog

## ADDED Requirements

### Requirement: Administrative Listing Of Services And Price Tiers

The repository MUST provide operations that list every service and every price tier, regardless of retirement or archive state, for administrative use.

#### Scenario: All services are listable including retired ones

- GIVEN services exist with a mix of active and retired states
- WHEN the administrative service listing is requested
- THEN every service is returned, with retirement state visible on each

#### Scenario: All price tiers are listable

- GIVEN one or more price tiers exist
- WHEN the administrative price tier listing is requested
- THEN every price tier is returned

### Requirement: Plan Retirement Frees Its Identity Slot

Retiring a plan MUST soft-delete it via `retired_at` and MUST NOT remove the row. Once retired, its `(service_id, kind, duration_days)` identity MUST become available for a new plan, because `plan_identity_uniq` only guards non-retired rows.

#### Scenario: A retired plan's identity can be reused

- GIVEN an active plan with a given service, kind, and duration
- WHEN that plan is retired and a new plan is created with the identical service, kind, and duration
- THEN the new plan is created successfully
- AND the retired plan remains readable, unaffected

### Requirement: A Plan Is Never Created Without A Price

Creating a plan MUST require at least one price, for exactly one price tier chosen by the caller, in the same operation. The system MUST NOT persist a plan that has zero prices.

#### Scenario: Plan creation without a price is rejected

- GIVEN valid service, kind, and duration for a new plan, and no price supplied
- WHEN plan creation is attempted
- THEN the operation MUST fail and no plan row is persisted

#### Scenario: Plan creation with one tier price succeeds

- GIVEN valid plan data and a price for exactly one existing price tier
- WHEN plan creation is attempted
- THEN the plan is created and is sellable at that tier only

### Requirement: One Current Price Per Plan And Tier

For any given plan and price tier, at most one price row MUST have no closing date (`effective_to IS NULL`) at any time, enforced by `plan_price_current_uniq`.

#### Scenario: Setting a new price closes the prior one

- GIVEN a plan with a current price for a tier
- WHEN a new price is set for the same plan and tier
- THEN the prior price row is closed with a non-null `effective_to`
- AND exactly one current price row exists for that plan and tier afterward

### Requirement: No Hard Delete In Catalog

No catalog entity (service, plan, plan price, price tier) MAY be physically deleted. Removal MUST be represented by `retired_at` or `archived_at`, and a price row is closed, never deleted.

#### Scenario: Retiring a plan does not delete its row

- GIVEN an existing plan
- WHEN the plan is retired
- THEN the plan row still exists and is readable, with `retired_at` set to a non-null timestamp
