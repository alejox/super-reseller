import { describe, expect, it } from "vitest";

import type { PasswordHasher } from "@/modules/identity/domain/password-hasher";
import type {
  CredentialsRepository,
  UserCredentials,
} from "@/modules/identity/domain/credentials-repository";
import { authenticate } from "./authenticate";

/**
 * design.md "Auth and Session": "Login always performs one verify — against
 * a dummy hash when the email is unknown — to remove the timing oracle for
 * user enumeration." The real argon2id cost is proven in
 * infrastructure/node-rs-argon2-hasher.test.ts; this suite proves the *use
 * case* takes the same code path whether or not the email exists, so it
 * uses a recording fake instead of paying the hashing cost.
 */

const DUMMY_HASH = "$argon2id$dummy$for-unknown-emails";

/** Encoding of the fake: a password "hashes" to `hashed:<password>`. */
function fakeHashOf(password: string): string {
  return `hashed:${password}`;
}

class RecordingHasher implements PasswordHasher {
  readonly verifiedHashes: string[] = [];

  async hash(password: string): Promise<string> {
    return fakeHashOf(password);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    this.verifiedHashes.push(passwordHash);
    return passwordHash === fakeHashOf(password);
  }
}

/**
 * Keyed by the *normalized* email, mirroring `users_email_lower_uniq` — the
 * unique index is functional on `lower(email)`, so a lookup that did not
 * case-fold could miss the row the database considers a duplicate.
 */
class InMemoryCredentialsRepository implements CredentialsRepository {
  constructor(private readonly rows: Readonly<Record<string, UserCredentials>>) {}

  async findByEmail(normalizedEmail: string): Promise<UserCredentials | null> {
    return this.rows[normalizedEmail] ?? null;
  }
}

const ACTIVE_RESELLER: UserCredentials = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "RESELLER",
  passwordHash: fakeHashOf("correct horse battery staple"),
  deactivatedAt: null,
};

const DEACTIVATED_ADMIN: UserCredentials = {
  id: "22222222-2222-4222-8222-222222222222",
  role: "ADMIN",
  passwordHash: fakeHashOf("correct horse battery staple"),
  deactivatedAt: new Date("2026-01-01T00:00:00Z"),
};

function makeDeps(rows: Readonly<Record<string, UserCredentials>> = {}) {
  const hasher = new RecordingHasher();
  return {
    hasher,
    deps: {
      users: new InMemoryCredentialsRepository(rows),
      hasher,
      dummyPasswordHash: DUMMY_HASH,
    },
  };
}

describe("authenticate — constant-path login verification", () => {
  it("performs exactly one verify against the dummy hash when the email is unknown", async () => {
    const { hasher, deps } = makeDeps();

    const result = await authenticate(deps, {
      email: "nobody@example.com",
      password: "correct horse battery staple",
    });

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(hasher.verifiedHashes).toEqual([DUMMY_HASH]);
  });

  it("performs exactly one verify against the stored hash when the email is known", async () => {
    const { hasher, deps } = makeDeps({ "owner@example.com": ACTIVE_RESELLER });

    const result = await authenticate(deps, {
      email: "owner@example.com",
      password: "wrong password",
    });

    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(hasher.verifiedHashes).toEqual([ACTIVE_RESELLER.passwordHash]);
  });

  it("returns the authenticated user for the right password", async () => {
    const { hasher, deps } = makeDeps({ "owner@example.com": ACTIVE_RESELLER });

    const result = await authenticate(deps, {
      email: "owner@example.com",
      password: "correct horse battery staple",
    });

    expect(result).toEqual({
      ok: true,
      user: { id: ACTIVE_RESELLER.id, role: "RESELLER" },
    });
    expect(hasher.verifiedHashes).toHaveLength(1);
  });

  it("looks the email up case-folded and trimmed, like users_email_lower_uniq", async () => {
    const { deps } = makeDeps({ "owner@example.com": ACTIVE_RESELLER });

    const result = await authenticate(deps, {
      email: "  Owner@Example.COM  ",
      password: "correct horse battery staple",
    });

    expect(result).toEqual({
      ok: true,
      user: { id: ACTIVE_RESELLER.id, role: "RESELLER" },
    });
  });

  it("rejects a deactivated user, still on the same single-verify path", async () => {
    const { hasher, deps } = makeDeps({ "admin@example.com": DEACTIVATED_ADMIN });

    const result = await authenticate(deps, {
      email: "admin@example.com",
      password: "correct horse battery staple",
    });

    // Same failure shape as an unknown email: telling a deactivated account
    // apart from a nonexistent one is the enumeration oracle the dummy-hash
    // path exists to close.
    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(hasher.verifiedHashes).toEqual([DEACTIVATED_ADMIN.passwordHash]);
  });
});
