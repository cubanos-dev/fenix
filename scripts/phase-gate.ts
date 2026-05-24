#!/usr/bin/env bun
/**
 * phase-gate — the 8-gate stack orchestrator.
 *
 * Runs gates 1-6 (deterministic) in order. Gates 7 (phase-reviewer) and 8
 * (agent-browser-verify) are subagent gates spawned by the
 * `/fenix-auto build` slash command, not by this script — they need a
 * Claude session to execute. This script records placeholder rows for
 * those gates and prints the next command for the orchestrator.
 *
 * Each deterministic gate writes its own JSON artifact via its own script.
 * This orchestrator only stitches them together, records each result via
 * `fenix-auto.ts gate-record`, and decides whether to halt or continue.
 *
 *   bun scripts/phase-gate.ts --phase <id>
 *                              [--only <gate>]
 *                              [--skip <gate,…>]
 *                              [--json]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { gateArtifactPath, type GateArtifact } from './lib/artifacts'

interface GateSpec {
  name: string
  hard: boolean
  /** How to run: 'script' shells out to bun, 'turbo' runs a turbo task, 'deferred' is for subagent gates. */
  kind: 'script' | 'turbo' | 'deferred'
  command?: string[]
}

// Canonical gate names use colon-form for multi-word gates (matches
// CLAUDE.md, db.ts schema comment, lessons.ts scope convention). Single-word
// gates and agent-named deferred gates stay bare. writeGateArtifact and
// gateArtifactPath sanitize `:` → `-` for filesystem-safe artifact paths,
// so on-disk filenames remain `pattern-audit.json` etc.
const GATE_STACK: GateSpec[] = [
  {
    // Hard-capable: file-naming + override-dir + per-app-globals findings are
    // soft, but import-graph boundary violations (added back from the deleted
    // boundaries.mjs) write verdict='fail' and the script exits non-zero.
    name: 'pattern:audit',
    hard: true,
    kind: 'script',
    command: ['bun', 'scripts/pattern-audit.ts', '--phase'],
  },
  {
    name: 'coverage:audit',
    hard: true,
    kind: 'script',
    command: ['bun', 'scripts/coverage-audit.ts', '--phase'],
  },
  {
    name: 'validate',
    hard: true,
    kind: 'turbo',
    command: ['bun', 'run', 'validate'],
  },
  {
    name: 'pen:drift',
    hard: true,
    kind: 'script',
    command: ['bun', 'scripts/pen-drift-check.ts', '--phase'],
  },
  {
    name: 'visual:diff',
    hard: true,
    kind: 'script',
    command: ['bun', 'scripts/visual-diff.ts', '--phase'],
  },
  {
    // Hard-capable: hygiene findings (TODO, console.log, no-any) stay soft,
    // but the IMPECCABLE rules (side-stripe, gradient-text, reflex-font)
    // write verdict='fail' and the script exits non-zero.
    name: 'slop:test',
    hard: true,
    kind: 'script',
    command: ['bun', 'scripts/slop-test.ts', '--phase'],
  },
  { name: 'phase-reviewer', hard: true, kind: 'deferred' },
  { name: 'agent-browser-verify', hard: true, kind: 'deferred' },
]

interface RunResult {
  gate: string
  hard: boolean
  status: 'pass' | 'fail' | 'soft-warn' | 'skipped' | 'deferred'
  artifact?: string
  exit_code: number
  reason?: string
}

function recordViaFenix(phase: string, gate: string, status: string, jsonPath?: string): void {
  const args = [
    '.claude/scripts/fenix-auto.ts',
    'gate-record',
    '--phase',
    phase,
    '--name',
    gate,
    '--status',
    status,
  ]
  if (jsonPath) {
    args.push('--json-path', jsonPath)
  }
  spawnSync('bun', args, { stdio: 'pipe' })
}

function runGate(phase: string, spec: GateSpec): RunResult {
  if (spec.kind === 'deferred') {
    return {
      gate: spec.name,
      hard: spec.hard,
      status: 'deferred',
      exit_code: 0,
      reason:
        'subagent gate — spawn from /fenix-auto build pipeline (Claude session needed)',
    }
  }

  const cmd =
    spec.kind === 'turbo' ? spec.command! : [...(spec.command ?? []), phase]

  const res = spawnSync(cmd[0], cmd.slice(1), {
    stdio: 'inherit',
    encoding: 'utf-8',
  })
  const exit = res.status ?? 1

  // Read the artifact if the gate wrote one.
  const artPath = gateArtifactPath(phase, spec.name)
  let status: RunResult['status'] = exit === 0 ? 'pass' : 'fail'
  let artifactRel: string | undefined
  if (existsSync(artPath)) {
    try {
      const parsed = JSON.parse(readFileSync(artPath, 'utf-8')) as GateArtifact
      status = (parsed.verdict as RunResult['status']) ?? status
      artifactRel = relative(process.cwd(), artPath)
    } catch {
      /* leave status as fallback */
    }
  } else if (spec.kind === 'turbo' && exit === 0) {
    // turbo validate doesn't write a per-gate JSON artifact; trust the exit.
    status = 'pass'
  }

  recordViaFenix(phase, spec.name, status, artifactRel)

  return {
    gate: spec.name,
    hard: spec.hard,
    status,
    artifact: artifactRel,
    exit_code: exit,
    reason:
      status === 'fail' && exit !== 0
        ? `exit ${exit}${artifactRel ? ` — see ${artifactRel}` : ''}`
        : undefined,
  }
}

function main(): number {
  const argv = process.argv.slice(2)
  const phaseIdx = argv.indexOf('--phase')
  if (phaseIdx < 0) {
    process.stderr.write('usage: phase-gate --phase <id> [--only <gate>] [--skip <g,…>] [--json]\n')
    return 2
  }
  const phase = argv[phaseIdx + 1]
  if (!phase) {
    process.stderr.write('--phase requires a phase id\n')
    return 2
  }
  const onlyIdx = argv.indexOf('--only')
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null
  const skipIdx = argv.indexOf('--skip')
  const skip =
    skipIdx >= 0 ? new Set((argv[skipIdx + 1] ?? '').split(',').filter(Boolean)) : new Set<string>()
  const asJson = argv.includes('--json')

  const planMd = resolve(process.cwd(), '.planning/phases', phase, 'PLAN.md')
  if (!existsSync(planMd)) {
    process.stderr.write(`phase-gate: ${relative(process.cwd(), planMd)} not found\n`)
    return 2
  }

  const results: RunResult[] = []
  let hardFailed = false

  for (const spec of GATE_STACK) {
    if (only && spec.name !== only) continue
    if (skip.has(spec.name)) {
      results.push({
        gate: spec.name,
        hard: spec.hard,
        status: 'skipped',
        exit_code: 0,
        reason: '--skip',
      })
      recordViaFenix(phase, spec.name, 'skipped')
      continue
    }
    if (hardFailed) {
      results.push({
        gate: spec.name,
        hard: spec.hard,
        status: 'skipped',
        exit_code: 0,
        reason: 'short-circuit after earlier hard failure',
      })
      recordViaFenix(phase, spec.name, 'skipped')
      continue
    }
    process.stdout.write(`\n── ${spec.name} ──────────────────────\n`)
    const r = runGate(phase, spec)
    results.push(r)
    if (spec.hard && (r.status === 'fail' || (r.status !== 'pass' && r.status !== 'deferred' && r.status !== 'soft-warn' && r.status !== 'skipped'))) {
      hardFailed = true
    }
  }

  // Summary
  if (asJson) {
    process.stdout.write(
      `${JSON.stringify({ status: hardFailed ? 'fail' : 'ok', phase, results }, null, 2)}\n`,
    )
  } else {
    process.stdout.write('\n══ summary ══════════════════════\n')
    for (const r of results) {
      const marker = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : r.status === 'deferred' ? '⏸' : '·'
      process.stdout.write(
        `${marker} ${r.gate.padEnd(22)} ${r.status.padEnd(10)} ${r.reason ?? ''}\n`,
      )
    }
    if (hardFailed) {
      process.stdout.write('\nphase-gate: HARD GATE FAILED — phase cannot proceed.\n')
    } else {
      const deferred = results.filter((r) => r.status === 'deferred').map((r) => r.gate)
      if (deferred.length > 0) {
        process.stdout.write(
          `\nphase-gate: deterministic gates ok. Subagent gates remain: ${deferred.join(', ')}.\n`,
        )
        process.stdout.write('Run /fenix-auto build to finish the pipeline.\n')
      } else {
        process.stdout.write('\nphase-gate: all gates green.\n')
      }
    }
  }

  return hardFailed ? 1 : 0
}

process.exit(main())
