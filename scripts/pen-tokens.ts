#!/usr/bin/env bun
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseFlags, resolveRepoRoot } from './lib/phase.ts'

const HELP = `pen-tokens — prepare the tokens output path and point at the fenix-pen-tokens skill.

Usage:
  bun run scripts/pen-tokens.ts [--pen <path>] [--out <path>]

Options:
  --pen <path>   Pen file path (defaults to pens/app.pen).
  --out <path>   Output CSS file (defaults to apps/app/styles/pen-tokens.css).
  --help         Show this help.

This is a thin shim. The real workflow lives in the fenix-pen-tokens
skill because it is an agent-driven task over Pencil MCP's
get_variables tool. This script only validates inputs and prepares
the output directory so the skill can write into it.

Prerequisite: users define pen variables manually in Pencil before
running this. Raw-hex guessing is intentionally NOT supported; it
produced unstable tokens.
`

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
  process.stdout.write('Now invoke the skill that drives the real extraction:\n')
  process.stdout.write('  Skill(fenix-pen-tokens)\n\n')
  process.stdout.write('The skill is at skills/fenix-pen-tokens/SKILL.md — it reads variables\n')
  process.stdout.write('via Pencil MCP get_variables and emits grouped CSS custom properties.\n')
  process.stdout.write('If the pen has no variables, the skill stops and asks the user to\n')
  process.stdout.write('define them first. Never guess from raw hex.\n')
  return 0
}

process.exit(main())
