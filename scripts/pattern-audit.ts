#!/usr/bin/env bun
/**
 * pattern-audit — gate 1.
 *
 * Two rule families:
 *
 *  SOFT — informational conventions. Surface as suggestions; never block.
 *   1. File names are kebab-case (apps/, packages/ — TS/TSX/CSS/JSON).
 *      Next.js reserved names (page, layout, route, loading, error,
 *      not-found, default, opengraph-image, sitemap, robots, manifest,
 *      template, head, icon) are exempt.
 *   2. No `apps/<x>/components/ui/` directories (override pattern is dead).
 *   3. No `apps/<x>/app/globals.css` (single source is packages/ui).
 *   4. Routes use the `page.tsx` + `_components/screen.tsx` split.
 *
 *  HARD — import-graph boundaries. Architectural invariants the brand-agent
 *  + design system depend on. Replace the deleted ESLint boundaries plugin.
 *   5. apps/web ⇎ apps/app — the two apps deploy independently; cross-
 *      imports couple them and leak server-only env into the public bundle.
 *   6. packages/ui MUST NOT import @scope/db, @scope/auth, @scope/storage —
 *      the design-system package stays browser-safe; queries belong in apps.
 *   7. packages/domain is a LEAF — no imports of other workspace packages.
 *   8. Route components MUST NOT import @scope/db directly — Server Actions
 *      or route handlers wrap data access (matches CLAUDE.md guidance).
 *
 *   bun scripts/pattern-audit.ts --phase <id>
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { writeGateArtifact, verdictExitCode } from './lib/artifacts'

interface Finding {
  rule: string
  severity: 'soft' | 'hard'
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
    severity: 'soft',
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
        severity: 'soft',
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
          severity: 'soft',
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
          severity: 'soft',
          file: relative(repoRoot, page),
          message: 'page.tsx without sibling _components/screen.tsx (split pattern)',
        })
      }
    }
  }
  return findings
}

// --- Import-graph boundary checks (HARD) ----------------------------------
//
// Re-encodes what the deleted packages/config/eslint/boundaries.mjs
// enforced. The workspace prefix `@<project>/*` is derived from the root
// package.json `name` field's leading scope so this works for any
// downstream rename of `@fenix/*` (e.g. /fenix-init writes `@thera-desk/*`).
//
// Patterns we extract:
//   import … from '<spec>'
//   import('…') and require('…')
// We only care about workspace package names ('@scope/<name>'), not deep
// imports or third-party.

function detectWorkspaceScope(repoRoot: string): string | null {
  const root = resolve(repoRoot, 'package.json')
  if (!existsSync(root)) return null
  try {
    const pkg = JSON.parse(readFileSync(root, 'utf-8')) as { name?: string }
    if (!pkg.name) return null
    const m = pkg.name.match(/^(@[^/]+)\//)
    if (m) return m[1]
    if (pkg.name.startsWith('@')) return pkg.name
    return null
  } catch {
    return null
  }
}

function importSpecifiers(src: string): string[] {
  const out: string[] = []
  const patterns = [
    /\bimport\s+(?:[^'"\n]*?\bfrom\s+)?['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const m of src.matchAll(re)) out.push(m[1])
  }
  return out
}

function isLeafName(spec: string, scope: string, leaf: string): boolean {
  return spec === `${scope}/${leaf}` || spec.startsWith(`${scope}/${leaf}/`)
}

interface PackageZone {
  zone: 'apps/web' | 'apps/app' | 'apps/fenix' | 'packages/ui' | 'packages/domain' | 'other'
  isRouteFile: boolean
}

function classifyFile(repoRoot: string, abs: string): PackageZone {
  const rel = relative(repoRoot, abs)
  const isRouteFile = /^apps\/[^/]+\/app\//.test(rel) && /\/(page|route|layout)\.tsx?$/.test(rel)
  if (rel.startsWith('apps/web/')) return { zone: 'apps/web', isRouteFile }
  if (rel.startsWith('apps/app/')) return { zone: 'apps/app', isRouteFile }
  if (rel.startsWith('apps/fenix/')) return { zone: 'apps/fenix', isRouteFile }
  if (rel.startsWith('packages/ui/')) return { zone: 'packages/ui', isRouteFile }
  if (rel.startsWith('packages/domain/')) return { zone: 'packages/domain', isRouteFile }
  return { zone: 'other', isRouteFile }
}

function checkImportBoundaries(repoRoot: string): Finding[] {
  const findings: Finding[] = []
  const scope = detectWorkspaceScope(repoRoot)
  if (!scope) return findings

  const files = [
    ...walk(resolve(repoRoot, 'apps')),
    ...walk(resolve(repoRoot, 'packages')),
  ].filter((f) => /\.(ts|tsx|mjs|js|jsx)$/.test(f) && !/\.(test|spec|stories)\./.test(f))

  for (const file of files) {
    const rel = relative(repoRoot, file)
    const { zone, isRouteFile } = classifyFile(repoRoot, file)
    if (zone === 'other') continue
    const src = readFileSync(file, 'utf-8')
    const specs = importSpecifiers(src)

    for (const spec of specs) {
      // apps cross-imports
      if (zone === 'apps/web' && spec.startsWith('apps/app/')) {
        findings.push({
          rule: 'no-cross-app-import',
          severity: 'hard',
          file: rel,
          message: `apps/web imports apps/app via "${spec}" — apps deploy independently`,
        })
      }
      if (zone === 'apps/app' && spec.startsWith('apps/web/')) {
        findings.push({
          rule: 'no-cross-app-import',
          severity: 'hard',
          file: rel,
          message: `apps/app imports apps/web via "${spec}" — apps deploy independently`,
        })
      }
      // packages/ui server-only-package leakage
      if (zone === 'packages/ui') {
        for (const leaf of ['db', 'auth', 'storage']) {
          if (isLeafName(spec, scope, leaf)) {
            findings.push({
              rule: 'ui-no-server-package',
              severity: 'hard',
              file: rel,
              message: `packages/ui imports "${spec}" — UI must stay browser-safe (move query to the app)`,
            })
          }
        }
      }
      // packages/domain is a leaf
      if (zone === 'packages/domain' && spec.startsWith(`${scope}/`)) {
        findings.push({
          rule: 'domain-is-leaf',
          severity: 'hard',
          file: rel,
          message: `packages/domain imports workspace package "${spec}" — domain must remain a leaf`,
        })
      }
      // Route file → @<scope>/db direct
      if (isRouteFile && isLeafName(spec, scope, 'db')) {
        findings.push({
          rule: 'route-no-direct-db',
          severity: 'hard',
          file: rel,
          message: `route file imports "${spec}" — wrap data access in a Server Action or route handler`,
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
  findings.push(...checkImportBoundaries(repoRoot))

  const hardFindings = findings.filter((f) => f.severity === 'hard')
  const softFindings = findings.filter((f) => f.severity === 'soft')

  const reasons: string[] = []
  if (findings.length === 0) {
    reasons.push('No pattern violations')
  } else {
    const byRule = new Map<string, number>()
    for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
    for (const [rule, n] of byRule) reasons.push(`${n} × ${rule}`)
  }
  if (hardFindings.length > 0) {
    reasons.unshift(
      `${hardFindings.length} import-graph boundary violation(s) — gate fails`,
    )
  }

  const hard = hardFindings.length > 0
  const verdict: 'pass' | 'fail' | 'soft-warn' =
    hard ? 'fail' : softFindings.length > 0 ? 'soft-warn' : 'pass'

  const { path } = writeGateArtifact({
    phase,
    gate: 'pattern:audit',
    verdict,
    hard,
    startedAt,
    reasons,
    details: { findings, hard_count: hardFindings.length, soft_count: softFindings.length },
  })
  process.stdout.write(`pattern:audit: ${verdict} — ${findings.length} finding(s) → ${relative(repoRoot, path)}\n`)
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)
  return verdictExitCode(verdict, hard)
}

process.exit(main())
