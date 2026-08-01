# Design: Platform Foundation

Hexagonal modules (`identity`, `catalog`) over Neon Postgres + Drizzle, where multi-tenant isolation is enforced by an **unforgeable `AccessScope` token** that every repository factory demands, so an unscoped query is a compile error rather than a code-review finding. Nothing user-visible ships.

## Technical Approach

| Layer | Contains | May import |
|---|---|---|
| `modules/*/domain` | Entities, value objects, ports, `AccessScope` | nothing outside `shared/money` |
| `modules/*/application` | Use cases, DAL (`import 'server-only'`) | `domain`, `next/headers`, `react` |
| `modules/*/infrastructure` | Drizzle schema + repository adapters | `domain`, `drizzle-orm`, `shared/db` |
| `shared/money` | `Money` plain-object VO (isomorphic) | nothing |
| `shared/db` | Neon client, schema barrel, `tenantWhere` | `drizzle-orm` |

Cross-module references are **by id only** (`users.price_tier_id` → `catalog`'s `price_tier`); no module imports another module's entity type. Boundaries are mechanically enforced by `eslint.config.mjs` `no-restricted-imports` zones, which is what makes the "domain has no ORM dependency" requirement testable via `npm run lint` instead of by inspection.

## Architecture Decisions

### Decision: `AccessScope` is an opaque branded token minted only by the DAL

**Choice**

```ts
// src/modules/identity/domain/access-scope.ts — brand is declared, NOT exported
declare const scopeBrand: unique symbol;
export type AccessScope =
  | { readonly [scopeBrand]: true; kind: 'admin';    userId: UserId }
  | { readonly [scopeBrand]: true; kind: 'reseller'; userId: UserId;
      resellerId: ResellerId; priceTierId: PriceTierId };
```

No module outside this file can name `scopeBrand`, so no object literal can satisfy `AccessScope`. The only producers are `mintAdminScope` / `mintResellerScope`, and lint restricts importing them to `identity/application/dal.ts`, which mints only from a DB-verified session row.

Repositories are unreachable without one, and admin-only capability is removed from the *type* under a reseller scope:

```ts
export interface CatalogRepositoryFactory {
  for<S extends AccessScope>(scope: S):
    S extends { kind: 'admin' } ? AdminCatalogRepository : ResellerCatalogRepository;
}
// ResellerCatalogRepository takes NO tier argument — tier comes from the scope.
listSellablePlans(): Promise<SellablePlan[]>;
findSellablePlan(planId: PlanId): Promise<SellablePlan | null>;
```

**Alternatives considered**: a `resellerId` parameter on each method (caller can pass any id — IDOR by typo); a base-class `applyScope()` helper (opt-in, forgettable); runtime assertions only.

**Rationale**: the catalog is the foundation's real confidentiality surface — a reseller must not resolve another *tier's* price. Because the tier is read from the scope and never accepted as a parameter, "price me at the cheapest tier" is not expressible. `WHERE` clauses are never a public method parameter, so no caller can compose a query that omits the tenant predicate.

For future tenant tables, `shared/db/tenant.ts` exposes `tenantWhere(table: PgTable & { resellerId: PgColumn }, scope)`. A table lacking `reseller_id` cannot be passed to it — the type system, not a convention, requires the column.

**One documented exception**: session lookup during login happens *before* a scope exists. It lives in a separate `SessionAuthenticator` port with a single method, so the exception is enumerable and reviewable rather than diffuse.

### Decision: Postgres RLS is rejected for this change; the schema stays RLS-ready

| Blocker | Detail |
|---|---|
| Driver | `@neondatabase/serverless` HTTP mode sends each statement as an independent HTTP request. `SET LOCAL app.reseller_id` requires transaction continuity, so a policy variable set in one call is not visible to the next. |
| Workaround cost | Forcing every read through `.transaction([...])` batches or switching to the WebSocket `Pool` driver removes the single-round-trip benefit that motivated choosing Neon serverless in the proposal. |
| Ownership | Policies are bypassed by the table owner unless a separate non-owner app role plus `FORCE ROW LEVEL SECURITY` is provisioned — extra role and migration surface in a change that ships no UI. |

**Verdict**: defer, do not discard. Every future tenant table declares `reseller_id NOT NULL`, so enabling RLS later is a policy migration, not a remodel. Recorded precondition: adopt the transaction-batched or `Pool` driver first. Interim defense is the three-layer stack above (unforgeable scope + typed tenant helper + lint zones) plus a per-repository isolation test. Driver behaviour is asserted, not yet executed — **verify in slice 2**.

### Decision: `plan_price` is append-only and individually addressable

Price changes insert a new row and close the previous one (`effective_to`). A partial unique index guarantees exactly one current price per (plan, tier). Ordering — built later — will store `order_line.plan_price_id` (FK to the exact historic row) plus a denormalized `amount_minor` snapshot. **That single reserved FK is the whole "capture price at order time" mechanism; no ordering table is created here.**

**Alternatives considered**: mutable price row + amount copied at order time. Rejected because a copied amount cannot prove *which* price it came from, and the original platform's failure was precisely that revenue-per-duration could not be reconstructed.

### Decision: `Money` is a frozen plain object, never a class

React blocks classes and functions from crossing the Server→Client boundary (`data-security.md`). A `Money` class would work in the domain and silently fail the moment a price reaches a Client Component, so the VO is data + module-level functions.

```ts
export type CurrencyCode = 'COP';                       // ISO 4217 alpha-3
export type Money = Readonly<{ amountMinor: number; currency: CurrencyCode }>;

money(amountMinor, currency)   // throws unless Number.isSafeInteger
addMoney(a, b) / subtractMoney(a, b)   // throws CurrencyMismatchError on differing codes
multiplyMoney(m, qty: number)          // integer factor only, exact
compareMoney(a, b) / isZero / isNegative
formatMoney(m, locale)                 // Intl.NumberFormat, presentation only, isomorphic
```

- **Rounding rules: none, deliberately.** Rounding only arises from division or percentages, and the proposal settled on *absolute* per-tier prices with no margin resolution. No `divide` is exposed. If ordering later needs proportional splits, add `allocate()` (largest-remainder, sum-preserving) rather than `round()`.
- **Currency mismatch throws.** With a single currency in production, a mismatch is a programmer error, not user input — a `Result` type would invite silent swallowing.
- **`number`, not `bigint`.** Safe-integer range covers ~90 000 000 000 COP in centavos; `bigint` serializes poorly across the RSC boundary and through Drizzle. Guarded by `Number.isSafeInteger` at construction.
- DB column is `bigint(mode: 'number')`; confirm the Neon HTTP driver returns it as a JS number and not a string in slice 2.

### Decision: identifiers are generated in the application, not by a DB default

`crypto.randomUUID()` in a domain factory. `gen_random_uuid()` is core Postgres since 13 and would also work, but app-side generation lets the domain build a fully-identified entity before persistence — required for pure unit tests against in-memory fakes — and keeps `save()` free of a read-back round trip.

### Decision: `role` is a Postgres enum; `plan.kind` is `text` + CHECK

`role` is closed by specification ("no other role value is valid"), so an enum makes the rejection a database guarantee. `plan.kind` is confirmed by the owner as exactly `SCREEN` and `FULL_ACCOUNT`, but it stays open by design: the legacy catalog also carries a domain-licensed kind (`Canva Pro a Dominio`) that the owner does not sell today and may add later. Postgres enum values cannot be removed, so `text` + CHECK keeps that widening a one-line migration.

### Decision: hand-authored down migrations

`drizzle-kit generate` emits forward-only SQL; it has no down generation, yet the baseline spec requires a paired down migration. Each generated `drizzle/NNNN_x.sql` gets a hand-authored `drizzle/down/NNNN_x.down.sql`, applied by `npm run db:rollback` (reads `__drizzle_migrations`, applies the matching down file, deletes the row). A CI test applies all migrations then rolls back and asserts `public` has zero tables. `drizzle-kit push` is not used — it produces no reviewable artifact and no rollback path.

## Schema

```sql
-- catalog
price_tier  ( id uuid PK, code text NOT NULL UNIQUE, name text NOT NULL,
              created_at timestamptz NOT NULL, archived_at timestamptz NULL )

service     ( id uuid PK, slug text NOT NULL UNIQUE, name text NOT NULL,
              description text NULL, created_at, updated_at timestamptz NOT NULL,
              retired_at timestamptz NULL )                        -- soft delete

plan        ( id uuid PK,
              service_id uuid NOT NULL REFERENCES service(id) ON DELETE RESTRICT,
              name text NOT NULL,
              kind text NOT NULL CHECK (kind IN ('SCREEN','FULL_ACCOUNT')),
              duration_days integer NOT NULL CHECK (duration_days > 0),
              created_at, updated_at timestamptz NOT NULL,
              retired_at timestamptz NULL )
  UNIQUE INDEX plan_identity_uniq (service_id, kind, duration_days) WHERE retired_at IS NULL

plan_price  ( id uuid PK,                                          -- the order-time anchor
              plan_id uuid NOT NULL REFERENCES plan(id) ON DELETE RESTRICT,
              price_tier_id uuid NOT NULL REFERENCES price_tier(id) ON DELETE RESTRICT,
              amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
              currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
              effective_from timestamptz NOT NULL,
              effective_to timestamptz NULL )
  UNIQUE INDEX plan_price_current_uniq (plan_id, price_tier_id) WHERE effective_to IS NULL

-- identity
user_role ENUM ('ADMIN','RESELLER')

users       ( id uuid PK, email text NOT NULL, password_hash text NOT NULL,
              role user_role NOT NULL, display_name text NOT NULL,
              price_tier_id uuid NULL REFERENCES price_tier(id) ON DELETE RESTRICT,
              created_at, updated_at timestamptz NOT NULL,
              deactivated_at timestamptz NULL )                    -- soft delete
  UNIQUE INDEX users_email_lower_uniq ON (lower(email))
  CHECK users_reseller_requires_tier:
        (role='RESELLER' AND price_tier_id IS NOT NULL)
     OR (role='ADMIN'    AND price_tier_id IS NULL)

sessions    ( id uuid PK,                                          -- the id inside the cookie
              user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              created_at, expires_at timestamptz NOT NULL,
              revoked_at timestamptz NULL )
  INDEX sessions_user_id_idx (user_id)
```

Schema-level answers to the proposal's edge cases:

| Edge case | Enforced by |
|---|---|
| Tier deleted while resellers assigned | `ON DELETE RESTRICT` on `users.price_tier_id` — database, not app code |
| One tier per reseller, no hierarchy | `users_reseller_requires_tier` CHECK; there is no `parent_id` column to add |
| Missing tier price ⇒ not sellable | price resolution is an inner join on `(plan, tier)`; absence yields no row, so no fallback is representable |
| Service retired, plans survive | `retired_at` + `ON DELETE RESTRICT` |
| Reseller deactivated | `deactivated_at` only — no redundant `is_active` boolean that could disagree with it |
| Legacy 56-SKU duplication | `plan_identity_uniq (service_id, kind, duration_days)` |

No `balance`, no credential column, no `stock_account` / `profile_slot` / `subscription`. Sessions store no IP or user-agent (Ley 1581 data minimization).

## Auth and Session

**Hashing** — argon2id via `@node-rs/argon2`, `m=19456 KiB, t=2, p=1`, 16-byte salt, 32-byte tag, stored as a PHC string in `password_hash`. Parameters are injected into the `PasswordHasher` port so tests can use cheap parameters without weakening production. Login always performs one verify — against a dummy hash when the email is unknown — to remove the timing oracle for user enumeration.

**Cookie** — name `session`; `httpOnly: true, secure: true, sameSite: 'lax', path: '/'`, `expires` mirroring `sessions.expires_at` (7 days absolute; no sliding refresh in this change). `lax` rather than `strict`: Next.js already compares `Origin` to `Host` for Server Actions, and `strict` would break the return redirect from the payment gateway in the later wallet change.

**Signing** — `jose` `SignJWT`, `alg: HS256`, payload `{ sid, uid, role }` + `setIssuedAt()` + `setExpirationTime`. Verified with `jwtVerify(token, key, { algorithms: ['HS256'] })`; pinning the algorithm list blocks `alg: none` and algorithm confusion. The payload holds no secret, so signing suffices and JWE is not needed. `SESSION_SECRET` (≥32 bytes) is read only inside the DAL module.

**DAL** (`src/modules/identity/application/dal.ts`, `import 'server-only'`):

```ts
verifySession(): Promise<VerifiedSession>   // redirects to /login when invalid
getScope():      Promise<AccessScope>       // the only minter of AccessScope
requireRole(r):  Promise<VerifiedSession>   // throws Forbidden
```

All three are wrapped in React `cache()` — **per-request** memoization. They MUST NOT use `"use cache"`: Cache Components caching is cross-request and durable, and would keep a revoked session alive. This distinction is the single most dangerous Next 16 footgun in this design.

**Revocation** — `deactivateUser` runs one transaction: set `users.deactivated_at`, then `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`. `verifySession` re-reads session ⋈ user on every request and rejects when `revoked_at IS NOT NULL OR expires_at <= now() OR users.deactivated_at IS NOT NULL`.

**`proxy.ts`** — optimistic **only**: reads the cookie, `jwtVerify`, matches the `role` claim against a static route table, redirects. No database access, because proxy runs on prefetched routes (`authentication.md`). Proxy defaults to the Node.js runtime in Next 16 and the `runtime` config option throws if set. **Accepted and documented property: a validly-signed cookie for an already-revoked session passes proxy.** The DAL rejects it microseconds later, and every Server Action calls `requireRole()` itself because Server Actions are public POST endpoints reachable independently of the page that renders them.

```
Login                      Authorized catalog read
─────                      ───────────────────────
Action                     Request → proxy.ts  (signature + role claim only)
  ↓ verify argon2id                ↓
  ↓ INSERT sessions          Server Component / Action
  ↓ jose sign {sid,uid,role}       ↓ verifySession()  → sessions ⋈ users, live check
  ↓ cookies().set(...)             ↓ getScope()       → AccessScope {reseller, tierId}
  → redirect                       ↓ repo.for(scope).listSellablePlans()
                                   → SQL forced to tier = scope.priceTierId
```

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit — no DB | `Money` algebra, mismatch/overflow rejection, plan invariants, tier-assignment rule, session validity predicate, scope derivation | Vitest, pure functions, in-memory fakes |
| Unit — slow path | argon2id hash/verify round trip, jose sign/verify, tampered and expired token rejection | Vitest with reduced argon2 parameters injected through the port |
| Repository contract | One shared suite run twice: against the in-memory fake **and** the real adapter — including "reseller B sees none of reseller A's rows", "same plan, two tiers, two amounts", "no current price ⇒ not sellable" | **PGlite** (`@electric-sql/pglite` + `drizzle-orm/pglite`): real Postgres in WASM, in-process, no Docker, no network, no Neon secret. Runs on CI and on forks. |
| Migration | apply all → schema matches Drizzle definition; roll back all → `public` empty | PGlite, same runner |
| Static | domain imports no `drizzle-orm`; `shared/db/client` imported only under `infrastructure/`; unscoped repository construction fails to compile | `npm run lint` zones + `npx tsc --noEmit` on a `tests/types/` negative fixture |
| Neon | migrations apply to a real branch | Manual, once per slice — not a CI gate |

The contract suite running identically on fake and PGlite is what makes the isolation guarantee real: the fake proves the *use case* is scoped, PGlite proves the *SQL* is.

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution |
| Git repository selection | N/A — no VCS automation |
| Commit state | N/A |
| Push state | N/A |
| PR commands | N/A |

The one boundary this change does introduce is HTTP routing via `proxy.ts`; it is covered by the authorization design above (optimistic-only, DAL re-verification, Server Action re-authorization) rather than by this matrix, whose rows address shell and VCS surfaces that do not exist here.

## Slice Mapping

| # | Slice | Est. | Delivers |
|---|---|---|---|
| 1 | Vitest + RTL, module skeleton, tsconfig aliases, eslint boundary zones | ~250 | A failing test can be written first |
| 2 | Neon + Drizzle client, `drizzle.config.ts`, migration + rollback scripts, PGlite harness | ~200 | Migrations apply and roll back in CI |
| 3a | `shared/money` | ~120 | `Money` algebra proven |
| 3b | Catalog domain + schema + repository (tier-scoped) | ~290 | Two tiers, two prices, proven |
| 4 | Identity schema, roles, tier assignment, `AccessScope`, tenant helper | ~250 | Isolation contract test passes |
| 5a | Password hashing port + argon2id adapter, `sessions` table + repository, `jose` sign/verify | ~230 | A session can be minted and verified |
| 5b | DAL (`verifySession`/`getScope`/`requireRole`), login/logout actions, `proxy.ts`, deactivation→revocation | ~220 | A request can be authorized and revoked |

**Slice 5 split**: 5a is pure server-side machinery with no routing; 5b is the request-path wiring that consumes it. Each has independent tests and a clean revert. **Slice 3 split**: slice 3 was forecast at exactly the 400-line budget, leaving no headroom; `Money` is self-contained and detaches cleanly. Every slice now sits at or below ~290 lines.

## Migration / Rollout

No data migration — all tables are new and nothing reads them, since no UI ships. Rollback is per-slice PR revert plus the paired down migration; a Neon branch reset is the escape hatch. The legacy 56-SKU WooCommerce import is a later, separate change: `plan_identity_uniq` is the constraint that will surface duplicate parses during that import.

## Open Questions

- [x] `plan.kind` allowed values — RESOLVED. Owner confirmed exactly two kinds: `SCREEN` (a single profile on a shared account) and `FULL_ACCOUNT` (the whole account). A third legacy kind, domain-licensed (`Canva Pro a Dominio`), is deliberately not sold today; `text` + CHECK keeps adding it a one-line migration.
- [ ] Confirm at slice 2 that `@neondatabase/serverless` HTTP mode returns `bigint` as a JS number under Drizzle's `mode: 'number'`.
- [ ] Confirm at slice 2 that PGlite covers every construct used here (partial unique indexes, functional unique index, enums, CHECK).
