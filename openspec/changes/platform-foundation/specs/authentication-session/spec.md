# Authentication and Session Specification

## Purpose

Login, DB-backed session lifecycle, revocation, and role-aware authorization.

## Requirements

### Requirement: Login Issues a DB-Backed Session

A successful login MUST create a session row in the database and set a `jose`-signed httpOnly cookie carrying that session's id.

#### Scenario: Successful login creates a session

- GIVEN a user with valid credentials
- WHEN the user logs in
- THEN a session row is persisted
- AND the response sets an httpOnly cookie signed with `jose` carrying the session id

### Requirement: Deactivation Revokes Sessions

Deactivating a user MUST invalidate that user's active sessions so the next authenticated request is rejected. This is why sessions are DB-backed rather than stateless.

#### Scenario: Deactivated user loses access on next request

- GIVEN a user with an active session
- WHEN an ADMIN deactivates that user
- THEN the next request carrying that user's session cookie is rejected as unauthenticated

### Requirement: Data Access Layer Enforces Authorization

Every Data Access Layer function MUST verify the caller's session and role before returning or mutating data, independent of any route-level check.

#### Scenario: DAL call without a valid session is rejected

- GIVEN a DAL function reading reseller-owned data
- WHEN it is invoked without a valid session context
- THEN it MUST return or throw an authorization error rather than data

### Requirement: Proxy Performs an Optimistic Check Only

`proxy.ts` MUST perform only an optimistic cookie-presence check for route access; it MUST NOT be the sole authorization enforcement point. Server Actions MUST re-authorize themselves because they are public endpoints.

#### Scenario: Server Action re-checks authorization independently

- GIVEN a request that passed the `proxy.ts` cookie check
- WHEN it reaches a Server Action requiring ADMIN role
- THEN the Server Action independently verifies the session and role before proceeding

### Requirement: Role-Aware Authorization

An authorization check MUST distinguish ADMIN and RESELLER and MUST deny an operation restricted to the other role.

#### Scenario: Reseller cannot perform an admin-only operation

- GIVEN an authenticated RESELLER session
- WHEN that session attempts an ADMIN-only operation
- THEN the operation is denied with an authorization error
