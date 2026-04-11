#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlags, resolveRepoRoot } from './lib/phase.ts'

const HELP = `pen-extract — prepare pen extraction directories and point at the fenix-pen-extract skill.

Usage:
  bun run scripts/pen-extract.ts [--pen <path>]

Options:
  --pen <path>   Path to the pen file (defaults to pens/app.pen).
  --help         Show this help.

This is a thin shim. The real extraction workflow lives in the
fenix-pen-extract skill because it is an agent-driven multi-step task
over Pencil MCP. This script only validates the pen file exists and
prepares pens/inventory/ and pens/exports/ so the skill can write
into them.
`

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const penArg = typeof flags.pen === 'string' ? flags.pen : 'pens/app.pen'
  const root = resolveRepoRoot(resolve('.'))
  const penPath = resolve(root, penArg)

  if (!existsSync(penPath)) {
    process.stderr.write(`pen-extract: pen file not found at ${penPath}\n`)
    process.stderr.write('  create it via Pencil or point --pen at an existing file.\n')
    return 1
  }

  const inventoryDir = join(root, 'pens', 'inventory')
  const exportsDir = join(root, 'pens', 'exports')
  mkdirSync(inventoryDir, { recursive: true })
  mkdirSync(exportsDir, { recursive: true })

  process.stdout.write('pen-extract ready\n')
  process.stdout.write(`  pen:       ${penPath}\n`)
  process.stdout.write(`  inventory: ${inventoryDir}\n`)
  process.stdout.write(`  exports:   ${exportsDir}\n\n`)
  process.stdout.write('Now invoke the skill that drives the real extraction:\n')
  process.stdout.write('  Skill(fenix-pen-extract)\n\n')
  process.stdout.write('The skill is at skills/fenix-pen-extract/SKILL.md — it walks the pen via\n')
  process.stdout.write('Pencil MCP, exports screen PNGs, and writes pens/inventory/ markdown with\n')
  process.stdout.write('verbatim note blocks. Notes are copied character-for-character; stories\n')
  process.stdout.write('cite them by path via @pen JSDoc tags.\n')
  return 0
}

process.exit(main())
