// Generic BetterAuth organization role constants and guards.
//
// BetterAuth's organization plugin ships with three built-in roles:
//   owner  — full control
//   admin  — administrative access
//   member — standard participant
//
// This module centralises the constants, the ordering, labels, and assertion
// helpers so every app in the monorepo shares one vocabulary. Projects that
// need richer domain-specific roles should layer them on top of this file, not
// fork it.

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
} as const

export type AppRole = (typeof ROLES)[keyof typeof ROLES]

const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
}

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

export function hasMinimumRole(userRole: AppRole | null | undefined, requiredRole: AppRole): boolean {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function requireOwnerRole(role: AppRole | null | undefined): asserts role is 'owner' {
  if (!hasMinimumRole(role, ROLES.owner)) {
    throw new Error('Forbidden: owner role required')
  }
}

export function requireAdminRole(role: AppRole | null | undefined): asserts role is 'owner' | 'admin' {
  if (!hasMinimumRole(role, ROLES.admin)) {
    throw new Error('Forbidden: admin role required')
  }
}

export function requireMemberRole(role: AppRole | null | undefined): asserts role is AppRole {
  if (!hasMinimumRole(role, ROLES.member)) {
    throw new Error('Forbidden: member role required')
  }
}
