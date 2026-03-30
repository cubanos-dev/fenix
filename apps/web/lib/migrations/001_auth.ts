import type { ColumnDefinitionBuilder, Kysely } from 'kysely'

type Col = ColumnDefinitionBuilder

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable('user')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('name', 'text', (col: Col) => col.notNull())
    .addColumn('email', 'text', (col: Col) => col.notNull().unique())
    .addColumn('emailVerified', 'boolean', (col: Col) => col.notNull().defaultTo(false))
    .addColumn('image', 'text')
    .addColumn('createdAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updatedAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .execute()

  await db.schema
    .createTable('session')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('expiresAt', 'timestamptz', (col: Col) => col.notNull())
    .addColumn('token', 'text', (col: Col) => col.notNull().unique())
    .addColumn('createdAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updatedAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('userId', 'text', (col: Col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('activeOrganizationId', 'text')
    .execute()

  await db.schema
    .createTable('account')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('accountId', 'text', (col: Col) => col.notNull())
    .addColumn('providerId', 'text', (col: Col) => col.notNull())
    .addColumn('userId', 'text', (col: Col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('idToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamptz')
    .addColumn('refreshTokenExpiresAt', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updatedAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .execute()

  await db.schema
    .createTable('verification')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('identifier', 'text', (col: Col) => col.notNull())
    .addColumn('value', 'text', (col: Col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col: Col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('updatedAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .execute()

  await db.schema
    .createTable('organization')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('name', 'text', (col: Col) => col.notNull())
    .addColumn('slug', 'text', (col: Col) => col.unique())
    .addColumn('logo', 'text')
    .addColumn('createdAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('metadata', 'text')
    .execute()

  await db.schema
    .createTable('member')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('organizationId', 'text', (col: Col) => col.notNull().references('organization.id').onDelete('cascade'))
    .addColumn('userId', 'text', (col: Col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('role', 'text', (col: Col) => col.notNull().defaultTo('member'))
    .addColumn('createdAt', 'timestamptz', (col: Col) => col.notNull().defaultTo(db.fn('now')))
    .execute()

  await db.schema
    .createTable('invitation')
    .addColumn('id', 'text', (col: Col) => col.primaryKey())
    .addColumn('organizationId', 'text', (col: Col) => col.notNull().references('organization.id').onDelete('cascade'))
    .addColumn('email', 'text', (col: Col) => col.notNull())
    .addColumn('role', 'text', (col: Col) => col.notNull().defaultTo('member'))
    .addColumn('status', 'text', (col: Col) => col.notNull().defaultTo('pending'))
    .addColumn('expiresAt', 'timestamptz', (col: Col) => col.notNull())
    .addColumn('inviterId', 'text', (col: Col) => col.notNull().references('user.id').onDelete('cascade'))
    .execute()
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable('invitation').execute()
  await db.schema.dropTable('member').execute()
  await db.schema.dropTable('organization').execute()
  await db.schema.dropTable('verification').execute()
  await db.schema.dropTable('account').execute()
  await db.schema.dropTable('session').execute()
  await db.schema.dropTable('user').execute()
}
