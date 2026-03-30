import type { Generated, ColumnType } from 'kysely'

// BetterAuth tables (managed by BetterAuth, do not modify manually)
export interface UserTable {
  id: Generated<string>
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, string>
}

export interface SessionTable {
  id: Generated<string>
  expiresAt: ColumnType<Date, string, string>
  token: string
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, string>
  ipAddress: string | null
  userAgent: string | null
  userId: string
  activeOrganizationId: string | null
}

export interface AccountTable {
  id: Generated<string>
  accountId: string
  providerId: string
  userId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  accessTokenExpiresAt: ColumnType<Date, string | undefined, string> | null
  refreshTokenExpiresAt: ColumnType<Date, string | undefined, string> | null
  scope: string | null
  password: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, string>
}

export interface VerificationTable {
  id: Generated<string>
  identifier: string
  value: string
  expiresAt: ColumnType<Date, string, string>
  createdAt: ColumnType<Date, string | undefined, never>
  updatedAt: ColumnType<Date, string | undefined, string>
}

export interface OrganizationTable {
  id: Generated<string>
  name: string
  slug: string | null
  logo: string | null
  createdAt: ColumnType<Date, string | undefined, never>
  metadata: string | null
}

export interface MemberTable {
  id: Generated<string>
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  createdAt: ColumnType<Date, string | undefined, never>
}

export interface InvitationTable {
  id: Generated<string>
  organizationId: string
  email: string
  role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'rejected' | 'canceled'
  expiresAt: ColumnType<Date, string, string>
  inviterId: string
}

// Base database with BetterAuth tables only.
// Apps extend this with their domain tables:
//
//   import type { Database as BaseDatabase } from '@fenix/db/types'
//   interface AppDatabase extends BaseDatabase {
//     projects: ProjectTable
//     issues: IssueTable
//   }
export interface Database {
  user: UserTable
  session: SessionTable
  account: AccountTable
  verification: VerificationTable
  organization: OrganizationTable
  member: MemberTable
  invitation: InvitationTable
}
