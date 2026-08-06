# Proposal: Platform Foundation

Build the domain core, persistence, and authenticated tenancy for a **credit-based reseller platform**. Nothing user-visible ships in this change.

## Intent

**What the product actually is.** A super-admin panel where the owner uploads services and plans with per-tier prices, plus one panel per reseller where a reseller browses the catalog at their own price, tops up balance, and buys. **Credits are the product.** Fulfillment — handing over an actual streaming account — happens entirely outside the platform, over WhatsApp, by the owner.

**Problem.** The WordPress + WooCommerce original encodes plan duration in the product **name** (`"(30 Dias)"`, `"(6 Meses)"`) because WooCommerce cannot model it. That produces 56 SKUs for ~14 services, makes term-based pricing manual, and makes revenue-per-duration reporting impossible. Correction: `Plan` = (service, kind, `duration_days`, absolute price per tier). Duration is a first-class attribute.

**Outcome.** After this change the codebase can state, with tests, who a user is, whether they are ADMIN or RESELLER, what any plan costs at their tier, and it can express money without floating point. That is the precondition for the wallet, ordering, and the two panels.

**Why now.** Strict TDD is active and the repo is a bare `create-next-app`. Every later change is blocked on a test runner, a database, and a domain model.

## Product-level non-goals (permanent, not deferred)

These are **not** future work. They were in the surveyed original and are deliberately not being rebuilt. Recorded here so a later phase does not resurrect them from the survey notes in Engram observation 225.

| Removed | Reason |
|---|---|
| Credential storage — no `StockAccount`, no `ProfileSlot`, no inventory | The platform never holds a streaming account. Fulfillment is off-platform. |
| AES-256-GCM credential encryption | Deleted along with credential storage. **This removes the single largest legal and custody exposure the earlier design carried.** A deliberate product decision, not an oversight. |
| Expiry engine — no `Subscription`, no cron, no days-remaining, no slot release | No subscription lifecycle exists inside the platform. |
| End-customer role | Only ADMIN and RESELLER are users. A reseller's own customers are not modeled at all. |
| The "Tus Cuentas Activas" table from the original | Not being rebuilt. It is a view over credentials the platform does not hold. |

Because inventory is gone, the stock-as-integer defect of the original is no longer relevant to this product and is not addressed.

## Confirmed: the catalog is transactional

The catalog is **transactional, not decorative** — confirmed by the owner. The owner uploads products; a reseller browses at their tier price and places an order that debits their balance; the order is recorded with a fulfillment status the owner marks as fulfilled after delivering off-platform. Ordering and fulfillment are **not** in this change, but the schema must not paint them into a corner.

## Scope

### In Scope

- **Test harness**: Vitest + React Testing Library, `npm test` wired. Lands first — strict TDD is active.
- **Persistence toolchain**: Neon Postgres (Vercel Marketplace, working assumption) + Drizzle ORM + `drizzle-kit` migrations.
- **Identity and tenancy**: ADMIN and RESELLER roles, single-level relationship, globally unique email.
- **Catalog**: services and plans, `duration_days` as a first-class attribute, absolute per-tier pricing.
- **Money**: integer minor units + ISO currency code (COP). No float anywhere near currency.
- **Auth**: `jose`-signed httpOnly session cookie, DB-backed session record, Data Access Layer, `proxy.ts` optimistic route check. Server Actions authorize themselves.
- **Module skeleton**: hexagonal/screaming layout (see Approach).

### Out of Scope (real future work)

- Wallet ledger.
- Payment-gateway adapter.
- Ordering and fulfillment.
- Admin panel UI.
- Reseller panel UI.

## Capabilities

### New Capabilities

- `engineering-baseline`: test command, module layout, money representation, migration workflow.
- `identity-and-tenancy`: users, ADMIN/RESELLER roles, single-level ownership, globally unique email.
- `catalog`: services, plans with first-class duration, absolute per-tier price lists.
- `authentication-session`: login, session lifecycle, revocation, role-aware authorization.

### Modified Capabilities

None — no existing specs.

## Approach

### Module layout

```
src/
  modules/
    identity/     domain | application | infrastructure   <- this change
    catalog/      domain | application | infrastructure   <- this change
    wallet/       (documented, not materialized)
    ordering/     (documented, not materialized)
  shared/
    money/        Money value object
    db/           Drizzle client, schema barrel
```

Four modules, one per business capability the product actually has — the layout screams *reseller credit platform*, not *CRUD app*. Each module owns its own domain types; the domain layer never imports Drizzle. Only `identity` and `catalog` are materialized here; `wallet` and `ordering` are named so their boundaries are reserved, not stubbed.

### Decisions

| Decision | Choice | Rationale | Rejected |
|---|---|---|---|
| Database | Neon Postgres via Vercel Marketplace | Serverless HTTP driver avoids connection exhaustion; branch-per-preview matches the Vercel deploy model | Self-hosted PG (ops burden), Supabase (buys auth we build deliberately) |
| ORM | Drizzle + drizzle-kit | SQL-first and typed; stays thin inside `infrastructure/` so the domain owns no ORM types | Prisma — generated client and engine leak into the domain layer |
| Tenancy isolation | `reseller_id` scoping enforced in the DAL/repository layer | Single testable enforcement point; no live DB needed to test it | Postgres RLS — stronger, but needs `SET LOCAL` per request over a pooled serverless driver. Evaluate in design as defense-in-depth. |
| Hierarchy | Role + `reseller_id` on owned rows. **No `parent_id`, no recursion, no acyclic constraint.** | One level (ADMIN → RESELLER) makes graph machinery pure cost | Arbitrary-depth sub-reseller tree |
| Tier pricing | `price_tier` entity; each reseller assigned one tier; `plan_price(plan_id, tier_id, amount_minor, currency)` | Absolute rows, no margin resolution logic to get wrong | Percentage/margin off a retail price |
| Session | `jose`-signed cookie carrying a session id + DB session row | A deactivated reseller must lose access immediately; a stateless JWT cannot be revoked | Stateless JWT |
| Money | Integer smallest practical units (pesos for COP, cents for USD) + currency code | Uniform and safe for any future second currency | Whole-peso integers |
| Payment gateway | **Port-only in this change — no adapter, no provider commitment.** Wompi recorded as the intended first adapter for the later wallet change. | Keeps the decision out of the foundation | — |

**Authorization posture.** `proxy.ts` performs an optimistic cookie check only. Real authorization lives in the DAL and is re-checked inside every Server Action — Server Actions are public endpoints.

## Business Rules

- A user is exactly one of ADMIN or RESELLER. No other roles exist.
- Email MUST be globally unique across all users.
- Every reseller-owned row MUST carry a `reseller_id`; a reseller MUST NOT read a row owned by another reseller. ADMIN reads all.
- Each reseller MUST be assigned exactly one price tier.
- Each plan MUST have a price row per tier; a plan with a missing tier price MUST NOT be sellable.
- Plan duration MUST be stored as `duration_days`, never parsed from a name.
- All monetary amounts MUST be integer minor units paired with a currency code. No float.
- Deactivating a user MUST invalidate that user's sessions.
- The wallet MUST NOT have a mutable `balance` column — balance is a fold of an append-only ledger. Enforced now so the schema cannot acquire one later.

## Edge Cases

- A plan price is missing for a tier → the plan is not sellable for that tier rather than falling back to another tier's price.
- A price tier is deleted while resellers are assigned to it → block deletion; reassign first.
- Plan price changed after an order exists → the schema must allow capturing price at order time (ordering is a later change).
- Reseller deactivated → soft delete; their rows are preserved for accounting.
- A service is retired while plans reference it → soft delete; existing plans stay readable.
- Migrating the 56 legacy WooCommerce products into `Service` + `Plan` with parsed durations.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `package.json`, `vitest.config.ts`, `vitest.setup.ts` | New | Test harness |
| `src/modules/identity/**` | New | Users, roles, sessions |
| `src/modules/catalog/**` | New | Services, plans, tier prices |
| `src/shared/money/**`, `src/shared/db/**` | New | Money value object, Drizzle client |
| `drizzle/**`, `drizzle.config.ts` | New | Schema + migrations |
| `proxy.ts` | New | Optimistic route check |
| `next.config.ts`, `tsconfig.json`, `.env.example` | Modified | `cacheComponents: true`, path aliases, secrets contract |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Multi-tenant isolation.** A missing `reseller_id` filter leaks one reseller's data to another. Now the top risk. | Medium | Repository-level scoping with no unscoped query API; an isolation test per repository; RLS evaluated in design as defense-in-depth. |
| **Wallet balance non-reconstructible.** A cached balance that drifts from the ledger is an accounting failure, not a bug. | Medium | The foundation schema forbids a stored balance now, constraining the later wallet change even though the ledger itself is out of scope here. |
| **Colombian Ley 1581 (habeas data).** Still applies to reseller personal data. | Low | Minimal personal data, no plaintext secrets in logs, deletion path via soft delete + purge. Exposure is far smaller without third-party credentials. |
| **Foundation scope creep.** "Foundation" invites building the whole product. | Medium | Non-goals above are binding; slice boundaries below are the enforcement. |
| **Neon coupling.** | Low | Drizzle keeps SQL portable; no background jobs are needed by this product. |

## Delivery: 400-line budget

**Revised forecast: ~1,300–1,600 authored lines.** Down from ~2,000–2,400 — inventory, credential encryption, and the expiry engine are gone, and identity lost its recursion. Still over the 400-line review budget, so chained slices remain necessary. Not padded to justify the earlier plan.

| # | Slice | Est. lines |
|---|---|---|
| 1 | Test harness + module skeleton + tsconfig aliases | ~250 |
| 2 | Neon + Drizzle toolchain, connection, migration workflow | ~200 |
| 3 | `Money` value object + catalog domain/schema (service, plan, `duration_days`, tier prices) | ~400 |
| 4 | Identity/tenancy schema (ADMIN/RESELLER, tier assignment, unique email) | ~250 |
| 5 | Auth: password hashing, session lifecycle, DAL, `proxy.ts` | ~450 |

Slice 5 is over budget and may need a split at tasks time (session store vs. route/DAL guards). Each slice has independent tests and a clean rollback.

## Rollback Plan

Per slice: revert the slice's PR. Slices 1–2 leave no data. Slices 3–5 add only new tables — roll back with the paired `down` migration; nothing else reads them because no UI ships in this change. Drop the Neon branch to reset state entirely.

## Dependencies

- Neon Postgres provisioned via the Vercel Marketplace (`DATABASE_URL`).
- `SESSION_SECRET` in the environment.
- npm packages: `vitest`, `@testing-library/react`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `jose`, an argon2id implementation.

## Success Criteria

- [ ] `npm test` runs and a failing test can be written first (strict TDD unblocked).
- [ ] Migrations apply cleanly to an empty Neon branch and roll back.
- [ ] A plan's term is read from `duration_days`, never parsed from a name.
- [ ] A plan resolves a different absolute price for two different tiers, proven by test.
- [ ] A reseller repository query for another reseller's rows returns empty, proven by test.
- [ ] Deactivating a user invalidates their session on the next request.
- [ ] No `StockAccount`, `ProfileSlot`, `Subscription`, or credential column exists in the schema.
- [ ] No mutable `balance` column exists in the schema.
- [ ] `npx tsc --noEmit` and `npm run lint` pass.
