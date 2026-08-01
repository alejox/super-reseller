# Apply Progress — platform-foundation

Slice 4 (Identity/Tenancy Schema + AccessScope) complete. Prior state: slices 1, 2, 3a, 3b complete (59-test baseline, commits on `main` up to `83af284`).

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

## Evidence (orchestrator independently re-ran)

- `npm test`: 104 passed, 1 skipped (Neon bigint probe, unchanged) — 17 files passed, 1 skipped.
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.

## Deviations and documented limitations (not hidden)

1. **Down-migration single-statement constraint** (slice-3b constraint, resurfaced as predicted): `rollbackLast` runs the down file as ONE prepared statement. `DROP TABLE IF EXISTS "users";` works; `DROP TYPE IF EXISTS "user_role" CASCADE;` corrupts (leaves a shell table); two statements fail. **Result: `user_role` enum survives rollback** — documented in the down-file header + tripwired in the round-trip test. Re-applying migrations to the SAME DB after rollback fails (`type user_role already exists`) — forward-apply again only on a fresh DB.
2. **`updated_at` gap on `users`**: design.md DDL lists it; schema omits it (from batch 4.2). Deferred — adding it now would need a 0002 migration + design amendment. Track as follow-up.
3. **AccessScope brand is a real `Symbol()`** (not `declare const` as design snippet shows): `declare` has no runtime value and the mint factories need the runtime key. Same type-level guarantee, working runtime.
4. **Catalog tables are NOT reseller-scoped** — design's isolation surface for catalog is the TIER, not reseller_id (verified in design.md; zero schema drift). `tenantWhere` is literally forced in identity reads; tier predicate + `effective_to IS NULL` forced on every catalog join.
5. **PGlite vs Neon error-message divergence**: assertion matches constraint name, not message text.
6. **`users` seed requirement change**: RESELLER fixtures now need an assigned price tier (CHECK superseded old behavior) — isolation/deactivation fixtures updated accordingly.

## Rollback boundary (slice 4)

Revert: `src/modules/identity/**`, `src/modules/catalog/infrastructure/{drizzle-,in-memory-}reseller-catalog-repository.ts`, `reseller-surface.contract.test.ts`, `src/shared/db/tenant.ts`, `src/modules/catalog/domain/catalog-repository.ts` (port type additions), `src/modules/catalog/infrastructure/in-memory-catalog-repository.ts` (helper), `tests/types/`, `drizzle/0001_*`, `drizzle/down/0001_*`, `drizzle/meta/0001_snapshot.json`, `_journal.json` 0001 entry, `tests/migrations/identity-round-trip.test.ts`, `src/shared/db/schema.ts` re-export line, eslint zones, `identity.schema.test.ts`/`users-isolation.contract.test.ts`/`catalog-round-trip.test.ts` updates.

## Next

Slice 5a (PR5a): password hashing + session store + jose (8 tasks: 5a.1–5a.8).
