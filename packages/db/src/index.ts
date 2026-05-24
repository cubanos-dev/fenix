import { Kysely, PostgresDialect } from 'kysely'
import type { PostgresPool } from 'kysely'
import type { Database } from './types'

async function createPool() {
  if (process.env.USE_PG_DRIVER === 'true') {
    const pg = await import('pg')
    return new pg.default.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }

  const { Pool, neonConfig } = await import('@neondatabase/serverless')
  const ws = await import('ws')
  neonConfig.webSocketConstructor = ws.default as unknown as typeof WebSocket

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

export const pool = await createPool()

function createDb() {
  // Kysely 0.29 tightened PostgresPool for its query-cancellation API; pg's
  // and @neondatabase/serverless's Pool shapes are structurally compatible
  // at runtime but don't satisfy the new interface until upstream types
  // catch up.
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: pool as unknown as PostgresPool }),
  })
}

// Singleton pattern for development (avoids connection leaks on HMR)
const globalForDb = globalThis as unknown as { db: Kysely<Database> }
export const db = globalForDb.db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForDb.db = db

export { Kysely, sql } from 'kysely'
export type { Database } from './types'
