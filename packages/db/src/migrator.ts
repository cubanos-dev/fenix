import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'

neonConfig.webSocketConstructor = ws

// Runs migrations from the calling app's migrations directory.
// Usage: pass the absolute path to the migrations folder.
export async function runMigrations(migrationsPath: string) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED,
  })

  const db = new Kysely({
    dialect: new PostgresDialect({ pool }),
  })

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: migrationsPath,
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`✓ ${result.migrationName}`)
    } else if (result.status === 'Error') {
      console.error(`✗ ${result.migrationName}`)
    }
  }

  if (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  await db.destroy()
  console.log('Migrations complete.')
}
