# Proposal: Admin Catalog Panel

## Intent

`platform-foundation` shipped a catalog the product owner cannot touch. Services, plans, and per-tier prices exist as tables and a repository port, but the only way to put a row in them is a developer with a database URL. No reseller can even be provisioned until a `price_tier` row exists (`users_reseller_requires_tier`), and there is no code path that creates one.

This change gives ADMIN a working catalog surface: bootstrap price tiers, create and retire services, create plans with a price, and change prices. It is the first slice where a human types money into this system, which is why two latent defects must close here rather than later.

## Settled decisions carried in (not open)

| Decision | Consequence for this change |
|---|---|
| `amount_minor` holds the currency's smallest **practical** unit per CLDR/Intl — pesos for COP, cents for USD | Admin types `150000` for a $150.000 COP plan. No ×100 in the form. |
| `retirePlan` is in scope | Without it a mistyped plan permanently occupies its `plan_identity_uniq` slot and the correct plan can never be created. |
| A plan MUST NOT be saved without at least one price | Price tiers must exist **before** any plan exists — tier bootstrap is a prerequisite, not an extra. |
| Hand-rolled Tailwind + Server Actions + `useActionState` | Matches `app/login/login-form.tsx` and `app/session-panel.tsx`. No component library is installed; shadcn/ui is rejected for this slice. UI copy stays Spanish (es-CO), per existing convention. |

## Scope

### In Scope

- **Port + both adapters**: `listServices()`, `listPriceTiers()`, `retirePlan(planId)` on `CatalogRepository`, implemented in `DrizzleCatalogRepository` and `InMemoryCatalogRepository`, covered by the existing shared contract suite.
- **`catalog/application` use-case layer** (currently `.gitkeep` only), mirroring `identity/application/`: list catalog, create/retire service, create plan **with a mandatory first price**, retire plan, replace plan price, create/list price tier.
- **Server Actions** for every mutation, each opening with `requireRole("ADMIN")` — Server Actions are public POST endpoints.
- **First real wiring of `ScopedRepositoryFactory`**: `getScope()` → `factory.for(scope)` → `AdminCatalogRepository`. It has never run outside tests.
- **`app/admin/catalog/`** page and forms, every data-reading component inside `<Suspense>` (Cache Components `blocking-route` constraint, documented at `app/admin/page.tsx:12-20`). No `"use cache"` on catalog reads in this slice.
- **Money-unit correction, documentation and test**: `platform-foundation/design.md:87` and `platform-foundation/proposal.md:94` say "centavos" and are now wrong — correct both, plus the comment in `src/shared/money/money.ts`. Add a test that pins COP → 0 fraction digits and USD → 2, because `money.test.ts:130` asserts `formatted.replace(/\D/g,"")` contains `"150"`, which passes for both `$150.000` and `$1.500,00`. A 100× error is currently unpinned.
- **DB-rejection surfacing**: `plan_identity_uniq` violation must render as a user-facing message, never a swallowed exception.

### Non-Goals (deferred, with reasons)

| Deferred | Reason |
|---|---|
| `updateService` / `updatePlan` (rename) | No port method exists; create + retire + recreate is a workable path once `retirePlan` lands. Pure additive later. |
| Price-tier archiving | `archived_at` exists but nothing sets it. Tiers are few and long-lived; archiving needs a "resellers still assigned" guard that is really an identity concern. |
| Bulk "retire all plans under this service" | Schema deliberately does not cascade (proven by `catalog-repository.contract.test.ts:111-131`). Retiring plans individually is correct and safe; a bulk action is a convenience with destructive blast radius. |
| Price-history browsing UI | `listPlanPriceHistory` already exists; nothing consumes history until ordering does. |
| Pagination and search | ~14 legacy services. Adding either now is speculative. |
| Any reseller-facing catalog UI | Out of scope per `platform-foundation/proposal.md:45-51`. |

## Capabilities

### New Capabilities

- `admin-catalog-management`: the ADMIN lifecycle surface — tier bootstrap, service and plan creation/retirement, price entry and replacement, and the requirement that every catalog mutation re-authorizes as ADMIN.

### Modified Capabilities

- `catalog`: add **plan retirement frees its identity slot** and **a plan is never created without a price** (the schema permits a priceless plan; the product does not).
- `engineering-baseline`: restate **Money Is Integer Minor Units With Currency** as the smallest *practical* unit per CLDR/Intl, with a scenario pinning COP (0 fraction digits) against USD (2).

## Approach

Layered exactly as `identity`: thin Server Action (`requireRole` → build repo from scope → call use case → `revalidatePath`), use case owns the business rule, repository owns SQL. The one composite use case is create-plan: `createPlan` then `setPlanPrice`, in that order, since a price row needs a `plan_id`.

**No migration is required.** `retired_at` on `plan` already exists; the three new methods are reads and one soft-delete over existing columns.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/modules/catalog/domain/catalog-repository.ts`, `plan.ts` | Modified | 3 port methods; `retirePlan` domain function mirroring `retireService` |
| `src/modules/catalog/infrastructure/*catalog-repository.ts` | Modified | Both adapters + contract suite |
| `src/modules/catalog/application/**` | New | Entire use-case layer + `actions.ts` |
| `app/admin/catalog/**` | New | Page, list, forms |
| `src/shared/money/money.ts`, `money.test.ts` | Modified | Unit-semantics comment + pinning test |
| `openspec/changes/platform-foundation/{design,proposal}.md` | Modified | "centavos" wording correction |
| `drizzle/**` | Untouched | No schema change |

## Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Money-unit misread (HIGH RISK — price data feeds future wallet debits)**. A 100× error in stored prices is an accounting failure, not a display bug. | Medium | High | Pinning test on COP/USD fraction digits lands **before** any price form; corrected docs; the form performs no scaling at all. |
| **Non-atomic price replacement (HIGH RISK — pricing)**. Neon HTTP has no transactions (`drizzle-catalog-repository.ts:98-122`): close-out then insert. A crash between them leaves the (plan, tier) with **zero** current prices. | Low | High | Fails safe toward "not sellable", never double-priced (`plan_price_current_uniq`). Surface it in the UI: a plan showing no current price for a tier must be visibly flagged and re-priceable. Do not paper over it with a retry that could double-close. |
| `ScopedRepositoryFactory` first production wiring | Medium | Medium | Wire and test it in the earliest slice, before UI depends on it. |
| Port change touches domain + two adapters + contract tests | High | Low | Expected; sequenced as slice 1 so later slices build on a stable port. |
| Scope inflation into rename/archive/history UI | Medium | Medium | Non-goals table above is binding. |

## Delivery: changed-line forecast

Budget is **800 lines**; requested strategy is `single-pr`. Strict TDD is active, and the last measurement on this project found the tasks-phase forecast low by ~2× because it counted implementation only. Tests are forecast separately here.

| Slice | Impl | Tests | Total |
|---|---|---|---|
| 1. Money pin + doc correction; port + both adapters + contract tests; `ScopedRepositoryFactory` wiring | ~150 | ~230 | **~380** |
| 2. Price-tier bootstrap + service lifecycle: use cases, actions, `app/admin/catalog` page and list, create-tier and create-service forms | ~380 | ~330 | **~710** |
| 3. Plan lifecycle: create-plan-with-price, retire-plan, replace-price use cases, actions and forms; duplicate-identity error surfacing | ~370 | ~370 | **~740** |
| **Total** | **~900** | **~930** | **~1,830** |

**This does not fit in one PR.** ~1,830 authored lines is roughly 2.3× the 800-line budget, and tests slightly outweigh implementation. Three chained slices are proposed, each independently testable and revertible; slice 1 is a hard prerequisite for 2 and 3, and slice 2 is a prerequisite for 3 (a plan cannot be created before a tier and a service exist). Slices 2 and 3 sit near the ceiling — `sdd-tasks` should split either one if its forecast grows.

**Decision needed before apply: Yes** — `single-pr` must be revised to a chained sequence, or an explicit `size:exception` accepted.

## Rollback Plan

No migration, so rollback is a code revert with no data step.

- Per slice: revert that slice's PR. Slice 1 reverts to the current port; nothing outside catalog imports the new methods.
- Slices 2–3 add routes and actions only. Reverting removes `/admin/catalog`; rows already written stay valid and readable, since every write uses existing columns and existing constraints.
- Rows created through the panel and then orphaned by a revert are not corrupt: a service or plan created by the UI is indistinguishable from one created by a script.
- Emergency reversal of a wrong price does not need a revert — set the correct price again; history is append-only and the prior row survives.

## Dependencies

- `platform-foundation` merged (it is — `9e996f7`).
- At least one ADMIN user (`scripts/db/seed-admin.ts`).
- No new npm packages.

## Success Criteria

- [ ] `formatMoney(money(150000,"COP"),"es-CO")` is pinned by test to `$ 150.000`, and USD to 2 fraction digits, in the same suite.
- [ ] No document in `openspec/` still describes `amount_minor` as centavos.
- [ ] An ADMIN can create a price tier, a service, and a plan with a price, from an empty database, using only the UI.
- [ ] Attempting to save a plan without a price is rejected by the use case, proven by test.
- [ ] Creating a duplicate active (service, kind, duration_days) shows a user-facing error rather than a stack trace.
- [ ] A retired plan frees its `plan_identity_uniq` slot: the same identity can be created again, proven by test.
- [ ] Every catalog Server Action rejects a RESELLER and an anonymous caller, proven by test per action.
- [ ] Every catalog-reading component renders inside `<Suspense>`; `npm run build` produces no `blocking-route` error.
- [ ] `npm test`, `npx tsc --noEmit`, and `npm run lint` pass.

## Proposal question round — RESOLVED

Answered by the maintainer (alejox) on 2026-08-05. These are settled inputs for `sdd-spec`, `sdd-design`, and `sdd-tasks`. Do not relitigate them.

1. **Currency on the price form — EXPOSED as an editable input.** The maintainer overrode the "fixed to COP" assumption. `plan_price.currency` is a real column and `Money` already validates ISO 4217 alpha-3 in the domain. That domain boundary is authoritative: client-side validation alone is not acceptable, and an invalid code must be rejected by `money()` regardless of what the form allows through.
2. **Mandatory first price covers ONE tier of the admin's choosing.** Remaining tiers are priced afterwards. A plan is simply not sellable to an unpriced tier, and the UI must make an unpriced tier visible rather than silently absent.
3. **Retiring a service with active plans is ALLOWED, with a visible warning** that its plans stay live and readable. This matches the schema's deliberate non-cascade, proven by `catalog-repository.contract.test.ts:111-131`. The UI must not invent a rule the schema does not enforce.
4. **Retiring a plan that is a service's only priced plan is ALLOWED**, with no special handling. There is no product rule requiring a service to keep at least one live plan.
5. **Chained delivery CONFIRMED — three slices, stacked to main.** Each PR targets the previous PR's branch; the last targets `main`; they merge in order. `delivery_strategy: auto-chain`, `chain_strategy: stacked-to-main`. The single-PR option with `size:exception` was explicitly rejected.
