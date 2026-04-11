#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseFlags, printJson, resolveRepoRoot } from './lib/phase.ts'

const HELP = `pattern-audit — pre-write reuse check. Grep for existing utilities before reinventing.

Usage:
  bun run scripts/pattern-audit.ts --symbol <name> [--json]
  bun run scripts/pattern-audit.ts --file <path> [--json]

Options:
  --symbol <name>  Symbol to search for (exact-name export/function).
  --file <path>    TypeScript file — extract its exports and audit each one.
  --json           Emit a machine-readable JSON report.
  --help           Show this help.

This is a soft gate. It exits 0 even when matches exist so the agent can cite
the findings in its plan. The point is to make reuse visible, not to block.
`

interface Candidate {
  file: string
  line: number
  snippet: string
}

interface SymbolReport {
  symbol: string
  candidates: Candidate[]
}

const SEARCH_PATHS = ['packages', 'apps/app/lib', 'apps/app/components', 'apps/web/lib', 'apps/web/components']

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'dist',
  'build',
  'coverage',
  'storybook-static',
])

function walkTsFiles(dir: string, acc: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let info
    try {
      info = statSync(full)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      walkTsFiles(full, acc)
      continue
    }
    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      acc.push(full)
    }
  }
}

function buildSymbolPatterns(symbol: string): RegExp[] {
  const esc = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${esc}\\b`),
    new RegExp(`export\\s+const\\s+${esc}\\b`),
    new RegExp(`export\\s+class\\s+${esc}\\b`),
    new RegExp(`export\\s+type\\s+${esc}\\b`),
    new RegExp(`export\\s+interface\\s+${esc}\\b`),
    new RegExp(`export\\s*\\{[^}]*\\b${esc}\\b[^}]*\\}`),
  ]
}

function grepSymbol(root: string, symbol: string): Candidate[] {
  const files: string[] = []
  for (const rel of SEARCH_PATHS) {
    const abs = join(root, rel)
    if (existsSync(abs)) walkTsFiles(abs, files)
  }
  const patterns = buildSymbolPatterns(symbol)
  const candidates: Candidate[] = []
  for (const file of files) {
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ''
      if (!patterns.some((re) => re.test(line))) continue
      candidates.push({
        file: relative(root, file),
        line: i + 1,
        snippet: line.trim(),
      })
    }
  }
  return candidates
}

function extractExportedSymbols(filePath: string): string[] {
  if (!existsSync(filePath)) return []
  const text = readFileSync(filePath, 'utf8')
  const names = new Set<string>()
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
  ]
  for (const re of patterns) {
    let match: RegExpExecArray | null
    while (true) {
      match = re.exec(text)
      if (match === null) break
      if (match[1]) names.add(match[1])
    }
  }
  // export { foo, bar as baz }
  const reNamed = /export\s*\{([^}]+)\}/g
  let namedMatch: RegExpExecArray | null
  while (true) {
    namedMatch = reNamed.exec(text)
    if (namedMatch === null) break
    const body = namedMatch[1] ?? ''
    for (const part of body.split(',')) {
      const bare = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
      if (bare && /^[A-Za-z_]\w*$/.test(bare)) names.add(bare)
    }
  }
  return Array.from(names)
}

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const symbol = typeof flags.symbol === 'string' ? flags.symbol : null
  const file = typeof flags.file === 'string' ? flags.file : null
  const json = flags.json === true

  if (!symbol && !file) {
    process.stderr.write('pattern-audit: --symbol or --file is required. Run with --help.\n')
    return 2
  }

  const root = resolveRepoRoot(resolve('.'))
  const reports: SymbolReport[] = []

  if (symbol) {
    reports.push({ symbol, candidates: grepSymbol(root, symbol) })
  }

  if (file) {
    const symbols = extractExportedSymbols(resolve(file))
    if (symbols.length === 0) {
      reports.push({ symbol: file, candidates: [] })
    } else {
      for (const name of symbols) {
        reports.push({ symbol: name, candidates: grepSymbol(root, name) })
      }
    }
  }

  const totalCandidates = reports.reduce((acc, r) => acc + r.candidates.length, 0)

  if (json) {
    printJson({
      scope: symbol ?? file,
      totalCandidates,
      reports,
    })
  } else {
    for (const report of reports) {
      process.stdout.write(`pattern-audit symbol=${report.symbol}\n`)
      if (report.candidates.length === 0) {
        process.stdout.write('  no existing utilities match\n')
        continue
      }
      process.stdout.write(`  WARNING: ${report.candidates.length} candidate(s) exist — cite before authoring\n`)
      for (const c of report.candidates) {
        process.stdout.write(`    ${c.file}:${c.line}  ${c.snippet}\n`)
      }
    }
  }
  return 0
}

process.exit(main())
