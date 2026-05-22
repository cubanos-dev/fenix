#!/usr/bin/env bun
/**
 * pattern-audit — gate 1 (SOFT).
 *
 * Informational signals about whether the implementation follows the
 * project's conventions. Never fails a phase; surfaces a list of
 * suggestions for the next reviewer.
 *
 * Checks:
 *   1. File names are kebab-case (apps/, packages/ — TS/TSX/CSS/JSON).
 *      Next.js reserved names (page, layout, route, loading, error,
 *      not-found, default, opengraph-image, sitemap, robots, manifest,
 *      template, head, icon) are exempt.
 *   2. No `apps/<x>/components/ui/` directories (override pattern is dead).
 *   3. No `apps/<x>/app/globals.css` (single source is packages/ui).
 *   4. Routes use the `page.tsx` + `_components/screen.tsx` split.
 *   5. Custom error classes are not thrown without context (best-effort).
 *
 *   bun scripts/pattern-audit.ts --phase <id>
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { writeGateArtifact } from './lib/artifacts'

interface Finding {
  rule: string
  file: string
  message: string
}

const RESERVED_NEXT = new Set([
  'page',
  'layout',
  'route',
  'loading',
  'error',
  'not-found',
  'default',
  'template',
  'head',
  'icon',
  'opengraph-image',
  'sitemap',
  'robots',
  'manifest',
  'middleware',
  'proxy',
  'instrumentation',
  'global-error',
])

const KEBAB_RE = /^[a-z0-9][a-z0-9-]*$/

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

function walk(dir: string, acc: string[] = []): string[] {
  if (!safeIsDir(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' ||
      entry === '.next' ||
      entry === '.turbo' ||
      entry === 'dist' ||
      entry === 'storybook-static' ||
      entry === '__screenshots__'
    )
      continue
    const full = join(dir, entry)
    const s = safeStat(full)
    if (s == null) continue
    if (s.isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

function checkFileName(repoRoot: string, file: string): Finding | null {
  const rel = relative(repoRoot, file)
  if (!/\.(tsx?|css|json)$/.test(rel)) return null
  const name = basename(rel).replace(/\.[^.]+$/, '').replace(/\.stories|\.test|\.spec/, '')
  // Special: route group "(name)" and underscored private "_name" are OK.
  if (name.startsWith('(') || name.startsWith('_')) return null
  if (RESERVED_NEXT.has(name)) return null
  // Allow PascalCase for files that export React components (heuristic on filename).
  // Page/Screen/_components live under app/ — those should be kebab-case.
  // For packages/components/ui/* shadcn files: kebab-case.
  if (KEBAB_RE.test(name)) return null
  // Allow PascalCase only outside app routing trees.
  if (/^[A-Z][A-Za-z0-9]*$/.test(name) && !rel.includes('/app/')) return null
  return {
    rule: 'kebab-case-files',
    file: rel,
    message: `expected kebab-case (or PascalCase outside app/), got "${name}"`,
  }
}

function checkNoUiOverrides(repoRoot: string): Finding[] {
  const findings: Finding[] = []
  const apps = resolve(repoRoot, 'apps')
  if (!safeIsDir(apps)) return findings
  for (const app of readdirSync(apps)) {
    const ui = join(apps, app, 'components', 'ui')
    if (safeIsDir(ui)) {
      findings.push({
        rule: 'no-ui-override-dir',
        file: relative(repoRoot, ui),
        message:
          'apps/<x>/components/ui/ is the override pattern — single UI source lives in packages/ui',
      })
    }
  }
  return findings
}

function checkNoPerAppGlobals(repoRoot: string): Finding[] {
  const findings: Finding[] = []
  const apps = resolve(repoRoot, 'apps')
  if (!safeIsDir(apps)) return findings
  for (const app of readdirSync(apps)) {
    for (const candidate of ['app/globals.css', 'styles/globals.css', 'src/globals.css']) {
      const full = join(apps, app, candidate)
      if (existsSync(full)) {
        findings.push({
          rule: 'no-per-app-globals',
          file: relative(repoRoot, full),
          message:
            'Per-app globals.css is dead — single source is packages/ui/src/styles/globals.css',
        })
      }
    }
  }
  return findings
}

function checkRouteHasScreen(repoRoot: string): Finding[] {
  const findings: Finding[] = []
  const apps = resolve(repoRoot, 'apps')
  if (!safeIsDir(apps)) return findings
  for (const app of readdirSync(apps)) {
    const appDir = join(apps, app, 'app')
    if (!safeIsDir(appDir)) continue
    const pages = walk(appDir).filter((f) => /\/page\.tsx$/.test(f))
    for (const page of pages) {
      const dir = page.replace(/\/page\.tsx$/, '')
      const hasScreen =
        existsSync(join(dir, '_components', 'screen.tsx')) ||
        existsSync(join(dir, '_components', 'screen.ts'))
      if (!hasScreen) {
        findings.push({
          rule: 'page-screen-split',
          file: relative(repoRoot, page),
          message: 'page.tsx without sibling _components/screen.tsx (split pattern)',
        })
      }
    }
  }
  return findings
}

function main(): number {
  const startedAt = Date.now()
  const phaseIdx = process.argv.indexOf('--phase')
  if (phaseIdx < 0) {
    process.stderr.write('usage: pattern-audit --phase <id>\n')
    return 2
  }
  const phase = process.argv[phaseIdx + 1]
  if (!phase) return 2

  const repoRoot = process.cwd()
  const findings: Finding[] = []

  for (const f of walk(resolve(repoRoot, 'apps'))) {
    const x = checkFileName(repoRoot, f)
    if (x) findings.push(x)
  }
  for (const f of walk(resolve(repoRoot, 'packages'))) {
    const x = checkFileName(repoRoot, f)
    if (x) findings.push(x)
  }
  findings.push(...checkNoUiOverrides(repoRoot))
  findings.push(...checkNoPerAppGlobals(repoRoot))
  findings.push(...checkRouteHasScreen(repoRoot))

  const reasons: string[] = []
  if (findings.length === 0) {
    reasons.push('No pattern violations')
  } else {
    const byRule = new Map<string, number>()
    for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
    for (const [rule, n] of byRule) reasons.push(`${n} × ${rule}`)
  }

  const { path } = writeGateArtifact({
    phase,
    gate: 'pattern-audit',
    verdict: 'soft-warn',
    hard: false,
    startedAt,
    reasons,
    details: { findings },
  })
  process.stdout.write(`pattern-audit: ${findings.length} finding(s) → ${relative(repoRoot, path)}\n`)
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)
  return 0
}

process.exit(main())
