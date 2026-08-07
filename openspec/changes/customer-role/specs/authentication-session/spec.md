# Delta for Authentication and Session

## MODIFIED Requirements

### Requirement: Deactivation Revokes Sessions

Deactivating a user MUST invalidate that user's active sessions so the next authenticated request is rejected. This is why sessions are DB-backed rather than stateless.
(Previously: verified for `ADMIN`/`RESELLER` only; now explicitly covers `CUSTOMER`.)

#### Scenario: Deactivated user loses access on next request

- GIVEN a user with an active session
- WHEN an ADMIN deactivates that user
- THEN the next request carrying that user's session cookie is rejected as unauthenticated

#### Scenario: Deactivated customer loses access on next request

- GIVEN a `CUSTOMER` with an active session
- WHEN an ADMIN deactivates that customer
- THEN the next request carrying that customer's session cookie is rejected as unauthenticated

### Requirement: Role-Aware Authorization

An authorization check MUST distinguish `ADMIN`, `RESELLER`, and `CUSTOMER`, and MUST deny an operation restricted to a different role.
(Previously: distinguished only `ADMIN` and `RESELLER`.)

#### Scenario: Reseller cannot perform an admin-only operation

- GIVEN an authenticated `RESELLER` session
- WHEN that session attempts an ADMIN-only operation
- THEN the operation is denied with an authorization error

#### Scenario: Customer cannot perform a reseller- or admin-only operation

- GIVEN an authenticated `CUSTOMER` session
- WHEN that session attempts a RESELLER-only or an ADMIN-only operation
- THEN the operation is denied with an authorization error

#### Scenario: Reseller cannot perform a customer-scoped operation

- GIVEN an authenticated `RESELLER` session
- WHEN that session attempts an operation scoped to `CUSTOMER` data
- THEN the operation is denied with an authorization error

## ADDED Requirements

### Requirement: Role-Aware Home Routing

A successful login MUST route the user to exactly one home matching their role — `ADMIN` to `/admin`, `RESELLER` to `/panel`, `CUSTOMER` to its own customer home. A role MUST NOT be able to reach a home that is not its own.

#### Scenario: Customer login lands on the customer home

- GIVEN a `CUSTOMER` user with valid credentials
- WHEN the customer logs in
- THEN the customer is routed to the customer home

#### Scenario: Customer cannot reach the reseller panel

- GIVEN an authenticated `CUSTOMER` session
- WHEN that session requests `/panel`
- THEN access is denied and the customer is redirected away

#### Scenario: Customer cannot reach the admin panel

- GIVEN an authenticated `CUSTOMER` session
- WHEN that session requests `/admin`
- THEN access is denied and the customer is redirected away

### Requirement: Actor-Subject Distinction For ADMIN-On-Behalf Operations

An authorization check for an operation that MAY be performed by `ADMIN` on behalf of a customer MUST evaluate two identities separately — the acting session's role (actor) and the tenant id the operation targets (subject). It MUST NOT authorize the operation merely because the actor is authenticated, nor merely because actor and subject happen to match: `ADMIN` as actor is authorized for any subject; a `CUSTOMER` actor is authorized only when actor and subject are the same tenant; a `RESELLER` actor is never authorized, regardless of subject.

#### Scenario: Admin actor is authorized for any customer subject

- GIVEN an authenticated `ADMIN` session and a target customer tenant id
- WHEN the ADMIN performs the on-behalf-of operation for that customer
- THEN the operation is authorized

#### Scenario: Customer actor is authorized only for themselves

- GIVEN an authenticated `CUSTOMER` session
- WHEN that customer performs the operation with themselves as the subject
- THEN the operation is authorized
- AND WHEN that same session names a different customer as the subject, the operation is denied

#### Scenario: Reseller actor is never authorized

- GIVEN an authenticated `RESELLER` session and any target customer tenant id
- WHEN the reseller attempts the on-behalf-of operation
- THEN the operation is denied
