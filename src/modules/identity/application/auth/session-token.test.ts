// @vitest-environment node
//
// Server-only module: it must run in the Node realm, not jsdom. Under the
// suite's default jsdom environment, `TextEncoder` returns a Uint8Array from
// a different realm, and jose's `instanceof Uint8Array` guard rejects it
// ("payload must be an instance of Uint8Array") — a test-environment
// artifact that never occurs on the server, where this code actually runs.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_TTL_DAYS,
  sessionExpiresAt,
  sessionSecretKey,
  signSessionToken,
  verifySessionToken,
} from "./session-token";

/**
 * design.md "Auth and Session": `jose` `SignJWT`, `alg: HS256`, payload
 * `{ sid, uid, role }`, verified with `jwtVerify(token, key, { algorithms:
 * ['HS256'] })` — "pinning the algorithm list blocks `alg: none` and
 * algorithm confusion". These tests are the proof of that pinning.
 */

const KEY = new TextEncoder().encode("test-secret-at-least-32-bytes-long!!");

const CLAIMS = {
  sid: "33333333-3333-4333-8333-333333333333",
  uid: "11111111-1111-4111-8111-111111111111",
  role: "RESELLER",
} as const;

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

/** Hand-rolls an unsigned `alg: none` token carrying valid-looking claims. */
function forgeAlgNoneToken(): string {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      ...CLAIMS,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.`;
}

function inOneHour(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session token — jose HS256 sign/verify", () => {
  it("round trips the { sid, uid, role } claims", async () => {
    const token = await signSessionToken(CLAIMS, inOneHour(), KEY);

    await expect(verifySessionToken(token, KEY)).resolves.toEqual(CLAIMS);
  });

  it("rejects a tampered payload", async () => {
    const token = await signSessionToken(CLAIMS, inOneHour(), KEY);
    const [header, payload, signature] = token.split(".");
    const forgedPayload = base64url(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), role: "ADMIN" }),
    );

    await expect(
      verifySessionToken(`${header}.${forgedPayload}.${signature}`, KEY),
    ).resolves.toBeNull();
  });

  it("rejects a token signed with a different key", async () => {
    const token = await signSessionToken(CLAIMS, inOneHour(), KEY);
    const otherKey = new TextEncoder().encode("another-secret-at-least-32-bytes!!!!");

    await expect(verifySessionToken(token, otherKey)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSessionToken(CLAIMS, new Date(Date.now() - 1000), KEY);

    await expect(verifySessionToken(token, KEY)).resolves.toBeNull();
  });

  it("rejects an unsigned alg: none token", async () => {
    await expect(verifySessionToken(forgeAlgNoneToken(), KEY)).resolves.toBeNull();
  });

  it("rejects a validly-signed token whose role claim is not a UserRole", async () => {
    const token = await signSessionToken(
      { ...CLAIMS, role: "SUPERADMIN" as never },
      inOneHour(),
      KEY,
    );

    await expect(verifySessionToken(token, KEY)).resolves.toBeNull();
  });

  it("sets exp from the session expiry it is given, so the token mirrors the sessions row", async () => {
    const expiresAt = new Date(Math.floor((Date.now() + 60_000) / 1000) * 1000);
    const token = await signSessionToken(CLAIMS, expiresAt, KEY);
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

    expect(payload.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });
});

describe("sessionExpiresAt", () => {
  it("is an absolute 7-day expiry with no sliding refresh", () => {
    const issuedAt = new Date("2026-08-01T00:00:00Z");

    expect(SESSION_TTL_DAYS).toBe(7);
    expect(sessionExpiresAt(issuedAt)).toEqual(new Date("2026-08-08T00:00:00Z"));
  });
});

describe("sessionSecretKey", () => {
  it("reads SESSION_SECRET at call time and encodes it", () => {
    vi.stubEnv("SESSION_SECRET", "a-perfectly-fine-secret-of-32+++".padEnd(32, "!"));

    expect(sessionSecretKey()).toBeInstanceOf(Uint8Array);
  });

  it("refuses a missing secret", () => {
    vi.stubEnv("SESSION_SECRET", "");

    expect(() => sessionSecretKey()).toThrow(/SESSION_SECRET/);
  });

  it("refuses a secret shorter than 32 bytes", () => {
    vi.stubEnv("SESSION_SECRET", "too-short");

    expect(() => sessionSecretKey()).toThrow(/32/);
  });
});
