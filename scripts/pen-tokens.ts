#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseFlags, resolveRepoRoot } from './lib/phase.ts'

const HELP = `pen-tokens — derive CSS custom properties from a pen file's variables.

Usage:
  bun run scripts/pen-tokens.ts [--pen <path>] [--out <path>]

Options:
  --pen <path>   Pen file path (defaults to pens/app.pen).
  --out <path>   Output CSS file (defaults to apps/app/styles/pen-tokens.css).
  --help         Show this help.

This is a thin wrapper. Token extraction requires the Pencil MCP tool
'mcp__pencil__get_variables', which must be invoked by the agent — Bun
scripts cannot call MCP tools directly. The script validates inputs,
prepares the output directory, and prints the instruction block.

Prerequisite: users define pen variables manually in Pencil. Raw-color
guessing is intentionally NOT supported; it produced unstable tokens.
`

// TODO(M4-future): automate via mcp-client when available.

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const penArg = typeof flags.pen === 'string' ? flags.pen : 'pens/app.pen'
  const outArg = typeof flags.out === 'string' ? flags.out : 'apps/app/styles/pen-tokens.css'

  const root = resolveRepoRoot(resolve('.'))
  const penPath = resolve(root, penArg)
  const outPath = resolve(root, outArg)

  if (!existsSync(penPath)) {
    process.stderr.write(`pen-tokens: pen file not found at ${penPath}\n`)
    return 1
  }

  mkdirSync(dirname(outPath), { recursive: true })

  process.stdout.write('pen-tokens ready\n')
  process.stdout.write(`  pen: ${penPath}\n`)
  process.stdout.write(`  out: ${outPath}\n\n`)
  process.stdout.write('Agent instructions:\n')
  process.stdout.write(`  1. mcp__pencil__open_document ${penPath}\n`)
  process.stdout.write('  2. mcp__pencil__get_variables\n')
  process.stdout.write('  3. For every variable returned, emit a CSS custom property.\n')
  process.stdout.write('     Group by scope (color, space, radius, typography) under :root.\n')
  process.stdout.write(`  4. Write the CSS to ${outPath}\n`)
  process.stdout.write('  5. Import it once from the app-level styles entry.\n\n')
  process.stdout.write('Rule: never guess tokens from raw hex values. Users define variables in Pencil first.\n')
  return 0
}

process.exit(main())
