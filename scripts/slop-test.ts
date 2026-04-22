#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { listChangedFiles, parseFlags, printJson, resolveRepoRoot } from './lib/phase.ts'
import {
  type Finding,
  type FindingKind,
  SCANNED_EXTENSIONS,
  fileExtension,
  scanText,
} from './lib/slop-patterns.ts'

const HELP = `slop-test — scan the current diff for impeccable's absolute-ban CSS patterns.

Usage:
  bun run scripts/slop-test.ts [--base <ref>] [--phase <id>] [--json] [--strict]

Options:
  --base <ref>    Git ref to diff against (defaults to main).
  --phase <id>    Phase id for reporting (informational, does not filter files).
  --json          Emit a machine-readable JSON report.
  --strict        Exit non-zero when findings are present (default: always exit 0 — informational).
  --help          Show this help.

Patterns flagged:
  - Side-stripe accents: border-left or border-right with width > 1px
  - Gradient text:       background-clip:text paired with a gradient background
  - Reflex-font imports: fonts on impeccable's reject list imported via next/font/google or @import

Geist (Fenix default) and any font listed in the allowlist are never flagged.
`

interface Report {
  base: string
  phase: string | null
  filesScanned: number
  findings: Finding[]
}

function scanFile(root: string, file: string): Finding[] {
  const ext = fileExtension(file)
  if (!SCANNED_EXTENSIONS.has(ext)) return []
  let text: string
  try {
    text = readFileSync(resolve(root, file), 'utf8')
  } catch {
    return []
  }
  return scanText(text, file)
}

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const base = typeof flags.base === 'string' ? flags.base : 'main'
  const phase = typeof flags.phase === 'string' ? flags.phase : null
  const json = flags.json === true
  const strict = flags.strict === true

  const root = resolveRepoRoot(resolve('.'))
  const changed = listChangedFiles({ base, cwd: root })
  const findings: Finding[] = []
  let filesScanned = 0
  for (const file of changed) {
    const ext = fileExtension(file)
    if (!SCANNED_EXTENSIONS.has(ext)) continue
    filesScanned += 1
    findings.push(...scanFile(root, file))
  }

  const report: Report = { base, phase, filesScanned, findings }

  if (json) {
    printJson(report)
  } else {
    const scope = phase ? `phase=${phase} ` : ''
    process.stdout.write(`slop-test ${scope}base=${base}\n`)
    process.stdout.write(`  files scanned: ${filesScanned}\n`)
    process.stdout.write(`  findings:      ${findings.length}\n`)
    if (findings.length > 0) {
      const grouped = new Map<FindingKind, Finding[]>()
      for (const f of findings) {
        const bucket = grouped.get(f.kind) ?? []
        bucket.push(f)
        grouped.set(f.kind, bucket)
      }
      for (const [kind, items] of grouped) {
        process.stdout.write(`\n  [${kind}] ${items.length} finding(s):\n`)
        for (const f of items) {
          process.stdout.write(`    ${f.file}:${f.line}\n`)
          process.stdout.write(`      ${f.snippet}\n`)
          if (f.note) process.stdout.write(`      → ${f.note}\n`)
        }
      }
      process.stdout.write(`\n  informational — impeccable absolute bans flagged. Review and rewrite.\n`)
    }
  }

  if (findings.length === 0) return 0
  return strict ? 1 : 0
}

process.exit(main())
