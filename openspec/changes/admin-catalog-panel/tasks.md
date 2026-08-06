# Tasks: Admin Catalog Panel

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,650–1,900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundation → PR 2 tier/service → PR 3 plan/price |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Money, port and factory foundation | PR 1 | `npm test` | N/A: no route | money/catalog port/factory files |
| 2 | Tier and service ADMIN workflow | PR 2 | `npm test` | Seed ADMIN: create tier then service | tier/service use cases, actions, UI |
| 3 | Atomic plan and price lifecycle | PR 3 | `npm test` | Seed ADMIN: create priced plan, reprice, retire | plan/price use cases, actions, UI |

## Phase 1: PR 1 — Foundation

- [x] 1.1 **RED**: pin COP 0-digit vs USD 2-digit formatting in `src/shared/money/money.test.ts`; correct practical-unit wording in `money.ts`.
- [x] 1.2 **GREEN/REFACTOR**: make the money test pass without amount scaling; replace stale “centavos” text in `openspec/changes/platform-foundation/{proposal,design}.md`.
- [x] 1.3 **RED**: extend `src/modules/catalog/infrastructure/catalog-repository.contract.test.ts` for list-all services/tiers, soft plan retirement, reusable retired identity, initial price, and one-current-price invariant.
- [x] 1.4 **GREEN/REFACTOR**: add `listServices`, `listPriceTiers`, `retirePlan`, `createPlanWithInitialPrice` and the `retirePlan` domain helper; implement both adapters, with one-statement CTE plan+price creation in Drizzle.
- [x] 1.5 **RED→GREEN→REFACTOR**: wire and test `ScopedRepositoryFactory` with one shared `getDb()` result for ADMIN and reseller adapters.

## Phase 2: PR 2 — Tier and Service Lifecycle

- [ ] 2.1 **RED**: add catalog application tests for ADMIN listing, tier creation/listing, service creation/retirement, and no side-effect retirement of active plans.
- [ ] 2.2 **GREEN/REFACTOR**: create use cases under `src/modules/catalog/application/` using the factory-resolved admin repository.
- [ ] 2.3 **RED**: action/component tests require ADMIN as each mutation’s first executable statement; RESELLER and anonymous callers mutate nothing.
- [ ] 2.4 **GREEN/REFACTOR**: create `app/admin/catalog/actions.ts`, page, Suspense `catalog-content.tsx`, and es-CO tier/service forms, including active-plan retirement warning.

## Phase 3: PR 3 — Plan and Price Lifecycle

- [ ] 3.1 **RED**: parameterize fake/PGlite tests: zero tiers or missing selected tier rejects before atomic creation and persists no plan; invalid currency rejects in `money()`.
- [ ] 3.2 **GREEN/REFACTOR**: implement `createPlanWithPrice` prerequisite checks and call the atomic port; do not add a retry to sequential replacement.
- [ ] 3.3 **RED**: action/component tests cover duplicate `plan_identity_uniq` Spanish error, every unpriced tier visible, interrupted replacement flagged unpriced, and allowed only-priced-plan retirement.
- [ ] 3.4 **GREEN/REFACTOR**: add plan/create-price/reprice/retire actions and `useActionState` forms; render every catalog read inside `<Suspense>`.
- [ ] 3.5 Verify each PR with `npm test`, `npx tsc --noEmit`, `npm run lint`; PR 3 additionally runs `npm run build` with no catalog `blocking-route` error.
