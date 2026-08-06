# Apply Progress — platform-foundation

Status: all planned slices (1–5b) complete, plus an undocumented UI/seed scope deviation (Phase 6, see `tasks.md`), plus a remediation batch closing two CRITICAL coverage gaps found by `sdd-verify`. Branch `feat/auth-and-login`, HEAD `9e996f7` at the time of this remediation. Prior state: slices 1, 2, 3a, 3b complete (59-test baseline, commits on `main` up to `83af284`).

## Slice 4 — completed tasks (4.1–4.15, 15/15)

| Task | Status | Evidence |
|---|---|---|
| 4.1/4.2 | [x] | `user_role` enum (ADMIN/RESELLER) + `users` table + role CHECK; SUPERADMIN rejected at enum level (PGlite). M1. |
| 4.3/4.4 | [x] | `users_email_lower_uniq` functional unique index on `lower(email)` (non-partial, per design.md DDL). M2. |
| 4.5/4.6 | [x] | `access-scope.ts` with non-exported `const scopeBrand: unique symbol = Symbol(...)`; negative fixture `tests/types/access-scope-negative.ts`; eslint seals minters to `dal.ts`. M3. |
| 4.7 | [x] | `shared/db/tenant.ts` `tenantWhere` (typed `TableWithResellerId`, rejects tables without `reseller_id`); `ScopedRepositoryFactory.for<S>` conditional-narrowed repos. M4. |
| 4.8/4.9 | [x] | Isolation contract suites over {fake, PGlite}: `users-isolation.contract.test.ts` (reseller B sees none of A; ADMIN sees all) + `reseller-surface.contract.test.ts` (tier-bound surface; tier never a parameter). 20 tests both backends. M5. |
| 4.10/4.11 | [x] | `users_reseller_requires_tier` CHECK — exact design.md DDL, proven via PGlite. M6. |
| 4.12/4.13 | [x] | FK `users.price_tier_id` ON DELETE RESTRICT (pre-existing, explicitly verified + introspection test; PGlite dialect uses SQLSTATE 23001 vs Neon 23503 — assertion matches constraint name). M7. |
| 4.14/4.15 | [x] | `deactivateUser` port + soft delete (`deactivated_at`), both adapters; no hard delete, no `is_active`. M8. |
| Finalization | [x] | `drizzle/0001_groovy_smiling_tiger.sql` (generated), `drizzle/down/0001_groovy_smiling_tiger.down.sql` (hand-authored), `drizzle/meta/0001_snapshot.json`, `tests/migrations/identity-round-trip.test.ts` (apply→rollback proven). `drizzle-kit check`: "Everything's fine". M9. |

### Slice 4 evidence (orchestrator independently re-ran)

- `npm test`: 104 passed, 1 skipped (Neon bigint probe, unchanged) — 17 files passed, 1 skipped.
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.

### Slice 4 rollback boundary

Revert: `src/modules/identity/**`, `src/modules/catalog/infrastructure/{drizzle-,in-memory-}reseller-catalog-repository.ts`, `reseller-surface.contract.test.ts`, `src/shared/db/tenant.ts`, `src/modules/catalog/domain/catalog-repository.ts` (port type additions), `src/modules/catalog/infrastructure/in-memory-catalog-repository.ts` (helper), `tests/types/`, `drizzle/0001_*`, `drizzle/down/0001_*`, `drizzle/meta/0001_snapshot.json`, `_journal.json` 0001 entry, `tests/migrations/identity-round-trip.test.ts`, `src/shared/db/schema.ts` re-export line, eslint zones, `identity.schema.test.ts`/`users-isolation.contract.test.ts`/`catalog-round-trip.test.ts` updates.

## Slice 5a — Password Hashing + Session Store + Signing (5a.1–5a.8, 8/8)

Commit `cd1f8fe`.

| Task | Status | Evidence |
|---|---|---|
| 5a.1/5a.2 | [x] | `PasswordHasher` port + `@node-rs/argon2` adapter. `node-rs-argon2-hasher.test.ts` proves round trip with reduced test parameters and asserts `PRODUCTION_HASHER_PARAMS` is `m=19456, t=2, p=1`, kept separate from the parameters injected into tests. Fresh random salt per hash proven at `:36`. |
| 5a.3/5a.4 | [x] | Constant-path login verification. `authenticate.ts` reads the user, then unconditionally selects `found?.passwordHash ?? deps.dummyPasswordHash` **before** verifying, and only inspects the result afterward — no early return on the unknown-email branch. `authenticate.test.ts` counts verify calls on both the unknown-email and known-email paths, and proves a deactivated user stays on the same single-verify path. |
| 5a.5/5a.6 | [x] | `jose` HS256 sign/verify. `session-token.ts` pins `jwtVerify(..., { algorithms: ["HS256"] })`. `session-token.test.ts` covers round trip, tampered payload, wrong key, expired token, `alg: none` rejection, non-`UserRole` role claim, and `exp` mirroring the session row. `sessionSecretKey()` is read at call time and enforces a ≥32-byte secret. |
| 5a.7/5a.8 | [x] | `sessions` table + repository insert. `log-in.test.ts` and `session-verifier.test.ts` apply the real `drizzle/` migrations into PGlite and query `sessions` with raw SQL — `id`, `user_id`, `expires_at`, `revoked_at`, no IP/user-agent columns, `ON DELETE CASCADE`, `sessions_user_id_idx`. |

**Migrations**: `drizzle/0002_identity_password_hash.sql`, `drizzle/0003_sessions.sql` (+ paired down files, + snapshots).

## Slice 5b — DAL + Server Action Authorization + Proxy (5b.1–5b.10, 10/10)

Commit `63cfa8f`.

| Task | Status | Evidence |
|---|---|---|
| 5b.1/5b.2 | [x] | `dal.ts` (`import 'server-only'`) wraps `getSession`/`verifySession`/`getScope`/`requireRole` in React `cache()`, with an explicit code comment forbidding `"use cache"` (per-request memoization only — a durable cache would keep a revoked session alive). `session-verifier.test.ts` (11 tests, PGlite) + `authorization.test.ts`. |
| 5b.3/5b.4 | [x] | `deactivateUser` transaction sets `users.deactivated_at` then revokes active sessions for that user. `session-verifier.test.ts:183,203` proves the next request is rejected. |
| 5b.5/5b.6 | [x] | `getScope` takes the role from the **row**, not the token, so a stale role claim cannot escalate — `session-verifier.test.ts:167`. `requireRole('ADMIN')` enforced in `deactivateUserAction`; `authorization.test.ts:28,32`, `deactivate-user.test.ts:101`. |
| 5b.7/5b.8 | [x] | `proxy.ts` — cookie presence + `jwtVerify` signature + role-claim route table only, no DB import; code comment documents the accepted property that a validly-signed but revoked-session cookie passes proxy and is rejected by the DAL microseconds later. `route-access.test.ts` (9 tests) proves `decideRouteAccess` independently of the DB re-check. `runtime` deliberately absent (Next 16 default). Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `.svg`. |
| 5b.9 | [x] | `login`/`logout` Server Actions (`src/modules/identity/application/actions.ts`) wire hashing, session signing, cookie set/clear. **Left with zero test coverage at the time — closed in the Remediation Batch below.** |
| 5b.10 | [x] | `npx tsc --noEmit` and `npm run lint` clean across the full change. |

**AccessScope unforgeability**: `tests/types/access-scope-negative.ts` uses eight `@ts-expect-error`/positive-assignment proofs and fails closed — if the brand ever became forgeable the directive would be unused and `tsc` would error.

**async `cookies()`/`headers()` (Next 16)**: every call site awaits — `dal.ts:51` `(await cookies()).get(...)`, `actions.ts:76` `const cookieStore = await cookies()`, `actions.ts:98` `(await cookies()).delete(...)`. `headers()` is unused. `npx tsc --noEmit` exit 0 confirms the Promise-returning Next 16 signatures are honored.

## Phase 6 — Scope Deviation: UI Shell + Admin Seed (undocumented at plan time)

Commits `2f5a9ab` (UI), `7f57949` (seed). **Not part of the original slice mapping.** `design.md` line 3 states "Nothing user-visible ships"; these two commits ship user-visible pages and an operational script anyway. Recorded honestly as a scope deviation in `tasks.md` Phase 6 rather than silently folded into the 64-task count or hidden — see `verify-report.md` WARNING 4 and this remediation's Item 4 below.

| Item | Status | Evidence |
|---|---|---|
| `provision-admin` use case + `UserProvisioning` port + Drizzle adapter | [x] | `provision-admin.test.ts` (PGlite) |
| `scripts/db/seed-admin.ts` | [x] | `npm run db:seed-admin` — one-shot bootstrap, manual smoke-tested against real Neon (per commit `2f5a9ab`'s own screenshot-verified login) |
| `/login` page + `login-form.tsx` | [x] | Client form → `login` Server Action |
| `/admin`, `/panel` role home shells | [x] | `app/admin/page.tsx`, `app/panel/page.tsx` |
| `app/page.tsx` root redirect | [x] | Reuses `decideRouteAccess` |
| `session-panel.tsx` + `logout-button.tsx` | [x] | → `logout` Server Action |
| `app/layout.tsx` font fix + `app/globals.css` | [x] | Unrelated to auth, bundled in the same commit |

**Known, tracked gap — not closed here**: zero automated coverage on these nine files (`verify-report.md` WARNING 5). RTL/jsdom/jest-dom were installed in Phase 1 but never used. Out of scope for this remediation batch (see Remediation Batch note below).

## Remediation Batch — closing `sdd-verify`'s 2 CRITICAL findings (this session)

`verify-report.md` (`evidence_revision: sha256:f998345f...`) returned `verdict: fail`, 2 CRITICAL, 8 WARNING, 5 SUGGESTION. This batch closes exactly the two CRITICALs plus the two WARNINGs explicitly assigned (hybrid-mirror staleness, undocumented UI scope) — the other 6 WARNING and 5 SUGGESTION findings are deliberately untouched, per the remediation work order.

### Item 1 — EB-5 "No Mutable Balance Column" had zero covering test (CRITICAL 1)

**Root cause**: a repo-wide grep confirmed zero occurrences of `balance`, but nothing asserted the invariant — a future migration could add a mutable balance column and the suite would stay green.

**Fix**: `src/shared/db/schema.inspection.test.ts` — scans every table in `shared/db/schema.ts`, the single barrel every module's schema is required to re-export through (drizzle-kit's one schema entry point), for any column matching `/balance/i`. Asserted against the real Drizzle table definitions via `getTableConfig`, not a hand-maintained list.

**RED proof (fault injection, not committed)**: temporarily added `balanceMinor: uuid("balance_minor")` to `users` in `identity.schema.ts` → test failed with `expected 'users.balance_minor' not to match /balance/i` → reverted → test passed again. `git diff` on the production schema file is empty after the revert.

### Item 2 — AUTH-1's cookie clause had zero covering test (CRITICAL 2)

**Root cause**: `src/modules/identity/application/actions.ts` had no test file. The session-row half of AUTH-1 was proven against real Postgres (`log-in.test.ts`); the cookie half — where the security control actually lives (`httpOnly` stops XSS session theft, `secure` stops plaintext transmission) — was correct on inspection only.

**Fix**: `src/modules/identity/application/actions.test.ts` — drives the real `login`/`logout` Server Actions end to end: real PGlite migrations, real production-parameter argon2id, real jose signing, real `redirect()` (which needs no stub outside a request — verified by reading `node_modules/next/dist/client/components/redirect.js`). Asserts the cookie name, that the value is non-empty, `httpOnly: true`, `secure: true`, `sameSite: "lax"`, `path: "/"`, and that `expires` equals the persisted `sessions.expires_at` to the millisecond. A second test proves no cookie is set on invalid credentials; a third proves `logout` deletes the cookie.

**Deviation — 3 `vi.mock` calls, explicitly reported (not silent)**: this is the suite's first use of `vi.mock` (previously 0 across 286+ assertions). All three are unavoidable framework boundaries, not fakes of this change's own business logic:

1. `next/headers`'s `cookies()` throws `throwForMissingRequestStore` unless called inside Next's internal, undocumented `workUnitAsyncStorage` request context (verified by reading `node_modules/next/dist/server/request/cookies.js`). Reconstructing that private store shape by hand would be *more* fragile than an explicit fake, not less. Faked with a minimal in-memory jar implementing only `set`/`delete`/`get` — the exact surface `actions.ts` calls.
2. `@/shared/db/client`'s `getDb()` is a memoized singleton hardcoded to `drizzle-orm/neon-http`, requiring a live `DATABASE_URL` that CI does not provision. Swapped for the same PGlite instance the rest of the identity suite already uses — no SQL or business logic is faked, only which real Postgres the module reaches (the same substitution `log-in.test.ts` makes via constructor injection instead).
3. `dal.ts` (imported transitively via `actions.ts`) has `import "server-only"` at its top; `node_modules/server-only/index.js` unconditionally throws unless the bundler sets the `react-server` resolve condition, which Vitest does not set by default. Next's own docs record this exact ecosystem limit ("Vitest currently does not support [async Server Components]... we recommend using E2E tests" — `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`). Stubbed to an empty module, scoped to this one test file — not a global `vitest.config.ts` change, which would have altered module resolution for the whole suite.

**RED proof (fault injection, not committed)**: temporarily weakened each attribute in `actions.ts` one at a time and re-ran the test — `httpOnly: false` failed; `secure: false` + `sameSite: "strict"` + `path: "/api"` (combined) failed; `expires` shifted by +1ms failed. Reverted after each; final `git diff` on `actions.ts` is empty.

### Item 3 — hybrid artifact mirrors reconciled (WARNING 1)

This file was three slices stale (stopped at slice 4, said "Next: Slice 5a") while its Engram twin under the same topic key (`sdd/platform-foundation/apply-progress`) was current but written in Spanish narrative form. This file now covers slices 5a, 5b, Phase 6 (UI + seed), and this remediation batch, and is saved to Engram verbatim under the same topic key so both mirrors agree, in English, per the project's technical-artifact language contract.

### Item 4 — undocumented shipped work accounted for in `tasks.md` (WARNING 4)

`tasks.md` gained a new "Phase 6: Scope Deviation" section (see above) listing the nine UI files and the seed-script chain as explicit, marked-complete tasks, with a note cross-referencing `design.md`'s unchanged "Nothing user-visible ships" line. `design.md` itself is left untouched — the deviation is recorded, not retroactively hidden by rewriting the design's original intent.

### Remediation batch — Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/shared/db/schema.inspection.test.ts src/modules/identity/application/actions.test.ts` — 2 files, 5 tests, all passed |
| Runtime harness command/scenario and result | PGlite (real Postgres in WASM) with the real `drizzle/` migrations applied in both new test files' `beforeEach`; real argon2id at production parameters; real jose HS256 sign/verify; real `redirect()` — no live Neon branch touched |
| Rollback boundary | Revert `src/shared/db/schema.inspection.test.ts`, `src/modules/identity/application/actions.test.ts`, and the `tasks.md`/`apply-progress.md` reconciliation edits — no production file changed |

### Remediation batch — TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | SAFETY NET | REFACTOR |
|---|---|---|---|---|---|
| EB-5 balance guard | Fault-injected `balanceMinor` column into `identity.schema.ts`; test failed with the exact expected assertion message | Reverted the plant; test passed against the real, unmodified schema barrel | N/A — single negative-invariant assertion over the complete table/column set is inherently exhaustive, no second case needed | Full suite (176/1) + `tsc` + `lint` re-run after the addition, all clean | None needed — test is a single focused `describe` block, no duplication to extract |
| AUTH-1 cookie flags | Fault-injected weakened `httpOnly`, then `secure`+`sameSite`+`path` together, then `expires`, one at a time, into `actions.ts`; each run failed with the exact expected diff | Reverted each plant in turn; final run passed against the real, unmodified `actions.ts` | Covered both the success path (cookie set, all 5 attributes) and the failure path (no cookie set on bad credentials) plus `logout` (cookie deleted) — 3 tests, 3 distinct code paths | Full suite (176/1) + `tsc` + `lint` re-run after the addition, all clean | None needed — no production code changed in this batch |

### Full-suite evidence (this remediation batch, re-run independently)

- `npm test`: 176 passed, 1 skipped (unchanged Neon-bigint probe) — 28 files passed, 1 skipped (29). Was 171/1 before this batch.
- `npx tsc --noEmit`: exit 0, clean.
- `npm run lint`: exit 0, clean, zero warnings.

## Deviations and documented limitations (not hidden)

1. **Down-migration single-statement constraint** (slice-3b constraint, resurfaced as predicted): `rollbackLast` runs the down file as ONE prepared statement. `DROP TABLE IF EXISTS "users";` works; `DROP TYPE IF EXISTS "user_role" CASCADE;` corrupts (leaves a shell table); two statements fail. **Result: `user_role` enum survives rollback** — documented in the down-file header + tripwired in the round-trip test. Re-applying migrations to the SAME DB after rollback fails (`type user_role already exists`) — forward-apply again only on a fresh DB.
2. **`updated_at` gap on `users`**: design.md DDL lists it; schema omits it (from batch 4.2). `display_name` (also NOT NULL in the design DDL) is missing too. Deferred — adding either now would need a 0002-class migration + design amendment. Track as follow-up (out of scope for this remediation batch, per the explicit work order).
3. **AccessScope brand is a real `Symbol()`** (not `declare const` as design snippet shows): `declare` has no runtime value and the mint factories need the runtime key. Same type-level guarantee, working runtime.
4. **Catalog tables are NOT reseller-scoped** — design's isolation surface for catalog is the TIER, not reseller_id (verified in design.md; zero schema drift). `tenantWhere` is literally forced in identity reads; tier predicate + `effective_to IS NULL` forced on every catalog join.
5. **PGlite vs Neon error-message divergence**: assertion matches constraint name, not message text.
6. **`users` seed requirement change**: RESELLER fixtures now need an assigned price tier (CHECK superseded old behavior) — isolation/deactivation fixtures updated accordingly.
7. **UI and admin seed shipped against `design.md`'s "Nothing user-visible ships"** (Phase 6 above) — recorded as a scope deviation in `tasks.md`, not fixed or reverted in this batch.
8. **Three `vi.mock` calls in `actions.test.ts`** (Remediation Item 2 above) — the suite's first, explicitly justified as unavoidable framework boundaries, not faked business logic.

## Next

All planned slices (1–5b) and the Phase 6 deviation are implemented and tested. The two CRITICAL coverage gaps from `sdd-verify` are closed. Remaining open items are the 6 untouched WARNINGs and 5 SUGGESTIONs in `verify-report.md` (stale delivery-strategy record, `users` DDL drift beyond `updated_at`, zero component tests, tasks 2.4/2.6 BLOCKED-but-checked, review-workload-over-budget record, build DB-independence not isolated) — none of them were in this remediation's scope and none block re-running `sdd-verify`. Recommended next phase: `sdd-verify`.
