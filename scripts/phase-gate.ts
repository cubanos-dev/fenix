#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { parseFlags, phaseExists, printJson, resolveRepoRoot } from './lib/phase.ts'

const HELP = `phase-gate — run all hard/soft gates for a phase in order.

Usage:
  bun run scripts/phase-gate.ts --phase <name> [--base <ref>] [--json]

Options:
  --phase <name>  Phase ID (required).
  --base <ref>    Git ref to diff against (defaults to main).
  --json          Emit a machine-readable JSON report.
  --help          Show this help.

Gates, in order:
  1. pattern-audit  (informational — logs candidates, never blocks)
  2. coverage-audit (HARD — blocks on uncovered files)
  3. bun run validate (HARD — typecheck + format + lint + unit/storybook tests)
  4. browser-verify (instructed — agent invokes agent-browser-verify skill)
  5. phase-reviewer (instructed — agent invokes phase-reviewer subagent)

Exit codes: 0 = all hard gates green, non-zero = blocked.
`

interface GateResult {
  name: string
  kind: 'hard' | 'soft' | 'instruction'
  status: 'pass' | 'fail' | 'skipped' | 'instructed'
  detail?: string
}

function runScript(root: string, script: string, args: string[]): { code: number; out: string } {
  const result = spawnSync('bun', ['run', script, ...args], { cwd: root, encoding: 'utf8' })
  return {
    code: result.status ?? 1,
    out: `${result.stdout}\n${result.stderr}`.trim(),
  }
}

function runCommand(root: string, command: string, args: string[]): { code: number; out: string } {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  return {
    code: result.status ?? 1,
    out: `${result.stdout}\n${result.stderr}`.trim(),
  }
}

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const phase = typeof flags.phase === 'string' ? flags.phase : null
  if (!phase) {
    process.stderr.write('phase-gate: --phase <name> is required. Run with --help.\n')
    return 2
  }
  const base = typeof flags.base === 'string' ? flags.base : 'main'
  const json = flags.json === true

  const root = resolveRepoRoot(resolve('.'))
  const gates: GateResult[] = []

  if (!phaseExists(root, phase)) {
    gates.push({
      name: 'phase-exists',
      kind: 'hard',
      status: 'fail',
      detail: `.planning/phases/${phase} is missing — create it first`,
    })
  } else {
    gates.push({ name: 'phase-exists', kind: 'hard', status: 'pass' })
  }

  const patternProbe = runScript(root, 'scripts/pattern-audit.ts', ['--symbol', 'cn', '--json'])
  gates.push({
    name: 'pattern-audit',
    kind: 'soft',
    status: patternProbe.code === 0 ? 'pass' : 'fail',
    detail: 'informational — cite findings in PLAN.md',
  })

  const coverage = runScript(root, 'scripts/coverage-audit.ts', ['--phase', phase, '--base', base])
  gates.push({
    name: 'coverage-audit',
    kind: 'hard',
    status: coverage.code === 0 ? 'pass' : 'fail',
    detail: coverage.out.split('\n').slice(-5).join(' | '),
  })

  const validate = runCommand(root, 'bun', ['run', 'validate'])
  gates.push({
    name: 'validate',
    kind: 'hard',
    status: validate.code === 0 ? 'pass' : 'fail',
    detail: validate.code === 0 ? 'typecheck + format + lint + test green' : 'failed — see logs',
  })

  gates.push({
    name: 'browser-verify',
    kind: 'instruction',
    status: 'instructed',
    detail: 'agent: invoke agent-browser-verify skill against the golden path for this phase',
  })
  gates.push({
    name: 'phase-reviewer',
    kind: 'instruction',
    status: 'instructed',
    detail: 'agent: invoke phase-reviewer subagent with diff + PLAN.md + DEFINITION-OF-DONE.md',
  })

  const hardFailed = gates.filter((g) => g.kind === 'hard' && g.status !== 'pass').length
  const verdict = hardFailed === 0 ? 'green' : 'blocked'

  if (json) {
    printJson({ phase, base, verdict, gates })
  } else {
    process.stdout.write(`phase-gate phase=${phase} base=${base}\n`)
    for (const g of gates) {
      process.stdout.write(`  [${g.kind}] ${g.name}: ${g.status}\n`)
      if (g.detail) process.stdout.write(`         ${g.detail}\n`)
    }
    process.stdout.write(`\n  verdict: ${verdict}\n`)
    if (hardFailed > 0) {
      process.stdout.write(`  ${hardFailed} hard gate(s) blocked. Fix and re-run.\n`)
    }
  }

  return hardFailed === 0 ? 0 : 1
}

process.exit(main())
