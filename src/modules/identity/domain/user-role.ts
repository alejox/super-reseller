export type UserRole = 'ADMIN' | 'RESELLER' | 'CUSTOMER'

export function isUserRole(value: unknown): value is UserRole {
  return value === 'ADMIN' || value === 'RESELLER' || value === 'CUSTOMER'
}
