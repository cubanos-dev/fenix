#!/usr/bin/env bun
/**
 * slop-test — gate 6.
 *
 * Two rule families:
 *
 *  HYGIENE (soft) — easy-to-miss code smells that don't ship instant
 *  damage but accumulate. Soft verdict.
 *   1. `// TODO` without an owner (`@<handle>`) or issue link
 *   2. `console.log` / `console.debug` outside test files
 *   3. `: any` type annotations in `apps/` or `packages/` source
 *   4. `// @ts-ignore` / `// @ts-expect-error` without a reason comment
 *   5. `--no-verify` references in code (anti-bypass culture)
 *   6. Hardcoded API keys / secrets (sk_…, pk_…, AKIA…, ghp_…, xox[bp]-…)
 *
 *  IMPECCABLE (HARD) — aesthetic absolute-bans from the design system
 *  contract. Any hit fails the gate. These match the visual identity the
 *  brand-agent established; the loop must defend them across phases.
 *   7. side-stripe accents (border-left / border-right > 1px, or 4px+
 *      border accents on cards/sections)
 *   8. gradient text (background-clip: text + linear|radial|conic gradient
 *      within 8 lines)
 *   9. reflex web fonts — Inter, DM Sans, Plus Jakarta, Instrument Serif,
 *      Geist Mono on prose, etc.; the brand-agent picks one and that's it
 *
 *   bun scripts/slop-test.ts --phase <id>
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { writeGateArtifact, verdictExitCode } from './lib/artifacts'

interface Finding {
  rule: string
  severity: 'soft' | 'hard'
  file: string
  line: number
  excerpt: string
}

const REFLEX_FONTS = [
  'Inter',
  'DM Sans',
  'Plus Jakarta',
  'Plus Jakarta Sans',
  'Instrument Serif',
  'Manrope',
  'Sora',
  'Space Grotesk',
  'Cal Sans',
  'Satoshi',
  'Switzer',
  'General Sans',
  'Clash Display',
  'Clash Grotesk',
  'Roobert',
  'Söhne',
  'Sohne',
  'Fraunces',
  'Lora',
  'Crimson Pro',
  'Source Serif',
  'Spectral',
  'Nunito',
  'Poppins',
  'Quicksand',
]

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'storybook-static',
  '__screenshots__',
  '.git',
  'coverage',
])

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
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const s = safeStat(full)
    if (s == null) continue
    if (s.isDirectory()) walk(full, acc)
    else if (/\.(tsx?|jsx?|css)$/.test(full)) acc.push(full)
  }
  return acc
}

function scanFile(repoRoot: string, abs: string): Finding[] {
  const rel = relative(repoRoot, abs)
  const isTest = /\.(test|spec|stories)\.tsx?$|\/e2e\//.test(rel)
  const isCss = /\.css$/.test(rel)
  const text = readFileSync(abs, 'utf-8')
  const lines = text.split('\n')
  const out: Finding[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lno = i + 1
    // 1. TODO without owner or issue
    if (/\/\/\s*TODO(?!\s*[:(]?\s*(@\w+|#\d+|http))/.test(line)) {
      out.push({
        rule: 'todo-without-owner',
        severity: 'soft',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    // 2. console.log outside tests
    if (!isTest && /\bconsole\.(log|debug)\b/.test(line)) {
      out.push({
        rule: 'console-in-production',
        severity: 'soft',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    // 3. : any
    if (/\.tsx?$/.test(rel) && /:\s*any\b(?!\w)/.test(line)) {
      // Allow `(_: any) => …` only if there's a comment explaining (very lenient).
      if (!/\bunknown\b/.test(line)) {
        out.push({
          rule: 'no-any',
          severity: 'soft',
          file: rel,
          line: lno,
          excerpt: line.trim().slice(0, 200),
        })
      }
    }
    // 4. @ts-ignore / @ts-expect-error without reason
    if (/@ts-(ignore|expect-error)\s*$/.test(line.trim())) {
      out.push({
        rule: 'ts-suppression-without-reason',
        severity: 'soft',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    // 5. --no-verify reference in source
    if (/--no-verify/.test(line) && !rel.endsWith('.md') && !isTest) {
      out.push({
        rule: 'no-verify-in-source',
        severity: 'soft',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    // 6. Hardcoded keys
    if (
      /\b(sk_live_|pk_live_|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[bp]-[A-Za-z0-9-]{20,})\w*/.test(
        line,
      )
    ) {
      out.push({
        rule: 'hardcoded-secret',
        severity: 'soft',
        file: rel,
        line: lno,
        excerpt: '<redacted>',
      })
    }

    // 7. IMPECCABLE: side-stripe accent (border-left / border-right > 1px).
    //    Match CSS/className with explicit pixel value > 1; the design
    //    system never uses side stripes as decoration.
    const sideStripe = line.match(
      /(?:border-(?:left|right))(?:-width)?:\s*([2-9]|\d{2,})px|\bborder-(?:l|r)-(?:[2-9]|\d{2,})\b/,
    )
    if (sideStripe && !isTest) {
      out.push({
        rule: 'impeccable-side-stripe',
        severity: 'hard',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }

    // 8. IMPECCABLE: gradient-text (background-clip:text within 8 lines of
    //    a gradient definition on the same element). Cheap two-line window.
    if (
      /background-clip\s*:\s*text\b|bg-clip-text\b/.test(line) &&
      lines
        .slice(Math.max(0, i - 4), i + 4)
        .some((l) => /(linear|radial|conic)-gradient\b|\bbg-gradient-to-[trblxy]/.test(l))
    ) {
      out.push({
        rule: 'impeccable-gradient-text',
        severity: 'hard',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }

    // 9. IMPECCABLE: reflex web font. Heuristic: a Next/font import for the
    //    reject list, OR a CSS font-family referencing one. Brand-agent
    //    picks the project's font; nothing else may slip in.
    if (
      /next\/font\/google/.test(line) &&
      REFLEX_FONTS.some((f) => new RegExp(`\\b${f.replace(/\s+/g, '_')}\\b`).test(line))
    ) {
      out.push({
        rule: 'impeccable-reflex-font',
        severity: 'hard',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    if (
      isCss &&
      /font-family\s*:/.test(line) &&
      REFLEX_FONTS.some((f) => line.includes(f))
    ) {
      out.push({
        rule: 'impeccable-reflex-font',
        severity: 'hard',
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
  }
  return out
}

function main(): number {
  const startedAt = Date.now()
  const phaseIdx = process.argv.indexOf('--phase')
  if (phaseIdx < 0) {
    process.stderr.write('usage: slop-test --phase <id>\n')
    return 2
  }
  const phase = process.argv[phaseIdx + 1]
  if (!phase) return 2

  const repoRoot = process.cwd()
  const files = [
    ...walk(resolve(repoRoot, 'apps')),
    ...walk(resolve(repoRoot, 'packages')),
    ...walk(resolve(repoRoot, 'scripts')),
    ...walk(resolve(repoRoot, '.claude/scripts')),
  ]
  const findings: Finding[] = []
  for (const f of files) findings.push(...scanFile(repoRoot, f))

  const hardFindings = findings.filter((f) => f.severity === 'hard')
  const softFindings = findings.filter((f) => f.severity === 'soft')

  const byRule = new Map<string, number>()
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
  const reasons: string[] = []
  if (findings.length === 0) reasons.push('No slop')
  else for (const [r, n] of byRule) reasons.push(`${n} × ${r}`)
  if (hardFindings.length > 0) {
    reasons.unshift(
      `${hardFindings.length} impeccable absolute-ban violation(s) — gate fails`,
    )
  }

  // The gate is HARD overall (impeccable bans are blockers), but verdict is
  // soft-warn when only hygiene rules fired.
  const hard = hardFindings.length > 0
  const verdict: 'pass' | 'fail' | 'soft-warn' =
    hard ? 'fail' : softFindings.length > 0 ? 'soft-warn' : 'pass'

  const { path } = writeGateArtifact({
    phase,
    gate: 'slop:test',
    verdict,
    hard,
    startedAt,
    reasons,
    details: { findings, hard_count: hardFindings.length, soft_count: softFindings.length },
  })
  process.stdout.write(
    `slop:test: ${verdict} — ${findings.length} finding(s) → ${relative(repoRoot, path)}\n`,
  )
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)
  return verdictExitCode(verdict, hard)
}

process.exit(main())
