```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b1d1603a85d10d5812ca2a3ca5f6be2ba87b6bbe898e7c08a1f7afc7da99216f
verdict: fail
blockers: 0
critical_findings: 0
requirements: 20/23
scenarios: 21/24
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:c754d60970f9d96a52ea5f973ce758f814c96062a2f8e6e0275c36d78ae03937
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:c50db1e73f94a5f276fdf8384598aa8bde93b14fc9804bf3a1585417719d2739
```

## Verification Report

**Change**: platform-foundation
**Version**: N/A (4 new delta specs, no prior `openspec/specs/` entries)
**Mode**: Strict TDD
**Commit verified**: `9e996f7` on branch `feat/auth-and-login`, plus 2 untracked test files and 2 modified doc files in the working tree
**Date**: 2026-08-05
**Supersedes**: the prior report at this path (`evidence_revision: sha256:f998345f…`, `verdict: fail`, 2 CRITICAL / 8 WARNING / 5 SUGGESTION, 18/23 requirements, 19/24 scenarios). This is an independent re-verification after a remediation batch, not a re-read of that report.

### What changed since the prior verdict

| Prior finding | Status now | Basis |
|---|---|---|
| CRITICAL 1 — EB-5 "No Mutable Balance Column" had no covering test | **Closed** | `src/shared/db/schema.inspection.test.ts` re-traced and independently probed — see EB-5 detail |
| CRITICAL 2 — AUTH-1's cookie clause had no covering test | **Closed** | `src/modules/identity/application/actions.test.ts` re-traced — see AUTH-1 detail |
| WARNING 1 — hybrid artifact mirrors disagreed | **Closed** | File and Engram twin now carry the same text under the same topic key |
| WARNING 4 — undocumented UI/seed scope drift | **Record closed, coherence gap remains** | `tasks.md` Phase 6 added; `design.md` line 3 still contradicted |
| WARNING 2 | Partially addressed | TDD Cycle Evidence table exists for the remediation batch only |
| WARNING 3, 5, 6, 7, 8 and all 5 SUGGESTIONs | **Still open** | Out of scope for the remediation batch, re-confirmed live this session |
| — | **1 new WARNING** | `logout`'s row-revocation branch is not exercised by the new test — see WARNING 8 |

No production source file changed. `git diff HEAD -- src ':(exclude)*.test.ts'` is empty, confirming both RED fault-injection plants were reverted.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 71 (64 original + 7 Phase 6) |
| Tasks complete | 71 |
| Tasks incomplete | 0 |
| Requirements | 23 (EB 5, IT 7, CAT 6, AUTH 5) |
| Scenarios | 24 (EB 5, IT 8, CAT 6, AUTH 5) |

All 71 checkboxes are `[x]` (`rg -c '^- \[x\]'` → 71, `^- \[ \]` → 0). Two of them (2.4, 2.6) remain checked while their own text reads **BLOCKED** — WARNING 6.

### Build & Tests Execution

Every command below was re-executed in this session; none of the orchestrator's reported numbers were taken on assertion.

**Tests**: 176 passed / 0 failed / 1 skipped (28 files passed, 1 skipped)

```text
$ npm test               # exit 0
 Test Files  28 passed | 1 skipped (29)
      Tests  176 passed | 1 skipped (177)
   Duration  60.32s
```

The delta from the prior run is exactly +2 files and +5 tests, which reconciles to the two new files (2 tests + 3 tests) with nothing else moved. The single skip is still `tests/migrations/neon-bigint-mode.test.ts`, gated by `describe.skipIf(!databaseUrl)`.

**Build**: PASSED

```text
$ npm run build          # exit 0
Compiled successfully in 1587ms / TypeScript finished in 1678ms
Generating static pages (7/7)
Routes: / (static), /_not-found, /admin (PPR), /login (static), /panel (PPR), ƒ Proxy (Middleware)
```

Same caveat as before: `.env.local` is present and Next auto-loads it, so `DATABASE_URL` and `SESSION_SECRET` were available. The build is not independently proven database-independent — WARNING 7.

**Type check**: `npx tsc --noEmit` — exit 0.
**Linter**: `npm run lint` (eslint) — exit 0, zero errors, zero warnings.
**Coverage**: not available — no coverage provider configured; `coverage_threshold: 0`. Not a failure.

### Spec Compliance Matrix

| # | Requirement | Scenario | Test evidence | Result |
|---|-------------|----------|---------------|--------|
| EB-1 | Test Command | A failing test can be written first | `tests/smoke.test.ts:4` + 176 tests executing and reporting | ⚠️ PARTIAL |
| EB-2 | Domain Layer Has No ORM Dependency | Domain source has no Drizzle import | `eslint.config.mjs` zones; `npm run lint` exit 0 | ✅ COMPLIANT |
| EB-3 | Money Is Integer Minor Units With Currency | Construction rejects non-integer / missing currency | `money.test.ts:26,30,36,41,45` | ✅ COMPLIANT |
| EB-4 | Migrations Are Clean and Reversible | Apply and roll back on an empty branch | `round-trip.test.ts:39`; `catalog-round-trip.test.ts:43`; `identity-round-trip.test.ts:79` | ⚠️ PARTIAL |
| EB-5 | No Mutable Balance Column | Schema has no balance column | `src/shared/db/schema.inspection.test.ts:32` — 6 tables, 40 columns, `getTableConfig` | ✅ COMPLIANT |
| IT-1 | Exactly One Role Per User | Invalid role is rejected | `identity.schema.test.ts:66` (PGlite); `user-role.test.ts:5` | ✅ COMPLIANT |
| IT-2 | Globally Unique Email | Duplicate email is rejected | `identity.schema.test.ts:101` (PGlite, case-folded) | ✅ COMPLIANT |
| IT-3 | Single-Level Reseller Ownership | Row carries reseller_id, no hierarchy field | `identity.schema.test.ts:154` (PGlite `information_schema`) | ✅ COMPLIANT |
| IT-4a | Reseller Row Isolation | Reseller cannot read another reseller's rows | `users-isolation.contract.test.ts:143` × {fake, PGlite} | ✅ COMPLIANT |
| IT-4b | Reseller Row Isolation | Admin reads across all resellers | `users-isolation.contract.test.ts:158` × {fake, PGlite} | ✅ COMPLIANT |
| IT-5 | One Price Tier Per Reseller | Reseller without a tier cannot be activated | `identity.schema.test.ts:188,244` (CHECK `users_reseller_requires_tier`) | ✅ COMPLIANT |
| IT-6 | Price Tier Deletion Guard | Deleting an in-use tier is blocked | `identity.schema.test.ts:275,313,329` (FK ON DELETE RESTRICT) | ✅ COMPLIANT |
| IT-7 | Reseller Deactivation Preserves Data | Deactivated reseller's rows remain | `users-isolation.contract.test.ts:199,216` × 2; `identity.schema.test.ts:362` | ✅ COMPLIANT |
| CAT-1 | Duration Is a First-Class Field | Duration is read from duration_days | `plan.test.ts:7` | ✅ COMPLIANT |
| CAT-2 | Per-Tier Absolute Pricing | Same plan resolves different prices per tier | `catalog-repository.contract.test.ts:72` × 2; `plan-price.test.ts:17` | ✅ COMPLIANT |
| CAT-3 | Missing Tier Price Blocks Sale | Plan without a tier price is unsellable | `catalog-repository.contract.test.ts:93` × 2; `reseller-surface.contract.test.ts:182` × 2 | ✅ COMPLIANT |
| CAT-4 | Service Retirement Preserves Plans | Retired service's plans stay readable | `catalog-repository.contract.test.ts:111` × 2; `service.test.ts:8` | ✅ COMPLIANT |
| CAT-5 | Price History Is Preserved | Prior price row survives a price change | `catalog-repository.contract.test.ts:133` × 2; `plan-price.test.ts:82` | ✅ COMPLIANT |
| CAT-6 | No Inventory or Subscription Entities | No forbidden entities or credential columns | Tables: `identity-round-trip.test.ts:88` + `catalog-schema.inspection.test.ts:16,35`. Columns: `catalog-schema.inspection.test.ts:25` (catalog only) | ⚠️ PARTIAL |
| AUTH-1 | Login Issues a DB-Backed Session | Successful login creates a session | Row: `log-in.test.ts:89`. Cookie: `actions.test.ts:124` (5 flags + `expires` vs `sessions.expires_at`) | ✅ COMPLIANT |
| AUTH-2 | Deactivation Revokes Sessions | Deactivated user loses access on next request | `session-verifier.test.ts:183,203` (PGlite) | ✅ COMPLIANT |
| AUTH-3 | DAL Enforces Authorization | DAL call without a valid session is rejected | `session-verifier.test.ts:79-179` (11 tests, PGlite); `authorization.test.ts:44,48,52` | ✅ COMPLIANT |
| AUTH-4 | Proxy Performs an Optimistic Check Only | Server Action re-checks authorization independently | `deactivate-user.test.ts:118`; `route-access.test.ts` (9 tests) | ✅ COMPLIANT |
| AUTH-5 | Role-Aware Authorization | Reseller cannot perform an admin-only operation | `authorization.test.ts:28,32`; `deactivate-user.test.ts:101` | ✅ COMPLIANT |

**Compliance summary**: 21/24 scenarios compliant, 3 partial, 0 untested. 20/23 requirements fully compliant. Prior: 19/24 and 18/23.

### Re-trace of the two closed CRITICALs

#### CRITICAL 1 — EB-5 balance guard: genuinely closed, with one named limit

`src/shared/db/schema.inspection.test.ts` (41 lines) does what the remediation claims. Verified point by point rather than accepted:

- **Real introspection, not a hand-maintained list.** It filters `Object.values(schema)` with `is(value, PgTable)` — a real Drizzle type predicate, stricter than the blind `as PgTable[]` cast the older `catalog-schema.inspection.test.ts:13` uses — then reads `getTableConfig(table).columns`.
- **Non-vacuous, proven empirically.** The file's own guard only asserts `tableConfigs.length > 0`, which would not by itself rule out a ghost loop over empty `columns` arrays. I ran an independent `tsx` probe against the real barrel outside the test harness: **6 tables, 40 columns actually enumerated** (`plan` 8, `plan_price` 7, `price_tier` 5, `service` 7, `sessions` 5, `users` 8). The `userRole` pgEnum export is correctly excluded by the `is()` filter. The inner assertion therefore executes 40 times, not zero.
- **Fails closed.** The assertion is `expect(\`${config.name}.${column.name}\`).not.toMatch(/balance/i)`. A planted `balanceMinor: uuid("balance_minor")` on `users` yields `users.balance_minor`, which matches — I confirmed the regex behaviour directly in the probe. A weakened or deleted flag cannot pass. I did not re-plant the column in the repository, since this phase is verification only; the mechanism is deterministic and was checked against the live table set rather than inferred.
- **The barrel really is the single entry point — today.** `drizzle.config.ts:10` names exactly one schema: `./src/shared/db/schema.ts`, which `export *`s both module schemas. `rg 'pgTable\('` over non-test source returns exactly 6 definitions, all inside those two files. So no current module bypasses the barrel.

**Named limit (not a blocker, recorded as SUGGESTION 6).** The guard's scope is the Drizzle *definition*, not the *database*. A column added by a hand-authored SQL migration to an existing table would apply to the database and be invisible to this test. That is not hypothetical in this repo: `drizzle/down/*.down.sql` are all hand-authored, so hand-authored SQL is established practice here. The table-level equivalent *is* covered end to end — `identity-round-trip.test.ts:88` pins the exact `public` table list after applying the real migrations — so a rogue *table* would be caught; a rogue *column* on an existing table would not. Second, the guard matches on column *name*; a mutable running balance named `credit_remaining` satisfies the regex and violates the requirement's intent. Both are cheap to close and neither is a defect today.

**Verdict on CRITICAL 1: closed.** EB-5 moves from UNTESTED to COMPLIANT.

#### CRITICAL 2 — AUTH-1 cookie flags: genuinely closed, and the mocks do not hollow it out

The direct question posed to this verification was whether mocking `next/headers` reduces the cookie assertion to asserting against the mock. **It does not, and the distinction is structural, not a judgement call.**

The five asserted attributes are constructed in production code, at `src/modules/identity/application/actions.ts:77-85`:

```ts
cookieStore.set(SESSION_COOKIE, result.token, {
  httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: result.expiresAt,
});
```

The fake at `actions.test.ts:60-70` implements `set` as `cookieSets.push({ name, value, options })` and nothing else. It **originates no value**; it is a sink that records the object the real `login` action passed. `expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" })` therefore reads production bytes. Flip `httpOnly` to `false` in `actions.ts` and the assertion fails; delete the key entirely and `toMatchObject` still fails, because it requires the key to be present with that value. This is a spy, not a stub of the behaviour under test — the difference between "asserting against the mock" and "asserting through the mock."

The other two mocks are equally non-hollowing: `@/shared/db/client` is redirected to the same PGlite instance the rest of the identity suite uses, so the test still runs **real** migrations, **real** production-parameter argon2id (`NodeRsArgon2Hasher(PRODUCTION_HASHER_PARAMS)` at `:100`), real jose signing, and a **real** `SELECT expires_at FROM sessions` at `:142` that must return exactly one row — no SQL and no business logic is faked. `server-only` is stubbed to `{}` purely because `node_modules/server-only/index.js` throws unless the bundler sets the `react-server` export condition; it gates nothing this test asserts.

What the test does **not** prove, stated plainly: that Next's real cookie store serialises those options into a correct `Set-Cookie` header. That is framework behaviour, outside this change's control, and not reachable from any unit or integration layer here — closing it would require an E2E tier that does not exist. It is not a gap in the change.

Mock/assertion ratio: 3 `vi.mock` vs 11 `expect()` in the file — well under the 2× mock-heavy threshold in `strict-tdd-verify.md`, so the deviation does not trip that guard either. Suite-wide `vi.mock` count is 3, confined to this one file.

**Verdict on CRITICAL 2: closed.** AUTH-1 moves from PARTIAL to COMPLIANT. Two residual seams are recorded as SUGGESTION 7 and 8, and one real coverage gap in the *same* file is recorded as WARNING 8 below.

### Detail on the three remaining PARTIAL entries

**EB-1 (PARTIAL, unchanged)** — 176 tests execute and report through `npm test`, so the runner demonstrably works. The scenario's literal claim is that Vitest reports an *intentionally failing* test as a failure rather than a runner error; `tests/smoke.test.ts:9` is `expect(true).toBe(true)` and nothing standing proves failure reporting. Worth noting the remediation's own fault-injection cycles were a live demonstration of exactly this, but they were transient by design and left no artifact. Non-blocking.

**EB-4 (PARTIAL, unchanged)** — `round-trip.test.ts:39` proves apply/rollback against throwaway fixtures and asserts `public` reaches zero tables. For the real product schema, `identity-round-trip.test.ts:122` deliberately asserts the opposite (`userRoleTypeExists` is `true` after rollback), because the single-statement down-migration constraint leaves the `user_role` enum behind. Documented deviation 1, still holds, still tripwired. Non-blocking.

**CAT-6 (PARTIAL, unchanged)** — The forbidden-*table* half is fully covered for the complete schema. The forbidden-*credential-column* half still scans catalog only (`catalog-schema.inspection.test.ts:25`), and identity was never given the equivalent check its own header calls for. The remediation added a whole-barrel column scanner but pointed it only at `/balance/i`, so this is now a one-line fix that was not taken — see SUGGESTION 2. `users.password_hash` is the user's own credential, which the spec permits (it forbids credentials "for a streaming account"), so there is no defect today.

### Correctness (Static Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| Password hashing | ✅ Implemented | argon2id via `@node-rs/argon2`, PHC string, params injected through a port |
| Session signing | ✅ Implemented | jose HS256, algorithm list pinned, secret read in one module, ≥32-byte guard |
| DB-backed sessions | ✅ Implemented | `sessions` table matches the design DDL exactly |
| Revocation on deactivation | ✅ Implemented | `deactivateUser` + `verifySessionFromToken` reject revoked / expired / deactivated |
| Revocation on logout | ⚠️ Implemented, untested | `actions.ts:95` `revoke(session.sessionId)` — see WARNING 8 |
| Tenant isolation | ✅ Implemented | `tenantWhere` type-requires a `reseller_id` column; contract suite on fake and PGlite |
| Cookie flags | ✅ Implemented and tested | `actions.test.ts:124` asserts all five attributes against production-constructed values |
| No balance column | ✅ Holds and guarded | 40 columns scanned per run against `/balance/i` |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| `AccessScope` opaque branded token minted only by the DAL | ✅ Yes | Brand is a real `Symbol()` — deviation 3, same type-level guarantee |
| RLS rejected, schema stays RLS-ready | ✅ Yes | Every tenant row carries `reseller_id`; no policy migration attempted |
| `plan_price` append-only and individually addressable | ✅ Yes | `effective_from`/`effective_to` + `plan_price_current_uniq` partial unique index |
| `Money` is a frozen plain object, never a class | ✅ Yes | `money.test.ts:159,166,174` |
| App-side identifier generation | ✅ Yes | No DB defaults on `id`; `crypto.randomUUID()` at the call sites |
| `role` enum, `plan.kind` text + CHECK | ✅ Yes | `userRole` pgEnum + redundant `users_role_check` |
| Hand-authored down migrations | ⚠️ Partial | Single-statement constraint means `user_role` survives rollback — deviation 1 |
| DAL uses `cache()` and never `"use cache"` | ✅ Yes | Enforced and documented at `dal.ts:24-32` |
| `proxy.ts` optimistic only, no DB | ✅ Yes | No database import; documented accepted property |
| Catalog isolation surface is the TIER, not `reseller_id` | ✅ Yes | Deviation 4 confirmed |
| Single schema barrel is drizzle-kit's only entry point | ✅ Yes | `drizzle.config.ts:10`; all 6 `pgTable` definitions reachable through it |
| `users` DDL matches design | ❌ No | `display_name` and `updated_at` still absent; `reseller_id` present but unlisted in the design DDL — WARNING 2. Re-confirmed by live introspection: `users` has exactly `id, email, password_hash, role, reseller_id, price_tier_id, deactivated_at, created_at` |
| "Nothing user-visible ships" | ❌ No | Nine UI files shipped; now *documented* in `tasks.md` Phase 6 but the design text is unchanged — WARNING 3 |

### Documented Deviations — re-checked

| # | Deviation | Still holds? | Acceptable? |
|---|---|---|---|
| 1 | Down-migration single statement; `user_role` survives rollback | ✅ Yes — `identity-round-trip.test.ts:122` | Acceptable; tripwired and documented. Runbook note still owed (SUGGESTION 5) |
| 2 | `updated_at` missing on `users` | ✅ Yes — confirmed by live introspection | Acceptable to defer; the note was widened this batch to name `display_name` too |
| 3 | `AccessScope` brand is a real `Symbol()` | ✅ Yes (`access-scope.ts:14`) | Acceptable — proven by the negative fixture |
| 4 | Catalog tables not reseller-scoped; isolation surface is the TIER | ✅ Yes | Acceptable — matches the design rationale |
| 5 | PGlite vs Neon SQLSTATE divergence (23001 vs 23503) | ✅ Yes | Acceptable — assertions match constraint names |
| 6 | RESELLER fixtures require an assigned price tier | ✅ Yes | Acceptable — consequence of a spec-required CHECK |
| 7 | UI + admin seed shipped against "Nothing user-visible ships" | ✅ Yes | Now recorded in `tasks.md` Phase 6 rather than hidden — WARNING 3 |
| 8 | Three `vi.mock` calls in `actions.test.ts` | ✅ Yes | **Acceptable** — assessed in full above; the mocks are sinks and substitutions, not fakes of asserted logic |

None of the eight is a defect. Deviation 1 is the exception on blocking: it is the direct cause of EB-4's PARTIAL status, so it does bear on archive readiness — see the Verdict. The other seven do not.

### Artifact Mirror Reconciliation (hybrid store)

| Artifact | File | Engram | Agree? |
|---|---|---|---|
| `apply-progress` | `openspec/changes/platform-foundation/apply-progress.md` | obs #235, topic `sdd/platform-foundation/apply-progress`, 14 revisions | ✅ Yes — text compared, identical opening status, slice tables, remediation section and deviation list; both in English |
| `tasks` | `tasks.md` (+14 lines, Phase 6) | obs #233 | ⚠️ Engram twin is a summary, not a mirror — acceptable by its own design, but Phase 6 is not reflected in it |
| `spec` | 4 `specs/*/spec.md` files | obs #231 | ✅ Yes |
| `verify-report` | this file | obs to be written | ✅ (this write) |

The `apply-progress.md` diff is `+119/-8`; every one of the 8 deleted lines is a stale line replaced by a superseding one (the slice-4-only status header, the "Next: Slice 5a" pointer, the narrow `updated_at` deviation note now widened, the slice-4 rollback heading now scoped). Content was extended, not overwritten — the claim holds.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ⚠️ | A "TDD Cycle Evidence" table now exists, but **only** for the remediation batch. Slices 1–5b still have Task/Status/Evidence tables with no RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR columns |
| All tasks have tests | ✅ | Every RED task maps to an existing test file; 29 test files present |
| RED confirmed (tests exist) | ✅ | 29/29 verified on disk; the 2 new files verified as the +2 in the run |
| GREEN confirmed (tests pass) | ✅ | 176/176 pass on execution, exit 0; 1 environment-gated skip |
| Triangulation adequate | ✅ | Contract suites run twice (fake + PGlite); `money.test.ts` 6 rejection cases; `session-token.test.ts` 5 rejection modes; `actions.test.ts` covers success, failure and logout paths |
| Safety Net for modified files | ⚠️ | Reportable for the remediation batch only (full suite + tsc + lint re-run, recorded); not reconstructible for slices 1–5b |

**TDD Compliance**: 4/6 checks passed, both remaining gaps being reporting gaps in `apply-progress.md` rather than evidence that TDD was skipped. Improved from the prior report, where the evidence table was entirely absent.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure, no I/O) | ~76 | 12 | Vitest |
| Integration (real Postgres via PGlite, real argon2, real jose) | ~100 | 16 | Vitest + `@electric-sql/pglite` + `drizzle-orm/pglite` |
| Component (React) | **0** | **0** | RTL + jsdom + jest-dom installed, **unused** |
| E2E | 0 | 0 | not installed |
| **Total** | **176 passed + 1 skipped** | **29** | |

The integration tier remains genuinely strong. The suite's zero-mock record is now 3 mocks in 1 of 29 files, all in a single framework-boundary test that has been assessed and accepted. The component tier is still entirely absent.

### Changed File Coverage

Coverage analysis skipped — no coverage provider configured and `coverage_threshold` is 0.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `tests/smoke.test.ts` | 9 | `expect(true).toBe(true)` | Tautology | WARNING (scoped, see note) |
| `src/modules/identity/application/actions.test.ts` | 134 | `expect(value.length).toBeGreaterThan(0)` | Non-empty check without asserting the value *is* the jose token carrying the session id | SUGGESTION |
| `src/modules/identity/application/actions.test.ts` | 129 | `.rejects.toThrow()` | Untyped throw assertion; does not pin the redirect target | SUGGESTION |
| `src/modules/identity/application/actions.test.ts` | 164-166 | `logout()` test | Describe title claims the row is cleared; the branch that clears it never runs | WARNING 8 |

Note on the smoke tautology: the strict-TDD default for a tautology is CRITICAL. That rationale does not apply here — the file's declared subject is the harness, its comment disclaims production coverage, and it gates no requirement. Held at WARNING with the reasoning stated, unchanged from the prior report.

Otherwise clean. The new `schema.inspection.test.ts` was specifically audited for the ghost-loop pattern (assertions inside a loop over a possibly-empty collection) and cleared by empirical probe — 40 iterations, not zero. `expect(...).not.toBeNull()` remains paired with a value assertion at every one of its 12 sites.

**Assertion quality**: 0 CRITICAL, 2 WARNING, 2 SUGGESTION.

### Quality Metrics

**Linter**: ✅ No errors, no warnings (`npm run lint`, exit 0).
**Type Checker**: ✅ No errors (`npx tsc --noEmit`, exit 0), which also validates the eight fail-closed `@ts-expect-error` proofs in `tests/types/access-scope-negative.ts`.

### Issues Found

**CRITICAL**

None. Both prior CRITICALs were independently re-traced and are closed.

**WARNING**

1. **The TDD Cycle Evidence table covers the remediation batch only.** Strict TDD was active for the entire change, but slices 1–5b still have no RED/GREEN/TRIANGULATE/SAFETY NET/REFACTOR record. Scoped to WARNING for the same reason as before — the substance was verified directly by execution — but the archived record will understate how the bulk of the change was built. *Carried forward, improved.*

2. **`users` schema still drifts from the design DDL in three ways.** Live introspection this session confirms `users` carries exactly `id, email, password_hash, role, reseller_id, price_tier_id, deactivated_at, created_at`. The design lists `display_name text NOT NULL` and `updated_at timestamptz NOT NULL`, neither present; `reseller_id` is present but absent from the design's `users` DDL, though IT-3 and `tenantWhere` require it, so the design DDL is what is wrong on that point. The deviation note was widened to cover `display_name` this batch, which is an improvement, but the drift itself is unfixed and needs a 0004-class migration plus a design amendment. *Carried forward, correctly out of the remediation's scope.*

3. **`design.md`'s "Nothing user-visible ships" is still contradicted, now in writing.** The reporting half is fixed: `tasks.md` Phase 6 lists all nine UI files and the seed script as explicit, marked-complete tasks with a note cross-referencing the design line. The coherence half is not: `design.md` line 3 still says the opposite of what shipped. Recording a contradiction is better than hiding it, and the remediation chose the honest option, but archiving both documents as-is freezes a self-contradicting design record. Amend the design line or split the UI into its own change. *Downgraded from the prior WARNING 4 — record closed, coherence gap open.*

4. **Zero component tests despite the tooling being installed.** `fd -g '*.test.tsx'` returns nothing. `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/dom` and `jsdom` were installed in slice 1 (task 1.2) and remain unused. The nine UI files have no automated coverage at all; under Strict TDD they were written without a RED step. This did not get worse, but it is the largest untested surface heading into archive. *Carried forward.*

5. **Tasks 2.4 and 2.6 are checked `[x]` while their own text reads BLOCKED.** Unchanged. Both concern real-Neon behaviour. `.env.local` now holds a real `DATABASE_URL`, so 2.4 is no longer blocked in practice — `tests/migrations/neon-bigint-mode.test.ts` self-skips only because Vitest does not auto-load `.env.local`; exporting `DATABASE_URL` and running that one file would close it. Nothing was run against the live database during this verification. *Carried forward.*

6. **Review workload has grown further past budget.** The committed branch diff against `main` is 60 files, 4,298 insertions and 114 deletions; excluding the lockfile and generated drizzle snapshots, **3,101 authored changed lines**, plus 209 uncommitted lines in the two new test files — roughly **3,310 against an 800-line budget, about 4.1×** (was 3.9×). The session resolved `delivery_strategy: single-pr`, which is a valid override, but `tasks.md` still records "Delivery strategy: ask-on-risk" and "Chain strategy: pending" at lines 17-18 and 22, contradicting the resolved decision. **This is the one finding that became more severe**, though only marginally and only in magnitude. *Carried forward, slightly worse.*

7. **Build evidence is still not database-independent.** Re-confirmed this session: `npm run build` passed with `.env.local` present and auto-loaded by Next, supplying `DATABASE_URL` and `SESSION_SECRET`. `src/shared/db/client.ts` is a lazy memoized factory written precisely so the build needs no database, and no page collected data through it, but the property was not isolated experimentally. Nothing was provisioned. *Carried forward.*

8. **NEW — `logout`'s row-revocation branch is never exercised, and the test that appears to cover it does not.** `actions.test.ts:160` is titled *"logout (AUTH-1: clearing the cookie clears the row, not only the client copy)"*, but the fake cookie jar at `:68` returns `get: () => undefined` unconditionally. `logout` calls `getSession()` (`actions.ts:91`), which reads `(await cookies()).get(SESSION_COOKIE)?.value` at `dal.ts:51` and therefore always resolves to `null` in this test, so the `session !== null` guard short-circuits and `revoke(session.sessionId)` at `actions.ts:95` never runs. The test proves only that the cookie is deleted. The revocation itself — the security-bearing half of logout, and the comment at `actions.ts:92-94` explains exactly why it matters — has zero coverage. Not CRITICAL: no spec scenario names logout revocation (AUTH-2 covers deactivation-driven revocation and is properly proven at `session-verifier.test.ts:183,203`), and the code is correct on inspection. But the test title overclaims, which is the kind of thing that reads as coverage in an archived record and is not. Fix: have the fake jar return the cookie written by the preceding `login`, then assert `sessions.revoked_at IS NOT NULL`.

**SUGGESTION**

1. Rewrite `tests/smoke.test.ts` to assert something real about the harness, or retire it now that 176 behavioural tests prove the runner. *(Carried.)*
2. Point the new whole-barrel scanner at the credential regex as well as `/balance/i`. It already enumerates all 40 columns of all 6 tables; adding `/(username|password|credential|secret)/i` with `users.password_hash` allow-listed closes CAT-6's PARTIAL status in one line. The remediation built the mechanism and did not use it for this. *(Carried, now much cheaper.)*
3. Add thin tests for the two remaining untested request-path entry files, `dal.ts` and `proxy.ts`. `actions.ts` is now covered. *(Carried, reduced from three files to two.)*
4. Configure a coverage provider so changed-file coverage becomes measurable. *(Carried.)*
5. Add a runbook note that rolling back the identity migration and re-applying to the same database fails with `type user_role already exists`; a fresh database or a manual `DROP TYPE user_role` is required. *(Carried.)*
6. **NEW** — Promote the balance guard from schema-definition scope to database scope: after `migrate()` in a PGlite suite, query `information_schema.columns` for `/balance/i`. That closes the hand-authored-migration hole and, because the same query returns names, is also where a semantic check (a running balance under a different name) would live.
7. **NEW** — In `actions.test.ts:134`, verify the cookie value rather than only its length: `jwtVerify(value, key)` and assert the `sid` claim equals the persisted `sessions.id`. AUTH-1's "signed with `jose` carrying the session id" clause is currently joined across two files by inspection of `actions.ts:77` passing `result.token`.
8. **NEW** — In `actions.test.ts:129`, assert the redirect target rather than a bare `.rejects.toThrow()`. The role ternary at `actions.ts:87` (`ADMIN_HOME` vs `RESELLER_HOME`) has no coverage; a regression sending a RESELLER to `/admin` would pass this test, and `route-access.test.ts` does not cover it because `login` does not call `decideRouteAccess`.

### Verdict

**FAIL (envelope) / PASS WITH WARNINGS (substance)** — 0 CRITICAL, 0 blockers, 8 WARNING, 8 SUGGESTION, 20/23 requirements and 21/24 scenarios.

**The change is not archivable yet, and the reason is not the remediation.** Both blocking findings from the prior verdict are genuinely closed. What blocks archive now is the envelope contract itself: `gentle-ai sdd-verify-validate` admits `verdict: pass` only when requirement and scenario coverage is complete. It denied both `pass` and `pass_with_warnings` against the honest counts with *"passing verdict contradicts failing or incomplete evidence"*, and admitted `fail`. Three scenarios remain PARTIAL, so the machine verdict is `fail` even though there is no CRITICAL finding and no defect. Inflating the counts to 23/23 and 24/24 would have produced an admitted `pass` — that was tested and confirmed — and would have been a fabrication. It was not done.

#### What the remediation actually achieved

Both CRITICALs were re-traced independently rather than accepted on assertion, and both are closed.

- **EB-5** is now real introspection over the real barrel. The guard was proven non-vacuous by an out-of-band `tsx` probe that counted **40 columns across 6 tables actually enumerated** per run — the file's own `length > 0` guard would not have ruled out a ghost loop, so this was checked rather than assumed. `drizzle.config.ts:10` confirms the barrel is drizzle-kit's single entry point and `rg 'pgTable\('` confirms all six table definitions are reachable through it. A planted `balance_minor` column would be caught. The residual hole is narrow and named: the guard's scope is the Drizzle definition, not the database, so a column added by a hand-authored migration would slip past it (SUGGESTION 6).
- **AUTH-1's cookie clause** is genuinely proven, and the `vi.mock` deviation does not hollow it out. This was the sharpest question put to this verification and the answer is structural, not a judgement call: the fake at `actions.test.ts:60-70` implements `set` as a push onto an array and originates no value. Every asserted attribute is constructed in production code at `actions.ts:77-85`. Weakening `httpOnly`, `secure`, `sameSite`, `path` or `expires` fails the test; deleting a key fails it too, because `toMatchObject` requires presence. That is asserting *through* a sink, not *against* a stub. The DB substitution keeps real migrations, real production-parameter argon2id, real jose and a real `SELECT` that must return one row. What is not proven — that Next serialises those options into a correct `Set-Cookie` header — is framework behaviour outside this change and unreachable without an E2E tier.
- **Both fault-injection plants were reverted.** `git diff HEAD -- src ':(exclude)*.test.ts'` is empty. All four commands re-run from scratch: `npm test` 176 passed / 1 skipped, `npx tsc --noEmit`, `npm run lint`, `npm run build`, all exit 0. All 71 tasks complete. Scenario coverage rose from 19/24 to 21/24 and requirements from 18/23 to 20/23.
- **The hybrid mirrors now agree.** `apply-progress.md` and Engram obs #235 carry the same text under the same topic key, both in English; the file diff is `+119/-8` with every deletion a stale line replaced by a superseding one. Extended, not overwritten — the claim holds.

#### Exactly what blocks archive

The three PARTIAL scenarios, in ascending order of effort:

1. **CAT-6** — one line. The remediation built a whole-barrel column scanner and pointed it only at `/balance/i`. Adding `/(username|password|credential|secret)/i` with `users.password_hash` allow-listed closes it.
2. **EB-1** — the scenario claims Vitest reports an intentionally failing test *as a failure, not a runner error*. `tests/smoke.test.ts:9` is `expect(true).toBe(true)` and nothing standing proves it. Closing this needs either a subprocess run asserting a non-zero exit code, or a spec amendment — a standing always-failing test is not an option.
3. **EB-4** — the scenario claims the database is empty after rollback; `identity-round-trip.test.ts:122` deliberately asserts the opposite for the real schema, because the single-statement `rollbackLast` constraint leaves the `user_role` enum behind. This is documented deviation 1 and it is a genuine implementation limit, not a test gap. Closing it needs multi-statement rollback support or a spec amendment. **This is the only one of the three that is real work.**

None of the three is a defect and none is a security concern. Two of them are arguably spec-text problems rather than implementation problems, and amending the spec is a legitimate route to a clean `pass` — but that is a decision for the orchestrator and the user, not for this verification to take unilaterally.

#### Everything else

Eight warnings remain open. Seven are carried forward and were correctly out of the remediation batch's scope; one is new. Only **WARNING 6** became more severe, and only in magnitude — the review workload went from about 3.9× to about 4.1× the 800-line budget as the two test files were added.

**WARNING 8 is new and worth reading before archive**: `actions.test.ts:160` is titled *"clearing the cookie clears the row, not only the client copy"*, but the fake jar's unconditional `get: () => undefined` makes `getSession()` resolve to `null`, so `revoke(session.sessionId)` at `actions.ts:95` never executes. The test proves only that the cookie is deleted. No spec scenario names logout revocation, so this is not CRITICAL — but an overclaiming test title reads as coverage in an archived record and is not.

Two further findings are pure record accuracy and will be frozen into the archive unless corrected first: **WARNING 5** (tasks 2.4 and 2.6 checked while their own text reads BLOCKED) and **WARNING 6's** stale `ask-on-risk` / `pending` forecast rows at `tasks.md:17-18,22`, which contradict the session's resolved `single-pr` strategy. Each is a two-line edit and neither is a blocker.

The engineering underneath remains strong: 176 tests passing with real Postgres in-process, real migrations, real argon2id, real jose, type-level proofs that fail closed, and now three mocks in one file of twenty-nine — assessed, justified, and confined to a genuine framework boundary.
