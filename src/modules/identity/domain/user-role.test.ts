import { describe, expect, it } from 'vitest'
import { isUserRole } from './user-role'

describe('isUserRole', () => {
  it('rejects unknown roles like SUPERADMIN', () => {
    expect(isUserRole('SUPERADMIN')).toBe(false)
  })

  it('accepts ADMIN', () => {
    expect(isUserRole('ADMIN')).toBe(true)
  })

  it('accepts RESELLER', () => {
    expect(isUserRole('RESELLER')).toBe(true)
  })

  it('accepts CUSTOMER', () => {
    expect(isUserRole('CUSTOMER')).toBe(true)
  })
})
