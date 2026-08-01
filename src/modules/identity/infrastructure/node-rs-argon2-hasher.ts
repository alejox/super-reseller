import { hash, verify } from '@node-rs/argon2'
import type { Argon2Params, PasswordHasher } from '@/modules/identity/domain/password-hasher'

// Adapter implementing the PasswordHasher port with @node-rs/argon2
// (argon2id, PHC-string output). Parameters are injected at construction —
// production code passes PRODUCTION_HASHER_PARAMS, tests pass reduced-cost
// parameters.
export class NodeRsArgon2Hasher implements PasswordHasher {
  constructor(private readonly params: Argon2Params) {}

  async hash(password: string): Promise<string> {
    // `algorithm` is intentionally NOT set: the library's Algorithm is an
    // ambient const enum, inaccessible under tsconfig `isolatedModules`
    // (TS2748), and Argon2id is its documented default. The PHC-string
    // prefix assertion in node-rs-argon2-hasher.test.ts guards that default
    // — the suite fails the moment the output is not $argon2id$.
    return hash(password, {
      memoryCost: this.params.memoryCost,
      timeCost: this.params.timeCost,
      parallelism: this.params.parallelism,
      outputLen: this.params.outputLen,
    })
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password)
  }
}
