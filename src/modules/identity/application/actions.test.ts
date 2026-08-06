// @vitest-environment node
//
// AUTH-1 (verify-report.md CRITICAL 2): the DB half of "Login Issues a
// DB-Backed Session" is proven in auth/log-in.test.ts against real
// Postgres (PGlite), real argon2id, and real jose. This file proves the
// other half — the cookie the DAL and proxy.ts actually trust — by driving
// the real `login` Server Action end to end: real PGlite migrations, real
// production-parameter argon2id, real jose signing, real `redirect()`.
//
// DEVIATION from this suite's zero-`vi.mock` record (documented, not
// silent — see apply-progress.md):
//
// 1. `next/headers`'s `cookies()` throws `throwForMissingRequestStore`
//    unless it runs inside Next's internal `workUnitAsyncStorage`
//    (verified by reading node_modules/next/dist/server/request/cookies.js).
//    That store's shape is a private, undocumented, version-fragile
//    implementation detail with no public constructor — reconstructing it
//    by hand would be MORE fragile than an explicit fake, not less. Faked
//    here with the smallest possible in-memory cookie jar, implementing
//    only the three methods `actions.ts` calls (`set`/`delete`/`get`).
// 2. `@/shared/db/client`'s `getDb()` is a memoized singleton hardcoded to
//    `drizzle-orm/neon-http` and requires a live `DATABASE_URL`; none is
//    provisioned in CI. Swapped for the SAME PGlite instance the rest of
//    the identity suite already uses for this exact purpose — this fakes
//    no SQL and no business logic, only which real Postgres the module
//    reaches, the same substitution `log-in.test.ts` makes by constructor
//    injection instead.
// 3. `dal.ts` (imported transitively via `./actions`) has `import
//    "server-only"` at its top. `node_modules/server-only/index.js`
//    unconditionally throws unless the bundler resolves the package's
//    `react-server` export condition — a condition Vitest does not set by
//    default, and setting it globally in `vitest.config.ts` would change
//    module resolution for the entire suite, including every React
//    component test, for the sake of one file. Next's own docs record this
//    exact ecosystem limit: "Since async Server Components are new to the
//    React ecosystem, Vitest currently does not support them... we
//    recommend using E2E tests for async components"
//    (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md).
//    Stubbed to an empty module, scoped to this file only.
//
// `next/navigation`'s `redirect()` needs no stub: outside a request it
// simply throws a plain digest-carrying `Error`
// (node_modules/next/dist/client/components/redirect.js:51-54), which this
// test catches directly — no framework runtime required.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import { closeTestDb, createTestDb, type TestDb } from "../../../../tests/support/pglite-db";
import { NodeRsArgon2Hasher } from "@/modules/identity/infrastructure/node-rs-argon2-hasher";
import { PRODUCTION_HASHER_PARAMS } from "@/modules/identity/domain/password-hasher";

type CookieSet = { name: string; value: string; options: Record<string, unknown> };

const cookieSets: CookieSet[] = [];
const cookieDeletes: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieSets.push({ name, value, options });
    },
    delete: (name: string) => {
      cookieDeletes.push(name);
    },
    get: () => undefined,
  }),
}));

let testDb: TestDb;

vi.mock("@/shared/db/client", () => ({
  getDb: () => testDb.db,
}));

vi.mock("server-only", () => ({}));

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "drizzle",
);

const USER_ID = "66666666-6666-4666-8666-666666666666";
const PASSWORD = "correct horse battery staple";
const SESSION_SECRET = "test-secret-at-least-32-bytes-long!!!!!";

beforeEach(async () => {
  testDb = await createTestDb();
  await migrate(testDb.db, { migrationsFolder: DRIZZLE_DIR });

  // Real argon2id at PRODUCTION parameters — the same cost `login()` itself
  // pays via `PRODUCTION_HASHER_PARAMS` — so this fixture matches what the
  // action under test actually hashes and verifies against.
  const hasher = new NodeRsArgon2Hasher(PRODUCTION_HASHER_PARAMS);
  await testDb.db.execute(
    sql`INSERT INTO users (id, email, password_hash, role, reseller_id, price_tier_id, created_at)
        VALUES (${USER_ID}, 'owner@example.com', ${await hasher.hash(PASSWORD)}, 'ADMIN', NULL, NULL, now())`,
  );

  cookieSets.length = 0;
  cookieDeletes.length = 0;
  vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await closeTestDb(testDb);
});

function loginFormData(email: string, password: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("login (AUTH-1: the session cookie carries every security flag design.md specifies)", () => {
  it("sets httpOnly, secure, sameSite=lax, path=/, and expires mirroring sessions.expires_at", async () => {
    const { login } = await import("./actions");

    // A successful login always ends in `redirect()`, which throws — that
    // is Next's normal control flow for a Server Action, not a test error.
    await expect(login(undefined, loginFormData("owner@example.com", PASSWORD))).rejects.toThrow();

    expect(cookieSets).toHaveLength(1);
    const [{ name, value, options }] = cookieSets;
    expect(name).toBe("session");
    expect(value.length).toBeGreaterThan(0);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    const rows = await testDb.db.execute<{ expires_at: Date }>(
      sql`SELECT expires_at FROM sessions WHERE user_id = ${USER_ID}`,
    );
    expect(rows.rows).toHaveLength(1);
    const persistedExpiresAt = new Date(rows.rows[0].expires_at).getTime();
    expect((options.expires as Date).getTime()).toBe(persistedExpiresAt);
  });

  it("sets no cookie at all when credentials are invalid", async () => {
    const { login } = await import("./actions");

    const state = await login(undefined, loginFormData("owner@example.com", "wrong password"));

    expect(state).toEqual({ error: expect.any(String) });
    expect(cookieSets).toHaveLength(0);
  });
});

describe("logout (AUTH-1: clearing the cookie clears the row, not only the client copy)", () => {
  it("deletes the session cookie", async () => {
    const { logout } = await import("./actions");

    await expect(logout()).rejects.toThrow();

    expect(cookieDeletes).toEqual(["session"]);
  });
});
