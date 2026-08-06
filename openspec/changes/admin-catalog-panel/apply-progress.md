# Apply Progress: Admin Catalog Panel

## Completed
- [x] 1.1–1.2 Money formatting uses Intl practical fraction digits: COP has 0 and USD 2; no caller-side scaling. Stale centavos wording corrected.
- [x] 1.3–1.4 Admin catalog port/adapters now list services and tiers, soft-retire plans, and atomically create a plan with its initial price through a Drizzle CTE.
- [x] 1.5 `createDrizzleScopedCatalogRepositoryFactory(db)` shares one handle between ADMIN and RESELLER adapters; PGlite contract coverage exercises it.

## TDD Cycle Evidence
| Tasks | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1–1.2 | Money practical-unit test added | Focused suite passed | Existing formatter retained; wording clarified |
| 1.3–1.4 | Cross-adapter contract cases added | In-memory + Drizzle implementations passed | Port and adapter types aligned on `ModuleDb` |
| 1.5 | PGlite factory path exercised | Reseller surface contract passed | Shared composition helper extracted |

## Work Unit Evidence
| Focused test | Runtime harness | Rollback boundary |
|---|---|---|
| `npm test -- src/shared/money/money.test.ts src/modules/catalog/infrastructure/catalog-repository.contract.test.ts src/modules/catalog/infrastructure/reseller-surface.contract.test.ts` — 53 passed | N/A — foundation contains no route/action boundary; PGlite contracts execute the real SQL CTE | Revert money, catalog port/adapters, factory, tests, and wording changes only |

## Remaining
- [ ] Phase 2 tasks 2.1–2.4
- [ ] Phase 3 tasks 3.1–3.5
