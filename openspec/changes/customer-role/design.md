# Design: Customer Role

Generalise the *existing* tenancy axis instead of adding a second one, reuse the tier-bound
catalog adapter for retail pricing, and discriminate `sales_order` by buyer so the reseller
double-spend guard survives byte-for-byte. Three chained PRs, stacked to `main`.

## Architecture Decisions

### Decision: `role` becomes `text` + CHECK; the `user_role` enum is dropped

**Verified, not assumed** (the proposal flagged this as needing verification):
`node_modules/drizzle-orm/pg-core/dialect.js:60` wraps **every pending migration file in ONE
`session.transaction(...)`**. So splitting `ALTER TYPE ... ADD VALUE` into its own migration file
**does not help** — it still shares a transaction with the CHECK rewrite, and Postgres rejects
`'CUSTOMER'::user_role` in the transaction that added it (`unsafe use of new value`). The
proposal's mitigation ("split the migration if needed") is not available under this migrator.

| Option | Verdict |
|---|---|
| `ADD VALUE` + CHECK phrased as `role <> 'ADMIN'` (never names the new literal) | Works, but leaves a permanent landmine: any future migration that names a newly added enum value fails, and the file split that authors will reach for cannot save them. Enum values are also unremovable, so the rollback stays "irreversible-ish". |
| `ADD VALUE` + `role::text IN (...)` in the CHECK | Relies on unspecified volatility tolerance for an I/O cast inside a CHECK. Rejected as unproven. |
| **Chosen: `ALTER COLUMN role TYPE text` + `DROP TYPE user_role` + CHECK** | Transaction-safe with zero enum literals, matches this project's own precedent for anything the product can widen (`plan.kind`, `sales_order.status`, `wallet_entry.kind`), and makes slice 1 **fully reversible** — the down migration is a CHECK swap, not an orphaned type. |

`platform-foundation`'s "role is closed by specification, so it is an enum" is superseded by
evidence: the product just widened it. Consequences: `identity.schema.test.ts:73` (expects
`invalid input value for enum user_role`) becomes a CHECK-violation assertion, and
`drizzle-users-repository`/`drizzle-sessions-repository` narrow `row.role` through the existing
`isUserRole()` guard — the same shape as `status as SalesOrderStatus` in ordering.

```sql
-- 0007 (forward, statement-broken, one transaction — safe)
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";
ALTER TABLE "users" DROP CONSTRAINT "users_reseller_requires_tier";
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;
DROP TYPE "public"."user_role";
ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('ADMIN','RESELLER','CUSTOMER'));
ALTER TABLE "users" ADD CONSTRAINT "users_tier_matches_role" CHECK (
     ("role" IN ('RESELLER','CUSTOMER') AND "price_tier_id" IS NOT NULL)
  OR ("role" = 'ADMIN'                  AND "price_tier_id" IS NULL));
```

The down file is one `DO $$ ... END $$` block (`migrator.ts:114` runs the file as a single
statement — established by `0006_sales_orders.down.sql`). It `RAISE EXCEPTION`s if any
`role = 'CUSTOMER'` row exists, then recreates the enum and both original constraints.
Recreating the type and casting to it *in the same transaction* is explicitly permitted.

### Decision: `sales_order` gains a buyer discriminator; no `customer_order` table

**The reseller invariant, proved unweakened.** `UNIQUE(wallet_entry_id)` is untouched and stays
global — Postgres uniqueness ignores NULLs, so "one ledger entry funds exactly one order" is
enforced identically. Only `NOT NULL` is relaxed, and it is *re-imposed conditionally*:

```sql
buyer_kind          text NOT NULL,
provider_account_id uuid NULL REFERENCES provider_account(id) ON DELETE RESTRICT,

CONSTRAINT sales_order_buyer_kind_check CHECK (buyer_kind IN ('RESELLER','CUSTOMER')),

CONSTRAINT sales_order_funding_check CHECK (
     (buyer_kind = 'RESELLER' AND wallet_entry_id IS NOT NULL AND provider_account_id IS NULL)
  OR (buyer_kind = 'CUSTOMER' AND wallet_entry_id IS NULL     AND provider_account_id IS NOT NULL)),

-- both closed status CHECKs REDESIGNED TOGETHER, not appended to:
CONSTRAINT sales_order_status_check
  CHECK (status IN ('AWAITING_PAYMENT','PENDING','FULFILLED','CANCELLED')),

CONSTRAINT sales_order_status_buyer_check CHECK (
     (buyer_kind = 'RESELLER' AND status IN ('PENDING','FULFILLED','CANCELLED'))
  OR (buyer_kind = 'CUSTOMER')),

CONSTRAINT sales_order_fulfilled_at_check
  CHECK ((status = 'FULFILLED') = (fulfilled_at IS NOT NULL))
```

The set of **rejected reseller rows is identical to today's**: `funding_check` restores NOT NULL
for `buyer_kind='RESELLER'`, `UNIQUE` is unchanged, and `status_buyer_check` makes
`AWAITING_PAYMENT` unreachable for a reseller — so the new status cannot park an unpaid reseller
order. It is also *strictly stronger*: a customer order now **cannot reference a wallet entry at
all**, so it can never spend a reseller's ledger row. `fulfilled_at_check` is rewritten as one
boolean equality — logically identical to the two-disjunct original (`status` is `NOT NULL`, so
neither side is nullable), and it now covers four statuses without enumerating them.

**Rejected: a separate `customer_order` table.** ~80% of the columns are shared (plan,
`plan_price_id` anchor, `placed_by`, status, `fulfilled_at`, note); `provider-fulfillment` will
fulfil both kinds, so it would need two fulfilment paths, two tenant filters, two contract
suites, and two id namespaces for `payment-gateway` to reference. Its only real advantage — that
a relaxed CHECK could later admit a malformed row — is answered by the CHECKs above being
*total*: every combination of `buyer_kind × wallet_entry_id × provider_account_id × status` is
decided.

**`payment-gateway` seam.** Settlement is one guarded UPDATE, the same concurrency shape as the
existing `fulfilOrder` (`drizzle-ordering-repository.ts:195`):
`UPDATE sales_order SET status='PENDING' WHERE id=$1 AND buyer_kind='CUSTOMER' AND status='AWAITING_PAYMENT'`
— idempotent by rows-affected. Because `funding_check` is keyed on `buyer_kind`, a future
`payment(sales_order_id UNIQUE, ...)` table (the customer-side mirror of `wallet_entry_id UNIQUE`)
lands **without rewriting any constraint here**.

### Decision: ADMIN-acting-as-customer is a scope *downgrade*, not a wider admin scope

ADMIN's "sees all" does **not** already cover writes. Writes take their tenant id from the use
case, not the scope (`placeOrder(command.resellerId)`), so an admin scope plus a caller-supplied
tenant id is exactly the IDOR-by-parameter hole `platform-foundation` closed. Rejected.

Chosen: `dal.ts` gains **`actAsCustomer(targetUserId)`** — the only other minter. It re-verifies
the session row is `ADMIN`, loads the target from the DB, asserts `role='CUSTOMER'` and
`deactivated_at IS NULL`, and mints a **customer scope** for the target carrying
`actingAdminUserId`. The acting admin therefore ends up *narrower* than an admin scope: every
query is filtered to that one customer's tenant, no admin surface is reachable, and no other
customer is visible. The only privilege gained is "write into a tenant that is not my session's".

Audit trail costs nothing new: `placed_by` / `created_by` are written as
`scope.actingAdminUserId ?? scope.userId`, so an admin-placed customer order is already
distinguishable in the database (an ADMIN `placed_by` against a customer `reseller_id`).

Rejected: a fourth `kind: "admin-acting-as"` — it would force a fourth branch through
`tenantWhere` and every repository. As a *field* on the customer scope, it is invisible to SQL
filtering and reaches only the audit column.

### Decision: `provider-accounts` is its own module, and its column is `reseller_id`

Inside `identity/` the entity would force identity to reference catalog's `service` table, which
`eslint.config.mjs` bars outright (only `repository-factory.ts` is exempt, and only for port
types). It is a product asset, not an identity fact, and `provider-fulfillment` will grow it.

The tenant column is named `reseller_id` **on purpose**: `TableWithResellerId` is
`PgTable & { resellerId: PgColumn }` (`tenant.ts:23`), so a `tenant_id` column would be a compile
error at `tenantWhere` until the deferred mechanical rename lands. Debt named, not paid here.

```sql
provider_account (
  id uuid PK,
  reseller_id uuid NOT NULL,                                   -- the customer's tenant id
  service_id  uuid NOT NULL REFERENCES service(id) ON DELETE RESTRICT,
  panel_username text NOT NULL,        -- the REAL identifier on the provider's panel (obs #422)
  label text NULL,                     -- optional customer-facing nickname
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,   -- ADMIN or the customer
  created_at timestamptz NOT NULL,
  archived_at timestamptz NULL )                               -- soft delete, project convention
  INDEX provider_account_tenant_idx (reseller_id, created_at)
  UNIQUE INDEX provider_account_identity_uniq (reseller_id, service_id, lower(panel_username))
    WHERE archived_at IS NULL
  CHECK provider_account_panel_username_check: length(btrim(panel_username)) > 0
```

**No** `password`, `credential`, `token`, `expires_at`, or `subscription_id` column — enforced by
a test that queries `information_schema.columns` and fails on `/pass|secret|credential|token|expir/`,
so the non-goal is a tripwire rather than a comment. The partial unique index mirrors
`plan_identity_uniq`: two Stella TV accounts for one customer are allowed (decision 3), the *same*
account registered twice is not.

## Interfaces

```ts
// identity/domain/ids.ts
export type TenantId = string;

// identity/domain/access-scope.ts — third variant
| { readonly [scopeBrand]: true; kind: "customer";
    userId: UserId; tenantId: TenantId; priceTierId: PriceTierId;
    /** null when the customer acts for itself; the ADMIN's id when acting on its behalf. */
    actingAdminUserId: UserId | null }

export function mintCustomerScope(
  userId: UserId, tenantId: TenantId, priceTierId: PriceTierId,
  actingAdminUserId: UserId | null = null): AccessScope

/** The ONE reader of a scope's tenant. Exhaustive switch: a fourth variant
 *  fails to compile here, and only here. */
export function tenantIdOf(scope: AccessScope): TenantId | null {
  switch (scope.kind) {
    case "admin":    return null;              // sees all
    case "reseller": return scope.resellerId;
    case "customer": return scope.tenantId;
  }
}
```

```ts
// shared/db/tenant.ts — binary switch → admin-vs-tenant
export function tenantWhere(table: TableWithResellerId, scope: AccessScope): SQL | undefined {
  const tenantId = tenantIdOf(scope);
  return tenantId === null ? undefined : eq(table.resellerId, tenantId);
}
```

The proposal's stated direction **validated against real code, with one correction**: today's
`if (scope.kind === "admin") return undefined; return eq(table.resellerId, scope.resellerId)`
narrows to the single remaining variant. Keeping that early-return shape and reaching for a
renamed field would silently accept a future variant; the exhaustive `switch` in `tenantIdOf` is
what makes a fourth scope a compile error. That is the design requirement, not the `if`.

`repository-factory.ts` carries a **live footgun** that must be inverted, not extended: today
`RepoFor<S> = S extends {kind:'reseller'} ? Reseller… : Admin…`, so a customer scope would
receive the **unscoped admin catalog**.

```ts
export type RepoFor<S extends AccessScope> =
  S extends { kind: "admin" } ? AdminCatalogRepository : ResellerCatalogRepository;
// for(): admin → adminRepository; everything else → new DrizzleResellerCatalogRepository(db, scope.priceTierId)
```

Both non-admin variants carry `priceTierId`, so the customer's retail price resolves through the
*same* tier-bound adapter — the proposal's "reuse `price_tier` + `plan_price`, zero new pricing
machinery" holds at the type level, and a cross-tier read stays inexpressible.
`ResellerCatalogRepository` now also serves customers; renaming it to `SellableCatalogRepository`
is accepted debt, deferred with the `reseller_id` rename.

## Route Access

`route-access.ts`: `CUSTOMER_HOME = "/account"` (English route, Spanish copy — existing practice),
`homeFor` becomes an exhaustive switch, and `ROLE_GATED_PREFIXES` becomes
`[[/admin, ADMIN], [/panel, RESELLER], [/account, CUSTOMER]]`.

`/panel` moving from `"ANY"` to `"RESELLER"` is a deliberate behaviour change beyond the customer
fix: `app/panel/page.tsx:24` calls only `verifySession()`, so an ADMIN can browse it today and
`tenantWhere` returns *no filter* for an admin scope — the reseller wallet and order views render
unfiltered. Admins are now redirected to `/admin`, their actual home.

## Data Flow

```
customer buys                      ADMIN buys FOR a customer
─────────────                      ─────────────────────────
verifySession()                    requireRole('ADMIN')
  ↓ getScope() → customer scope      ↓ actAsCustomer(targetUserId)   ← DB-validated, server-side
  ↓ (actingAdminUserId = null)       ↓ customer scope + actingAdminUserId
  └──────────────┬────────────────────┘
                 ↓ repo.for(scope) → tier-bound catalog (scope.priceTierId)
                 ↓ resolve plan_price for the chosen duration_days (30/90/180/365)
                 ↓ placeCustomerOrder(providerAccountId)
                 → INSERT sales_order (buyer_kind='CUSTOMER', status='AWAITING_PAYMENT',
                     wallet_entry_id NULL, placed_by = actingAdminUserId ?? userId)
                 → NO wallet_entry row  ─────────────→  seam consumed by `payment-gateway`
```

## File Changes

| File | Action | Description |
|---|---|---|
| `domain/user-role.ts` | Modify | Third literal + `isUserRole` guard |
| `domain/ids.ts` | Modify | `TenantId` |
| `domain/access-scope.ts` | Modify | Customer variant, `mintCustomerScope`, `tenantIdOf`, `ScopeRole` |
| `shared/db/tenant.ts` | Modify | Delegate to `tenantIdOf` |
| `application/dal.ts` | Modify | Mint customer scope; add `actAsCustomer` |
| `application/auth/route-access.ts` | Modify | `/account`, `/panel` → RESELLER, exhaustive `homeFor` |
| `application/admin/provision-customer.ts` | New | Mirrors `provision-reseller.ts` |
| `domain/user-provisioning.ts` + both adapters | Modify | `createCustomer` |
| `infrastructure/identity.schema.ts` | Modify | `role: text`, drop `pgEnum`, two rewritten CHECKs |
| `infrastructure/repository-factory.ts` | Modify | Invert `RepoFor`; tier-bound for every non-admin |
| `infrastructure/drizzle-{users,sessions}-repository.ts` | Modify | Narrow `row.role` via `isUserRole` |
| `src/modules/provider-accounts/**` | New | Domain, schema, port, both adapters, contract suite |
| `src/modules/ordering/**` | Modify | `buyer_kind`, `provider_account_id`, `AWAITING_PAYMENT`, customer order use case |
| `drizzle/0007…0009` + `down/` | New | One migration per slice, each with a single-statement `DO` down |
| `app/admin/customers/**`, `app/account/**` | New | ADMIN provisioning + act-as; customer panel |
| `eslint.config.mjs` | Modify | `provider-accounts` zone, mirroring wallet/ordering |
| `src/modules/wallet/**` | Untouched | Decision 5 |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `tenantIdOf` exhaustiveness; `decideRouteAccess` per role incl. customer→`/panel` and admin→`/panel` negatives; `provisionCustomer` rules; customer order rejects a submitted price | Vitest, pure |
| Type | A customer scope must NOT type-check as `AdminCatalogRepository` | `tests/types/access-scope-negative.ts` + `tsc --noEmit` |
| Repository contract | One suite, both adapters: customer↔customer and customer↔reseller isolation on `provider_account` and `sales_order` | PGlite, mirroring `users-isolation.contract.test.ts` |
| Schema (RED first) | Tier-less CUSTOMER, tier-bearing ADMIN, tier-less RESELLER all rejected; reseller order without a wallet entry rejected; reseller order at `AWAITING_PAYMENT` rejected; customer order with a wallet entry rejected; **reused wallet entry still rejected — pre-existing test passes unmodified**; `provider_account` has no credential-shaped column | PGlite |
| Migration | Apply + roll back 0007–0009 on empty; 0007 down raises when a CUSTOMER row exists | PGlite round-trip |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution |
| Git repository selection | N/A — no VCS automation |
| Commit state / Push state / PR commands | N/A — no shell, subprocess, or PR automation |

The one boundary this change touches is HTTP routing (`route-access.ts`), covered by the Route
Access section and its per-role RED tests rather than by these shell/VCS rows — same treatment as
`platform-foundation/design.md`.

## Migration / Rollout

| Slice | Migration | Rollback |
|---|---|---|
| 1 — identity + tenancy | `0007_customer_role` (role→text, CHECK rewrite) | Clean: `DO` block restores the enum + both CHECKs; raises if a CUSTOMER row exists |
| 2 — provider accounts | `0008_provider_account` (+ `ENABLE ROW LEVEL SECURITY`, hand-added per 0006) | `DROP TABLE provider_account` |
| 3 — purchase seam | `0009_customer_orders` (columns + four CHECKs; existing rows backfilled `buyer_kind='RESELLER'` **before** the CHECKs are added) | Restores the two original CHECKs; raises if a CUSTOMER order exists |

Backfill order inside 0009 matters: `ALTER TABLE ADD COLUMN buyer_kind text` → `UPDATE ... SET
buyer_kind='RESELLER'` → `SET NOT NULL` → `ADD CONSTRAINT`. Adding the CHECK first fails
validation against existing rows. Every new table gets `ENABLE ROW LEVEL SECURITY` by hand —
drizzle-kit never emits it and `0004_rls_lockdown` does not cover future tables.

Prerequisite: a retail `price_tier` row must exist before any customer can be provisioned.

## Open Questions

- [ ] Confirm PGlite 0.5.4 accepts `ALTER COLUMN ... TYPE text USING` plus `DROP TYPE` inside the
      migrator's single transaction — the whole enum decision rests on it. Prove it in slice 1's
      first RED test, before authoring 0007.
- [ ] Does an ADMIN acting for a customer need to be surfaced in the customer's own order list
      ("placed by support"), or is the `placed_by` column enough for now? Product call, not blocking.
