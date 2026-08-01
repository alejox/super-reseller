# Tasks: Platform Foundation

Strict TDD is active. Every implementation task is preceded by its failing-test task (RED → GREEN). Do not collapse pairs.

Spec tags: EB=engineering-baseline, IT=identity-and-tenancy, CAT=catalog, AUTH=authentication-session.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,560 (range 1,300–1,600 per proposal) |
| Per-slice risk | Low — each slice ≤290 lines |
| Whole-change risk (single PR) | High |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1→PR2→PR3a→PR3b→PR4→PR5a→PR5b (strict order) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Test harness + module skeleton + aliases | PR1 | `npm test -- tests/smoke.test.ts` | N/A — no runtime surface yet | Revert `vitest.config.ts`, skeleton dirs, tsconfig paths, eslint zones |
| 2 | Neon+Drizzle toolchain, migrate/rollback, PGlite harness | PR2 | `npm test -- tests/migrations` | Manual: apply to Neon preview branch once (not CI gate) | Revert `drizzle.config.ts`, `drizzle/**`, db scripts — no table read yet |
| 3a | `Money` value object | PR3a | `npm test -- src/shared/money` | N/A — pure functions | Revert `src/shared/money/**` — no consumer yet |
| 3b | Catalog domain + schema + scoped repo | PR3b | `npm test -- src/modules/catalog` (fake+PGlite) | PGlite in-process apply | Revert `src/modules/catalog/**`, catalog migration + down file |
| 4 | Identity schema + `AccessScope` + scoped repos | PR4 | `npm test -- src/modules/identity` + `tsc --noEmit` on `tests/types/` | PGlite in-process apply | Revert `src/modules/identity/**` (pre-DAL), identity migration + down file |
| 5a | Password hashing + session store + jose | PR5a | `npm test -- src/modules/identity/application/auth` | N/A — no route wired | Revert hashing port/adapter, `sessions` repo, jose module |
| 5b | DAL + Server Action authorization + `proxy.ts` | PR5b | `npm test -- src/modules/identity/application/dal` | Manual: login → deactivate → next request rejected, once | Revert `dal.ts`, `proxy.ts`, login/logout actions |

## Phase 1: Test Harness + Module Skeleton (PR1, ~250 lines)

- [x] 1.1 RED: `tests/smoke.test.ts` asserts an intentionally failing expectation (EB: Test Command)
- [x] 1.2 GREEN: install Vitest + RTL + jsdom; add `vitest.config.ts`, `vitest.setup.ts`, `npm test` script; smoke test now fails as a reported failure, not a runner error
- [x] 1.3 Create module skeleton: `src/modules/{identity,catalog}/{domain,application,infrastructure}`, `src/shared/{money,db}`
- [x] 1.4 Add `tsconfig.json` path aliases for `@/modules/*`, `@/shared/*`
- [x] 1.5 Add `eslint.config.mjs` `no-restricted-imports` zones: `domain/` cannot import `drizzle-orm`; app modules cannot import each other's entity types (EB: Domain Layer Has No ORM Dependency, groundwork)
- [x] 1.6 Verify: `npm test` passes on a trivial true assertion; `npm run lint` passes on empty skeleton

## Phase 2: Neon + Drizzle Toolchain (PR2, ~200 lines)

- [x] 2.1 RED: PGlite test applies all migrations then rolls back all, asserts `public` schema has zero tables (EB: Migrations Are Clean and Reversible)
- [x] 2.2 GREEN: `drizzle.config.ts`, Neon client in `src/shared/db/client.ts` (`@neondatabase/serverless`), `npm run db:migrate`, `npm run db:rollback` reading `__drizzle_migrations`
- [x] 2.3 GREEN: hand-authored down-migration convention `drizzle/down/NNNN.down.sql`; PGlite test harness wiring (`drizzle-orm/pglite`)
- [x] 2.4 Verify (open item): Neon HTTP driver returns `bigint` columns as JS `number` under Drizzle `mode: 'number'` — write and run a probe test — **BLOCKED**: no Neon branch/`DATABASE_URL` provisioned in this batch (explicit constraint). Probe test written at `tests/migrations/neon-bigint-mode.test.ts`, self-skips without `DATABASE_URL`. Unblock by provisioning a Neon branch, exporting `DATABASE_URL`, and running that file.
- [x] 2.5 Verify (open item): PGlite supports partial unique index, functional unique index (`lower(email)`), enum, and CHECK constraints used later — write and run a probe migration — **VERIFIED, all pass**: `tests/migrations/pglite-constructs.test.ts`, 4/4 green (partial unique index, functional unique index on `lower(email)`, Postgres enum, CHECK constraint).
- [x] 2.6 Manual, once: apply migrations to a real Neon branch, confirm apply succeeds (not a CI gate) — **BLOCKED**: same reason as 2.4, no live Neon branch in this batch. Also moot today: `drizzle/` has zero real migrations (product schema ships in slice 3b/4), so there is nothing yet to apply even once unblocked.

## Phase 3a: Money Value Object (PR3a, ~120 lines)

- [x] 3a.1 RED: `money()` throws on non-integer amount or missing currency (EB: Money Is Integer Minor Units With Currency)
- [x] 3a.2 GREEN: `src/shared/money/money.ts` — frozen `Money` type + `money()` guarded by `Number.isSafeInteger`
- [x] 3a.3 RED: `addMoney`/`subtractMoney` throw `CurrencyMismatchError` on differing currency codes
- [x] 3a.4 GREEN: implement `addMoney`, `subtractMoney`
- [x] 3a.5 RED: `multiplyMoney` rejects a non-integer factor; exact result for an integer factor
- [x] 3a.6 GREEN: implement `multiplyMoney`, `compareMoney`, `isZero`, `isNegative`, `formatMoney`
- [x] 3a.7 REFACTOR: confirm no class/function crosses the module boundary — plain data only

## Phase 3b: Catalog Domain + Schema (PR3b, ~290 lines)

- [x] 3b.1 RED: plan's duration reads from `duration_days`, independent of display name (CAT: Duration Is a First-Class Field)
- [x] 3b.2 GREEN: `plan` domain entity + Drizzle `plan` table (`duration_days`, `kind` CHECK `SCREEN|FULL_ACCOUNT`, `plan_identity_uniq`)
- [x] 3b.3 RED: same plan resolves different absolute price for tier A vs tier B (CAT: Per-Tier Absolute Pricing)
- [x] 3b.4 GREEN: `plan_price` table + tier-scoped price resolution repository method
- [x] 3b.5 RED: plan with no tier-B price row is reported unsellable at tier B, no fallback to tier A (CAT: Missing Tier Price Blocks Sale)
- [x] 3b.6 GREEN: implement sellability check as inner join, no fallback path
- [x] 3b.7 RED: retiring a service keeps its plans readable with prices intact (CAT: Service Retirement Preserves Plans)
- [x] 3b.8 GREEN: `service` table + `retired_at` soft delete, `ON DELETE RESTRICT` on `plan.service_id`
- [x] 3b.9 RED: setting a new price for a plan/tier leaves the prior price row stored and individually addressable (CAT: Price History Is Preserved)
- [x] 3b.10 GREEN: `effective_from`/`effective_to` close-out logic + `plan_price_current_uniq` partial unique index
- [x] 3b.11 Verify: schema inspection test confirms no `StockAccount`, `ProfileSlot`, `Subscription`, or credential column exists (CAT: No Inventory or Subscription Entities)
- [x] 3b.12 GREEN: catalog contract test suite parametrized over {in-memory fake, PGlite adapter} — same assertions run twice

## Phase 4: Identity/Tenancy Schema + AccessScope (PR4, ~250 lines)

- [x] 4.1 RED: persisting role `"SUPERADMIN"` fails validation (IT: Exactly One Role Per User)
- [x] 4.2 GREEN: `user_role` enum, `users` table, role CHECK
- [x] 4.3 RED: creating a second user with an existing email fails uniqueness (IT: Globally Unique Email)
- [x] 4.4 GREEN: `users_email_lower_uniq` functional unique index
- [x] 4.5 RED: type-level negative fixture in `tests/types/` proves an object literal cannot satisfy `AccessScope` and unscoped repository construction fails to compile
- [x] 4.6 GREEN: `src/modules/identity/domain/access-scope.ts` — brand symbol declared, NOT exported; `mintAdminScope`/`mintResellerScope` lint-restricted to `dal.ts`
- [x] 4.7 GREEN: `shared/db/tenant.ts` `tenantWhere(table, scope)` typed to require a `reseller_id` column; repository factory `for<S extends AccessScope>` returning role-narrowed repository types (IT: Single-Level Reseller Ownership — no `parent_id` column)
- [x] 4.8 RED: reseller B's scoped query returns none of reseller A's rows; ADMIN-scoped query returns rows from every reseller (IT: Reseller Row Isolation) — contract suite over {fake, PGlite}
- [x] 4.9 GREEN: scoped catalog/identity repository queries force `tenantWhere` in every read path
- [x] 4.10 RED: activating a RESELLER with no assigned price tier fails (IT: One Price Tier Per Reseller)
- [x] 4.11 GREEN: `users_reseller_requires_tier` CHECK + activation guard
- [x] 4.12 RED: deleting a price tier with assigned resellers fails, tier remains (IT: Price Tier Deletion Guard)
- [x] 4.13 GREEN: `ON DELETE RESTRICT` on `users.price_tier_id`
- [x] 4.14 RED: deactivating a reseller marks them inactive, not removed; owned rows remain (IT: Reseller Deactivation Preserves Data)
- [x] 4.15 GREEN: `deactivated_at` soft delete on `users`

## Phase 5a: Password Hashing + Session Store + Signing (PR5a, ~230 lines)

- [x] 5a.1 RED: argon2id hash/verify round trip with reduced test parameters succeeds; wrong password fails
- [x] 5a.2 GREEN: `PasswordHasher` port + `@node-rs/argon2` adapter (`m=19456, t=2, p=1`), production params injected separately from test params
- [x] 5a.3 RED: login against an unknown email still performs one verify against a dummy hash (no timing difference vs known email)
- [x] 5a.4 GREEN: implement constant-path login verification
- [x] 5a.5 RED: `jose` sign/verify round trip succeeds; tampered token rejected; expired token rejected; `alg: none` rejected
- [x] 5a.6 GREEN: session signing module — `SignJWT` HS256, `jwtVerify` with pinned `algorithms: ['HS256']`, `SESSION_SECRET` read only inside this module
- [x] 5a.7 RED: a successful login persists a `sessions` row (AUTH: Login Issues a DB-Backed Session)
- [x] 5a.8 GREEN: `sessions` table + repository insert (`user_id`, `expires_at`, no IP/user-agent)

## Phase 5b: DAL + Server Action Authorization + Proxy (PR5b, ~220 lines)

- [x] 5b.1 RED: a DAL call without a valid session context throws/returns an authorization error, not data (AUTH: Data Access Layer Enforces Authorization)
- [x] 5b.2 GREEN: `src/modules/identity/application/dal.ts` (`import 'server-only'`) — `verifySession()`, `getScope()`, `requireRole()`, each wrapped in React `cache()`. MUST NOT use `"use cache"` — that directive is cross-request/durable and would keep a revoked session alive; add a code comment stating this explicitly
- [x] 5b.3 RED: after an ADMIN deactivates a user, the next request carrying that user's session cookie is rejected (AUTH: Deactivation Revokes Sessions)
- [x] 5b.4 GREEN: `deactivateUser` transaction — set `users.deactivated_at`, then revoke all active sessions for that user; `verifySession` rejects revoked/expired/deactivated
- [x] 5b.5 RED: an authenticated RESELLER session attempting an ADMIN-only operation is denied (AUTH: Role-Aware Authorization)
- [x] 5b.6 GREEN: `requireRole('ADMIN')` enforced in one representative admin-only Server Action
- [x] 5b.7 RED: a request that passed the `proxy.ts` cookie check still gets independently re-verified by the Server Action it reaches (AUTH: Proxy Performs an Optimistic Check Only)
- [x] 5b.8 GREEN: `proxy.ts` — cookie presence + `jwtVerify` signature + role-claim route table only, no DB access; code comment documents the accepted property that a validly-signed but revoked-session cookie passes proxy and is rejected by the DAL microseconds later
- [x] 5b.9 GREEN: login/logout Server Actions wire hashing, session signing, cookie set/clear
- [x] 5b.10 Verify: `npx tsc --noEmit` and `npm run lint` pass across the full change
