# Design: Admin Catalog Panel

## Technical Approach

Build the ADMIN route as a thin Next 16 Server Action boundary over catalog application use cases. Each mutation re-authorizes, obtains an ADMIN scope, resolves `ScopedRepositoryFactory`, calls a use case, then `revalidatePath("/admin/catalog")`. Runtime catalog reads live in a child Server Component inside `<Suspense>`; no `"use cache"` is used.

Deliver three stacked-to-main slices: (1) money/port/factory foundation, (2) tiers and services, (3) plan/price lifecycle.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Initial price atomicity | Add `createPlanWithInitialPrice` to the admin port; Drizzle inserts plan and first price in one SQL statement/CTE. | Current `createPlan` then `setPlanPrice` can leave a priceless plan when Neon HTTP fails between statements, violating the spec. No migration is needed. |
| Tier prerequisite | `createPlanWithPrice` first calls `listPriceTiers`; it rejects an empty list or a selected ID absent from that list before the atomic port. | The in-memory adapter has no FK enforcement; the use case is the shared, enforceable boundary. Drizzle's FK remains defense in depth. |
| Price replacement | Keep close-then-insert `setPlanPrice`; never auto-retry. | Neon HTTP has no transaction support. A mid-operation failure yields zero current prices, safely unsellable and visibly re-priceable. |
| Money input | Parse only decimal integer strings to a safe integer; pass unchanged to `money(amount, currency)`. | COP `150000` is pesos (0 Intl fraction digits); USD remains cents (2). No scaling or floating point. |
| Error boundary | Map only known `plan_identity_uniq` failures to an es-CO form error; rethrow unexpected failures. | Actionable duplicate feedback must not hide operational failures. |

## Data Flow

```
Catalog page -> Suspense CatalogContent -> getScope -> ScopedRepositoryFactory
                                            |              -> list use case
Client form -> Server Action -> requireRole("ADMIN") -> getScope -> factory
             -> mutation use case -> repository -> revalidatePath
```

`listAdminCatalog` gets every tier and service (including archived/retired), then plans and their tier histories. It derives `effectiveTo === null`, rendering every tier as either priced or “Sin precio”; ~14 services makes this explicit read composition acceptable.

`createPlanWithPrice` validates plan/money fields, verifies the chosen tier through the list port, then calls the atomic port. `replacePlanPrice` delegates to sequential replacement. Service retirement displays that plans remain live; retiring the only priced plan remains allowed.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/shared/money/money.ts`, `money.test.ts` | Modify | Correct practical-unit wording; pin COP 0 vs USD 2 digits. |
| `src/modules/catalog/domain/catalog-repository.ts`, `plan.ts` | Modify | Add listings, `retirePlan`, `createPlanWithInitialPrice`, and plan retirement helper. |
| `src/modules/catalog/infrastructure/{drizzle,in-memory}-catalog-repository.ts` | Modify | Implement port; CTE atomic create in Drizzle, validated map write in memory. |
| `src/modules/catalog/infrastructure/catalog-repository.contract.test.ts` | Modify | Cross-adapter listings, soft-delete, initial-price and price-current contracts. |
| `src/modules/catalog/application/**` | Create | Listing/lifecycle use cases plus tests; tier prerequisite belongs here. |
| `app/admin/catalog/actions.ts` | Create | Production composition and ADMIN-first actions: `const db=getDb(); new ScopedRepositoryFactory(new DrizzleCatalogRepository(db), scope => new DrizzleResellerCatalogRepository(db, scope.priceTierId))`. |
| `app/admin/catalog/{page.tsx,catalog-content.tsx,*.tsx}` | Create | Suspense page, es-CO lists and `useActionState` forms. |
| `openspec/changes/platform-foundation/{proposal,design}.md` | Modify | Replace stale “centavos” wording. |

## Interfaces / Contracts

```ts
type CreatePlanWithInitialPriceInput = NewPlanInput & {
  priceTierId: PriceTierId; amountMinor: number; currency: CurrencyCode;
};
type CreatePlanWithPriceDeps = Pick<CatalogRepository,
  "listPriceTiers" | "createPlanWithInitialPrice">;
interface CatalogRepository {
  listServices(): Promise<readonly Service[]>;
  listPriceTiers(): Promise<readonly PriceTier[]>;
  retirePlan(planId: PlanId): Promise<void>;
  createPlanWithInitialPrice(input: CreatePlanWithInitialPriceInput): Promise<Plan>;
}
type CatalogFormState = { readonly error: string } | undefined;
```

Every mutation action's first executable statement is `await requireRole("ADMIN")`; it then calls `getScope()` and the concrete factory above. FormData IDs are untrusted. The use case returns a domain result/error; actions return only `CatalogFormState`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Money units, input parsing, duplicate mapping | RED → GREEN → REFACTOR with Vitest. |
| Use-case contract | Zero tiers and missing selected tier reject before `createPlanWithInitialPrice`, and leave no plan | Parameterize the same RED tests over in-memory and PGlite repositories; this is the in-memory FK substitute. |
| Integration | Listings include retired rows; plan retirement frees identity; atomic create; replacement interruption/current invariant | Existing shared suite against in-memory and PGlite; PGlite additionally proves DB FKs/CTE atomicity. |
| Action/component | Every mutation is ADMIN-first; concrete factory shares one `getDb()` result between admin and reseller adapters; Spanish errors/warnings/unpriced states | Mock DAL/db/constructors and React Testing Library. |
| Build gates | Suspense/type/lint integrity | `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Deliver three stacked PRs to main; each is code-revertible. Correct a price with a new append-only row, not a rollback.

## Open Questions

None.
