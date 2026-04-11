#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { listAddedFiles, parseFlags, printJson, resolveRepoRoot } from './lib/phase.ts'

const HELP = `coverage-audit — assert that a phase shipped its required test artifacts.

Usage:
  bun run scripts/coverage-audit.ts --phase <name> [--base <ref>] [--json]

Options:
  --phase <name>   Phase ID (required). Used for reporting only.
  --base <ref>     Git ref to diff against (defaults to main).
  --json           Emit a machine-readable JSON report.
  --help           Show this help.

Checks performed against files added between <base> and HEAD:
  - Screens or shared components must have a co-located *.stories.tsx.
  - New routes (page.tsx / route.ts) must have a matching e2e spec.
  - New pure-fn modules must have a co-located *.test.ts.

Exit codes: 0 = green, 1 = uncovered files found, 2 = invalid invocation.
`

interface Uncovered {
  file: string
  reason: string
  expected: string[]
}

const SCREEN_RE = /^apps\/[^/]+\/app\/.+\/_components\/screen\.tsx$/
const SHARED_COMPONENT_RE = /^apps\/[^/]+\/components\/.+\.tsx$/
const PAGE_RE = /^apps\/[^/]+\/app\/.+\/page\.tsx$/
const ROUTE_RE = /^apps\/[^/]+\/app\/.+\/route\.ts$/
const APP_LIB_RE = /^apps\/[^/]+\/lib\/.+\.ts$/
const DOMAIN_RE = /^packages\/domain\/.+\.ts$/

function isTestOrStoryFile(file: string): boolean {
  return (
    file.endsWith('.test.ts') ||
    file.endsWith('.test.tsx') ||
    file.endsWith('.stories.tsx') ||
    file.endsWith('.stories.ts') ||
    file.endsWith('.spec.ts') ||
    file.endsWith('.spec.tsx') ||
    file.includes('/__tests__/') ||
    file.includes('/e2e/')
  )
}

function hasCoLocatedStory(root: string, file: string): string | null {
  const dir = join(root, dirname(file))
  const base = file.split('/').pop() ?? ''
  const stem = base.replace(/\.tsx$/, '')
  const candidates = [join(dir, `${stem}.stories.tsx`), join(dir, `${stem}.stories.ts`)]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function hasCoLocatedUnitTest(root: string, file: string): string | null {
  const dir = join(root, dirname(file))
  const base = file.split('/').pop() ?? ''
  const stem = base.replace(/\.ts$/, '')
  const candidates = [
    join(dir, `${stem}.test.ts`),
    join(dir, `${stem}.test.tsx`),
    join(dir, '__tests__', `${stem}.test.ts`),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function findAppName(file: string): string | null {
  const match = /^apps\/([^/]+)\//.exec(file)
  return match ? (match[1] ?? null) : null
}

function hasE2ETest(root: string, file: string): string | null {
  const app = findAppName(file)
  if (!app) return null
  const e2eDir = join(root, 'apps', app, 'e2e')
  if (!existsSync(e2eDir)) return null
  const routeStem = file
    .replace(/^apps\/[^/]+\/app\//, '')
    .replace(/\/page\.tsx$|\/route\.ts$/, '')
    .split('/')
    .filter((seg) => !seg.startsWith('('))
    .join('-')
    .replace(/\[([^\]]+)\]/g, '$1')
  const candidates = [join(e2eDir, `${routeStem || 'index'}.spec.ts`), join(e2eDir, `${routeStem || 'index'}.e2e.ts`)]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  // Fallback: any spec file referencing the route path, so projects with
  // feature-grouped specs still satisfy the gate.
  try {
    const entries = readdirSync(e2eDir)
    const needle = `/${routeStem.replace(/-/g, '/')}`
    for (const entry of entries) {
      if (!entry.endsWith('.spec.ts') && !entry.endsWith('.e2e.ts')) continue
      const contents = readFileSync(join(e2eDir, entry), 'utf8')
      if (contents.includes(needle)) {
        return join(e2eDir, entry)
      }
    }
  } catch {
    // swallow — missing directory or permission falls through to null
  }
  return null
}

function exportsPureFn(root: string, file: string): boolean {
  const full = join(root, file)
  if (!existsSync(full)) return false
  const text = readFileSync(full, 'utf8')
  return /\bexport\s+(?:async\s+)?function\s+\w+/.test(text) || /\bexport\s+const\s+\w+\s*=\s*\(/.test(text)
}

function audit(root: string, files: string[]): Uncovered[] {
  const uncovered: Uncovered[] = []
  for (const file of files) {
    if (isTestOrStoryFile(file)) continue

    if (SCREEN_RE.test(file) || SHARED_COMPONENT_RE.test(file)) {
      if (!hasCoLocatedStory(root, file)) {
        uncovered.push({
          file,
          reason: 'missing co-located Storybook story',
          expected: [file.replace(/\.tsx$/, '.stories.tsx')],
        })
      }
      continue
    }

    if (PAGE_RE.test(file) || ROUTE_RE.test(file)) {
      if (!hasE2ETest(root, file)) {
        const app = findAppName(file) ?? 'app'
        uncovered.push({
          file,
          reason: 'missing Playwright E2E spec for new route',
          expected: [`apps/${app}/e2e/<route>.spec.ts`],
        })
      }
      continue
    }

    if ((APP_LIB_RE.test(file) || DOMAIN_RE.test(file)) && !file.endsWith('.d.ts')) {
      if (exportsPureFn(root, file) && !hasCoLocatedUnitTest(root, file)) {
        uncovered.push({
          file,
          reason: 'module exports functions but has no co-located unit test',
          expected: [file.replace(/\.ts$/, '.test.ts')],
        })
      }
      continue
    }
  }
  return uncovered
}

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const phase = typeof flags.phase === 'string' ? flags.phase : null
  if (!phase) {
    process.stderr.write('coverage-audit: --phase <name> is required. Run with --help for details.\n')
    return 2
  }
  const base = typeof flags.base === 'string' ? flags.base : 'main'
  const json = flags.json === true

  const root = resolveRepoRoot(resolve('.'))
  const added = listAddedFiles({ base, cwd: root })
  const uncovered = audit(root, added)

  if (json) {
    printJson({
      phase,
      base,
      addedFiles: added.length,
      uncovered,
      verdict: uncovered.length === 0 ? 'green' : 'blocked',
    })
  } else {
    process.stdout.write(`coverage-audit phase=${phase} base=${base}\n`)
    process.stdout.write(`  added files: ${added.length}\n`)
    if (uncovered.length === 0) {
      process.stdout.write('  verdict: green\n')
    } else {
      process.stdout.write(`  verdict: BLOCKED (${uncovered.length} uncovered)\n`)
      for (const item of uncovered) {
        process.stdout.write(`    - ${item.file}\n`)
        process.stdout.write(`      reason: ${item.reason}\n`)
        process.stdout.write(`      expected: ${item.expected.join(', ')}\n`)
      }
    }
  }
  return uncovered.length === 0 ? 0 : 1
}

process.exit(main())
