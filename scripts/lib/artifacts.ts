/**
 * Gate artifact writer.
 *
 * Every gate emits `.planning/phases/<phase>/.artifacts/<gate>.json` with a
 * uniform envelope. The orchestrator and the Fenix UI read this shape.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export type GateVerdict = 'pass' | 'fail' | 'soft-warn' | 'skipped'

export interface GateArtifact<T = unknown> {
  schema: 'fenix.gate.v1'
  gate: string
  phase: string
  verdict: GateVerdict
  hard: boolean
  ran_at: string
  duration_ms: number
  reasons: string[]
  details?: T
}

export interface WriteGateArgs<T> {
  phase: string
  gate: string
  verdict: GateVerdict
  hard: boolean
  startedAt: number
  reasons?: string[]
  details?: T
  repoRoot?: string
}

export function writeGateArtifact<T = unknown>(args: WriteGateArgs<T>): {
  path: string
  artifact: GateArtifact<T>
} {
  const repoRoot = args.repoRoot ?? process.cwd()
  const dir = resolve(
    repoRoot,
    '.planning/phases',
    args.phase,
    '.artifacts',
  )
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const safeGateName = args.gate.replace(/[^a-z0-9-]/gi, '-')
  const file = join(dir, `${safeGateName}.json`)

  const artifact: GateArtifact<T> = {
    schema: 'fenix.gate.v1',
    gate: args.gate,
    phase: args.phase,
    verdict: args.verdict,
    hard: args.hard,
    ran_at: new Date(args.startedAt).toISOString(),
    duration_ms: Date.now() - args.startedAt,
    reasons: args.reasons ?? [],
    details: args.details,
  }

  ensureDir(dirname(file))
  writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`)
  return { path: file, artifact }
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function gateArtifactPath(
  phase: string,
  gate: string,
  repoRoot: string = process.cwd(),
): string {
  const safe = gate.replace(/[^a-z0-9-]/gi, '-')
  return resolve(repoRoot, '.planning/phases', phase, '.artifacts', `${safe}.json`)
}

export function verdictExitCode(verdict: GateVerdict, hard: boolean): number {
  if (verdict === 'pass') return 0
  if (verdict === 'soft-warn' || verdict === 'skipped') return 0
  return hard ? 1 : 0
}
