/**
 * apps/fenix read wrapper on .planning/fenix.db.
 *
 * Single source of schema = .claude/scripts/lib/db.ts. We open in readonly
 * mode because Next.js server components do not write; mutations go through
 * /api/orchestrator which shells out to the orchestrator helper.
 *
 * No connection cache: bun:sqlite open is cheap and the orchestrator can
 * recreate the DB at any time (init-db, rehydrate, manual rm). A cached
 * handle would pin a stale inode and serve old data forever. WAL mode
 * (set by the writer) lets readers see committed writes without locking.
 */

import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function repoRoot(): string {
  // apps/fenix is two levels below the repo root.
  return process.env.FENIX_REPO_ROOT ?? resolve(process.cwd(), '../..')
}

export function dbPath(): string {
  return process.env.FENIX_DB ?? resolve(repoRoot(), '.planning/fenix.db')
}

export function readDb(): Database | null {
  const path = dbPath()
  if (!existsSync(path)) return null
  return new Database(path, { readonly: true })
}
