# Admin Catalog Management Specification

## Purpose

The ADMIN-only surface for operating the catalog: bootstrapping price tiers, creating and retiring services and plans, and entering and replacing prices — the first human-facing path into catalog data.

## Requirements

### Requirement: Every Catalog Mutation Re-Authorizes As ADMIN

Every catalog Server Action MUST call role authorization for the `ADMIN` role as its first statement, before touching any repository or catalog data.

#### Scenario: A RESELLER caller is rejected

- GIVEN a caller authenticated with the RESELLER role
- WHEN any catalog mutation Server Action is invoked directly
- THEN the action MUST reject the caller and MUST NOT perform the mutation

#### Scenario: An anonymous caller is rejected

- GIVEN a caller with no valid session
- WHEN any catalog mutation Server Action is invoked directly
- THEN the action MUST reject the caller and MUST NOT perform the mutation

### Requirement: An ADMIN Scope Resolves To The Full Catalog Repository

Resolving a catalog repository for an ADMIN access scope MUST return the full, unscoped repository surface capable of every catalog operation in this specification.

#### Scenario: Admin scope yields the full surface

- GIVEN an authenticated ADMIN session
- WHEN the catalog repository is resolved for that session's scope
- THEN the returned repository exposes create, retire, list, and price operations for services, plans, and price tiers

### Requirement: Price Tiers Are A Prerequisite For Plans

The system MUST allow an ADMIN to create and list price tiers, and MUST NOT permit plan creation while zero price tiers exist.

#### Scenario: Admin creates a price tier from an empty database

- GIVEN a database with no price tiers
- WHEN an ADMIN submits a new price tier
- THEN the tier is created and appears in the price tier listing

#### Scenario: Plan creation is unavailable with no tiers

- GIVEN a database with no price tiers
- WHEN an ADMIN attempts to create a plan
- THEN plan creation MUST NOT be submittable without an existing tier to price against

### Requirement: Admin Manages Service Lifecycle

The system MUST allow an ADMIN to create a service and to retire an existing service.

#### Scenario: Retiring a service with active plans shows a warning, not a block

- GIVEN a service with one or more active plans
- WHEN an ADMIN retires the service
- THEN the retirement succeeds, the UI displays a visible warning that its plans remain live and readable
- AND no plan is retired as a side effect

### Requirement: Plan Creation Requires One Priced Tier, Chosen By The Admin

Creating a plan MUST require the ADMIN to submit exactly one price, for a price tier the ADMIN selects, with currency as an editable field on the same form.

#### Scenario: Currency is entered by the admin and validated by the domain

- GIVEN a price form with an editable currency field
- WHEN an ADMIN submits a currency code that is not a valid ISO 4217 alpha-3 code
- THEN the `Money` domain construction MUST reject it, regardless of any client-side validation the form performs

#### Scenario: Other tiers remain visibly unpriced

- GIVEN a plan created with a price for one tier only
- WHEN the plan is viewed in the admin catalog listing
- THEN every other price tier MUST be shown as unpriced, not omitted from the display

### Requirement: Admin Can Retire A Plan

The system MUST allow an ADMIN to retire an existing plan. Retiring a plan that is its service's only priced plan MUST be allowed without additional confirmation or special handling.

#### Scenario: Retiring the only priced plan of a service succeeds

- GIVEN a service with exactly one plan, which has a current price
- WHEN an ADMIN retires that plan
- THEN the plan is retired and the service itself remains active and unaffected

### Requirement: Price Replacement Fails Safe Toward Not Sellable

Replacing a plan's price for a tier MUST close the current row before inserting the new one. If interrupted between those steps, the plan MUST be treated as unsellable at that tier rather than double-priced, and the system MUST NOT auto-retry in a way that could close an already-closed row.

#### Scenario: An interrupted price replacement leaves the tier unpriced, not double-priced

- GIVEN a plan with a current price for a tier
- WHEN the price replacement is interrupted after the current row closes but before the new row inserts
- THEN the plan has zero current prices for that tier
- AND the admin catalog listing visibly flags the tier as unpriced and re-priceable

#### Scenario: A completed price replacement never produces two current rows

- GIVEN a plan with a current price for a tier
- WHEN an ADMIN successfully replaces the price
- THEN exactly one current price row exists for that plan and tier afterward

### Requirement: Duplicate Plan Identity Is A User-Facing Error

Attempting to create a plan whose `(service, kind, duration_days)` identity matches an existing non-retired plan MUST surface as a readable, user-facing error message, never as an unhandled exception or raw database error text.

#### Scenario: Duplicate active plan identity is rejected with a message

- GIVEN an active plan with a given service, kind, and duration
- WHEN an ADMIN attempts to create another plan with the identical service, kind, and duration
- THEN the creation is rejected and the ADMIN sees a specific, readable error message, not a stack trace

### Requirement: Catalog Reads Render Inside Suspense

Every component that reads catalog data at request time MUST be rendered inside a `<Suspense>` boundary. No catalog-reading component MAY read runtime data directly in a page body.

#### Scenario: Catalog listing page builds without a blocking-route error

- GIVEN the admin catalog page renders service, plan, and price listings
- WHEN the application is built
- THEN the build MUST NOT report a `blocking-route` error for any catalog-reading component
