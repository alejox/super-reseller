import { describe, expect, it } from 'vitest'
import { NodeRsArgon2Hasher } from './node-rs-argon2-hasher'
import { PRODUCTION_HASHER_PARAMS, type Argon2Params } from '@/modules/identity/domain/password-hasher'

// Reduced-cost parameters injected through the port so the suite stays fast
// (design.md "Auth and Session" — production params live separately).
const TEST_PARAMS: Argon2Params = {
  memoryCost: 64,
  timeCost: 1,
  parallelism: 1,
  outputLen: 32,
}

describe('PasswordHasher port contract (NodeRsArgon2Hasher adapter)', () => {
  it('hashes with argon2id and the injected reduced parameters (PHC string)', async () => {
    const hasher = new NodeRsArgon2Hasher(TEST_PARAMS)
    const hash = await hasher.hash('correct horse battery staple')

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=64,t=1,p=1\$/)
  })

  it('verify round trip succeeds for the right password', async () => {
    const hasher = new NodeRsArgon2Hasher(TEST_PARAMS)
    const hash = await hasher.hash('correct horse battery staple')

    expect(await hasher.verify(hash, 'correct horse battery staple')).toBe(true)
  })

  it('verify fails for a wrong password', async () => {
    const hasher = new NodeRsArgon2Hasher(TEST_PARAMS)
    const hash = await hasher.hash('correct horse battery staple')

    expect(await hasher.verify(hash, 'wrong password')).toBe(false)
  })

  it('uses a fresh random salt per hash — same password hashes differently, both verify', async () => {
    const hasher = new NodeRsArgon2Hasher(TEST_PARAMS)
    const first = await hasher.hash('correct horse battery staple')
    const second = await hasher.hash('correct horse battery staple')

    expect(first).not.toBe(second)
    expect(await hasher.verify(first, 'correct horse battery staple')).toBe(true)
    expect(await hasher.verify(second, 'correct horse battery staple')).toBe(true)
  })

  it('exposes production parameters separately, at production strength (m=19456, t=2, p=1)', () => {
    expect(PRODUCTION_HASHER_PARAMS).toEqual({
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    })
  })
})
