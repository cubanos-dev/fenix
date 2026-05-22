#!/usr/bin/env bun
/**
 * coverage-audit — gate 2 (HARD).
 *
 * Three coverage checks per phase:
 *   1. Every State Enumeration entry has a Storybook story with a matching
 *      `@state-id <id>` JSDoc tag.
 *   2. Every route under `apps/<x>/app/**` (page.tsx | route.ts) has at
 *      least one E2E spec under `apps/<x>/e2e/**` that references it.
 *   3. Every exported pure function in a packages/<x>/src tree has a
 *      co-located `.test.ts` covering it (we check file presence; the
 *      `validate` gate verifies the tests actually pass).
 *
 *   bun scripts/coverage-audit.ts --phase <id>
 *
 * Writes `.planning/phases/<id>/.artifacts/coverage-audit.json`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { readPlan, allStates } from './lib/plan'
import { writeGateArtifact, verdictExitCode } from './lib/artifacts'

interface CoverageDetails {
  states: { declared: string[]; covered: string[]; missing: string[] }
  routes: {
    all: string[]
    covered: string[]
    missing: Array<{ route: string; reason: string }>
  }
  units: {
    candidates: string[]
    covered: string[]
    missing: string[]
  }
}

function findFiles(
  dir: string,
  filter: (full: string) => boolean,
  acc: string[] = [],
): string[] {
  if (!safeIsDir(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    if (entry === '.turbo' || entry === 'storybook-static') continue
    const full = join(dir, entry)
    const s = safeStat(full)
    if (s == null) continue
    if (s.isDirectory()) findFiles(full, filter, acc)
    else if (filter(full)) acc.push(full)
  }
  return acc
}

function safeStat(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function safeIsDir(p: string): boolean {
  const s = safeStat(p)
  return s != null && s.isDirectory()
}

function scanStoryStateIds(repoRoot: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const stories = [
    ...findFiles(resolve(repoRoot, 'apps'), (f) => /\.stories\.tsx?$/.test(f)),
    ...findFiles(resolve(repoRoot, 'packages'), (f) => /\.stories\.tsx?$/.test(f)),
  ]
  for (const file of stories) {
    const src = readFileSync(file, 'utf-8')
    const tags = [...src.matchAll(/@state-id\s+([a-z0-9][a-z0-9-]*)/gi)].map((m) => m[1])
    if (tags.length === 0) continue
    out.set(relative(repoRoot, file), tags)
  }
  return out
}

function listRoutes(repoRoot: string): string[] {
  const out: string[] = []
  const appsDir = resolve(repoRoot, 'apps')
  if (!safeIsDir(appsDir)) return out
  for (const app of readdirSync(appsDir)) {
    const appDir = join(appsDir, app, 'app')
    if (!safeIsDir(appDir)) continue
    findFiles(appDir, (f) => /\/(page|route)\.tsx?$/.test(f)).forEach((f) => {
      out.push(relative(repoRoot, f))
    })
  }
  return out
}

function routeToPath(routeFile: string): string {
  // apps/app/app/(dash)/billing/page.tsx → /billing
  // apps/app/app/api/users/route.ts        → /api/users
  const after = routeFile.replace(/^apps\/[^/]+\/app/, '')
  return after
    .replace(/\/(page|route)\.tsx?$/, '')
    .replace(/\/\([^)]+\)/g, '') // route groups
    .replace(/^$/, '/')
}

function listE2ESpecs(repoRoot: string): string[] {
  const out: string[] = []
  const appsDir = resolve(repoRoot, 'apps')
  if (!safeIsDir(appsDir)) return out
  for (const app of readdirSync(appsDir)) {
    const e2eDir = join(appsDir, app, 'e2e')
    if (!safeIsDir(e2eDir)) continue
    findFiles(e2eDir, (f) => /\.spec\.tsx?$/.test(f)).forEach((f) => {
      out.push(relative(repoRoot, f))
    })
  }
  return out
}

function listPackageExports(repoRoot: string): string[] {
  const out: string[] = []
  const pkgDir = resolve(repoRoot, 'packages')
  if (!safeIsDir(pkgDir)) return out
  for (const pkg of readdirSync(pkgDir)) {
    const src = join(pkgDir, pkg, 'src')
    if (!safeIsDir(src)) continue
    findFiles(src, (f) => /\.tsx?$/.test(f) && !/\.(test|stories|d)\.tsx?$/.test(f)).forEach(
      (f) => {
        out.push(relative(repoRoot, f))
      },
    )
  }
  return out
}

function hasCoLocatedTest(unit: string, repoRoot: string): boolean {
  const candidates = [
    unit.replace(/\.tsx?$/, '.test.ts'),
    unit.replace(/\.tsx?$/, '.test.tsx'),
  ]
  return candidates.some((c) => safeStat(resolve(repoRoot, c)) != null)
}

function main(): number {
  const startedAt = Date.now()
  const argv = process.argv.slice(2)
  const phaseIdx = argv.indexOf('--phase')
  if (phaseIdx < 0) {
    process.stderr.write('usage: coverage-audit --phase <id>\n')
    return 2
  }
  const phase = argv[phaseIdx + 1]
  if (!phase) {
    process.stderr.write('--phase requires a phase id\n')
    return 2
  }

  const repoRoot = process.cwd()
  const plan = readPlan(phase, repoRoot)
  const declaredStates = allStates(plan)

  // 1. State coverage
  const storyMap = scanStoryStateIds(repoRoot)
  const allCoveredStateIds = new Set<string>()
  for (const tags of storyMap.values()) for (const t of tags) allCoveredStateIds.add(t)
  const missingStates = declaredStates.filter((s) => !allCoveredStateIds.has(s))

  // 2. Route coverage
  const routes = listRoutes(repoRoot)
  const routePaths = routes.map((r) => ({ file: r, path: routeToPath(r) }))
  const specs = listE2ESpecs(repoRoot)
  const specBodies = new Map(specs.map((s) => [s, readFileSync(resolve(repoRoot, s), 'utf-8')]))
  const missingRoutes: Array<{ route: string; reason: string }> = []
  const coveredRoutes: string[] = []
  for (const { file, path } of routePaths) {
    const referenced = [...specBodies.values()].some((body) =>
      body.includes(path === '/' ? "'/'" : path),
    )
    if (referenced) coveredRoutes.push(file)
    else
      missingRoutes.push({
        route: file,
        reason: `no E2E spec under apps/*/e2e/ references "${path}"`,
      })
  }

  // 3. Unit test coverage
  const units = listPackageExports(repoRoot)
  const unitCovered: string[] = []
  const unitMissing: string[] = []
  for (const u of units) {
    if (hasCoLocatedTest(u, repoRoot)) unitCovered.push(u)
    else unitMissing.push(u)
  }

  const reasons: string[] = []
  if (declaredStates.length === 0) {
    reasons.push(
      'State Enumeration is empty — contract author has not filled it yet (run /fenix-auto build to author the contract)',
    )
  }
  if (missingStates.length > 0) {
    reasons.push(
      `${missingStates.length} declared state(s) without a matching @state-id story: ${missingStates.join(', ')}`,
    )
  }
  if (missingRoutes.length > 0) {
    reasons.push(`${missingRoutes.length} route(s) without an E2E spec`)
  }
  if (unitMissing.length > 0) {
    reasons.push(`${unitMissing.length} package export(s) without a co-located *.test.ts`)
  }

  // The HARD verdict: fail if any of the three coverage classes is short
  // AND that class actually has something to cover. An empty repo passes
  // soft-warn (nothing to verify) so the gate doesn't block bootstrap.
  let verdict: 'pass' | 'fail' | 'soft-warn' = 'pass'
  if (declaredStates.length === 0 && routes.length === 0 && units.length === 0) {
    verdict = 'soft-warn'
    reasons.push('No states, routes, or package exports yet — gate skipped on empty repo')
  } else if (
    missingStates.length > 0 ||
    missingRoutes.length > 0 ||
    unitMissing.length > 0
  ) {
    verdict = 'fail'
  }

  const details: CoverageDetails = {
    states: {
      declared: declaredStates,
      covered: declaredStates.filter((s) => allCoveredStateIds.has(s)),
      missing: missingStates,
    },
    routes: { all: routes, covered: coveredRoutes, missing: missingRoutes },
    units: { candidates: units, covered: unitCovered, missing: unitMissing },
  }

  const { path } = writeGateArtifact({
    phase,
    gate: 'coverage-audit',
    verdict,
    hard: true,
    startedAt,
    reasons,
    details,
  })

  process.stdout.write(
    `coverage-audit: ${verdict} (${reasons.length} reason${reasons.length === 1 ? '' : 's'}) → ${relative(repoRoot, path)}\n`,
  )
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)

  return verdictExitCode(verdict, true)
}

process.exit(main())
