#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFlags, resolveRepoRoot } from './lib/phase.ts'

const HELP = `pen-extract — prepare pen extraction directories and print MCP instructions.

Usage:
  bun run scripts/pen-extract.ts [--pen <path>]

Options:
  --pen <path>   Path to the pen file (defaults to pens/app.pen).
  --help         Show this help.

This is a thin wrapper. Real pen extraction requires the Pencil MCP tools,
which must be invoked by the agent — Bun scripts cannot call MCP tools
directly. The script validates inputs, prepares output directories, and
prints a structured instruction block the agent follows step-by-step.
`

// TODO(M4-future): automate via mcp-client when available.

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
  process.stdout.write('Agent instructions (run these MCP tool calls now):\n')
  process.stdout.write(`  1. mcp__pencil__open_document ${penPath}\n`)
  process.stdout.write("  2. mcp__pencil__batch_get { patterns: [{ type: 'frame', name: ' -- ' }] }\n")
  process.stdout.write('     (collect every top-level section frame; section names look like "SC -- Dashboard")\n')
  process.stdout.write('  3. For each section frame:\n')
  process.stdout.write("     a. mcp__pencil__batch_get with pattern { type: 'frame', name: '<Section> -- ' }\n")
  process.stdout.write('        to enumerate screen variants.\n')
  process.stdout.write(
    '     b. mcp__pencil__export_nodes for each screen frame → pens/exports/<section-slug>/<screen-slug>.png\n',
  )
  process.stdout.write(
    "     c. mcp__pencil__batch_get for sibling { type: 'note' } nodes and pair each by title prefix.\n",
  )
  process.stdout.write('     d. Write pens/inventory/<section-slug>.md containing the section title, verbatim notes,\n')
  process.stdout.write('        a per-screen block with @pen <png-path>, verbatim note, and frame dimensions.\n')
  process.stdout.write('  4. Write pens/inventory/INDEX.md listing every section + screen with its inventory link.\n')
  process.stdout.write('  5. Write pens/inventory/COMPONENTS.md listing reusable pen components (id + name).\n\n')
  process.stdout.write('Rule: notes are copied verbatim. Never paraphrase. Never interpret. Stories cite by path.\n')
  return 0
}

process.exit(main())
