import { Kysely, PostgresDialect } from 'kysely'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import type { Database } from './types'

neonConfig.webSocketConstructor = ws

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

export const pool = createPool()

function createDb() {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })
}

// Singleton pattern for development (avoids connection leaks on HMR)
const globalForDb = globalThis as unknown as { db: Kysely<Database> }
export const db = globalForDb.db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForDb.db = db

export { Kysely, sql } from 'kysely'
export type { Database } from './types'
