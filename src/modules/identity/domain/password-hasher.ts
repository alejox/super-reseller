// Port: password hashing for the identity module (design.md "Auth and
// Session"). Domain-layer ports import nothing outside shared/money; the
// argon2 library lives behind the adapter in infrastructure/.

export interface Argon2Params {
  /** Memory cost in KiB. */
  readonly memoryCost: number
  /** Time cost — number of passes. */
  readonly timeCost: number
  /** Parallelism — number of threads. */
  readonly parallelism: number
  /** Tag length in bytes. */
  readonly outputLen: number
}

export interface PasswordHasher {
  /** Returns an argon2id PHC string suitable for `password_hash`. */
  hash(password: string): Promise<string>
  /** Constant-time-ish verification of a PHC string against a password. */
  verify(passwordHash: string, password: string): Promise<boolean>
}

// Production parameters (OWASP-recommended argon2id profile). Exported
// separately so adapters inject cheap parameters in tests without weakening
// production hashes.
export const PRODUCTION_HASHER_PARAMS: Argon2Params = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
}
