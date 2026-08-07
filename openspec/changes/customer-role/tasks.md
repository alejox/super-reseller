# Tasks: Customer Role

Strict TDD is active. Every implementation task is preceded by its failing-test task (RED → GREEN). Do not collapse pairs.

Spec tags: CI=customer-identity, PA=provider-accounts, CP=customer-purchasing, IT=identity-and-tenancy, AUTH=authentication-session.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~2,030 (Impl ~1,040 + Tests ~990, per proposal) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (identity+tenancy) → PR2 (provider_account) → PR3 (purchase seam) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

All three slices sit near or above the 800-line session budget on their own (~670 / ~630 / ~730). None is split further here because each is already the smallest unit with a clean start/finish per `design.md`'s dependency chain (slice 1 blocks 2 and 3; slice 2 blocks 3). If slice 3 grows during implementation, first candidate to peel off is the duration-selector UI into its own follow-on PR — the schema+use-case portion cannot be reduced further without breaking the CHECK-redesign atomicity `design.md` requires.

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | `users.role` text+CHECK, `UserRole`, customer `AccessScope`, `tenantWhere`/`RepoFor` fixes, route-access, `provisionCustomer`, admin form, isolation tests | PR1 (→ main) | `npm test -- src/modules/identity` | PGlite in-process migration apply/rollback of `0007` | Revert PR1; run `drizzle/down/0007_customer_role.down.sql` (fails if a CUSTOMER row exists — delete/re-role first) |
| 2 | `provider_account` domain/schema/adapters/contract suite, customer panel shell, admin read-only view | PR2 (→ PR1 branch, then → main) | `npm test -- src/modules/provider-accounts` | PGlite in-process apply of `0008` | Revert PR2; `DROP TABLE provider_account` (clean, nothing else references it) |
| 3 | `sales_order` buyer discriminator + CHECK redesign, customer order use case, duration selector UI | PR3 (→ PR2 branch, then → main) | `npm test -- src/modules/ordering` | PGlite in-process apply of `0009`; manual: place one reseller order end-to-end, confirm unchanged | Revert PR3; `drizzle/down/0009_customer_orders.down.sql` restores original CHECKs (fails if a CUSTOMER order exists) |

## Phase 1: Identity + Tenancy (PR1, ~670 lines)

- [x] 1.1 RED: PGlite probe proves `ALTER COLUMN role TYPE text USING role::text` + `DROP TYPE user_role` succeed inside the migrator's single transaction (design.md Open Question — prove before authoring 0007)
- [x] 1.2 GREEN: author `drizzle/0007_customer_role.sql` — statement-broken: drop `users_role_check`/`users_reseller_requires_tier`, alter `role` to `text`, `DROP TYPE user_role`, add `users_role_check` (ADMIN/RESELLER/CUSTOMER), add `users_tier_matches_role`
- [x] 1.3 RED: `0007` down migration raises when a `role='CUSTOMER'` row exists; on empty table it restores the enum + both original CHECKs
- [x] 1.4 GREEN: author `drizzle/down/0007_customer_role.down.sql` as one `DO $$ ... END $$` block
- [x] 1.5 GREEN: `identity.schema.ts` — drop `pgEnum`, `role: text("role").notNull()`, rewritten `users_role_check` + `users_tier_matches_role`
- [x] 1.6 Update `identity.schema.test.ts`: invalid-role assertion becomes a CHECK-violation, not `invalid input value for enum user_role` (IT: Exactly One Role Per User)
- [x] 1.7 RED: CUSTOMER row with a tier persists; tier-less CUSTOMER, tier-bearing ADMIN, and tier-less RESELLER are all rejected — one test each (IT: CUSTOMER role accepted, Tier Requirement Matches Role)
- [x] 1.8 GREEN: confirm `users_tier_matches_role` covers all four cases (already authored in 1.2/1.5; this task is the test-driven verification pass)
- [x] 1.9 RED: `isUserRole` guard accepts `"CUSTOMER"`, rejects unknown strings
- [x] 1.10 GREEN: `domain/user-role.ts` — add `"CUSTOMER"` literal to `UserRole`, update `isUserRole`
- [x] 1.11 GREEN: `domain/ids.ts` — add `TenantId` type
- [x] 1.12 RED: type-level negative fixture — a 4th `AccessScope` variant (or an object literal) fails to compile against `tenantIdOf`'s exhaustive switch (implemented as the internal `never`-checked `default` branch inside `tenantIdOf` itself, proven by `access-scope.test.ts`'s behavioral coverage of all three kinds — see Deviations)
- [x] 1.13 GREEN: `domain/access-scope.ts` — add `kind: "customer"` variant `{ userId, tenantId, priceTierId, actingAdminUserId }`, `mintCustomerScope(...)`, `tenantIdOf(scope)` exhaustive switch, update `ScopeRole`
- [x] 1.14 RED: `tenantWhere` — admin gets `undefined`, reseller/customer each get `eq(resellerId, tenantIdOf(scope))`
- [x] 1.15 GREEN: `shared/db/tenant.ts` rewritten to delegate to `tenantIdOf` (binary switch → admin-vs-tenant)
- [x] 1.16 RED: `repository-factory.ts` — a customer scope must receive `ResellerCatalogRepository` (tier-bound), NOT `AdminCatalogRepository` — proves today's inverted ternary bug (`RepoFor<S>` currently reads `S extends {kind:"reseller"} ? Reseller : Admin`, handing a future customer scope the unscoped admin catalog)
- [x] 1.17 GREEN: invert `RepoFor<S>` to `S extends {kind:"admin"} ? AdminCatalogRepository : ResellerCatalogRepository`; `for()` selects the tier-bound `DrizzleResellerCatalogRepository(db, scope.priceTierId)` for every non-admin scope
- [x] 1.18 RED: `getScope()` mints a customer scope from a `CUSTOMER` session row carrying `resellerId`(tenant id) + `priceTierId`
- [x] 1.19 GREEN: `application/dal.ts` — extend `getScope()`'s branch for `session.role === "CUSTOMER"`, same missing-tier guard shape as the reseller branch (branching logic extracted to testable `scope-resolution.ts` — see Deviations)
- [x] 1.20 RED: `actAsCustomer(targetUserId)` — ADMIN actor only; loads target from DB; rejects non-`CUSTOMER` target and a deactivated target; mints a customer scope with `actingAdminUserId` set
- [x] 1.21 GREEN: implement `actAsCustomer` in `application/dal.ts`
- [x] 1.22 RED: `assertActorAuthorizedForSubject(scope, targetTenantId)` — ADMIN passes for any subject; CUSTOMER passes only when `tenantIdOf(scope) === targetTenantId`; RESELLER always denied (AUTH: Actor-Subject Distinction For ADMIN-On-Behalf Operations)
- [x] 1.23 GREEN: add `assertActorAuthorizedForSubject` to `application/authorization.ts` — the one generic helper slices 2 and 3 reuse
- [x] 1.24 RED: `route-access.test.ts` — customer logs in to `/account`; `/panel` denies both CUSTOMER and ADMIN (redirect to own home); `/account` denies RESELLER and ADMIN; existing "ADMIN into `/panel`" assertion is rewritten to expect a redirect, not `allow`
- [x] 1.25 GREEN: `route-access.ts` — `CUSTOMER_HOME = "/account"`, `ROLE_GATED_PREFIXES = [[/admin,ADMIN],[/panel,RESELLER],[/account,CUSTOMER]]`, `homeFor` becomes an exhaustive switch over three roles
- [x] 1.26 RED: `app/panel/page.tsx` rendered by a non-RESELLER session throws/redirects (closes the second live bug: today only `verifySession()` runs, so an ADMIN sees unfiltered reseller wallet/order data because `tenantWhere` returns no filter for an admin scope)
- [x] 1.27 GREEN: add `await requireRole("RESELLER")` to `app/panel/page.tsx`, mirroring `app/admin/page.tsx`'s `AdminAccessStatus` defense-in-depth pattern
- [x] 1.28 RED: `provisionCustomer` — rejects with no retail tier available, rejects an unknown tier id, rejects a taken email, succeeds and mints a fresh tenant id (CI: Only ADMIN Provisions A Customer, Retail Tier Is A Prerequisite For Provisioning)
- [x] 1.29 GREEN: `domain/user-provisioning.ts` — add `NewCustomerUser` + `createCustomer(user)` to the `UserProvisioning` port
- [x] 1.30 GREEN: `infrastructure/drizzle-user-provisioning.ts` — implement `createCustomer`
- [x] 1.31 GREEN: `application/admin/provision-customer.ts` — mirrors `provision-reseller.ts` exactly (email/password validation, tier lookup, fresh `newUserId`/`newTenantId`), test-doubled `UserProvisioning`/`CredentialsRepository` in `provision-customer.test.ts` matching `provision-reseller.test.ts`'s fake pattern
- [x] 1.32 GREEN: `app/admin/customers/**` — ADMIN provisioning form, wired to `provisionCustomer` via a Server Action, `requireRole("ADMIN")` guard
- [x] 1.33 RED: isolation contract suite — customer B's scoped `users` query returns none of customer A's rows; a reseller-scoped query returns none of any customer's rows (CI: Customer Row Isolation; IT: Tenant Row Isolation) — extends `users-isolation.contract.test.ts`'s seed/assertion shape with CUSTOMER rows
- [x] 1.34 GREEN: confirm both `DrizzleScopedUsersRepository` and `InMemoryScopedUsersRepository` pass the extended suite unmodified (no adapter code should need to change — `tenantWhere`/`tenantIdOf` already generalized in 1.15)
- [x] 1.35 Verify: `npx tsc --noEmit` and `npm run lint` pass for the full slice; two distinct customers' tenant ids are unrelated and neither references a reseller as parent (CI: Customer Gets Its Own Tenant Id)

## Phase 2: Provider Accounts (PR2, ~630 lines)

- [x] 2.1 RED: `provider_account.schema.ts` — schema inspection test fails while the table does not exist (drives the migration)
- [x] 2.2 GREEN: author `drizzle/0008_provider_account.sql` — `provider_account` table per `design.md` DDL (`reseller_id`, `service_id` RESTRICT, `panel_username`, `label`, `created_by` RESTRICT, `created_at`, `archived_at`), `provider_account_tenant_idx`, partial unique `provider_account_identity_uniq(reseller_id, service_id, lower(panel_username)) WHERE archived_at IS NULL`, `provider_account_panel_username_check`, hand-added `ENABLE ROW LEVEL SECURITY`
- [x] 2.3 GREEN: author `drizzle/down/0008_provider_account.down.sql` — `DROP TABLE provider_account`
- [x] 2.4 GREEN: `src/modules/provider-accounts/infrastructure/provider-account.schema.ts` — Drizzle table definition matching 2.2
- [x] 2.5 RED: schema inspection test queries `information_schema.columns` for `provider_account` and fails if any column name matches `/pass|secret|credential|token|expir/` (PA: No Credential Or Lifecycle Fields Exist — the tripwire test)
- [x] 2.6 GREEN: confirm 2.4's column set passes the tripwire (no new column should be needed if 2.2/2.4 match the DDL exactly)
- [x] 2.7 RED: creating a `provider_account` persists provider, real `panel_username`, and label with no credential populated; a second Stella-TV account for the same customer is allowed (PA: Provider Account Identifies A Real Panel Login)
- [x] 2.8 GREEN: `domain/provider-account.ts` entity + `domain/provider-account-repository.ts` port (`create`, `listForTenant`, `findById` — all scope-filtered)
- [x] 2.9 GREEN: `infrastructure/drizzle-provider-account-repository.ts` + `infrastructure/in-memory-provider-account-repository.ts`
- [x] 2.10 RED: registering the *same* `(service, panel_username)` pair twice for one customer is rejected by the partial unique index; two different providers, or the same provider with a different username, are not
- [x] 2.11 GREEN: confirm 2.2's partial unique index covers this (test-driven verification, no schema change expected)
- [x] 2.12 RED: contract suite (both adapters) — customer B's listing excludes customer A's accounts; a reseller-scoped listing is always empty (PA: Provider Account Isolation)
- [x] 2.13 GREEN: `provider-account-repository.contract.test.ts` parametrized over {in-memory, PGlite}, same assertions run twice
- [x] 2.14 RED: a `CUSTOMER` creates an account owned by their own tenant id; the same customer cannot name a different tenant id as owner (PA: A Customer Creates Their Own Provider Account)
- [x] 2.15 GREEN: `application/create-provider-account.ts` — self-service path, `requireRole("CUSTOMER")` + `getScope()`, tenant id taken from scope, never from input
- [x] 2.16 RED: an `ADMIN` creates an account naming a target customer as owner; the account's tenant id is the customer's, not the admin's; a `RESELLER` is denied outright (PA: ADMIN May Create A Provider Account On A Customer's Behalf)
- [x] 2.17 GREEN: `application/admin/create-provider-account-for-customer.ts` — `requireRole("ADMIN")` → `actAsCustomer(targetUserId)` → same use case as 2.15, reusing `assertActorAuthorizedForSubject` from 1.23
- [x] 2.18 GREEN: `app/account/**` — customer panel shell: list owned `provider_account` rows + a create form wired to 2.15's Server Action
- [x] 2.19 GREEN: `app/admin/customers/[id]/**` — admin read-only view of a customer's `provider_account` rows + an on-behalf create form wired to 2.17's Server Action
- [x] 2.20 GREEN: `eslint.config.mjs` — add a `provider-accounts` lint zone mirroring `wallet`/`ordering` (domain forbids `drizzle-orm`, app modules forbid importing each other's entity types)
- [x] 2.21 Verify: `npx tsc --noEmit` and `npm run lint` pass for the full slice

## Phase 3: Purchase Seam (PR3, ~730 lines)

- [x] 3.1 RED: reseller order without a `wallet_entry_id` is rejected; reseller order at `AWAITING_PAYMENT` is rejected (`sales_order_status_buyer_check`); customer order carrying a `wallet_entry_id` is rejected (`sales_order_funding_check`) — schema-level, PGlite
- [x] 3.2 RED: pre-existing "reused wallet entry rejected" test (double-spend guard) is re-run **unmodified** and still passes — the explicit regression proof (CP: Reseller Ordering Invariant Is Unchanged)
- [x] 3.3 GREEN: author `drizzle/0009_customer_orders.sql` — backfill order matters: `ADD COLUMN buyer_kind text` (nullable) → `UPDATE sales_order SET buyer_kind='RESELLER'` → `ALTER COLUMN buyer_kind SET NOT NULL` → add `provider_account_id uuid NULL REFERENCES provider_account(id) ON DELETE RESTRICT` → add all four CHECKs (`sales_order_buyer_kind_check`, `sales_order_funding_check`, redesigned `sales_order_status_check` incl. `AWAITING_PAYMENT`, `sales_order_status_buyer_check`, rewritten `sales_order_fulfilled_at_check`)
- [x] 3.4 GREEN: author `drizzle/down/0009_customer_orders.down.sql` — raises if any `buyer_kind='CUSTOMER'` row exists; else restores the two original CHECKs and drops the new columns
- [x] 3.5 GREEN: `ordering.schema.ts` — add `buyerKind`, `providerAccountId`, relax `walletEntryId` to nullable, replace the two existing CHECKs with the four from 3.3
- [x] 3.6 RED: `placeOrderAsReseller` (existing use case) is called unmodified and still produces a `buyer_kind='RESELLER'` row with a wallet entry — proves no reseller-path regression
- [x] 3.7 GREEN: `drizzle-ordering-repository.ts` `placeOrder` — set `buyerKind: 'RESELLER'` explicitly (no behavior change, just the new required column)
- [x] 3.8 RED: customer order use case rejects a client-submitted price and uses only the server-resolved `plan_price` at the customer's tier for the chosen `duration_days`; a duration with no current price at that tier is not offered, with no fallback tier (CP: Price Resolves From The Catalog At Purchase Time)
- [x] 3.9 RED: the recorded order references the resolved `plan_price_id`; a later price change does not retroactively alter it (CP: Order Anchors To A Resolved Price Row)
- [x] 3.10 RED: purchase records an `AWAITING_PAYMENT` order with no `wallet_entry` row and no wallet balance change (CP: Customer Order Awaits Payment, No Wallet Involvement)
- [x] 3.11 GREEN: `application/place-customer-order.ts` — mirrors `place-order.ts`'s shape; resolves price via the tier-bound `ResellerCatalogRepository` (now serving customers, per 1.17); `ordering.placeCustomerOrder(...)` inserts with `buyer_kind='CUSTOMER'`, `status='AWAITING_PAYMENT'`, `wallet_entry_id=null`, requires a `provider_account_id`
- [x] 3.12 GREEN: `domain/ordering-repository.ts` + `drizzle-ordering-repository.ts` — add `placeCustomerOrder` alongside existing `placeOrder`
- [x] 3.13 RED: a `CUSTOMER` purchases only against a `provider_account` they own; purchasing against an account they do not own is denied (CP: A Customer Starts Their Own Purchase)
- [x] 3.14 GREEN: wire ownership check into 3.11 — the `provider_account_id`'s `reseller_id` (tenant) must equal `tenantIdOf(scope)`
- [x] 3.15 RED: an `ADMIN` starts a purchase naming a target customer; the order is owned by the customer's tenant, not the admin's; a `RESELLER` is denied (CP: ADMIN May Start A Purchase On A Customer's Behalf)
- [x] 3.16 GREEN: `application/admin/place-order-for-customer.ts` — `requireRole("ADMIN")` → `actAsCustomer(targetUserId)` → `assertActorAuthorizedForSubject` (1.23) → 3.11's use case, `placed_by = actingAdminUserId ?? userId`
- [x] 3.17 RED: contract suite (both adapters) — customer B's order query excludes customer A's orders; a reseller-scoped order query returns none (CP: Order Isolation)
- [x] 3.18 GREEN: extend `ordering-repository.contract.test.ts` with the customer-order seed rows and isolation assertions
- [x] 3.19 RED: a customer with zero `provider_account` rows opens the purchase flow on account creation, not an empty selector (CP: Purchase Flow Opens On Account Creation When Empty)
- [x] 3.20 GREEN: `app/account/purchase/**` — duration selector UI (1/3/6/12 months from `duration_days`), account picker that redirects to account creation when the list is empty, resolved-price display, confirm action wired to 3.11/3.16
- [x] 3.21 Verify: `npx tsc --noEmit`, `npm run lint`, and `npm test` pass across the full change; migrations 0007–0009 apply and roll back cleanly on an empty PGlite/Neon branch
