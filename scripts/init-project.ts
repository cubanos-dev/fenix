#!/usr/bin/env bun
/**
 * init-project — `bun create fenix <name>` entrypoint, also runnable as
 * `bun scripts/init-project.ts` against a fresh `git clone`.
 *
 * What it does:
 *   1. Verify cwd looks like a Fenix clone (has package.json named "fenix"
 *      or a workspace using @fenix/* deps).
 *   2. Reset git history (rm -rf .git; git init; first empty commit) so
 *      downstream history starts clean — the Fenix framework's own commit
 *      log shouldn't pollute the new project.
 *   3. Remove source-only artifacts:
 *        - .claude/plans/        (Fenix design plans, not downstream's)
 *        - docs/PRODUCT.md       (Fenix-as-product overview)
 *        - .fenix-initialized    (any stale marker)
 *   4. `bun install`             (refresh workspace deps under the new
 *                                 layout — though no renames yet; that
 *                                 happens in /fenix-init)
 *   5. Write `.fenix-initialized` marker.
 *   6. Print next steps:
 *        Run `claude` then `/fenix-init` to walk the 7 setup questions.
 *
 * Safe to re-run: the marker file makes step 1-5 a no-op on the second
 * call. /fenix-init handles the user-facing configuration (USER_IDEA,
 * package renames, MCP wiring, etc.).
 *
 *   bun scripts/init-project.ts [--force] [--skip-install]
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const MARKER = '.fenix-initialized'

function fail(msg: string, code = 1): never {
  process.stderr.write(`init-project: ${msg}\n`)
  process.exit(code)
}

function step(label: string): void {
  process.stdout.write(`▶ ${label}\n`)
}

function run(cmd: string, args: string[]): void {
  const res = spawnSync(cmd, args, { stdio: 'inherit' })
  if (res.status !== 0) fail(`${cmd} ${args.join(' ')} exited ${res.status}`, 2)
}

function main(): number {
  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const skipInstall = argv.includes('--skip-install')

  const repoRoot = process.cwd()
  const markerPath = resolve(repoRoot, MARKER)
  const rootPkgPath = resolve(repoRoot, 'package.json')

  if (!existsSync(rootPkgPath)) {
    fail('no package.json found in cwd — run this from a Fenix clone root')
  }
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8')) as {
    name?: string
    workspaces?: string[]
  }
  if (rootPkg.name !== 'fenix' && !Array.isArray(rootPkg.workspaces)) {
    fail(
      `package.json at ${repoRoot} does not look like a Fenix clone (name="${rootPkg.name}")`,
    )
  }

  if (existsSync(markerPath) && !force) {
    process.stdout.write(
      `init-project: ${MARKER} already exists — this clone has been initialized. Pass --force to re-run.\n`,
    )
    return 0
  }

  // 1. Reset git history.
  step('reset .git history')
  rmSync(resolve(repoRoot, '.git'), { recursive: true, force: true })
  run('git', ['init', '--initial-branch=main'])

  // 2. Drop source-only files.
  step('drop fenix-source-only artifacts')
  for (const p of ['.claude/plans', 'docs/PRODUCT.md']) {
    const full = resolve(repoRoot, p)
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true })
      process.stdout.write(`  removed ${p}\n`)
    }
  }

  // 3. `bun install`.
  if (!skipInstall) {
    step('bun install')
    run('bun', ['install'])
  } else {
    step('skipping bun install (--skip-install)')
  }

  // 4. Marker.
  step(`write ${MARKER}`)
  writeFileSync(markerPath, `${new Date().toISOString()}\n`)

  // 5. Initial empty commit so the user has a base to commit on top of.
  step('create initial commit')
  run('git', ['add', '-A'])
  run('git', ['commit', '-m', 'chore: clean fenix clone — ready for /fenix-init'])

  // 6. Next steps.
  process.stdout.write(`
init-project: done.

Next steps:
  1. Open this directory with Claude Code:    claude
  2. Inside Claude, run the scaffolder:        /fenix-init
     (walks 7 setup questions, renames @fenix/* packages to your
      project name, configures MCPs, writes USER_IDEA.md)
  3. Start the loop:                           /fenix-auto research

Optional environment:
  - PENCIL_CLI_KEY     authenticate the Pencil CLI for Stage 2 design
  - DATABASE_URL       Neon connection (set via vercel env pull .env.local)
  - BETTER_AUTH_SECRET configured via the auth opt-in flow

`)
  return 0
}

try {
  process.exit(main())
} catch (err) {
  fail((err as Error).message, 2)
}
