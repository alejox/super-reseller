export type UserRole = 'ADMIN' | 'RESELLER'

export function isUserRole(value: unknown): value is UserRole {
  return value === 'ADMIN' || value === 'RESELLER'
}
