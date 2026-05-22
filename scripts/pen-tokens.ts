#!/usr/bin/env bun
/**
 * pen-tokens — utility.
 *
 * Sanity-checks that the design tokens declared in the active pen
 * (via Pencil variables) line up with the canonical shadcn theme at
 * `packages/ui/src/styles/globals.css`. Since the brand-agent writes
 * the theme once at Stage 1 and the design-runner passes it to Pencil
 * via `--prompt-file`, drift here is unexpected — it would mean the
 * theme was re-authored without the pen following.
 *
 * Implementation: parse the canonical CSS for every `--<token>` declaration
 * (under `:root` and `.dark`); read the pen's exported tokens via the
 * `pencil export-tokens` CLI (or `pens/inventory/tokens.json` if present);
 * compare value-by-value, report drift, never fail (warn only).
 *
 *   bun scripts/pen-tokens.ts --version <v>
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { relative, resolve } from 'node:path'

interface Token {
  name: string
  value: string
}

interface DriftRecord {
  name: string
  css_value: string | null
  pen_value: string | null
  status: 'match' | 'drift' | 'pen-only' | 'css-only'
}

function parseCssTokens(text: string, selector: string): Map<string, string> {
  // Find the block: `:root { … }` or `.dark { … }`
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\}`, 'g')
  const m = re.exec(text)
  if (!m) return new Map()
  const out = new Map<string, string>()
  for (const line of m[1].split('\n')) {
    const decl = line.match(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);?/)
    if (decl) out.set(decl[1], decl[2].trim())
  }
  return out
}

function readPenTokens(repoRoot: string, version: string): Token[] | null {
  const stub = resolve(repoRoot, 'pens', 'inventory', `${version}.tokens.json`)
  if (existsSync(stub)) {
    try {
      const parsed = JSON.parse(readFileSync(stub, 'utf-8')) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (t): t is Token =>
            typeof t === 'object' &&
            t != null &&
            typeof (t as Token).name === 'string' &&
            typeof (t as Token).value === 'string',
        )
      }
    } catch {
      /* fall through to CLI */
    }
  }
  const penPath = resolve(repoRoot, 'pens', `${version}.pen`)
  if (!existsSync(penPath)) return null
  const res = spawnSync('pencil', ['export-tokens', '--in', penPath, '--json'], {
    encoding: 'utf-8',
  })
  if (res.status !== 0) return null
  try {
    const parsed = JSON.parse(res.stdout) as Token[]
    return parsed
  } catch {
    return null
  }
}

function main(): number {
  const argv = process.argv.slice(2)
  const vIdx = argv.indexOf('--version')
  if (vIdx < 0) {
    process.stderr.write('usage: pen-tokens --version <v>\n')
    return 2
  }
  const version = argv[vIdx + 1]
  if (!version) return 2

  const repoRoot = process.cwd()
  const cssPath = resolve(repoRoot, 'packages/ui/src/styles/globals.css')
  if (!existsSync(cssPath)) {
    process.stderr.write(`pen-tokens: ${relative(repoRoot, cssPath)} not found — nothing to compare\n`)
    return 0
  }
  const css = readFileSync(cssPath, 'utf-8')
  const root = parseCssTokens(css, ':root')

  const penTokens = readPenTokens(repoRoot, version)
  if (penTokens == null) {
    process.stderr.write(
      `pen-tokens: Could not read pen tokens for ${version} (Pencil CLI unavailable AND no pens/inventory/${version}.tokens.json). Skipping.\n`,
    )
    return 0
  }

  const penMap = new Map(penTokens.map((t) => [t.name.replace(/^--/, ''), t.value]))

  const drift: DriftRecord[] = []
  const allKeys = new Set([...root.keys(), ...penMap.keys()])
  for (const k of allKeys) {
    const cssV = root.get(k) ?? null
    const penV = penMap.get(k) ?? null
    if (cssV != null && penV == null) {
      drift.push({ name: k, css_value: cssV, pen_value: null, status: 'css-only' })
    } else if (cssV == null && penV != null) {
      drift.push({ name: k, css_value: null, pen_value: penV, status: 'pen-only' })
    } else if (cssV !== penV) {
      drift.push({ name: k, css_value: cssV, pen_value: penV, status: 'drift' })
    } else {
      drift.push({ name: k, css_value: cssV, pen_value: penV, status: 'match' })
    }
  }

  const summary = {
    schema: 'fenix.pen.tokens.v1',
    version,
    css_path: relative(repoRoot, cssPath),
    generated_at: new Date().toISOString(),
    matches: drift.filter((d) => d.status === 'match').length,
    drifts: drift.filter((d) => d.status !== 'match'),
  }
  const outPath = resolve(repoRoot, 'pens', 'inventory', `${version}.tokens-drift.json`)
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`)
  const drifted = summary.drifts.length
  process.stdout.write(
    `pen-tokens: ${summary.matches} match, ${drifted} drift → ${relative(repoRoot, outPath)}\n`,
  )
  return 0
}

process.exit(main())
