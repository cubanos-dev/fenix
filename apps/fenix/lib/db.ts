/**
 * apps/fenix read wrapper on .planning/fenix.db.
 *
 * Single source of schema = .claude/scripts/lib/db.ts. We open in readonly
 * mode because Next.js server components do not write; mutations go through
 * /api/orchestrator which shells out to the orchestrator helper.
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

let cached: Database | null = null

export function readDb(): Database | null {
  const path = dbPath()
  if (!existsSync(path)) return null
  if (cached) return cached
  cached = new Database(path, { readonly: true })
  return cached
}

export function closeDb(): void {
  if (cached) {
    cached.close()
    cached = null
  }
}
