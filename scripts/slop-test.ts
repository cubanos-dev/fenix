#!/usr/bin/env bun
/**
 * slop-test — gate 6 (SOFT).
 *
 * Absolute-bans on shoddy code that's easy to introduce and hard to catch
 * in lint. Never fails a phase; surfaces violations for the next reviewer.
 *
 * Bans:
 *   1. `// TODO` without an owner (`@<handle>`) or issue link
 *   2. `console.log` / `console.debug` outside test files
 *   3. `: any` type annotations in `apps/` or `packages/` source
 *   4. `// @ts-ignore` / `// @ts-expect-error` without a reason comment
 *   5. `--no-verify` references in code (anti-bypass culture)
 *   6. Hardcoded API keys / secrets that look like real credentials
 *      (sk_…, pk_…, AKIA…, ghp_…, etc.)
 *
 *   bun scripts/slop-test.ts --phase <id>
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { writeGateArtifact } from './lib/artifacts'

interface Finding {
  rule: string
  file: string
  line: number
  excerpt: string
}

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
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    // 2. console.log outside tests
    if (!isTest && /\bconsole\.(log|debug)\b/.test(line)) {
      out.push({
        rule: 'console-in-production',
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
        file: rel,
        line: lno,
        excerpt: line.trim().slice(0, 200),
      })
    }
    // 5. --no-verify reference in source
    if (/--no-verify/.test(line) && !rel.endsWith('.md') && !isTest) {
      out.push({
        rule: 'no-verify-in-source',
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
        file: rel,
        line: lno,
        excerpt: '<redacted>',
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

  const byRule = new Map<string, number>()
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
  const reasons: string[] = []
  if (findings.length === 0) reasons.push('No slop')
  else for (const [r, n] of byRule) reasons.push(`${n} × ${r}`)

  const { path } = writeGateArtifact({
    phase,
    gate: 'slop-test',
    verdict: 'soft-warn',
    hard: false,
    startedAt,
    reasons,
    details: { findings },
  })
  process.stdout.write(
    `slop-test: ${findings.length} finding(s) → ${relative(repoRoot, path)}\n`,
  )
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)
  return 0
}

process.exit(main())
