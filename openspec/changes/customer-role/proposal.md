# Proposal: Customer Role

First of four sequenced changes in the customer/fulfilment/payments pivot:
**`customer-role`** → `volume-pricing` → `payment-gateway` → `provider-fulfillment`.
This change is the dependency root: it defines *who* a customer is, *what they
own*, and *the shape of the purchase they start*. It does not build Binance Pay
and it does not build provider-panel automation.

## Supersession of `platform-foundation` non-goals

`openspec/changes/platform-foundation/proposal.md:24` records a **permanent**
product non-goal that this change formally overturns:

| Superseded | Was | Now |
|---|---|---|
| **End-customer role** | "Only ADMIN and RESELLER are users. A reseller's own customers are not modeled at all." | A third first-class role, `CUSTOMER`, provisioned by ADMIN. |

The other four non-goals in that table **remain binding** and are re-affirmed here,
because this change comes close enough to each to invite resurrection:

- **No credential storage / no AES-256-GCM encryption** — `provider_account` in this
  change holds *no* panel credentials. Re-introducing encrypted credentials is
  `provider-fulfillment`'s decision to make and to justify, not a side effect of this one.
- **No expiry engine** — `provider_account` records *what the customer owns*, not a
  subscription lifecycle. No `Subscription` table, no cron, no days-remaining, no expiry job.
- **No inventory** — unchanged.
- **"Tus Cuentas Activas" table** — not rebuilt.

The `platform-foundation` hierarchy decision (`proposal.md:91`, "one level
ADMIN → RESELLER, no `parent_id`, no recursion") is **NOT superseded**. Under the
confirmed flat model it is merely widened to ADMIN → {RESELLER, CUSTOMER}. Depth
stays at one. `sdd-explore` (Engram obs #417) assumed a nested RESELLER → CUSTOMER
hierarchy and named it the pivot's top risk; that assumption was corrected by the
maintainer (obs #419) and **the nesting risk does not apply to this change**.

## Settled product decisions carried in (not open)

| # | Decision | Consequence |
|---|---|---|
| 1 | **Flat tenancy.** CUSTOMER and RESELLER are both direct tenants of ADMIN. No reseller-owns-customer edge. | No second ownership axis is needed. A customer gets its **own tenant id**, exactly as a reseller does today. |
| 2 | **ADMIN provisions customers directly.** No self-registration. | Mirror `provision-reseller.ts` → `provision-customer.ts` + an admin form. |
| 3 | **A customer owns one *or several* `provider_account` records** simultaneously (e.g. Stella TV *and* Oleada TV under one login). | New entity, in scope here — see "Approach". |
| 4 | **Purchase UX (fixed):** pick an account (or create one) → pick a duration from a fixed 1/3/6/12-month selector → see the resolved price → proceed to pay. | The payment step is a **seam** in this change: the order enters an awaiting-payment state and stops there. |
| 5 | **Customers fund their own purchases** via the gateway. Not from a reseller's wallet. | No customer wallet, no `wallet_entry` change, no new ledger kind in this change. |
| 6 | **Resellers never see customer data.** Only ADMIN has full visibility. | Falls out of (1) for free — a reseller's `tenantWhere` filter already excludes every row it does not own. |

## Intent

**Problem.** The platform can only be sold *through* a reseller. An end customer who
wants a streaming subscription has no account, no way to see a price, and no way to
buy — the owner handles them by hand, off-platform. Meanwhile the schema actively
forbids the role: `users_reseller_requires_tier`
(`identity.schema.ts:63-66`) is written as
`(role='RESELLER' AND tier IS NOT NULL) OR (role='ADMIN' AND tier IS NULL)`, so a
`CUSTOMER` row satisfies **neither** disjunct and is rejected by Postgres outright.
Adding the enum value without rewriting that CHECK produces a role nobody can be.

**Outcome.** After this change: ADMIN can create a customer; that customer can log in
to their own panel, see only their own data, register the provider accounts they hold,
choose a duration, and see the exact price they will be charged — with the order parked
in an awaiting-payment state that `payment-gateway` will later settle.

**Why now.** `payment-gateway` cannot decide *whose* payment it is settling and
`provider-fulfillment` cannot decide *whose* account it is provisioning until the
customer's identity and ownership model exist. Both are blocked on this.

## Scope

### In Scope

- **`CUSTOMER` role**: `user_role` Postgres enum value, the `UserRole` domain union
  (`domain/user-role.ts` — a hand-maintained literal union, not enum-derived), and a
  **rewrite** of `users_reseller_requires_tier` so a customer is representable.
- **Third `AccessScope` variant** + `mintCustomerScope`, minted only in
  `application/dal.ts`, and the generalisation of `tenantWhere` from a two-way switch
  to "admin sees all, every other scope filters on its own tenant id".
- **`provisionCustomer` use case** + `UserProvisioning.createCustomer` on both adapters,
  mirroring `provision-reseller.ts`, plus the ADMIN form under `app/admin/customers/`.
- **Route access**: a customer home. **Required, not cosmetic** —
  `route-access.ts:20-23` gates `/panel` as `"ANY"`, so merely adding the role would
  let every customer walk into the reseller panel.
- **`provider_account` entity** (customer-owned): which provider/service, a customer-facing
  label, timestamps. **No credentials, no expiry, no panel linkage.** Domain + schema +
  Drizzle and in-memory adapters + the shared contract suite, per the established pattern.
- **Customer purchase, up to the payment seam**: a customer-scoped order use case that
  resolves the price from the catalog at the customer's tier for the chosen duration and
  records the order as awaiting payment against a chosen `provider_account`.
- **Isolation tests per repository**, matching `users-isolation.contract.test.ts` — one
  customer MUST NOT read another customer's accounts or orders, and a reseller MUST NOT
  read any of them.

### Out of Scope (real future work, with the change that owns it)

| Deferred | Owner |
|---|---|
| Binance Pay: checkout, webhook, signature verification, settlement | `payment-gateway` |
| Marking an awaiting-payment order paid, and what happens when it is never paid | `payment-gateway` |
| Provider-panel automation, Playwright, encrypted panel credentials, background jobs | `provider-fulfillment` |
| Volume/banded pricing (`credit_price_band`) | `volume-pricing` |
| Customer self-registration, password reset, email verification | none yet — ADMIN provisions |
| A customer wallet or stored balance | none — decision 5 makes it unnecessary |
| Automated fulfilment statuses (`FAILED`, in-flight) on `sales_order` | `provider-fulfillment` |
| Physically renaming the `reseller_id` column to `tenant_id` | separate mechanical change (see Approach) |

## Capabilities

### New Capabilities

- `customer-identity`: the CUSTOMER role, ADMIN-driven provisioning, the customer's own
  tenant, its access scope, and the isolation guarantees between customers, and between
  customers and resellers.
- `provider-accounts`: a customer owns zero or more provider accounts; creation, listing,
  ownership, and the explicit absence of credentials and lifecycle.
- `customer-purchasing`: account selection → fixed duration selector → resolved price →
  an order awaiting payment. Includes the seam contract that `payment-gateway` consumes.

### Modified Capabilities

- `identity-and-tenancy`: "A user is exactly one of ADMIN or RESELLER" becomes three roles;
  the tier requirement extends to CUSTOMER; the ownership axis is restated as a generic
  tenant id rather than a reseller id.
- `authentication-session`: role-aware routing gains a third home and stops treating
  `/panel` as reachable by any authenticated user.

## Approach

### Tenancy: generalise the existing axis, do not add a second one

Flat tenancy is the whole reason this is cheap. A customer is minted **its own tenant id**
into the existing ownership column (`users.reseller_id` is already a freestanding UUID with
no FK, generated per tenant in `provision-reseller.ts:82` — not derived from `users.id`).
`tenantWhere` changes from `admin | reseller` to `admin | <any tenant scope>` and every
existing owned table keeps working unchanged.

**Rejected**: a second `customer_id` column with a union filter in `tenantWhere`. It doubles
the number of ways a query can be under-filtered, which is the leak path `platform-foundation`
called the top risk — and flat tenancy makes it unnecessary.

**Recommended follow-up, not this change**: rename the physical column
`reseller_id` → `tenant_id` across `users`, `wallet_entry`, and `sales_order`. It is a pure
mechanical rename with no behaviour change, and folding it in here would consume most of the
review budget for zero product value. This change introduces the `TenantId` type at the domain
level and documents the naming debt.

### Pricing: reuse `price_tier` + `plan_price`, do not invent a parallel concept

This is the open design question `sdd-explore` deferred, and the **recommendation is reuse**:

- The confirmed 1/3/6/12-month selector *is* `plan.duration_days` (30/90/180/365). The catalog
  already models duration as a first-class field precisely so it is never parsed from a name.
- A customer is assigned a **retail `price_tier`**, exactly as a reseller is assigned a wholesale
  one. `plan_price(plan_id, tier_id, …)` then resolves the customer's price with **zero new
  pricing machinery**, and `DrizzleResellerCatalogRepository(db, scope.priceTierId)` already
  binds the tier at construction so a cross-tier read is not expressible.
- It also makes the CHECK rewrite natural and symmetric:
  `(role IN ('RESELLER','CUSTOMER') AND tier IS NOT NULL) OR (role='ADMIN' AND tier IS NULL)`.

**Rejected**: a parallel customer-pricing table. It would duplicate the effective-dated pricing
pattern, and produce two places where a price can disagree.

Ordering reuse is **partially recommended and left for `sdd-design` to finalise**, because one
existing invariant genuinely resists it: `sales_order.wallet_entry_id` is `NOT NULL UNIQUE`
(`ordering.schema.ts:43-46`) — it is what makes double-spending a ledger entry a database
rejection. A customer order is funded by a gateway payment, not a wallet debit, so it has no
such entry. Recommended direction: extend `sales_order` with a buyer discriminator plus a
correlation CHECK (a reseller order MUST carry a wallet entry and MUST NOT be awaiting payment;
a customer order MUST NOT carry one and MUST carry a `provider_account_id`), rather than simply
making the column nullable and losing the reseller invariant. The alternative — a separate
`customer_order` table — must be weighed in design, not assumed away here. Note also that
`sales_order.status`'s CHECK and the `sales_order_fulfilled_at_check` correlation CHECK are both
closed constraints that must be **redesigned together**, not appended to.

### Layering

Unchanged from the established pattern: thin Server Action (`requireRole` → `getScope` →
build repo from scope → use case → `revalidatePath`), use case owns the rule, repository owns
SQL, contract suite runs both adapters. Strict TDD; no new npm packages.

## Business Rules

- A user is exactly one of ADMIN, RESELLER, or CUSTOMER. No other roles exist.
- A CUSTOMER MUST be assigned exactly one price tier; an ADMIN MUST have none.
- A CUSTOMER MUST NOT be owned by, visible to, or manageable by any RESELLER.
- A CUSTOMER MUST NOT read another CUSTOMER's rows. ADMIN reads all.
- Only an ADMIN MAY create a CUSTOMER account. There is no self-registration path.
- A CUSTOMER MAY own several `provider_account` records simultaneously.
- A `provider_account` MUST NOT store any credential, secret, or panel password.
- A customer purchase MUST resolve its price from the catalog at the customer's tier at
  purchase time; a submitted price MUST be rejected.
- A customer order MUST NOT debit any wallet, and MUST NOT be considered paid by this change.
- Deactivating a CUSTOMER MUST invalidate that customer's sessions (already true, restated).

## Edge Cases

- No retail price tier exists yet → a customer cannot be provisioned. Same prerequisite shape
  as `users_reseller_requires_tier` today; must be a clear message, not a constraint violation.
- A plan has no current price at the retail tier → that duration is not offered, with no
  fallback to another tier (CAT: Missing Tier Price Blocks Sale).
- Customer with zero `provider_account` records → the purchase flow must open on "create one",
  not an empty selector.
- Two accounts on the *same* provider for one customer — allowed or not? See question round.
- A customer abandons an awaiting-payment order → intentionally undefined here; `payment-gateway` owns it.
- Deactivated customer with an awaiting-payment order → the order stays for accounting; the session dies.
- A price changes between the price being shown and the order being recorded → the order anchors
  to a `plan_price_id`, as reseller orders already do.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/modules/identity/domain/user-role.ts` | Modified | Third literal in the hand-maintained union + its guard |
| `src/modules/identity/domain/access-scope.ts` | Modified | Customer variant, `mintCustomerScope`, `ScopeRole` |
| `src/modules/identity/infrastructure/identity.schema.ts` | Modified | Enum value, `users_role_check`, `users_reseller_requires_tier` rewrite |
| `src/shared/db/tenant.ts` | Modified | Two-way switch → admin-vs-tenant; `TableWithResellerId` doc |
| `src/modules/identity/application/dal.ts` | Modified | Mint the customer scope from the verified session row |
| `src/modules/identity/application/auth/route-access.ts` | Modified | Customer home; `/panel` stops being `"ANY"` |
| `src/modules/identity/application/admin/provision-customer.ts` | New | Mirrors `provision-reseller.ts` |
| `src/modules/identity/domain/user-provisioning.ts` + both adapters | Modified | `createCustomer` |
| `src/modules/identity/infrastructure/repository-factory.ts` | Modified | Customer scope → tier-bound catalog surface |
| `src/modules/provider-accounts/**` (or `identity/`— design decides) | New | Entity, port, both adapters, contract suite |
| `src/modules/ordering/**` | Modified | Customer-scoped order use case + awaiting-payment seam |
| `app/admin/customers/**`, `app/account/**` (name TBD) | New | ADMIN provisioning form; customer panel |
| `drizzle/**` + `drizzle/down/**` | New | Enum `ADD VALUE`, CHECK rewrites, `provider_account`, `sales_order` columns |
| `src/modules/wallet/**` | Untouched | Decision 5 — no customer wallet |

## Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| **Cross-customer data leak.** `tenantWhere` is today a binary admin/reseller switch; widening it is the single most dangerous edit in this change. | Medium | **High** | Widen to "admin sees all, everyone else filters on their own tenant id" — one branch, not a union of axes. An isolation contract test per repository, covering customer↔customer *and* customer↔reseller, landing in the same slice as the widening. |
| **`/panel` is gated `"ANY"`.** Adding the role without touching `route-access.ts` grants every customer the reseller panel. | **High** if unaddressed | High | Explicit in-scope item; a route-decision test per role, including the negative case. |
| **`users_reseller_requires_tier` makes CUSTOMER unrepresentable.** Not a nuisance — every insert fails. | Certain if unaddressed | High | CHECK rewrite is in scope and named in the migration task. |
| **Postgres enum `ADD VALUE`** cannot be used in the same transaction that added it on some PG versions/runners. | Medium | Medium | Verify `drizzle-kit`'s transaction behaviour before authoring; split the migration if needed. Do not discover this in production. |
| **Ordering-invariant damage (HIGH RISK — touches order/payment records).** Naively nulling `sales_order.wallet_entry_id` destroys the UNIQUE-NOT-NULL double-spend guard for resellers. | Medium | **High** | Discriminator + correlation CHECK, or a separate table; `sdd-design` MUST choose explicitly and prove the reseller invariant still holds by test. Both closed status CHECKs are redesigned together, not appended to. |
| **Payment seam drifts** from what `payment-gateway` needs. | Medium | Medium | Define the seam as an explicit spec requirement here (state, ownership, what settlement must supply) so the next change consumes a contract, not an assumption. |
| **Scope creep into fulfilment or payments.** `provider_account` invites credentials; the purchase flow invites a checkout. | **High** | Medium | The non-goals table above is binding; the re-affirmed `platform-foundation` non-goals are its backstop. |
| **Naming debt** — `reseller_id` now holds customer tenant ids. | High | Low | Documented, `TenantId` type introduced, physical rename scheduled as its own mechanical change. |

## Delivery: changed-line forecast

Budget is **800 lines**; the session's cached strategy is `single-pr`. Strict TDD is active, and
this project's last measurement found tasks-phase forecasts low by ~2× because they counted
implementation only — tests are forecast separately here.

| Slice | Impl | Tests | Total |
|---|---|---|---|
| 1. Identity + tenancy: enum + CHECK rewrite + migration, `UserRole`, customer `AccessScope`, `tenantWhere` widening, `route-access`, `provisionCustomer` + both provisioning adapters, admin form, isolation tests | ~330 | ~340 | **~670** |
| 2. `provider_account`: domain, schema + migration, port, both adapters + contract suite, customer panel shell (list + create), admin read-only view | ~330 | ~300 | **~630** |
| 3. Purchase seam: `sales_order` discriminator + awaiting-payment status + CHECK redesign + migration, customer order use case, duration selector and resolved-price UI | ~380 | ~350 | **~730** |
| **Total** | **~1,040** | **~990** | **~2,030** |

**This does not fit in one PR.** ~2,030 authored lines is roughly 2.5× the 800-line budget.
Three chained slices are proposed; slice 1 is a hard prerequisite for 2 and 3, and slice 2 is a
prerequisite for 3 (an order needs an account to point at). All three sit near the ceiling —
`sdd-tasks` should split any slice whose forecast grows.

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High
```

## Rollback Plan

Per slice — revert that slice's PR, then apply the paired `down` migration.

- **Slice 1** is the only irreversible-ish one: `ALTER TYPE user_role ADD VALUE 'CUSTOMER'`
  **cannot be dropped in Postgres** while it is referenced, and cannot be removed from an enum at
  all without recreating the type. The `down` migration therefore restores the previous CHECK and
  leaves the enum value orphaned but unused. **Rolling back after any customer row exists requires
  deleting or re-roling those rows first** — that must be stated in the migration and in tasks.
- **Slice 2** adds one new table nothing else reads; `DROP TABLE provider_account` is clean.
- **Slice 3** adds columns and rewrites two CHECKs on `sales_order`; the `down` migration restores
  the original CHECKs, which will fail if any customer order exists — same precondition as slice 1.
- No existing reseller behaviour changes, so a revert cannot corrupt reseller orders or the ledger,
  provided the reseller-side invariant tests from slice 3 are green before merge.
- Reset-everything path is unchanged: drop the Neon branch.

## Dependencies

- `platform-foundation` and `admin-catalog-panel` merged (they are).
- A **retail `price_tier` row must exist** before any customer can be provisioned. The admin
  catalog panel can already create one — no new work, but it is a real ordering prerequisite.
- No new npm packages.

### Followed by (this change is their prerequisite)

- `payment-gateway` — consumes the awaiting-payment seam defined here to settle a customer order.
- `provider-fulfillment` — consumes `provider_account` ownership semantics and adds the panel
  automation, encrypted credentials, and automated fulfilment statuses deliberately excluded here.
- `volume-pricing` — independent of this change; may later replace how a customer's price resolves.

## Success Criteria

- [ ] A `CUSTOMER` row can be inserted; the rewritten CHECK accepts it and still rejects a
      tier-less CUSTOMER, a tier-less RESELLER, and a tier-bearing ADMIN — one test each.
- [ ] An ADMIN can provision a customer from the UI, from an empty customer table.
- [ ] A customer logging in lands on the customer home and is redirected away from `/panel` and
      `/admin`, proven by test per role.
- [ ] A customer repository query for another customer's `provider_account` or order returns empty.
- [ ] A RESELLER-scoped query returns no customer rows, and no customer-facing surface is reachable
      by a reseller — proven by test.
- [ ] A customer with two `provider_account` records sees both, and can start a purchase against
      either one.
- [ ] The 1/3/6/12-month selector resolves its price from `plan_price` at the customer's tier; a
      client-submitted price is ignored, proven by test.
- [ ] A customer order is recorded awaiting payment, debits no wallet, and creates no
      `wallet_entry` row — proven by test.
- [ ] Reseller ordering is unchanged: the wallet-entry double-spend guard still rejects a reused
      entry, proven by the pre-existing test still passing unmodified.
- [ ] No credential, secret, or expiry column exists on `provider_account`.
- [ ] Migrations apply and roll back on an empty Neon branch; the enum-value caveat is documented.
- [ ] `npm test`, `npx tsc --noEmit`, and `npm run lint` pass.

## Proposal question round — OPEN

Product questions this proposal could not settle from the confirmed decisions. Each has a
working assumption already baked in above; answering may change the specs, not the shape.

1. **Two accounts on the same provider.** May one customer hold two `provider_account` records
   for the *same* provider (two Stella TV accounts), or is one-per-provider the rule?
   *Assumed: allowed — decision 3 says "one or several" without qualifying it, and a uniqueness
   constraint is far cheaper to add later than to remove.*
2. **What a `provider_account` is identified by.** A customer-chosen label only, or the actual
   username/identifier on the provider's panel? The latter is what `provider-fulfillment` will
   need to act on, and getting it wrong now means a migration then.
   *Assumed: a customer-facing label plus a provider reference, with no credential.*
3. **Customer home route and naming.** `/cuenta`, `/mi-cuenta`, `/account`? UI copy is Spanish
   (es-CO) by existing convention; route naming so far is English (`/panel`, `/admin`).
   *Assumed: an English route with Spanish copy, matching current practice.*
4. **May an ADMIN act on a customer's behalf** — create a provider account for them, or start a
   purchase for them? This is a real support-burden question, and it changes the authorization
   surface of every use case in slice 2 and 3.
   *Assumed: ADMIN reads everything but writes nothing on a customer's behalf in this change.*
5. **Does a customer see prices before choosing an account,** i.e. is there a browsable retail
   catalog, or does pricing only appear inside the purchase flow after an account is picked?
   *Assumed: the latter — decision 4's flow starts at account selection, and a browsable retail
   catalog is a second surface this budget cannot absorb.*

A second question round is available on request; answers to 1, 2, and 4 have the largest
downstream effect and would be most useful before `sdd-spec`.
