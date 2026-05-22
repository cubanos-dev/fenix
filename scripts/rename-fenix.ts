#!/usr/bin/env bun
/**
 * rename-fenix — atomically rewrite `@fenix/*` to `@<project>/*` across the
 * entire repository in one pass.
 *
 * Called by the `fenix-init` agent during Stage 0 so the project scaffold
 * matches the user-chosen name. Safe to invoke directly from a Bash shell;
 * idempotent — running again with the same name is a no-op.
 *
 * What gets rewritten:
 *   - Every package.json   — `"name": "@fenix/..."` and workspace deps
 *   - Every .ts / .tsx     — `from "@fenix/..."`, `import("@fenix/...")`
 *   - Every .js / .mjs     — same as .ts
 *   - Every .css           — `@import "@fenix/..."`
 *   - Every .json          — biome.json `extends`, tsconfig `extends`
 *   - Every .md            — agent docs referencing import paths
 *
 * Skipped:
 *   - node_modules, .next, .turbo, .git, .planning, dist, build,
 *     storybook-static, .vercel, .venv, __screenshots__, bun.lock
 *
 *   bun scripts/rename-fenix.ts <project-name> [--dry-run]
 *
 * Exit codes:
 *   0  — success (or dry-run)
 *   1  — invalid name or no changes possible
 *   2  — internal error
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const NAME_RE = /^[a-z][a-z0-9-]*$/

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.git',
  '.planning',
  'dist',
  'build',
  'storybook-static',
  '.vercel',
  '.venv',
  '__screenshots__',
  'coverage',
])

const SKIP_FILES = new Set(['bun.lock', 'package-lock.json', 'yarn.lock'])

const EXT_RE = /\.(tsx?|jsx?|mjs|cjs|css|json|md)$/

interface Change {
  file: string
  before: number
  after: number
}

function safeStat(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function walk(dir: string, acc: string[] = []): string[] {
  const s = safeStat(dir)
  if (s == null || !s.isDirectory()) return acc
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    if (entry.startsWith('.fenix-initialized')) continue
    const full = join(dir, entry)
    const st = safeStat(full)
    if (st == null) continue
    if (st.isDirectory()) walk(full, acc)
    else if (EXT_RE.test(entry) && !SKIP_FILES.has(entry)) acc.push(full)
  }
  return acc
}

function rewriteContent(
  text: string,
  newName: string,
): { text: string; matches: number } {
  // Match `@fenix/` followed by a valid package-name char. This avoids
  // accidentally touching `@fenix` standalone (the framework name) or
  // composite tokens like `@fenix-foo`.
  const re = /@fenix\/(?=[a-z0-9_-])/g
  const replacement = `@${newName}/`
  let matches = 0
  const rewritten = text.replace(re, () => {
    matches++
    return replacement
  })
  return { text: rewritten, matches }
}

function main(): number {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const positional = argv.filter((a) => !a.startsWith('--'))
  const newName = positional[0]

  if (!newName) {
    process.stderr.write('usage: rename-fenix <project-name> [--dry-run]\n')
    return 1
  }
  if (!NAME_RE.test(newName)) {
    process.stderr.write(
      `rename-fenix: project name "${newName}" must match /^[a-z][a-z0-9-]*$/\n`,
    )
    return 1
  }
  if (newName === 'fenix') {
    process.stderr.write('rename-fenix: nothing to do — name is already "fenix"\n')
    return 0
  }

  const repoRoot = process.cwd()
  const files = walk(repoRoot)
  const changes: Change[] = []
  let totalMatches = 0

  for (const file of files) {
    const before = readFileSync(file, 'utf-8')
    const { text, matches } = rewriteContent(before, newName)
    if (matches === 0) continue
    totalMatches += matches
    changes.push({ file: relative(repoRoot, file), before: matches, after: matches })
    if (!dryRun) writeFileSync(file, text)
  }

  const prefix = dryRun ? '[dry-run] ' : ''
  process.stdout.write(
    `${prefix}rename-fenix: rewrote ${totalMatches} occurrence(s) of @fenix/ → @${newName}/ across ${changes.length} file(s)\n`,
  )
  for (const c of changes) {
    process.stdout.write(`  ${c.before.toString().padStart(3)} × ${c.file}\n`)
  }
  if (!dryRun && changes.length > 0) {
    process.stdout.write(
      '\nrename-fenix: run `bun install` to refresh bun.lock with the new workspace names.\n',
    )
  }
  return 0
}

try {
  process.exit(main())
} catch (err) {
  process.stderr.write(`rename-fenix: ${(err as Error).message}\n`)
  process.exit(2)
}
