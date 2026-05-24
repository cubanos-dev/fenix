#!/usr/bin/env bun
/**
 * agent-browser-verify-parse — turn a Playwright JSON report + the original
 * golden-path contract into the gate-8 verdict artifact.
 *
 *   bun scripts/agent-browser-verify-parse.ts \
 *     --playwright .planning/phases/<phase>/.artifacts/playwright-output.json \
 *     --contract e2e/<phase>.golden.contract.json \
 *     --out .planning/phases/<phase>/.artifacts/agent-browser-verify.json
 *
 * Verdict rule:
 *   PASS  ⇔  every Playwright test is `expected: passed` AND zero stderr
 *            `console.error` entries (the spec aggregates them and asserts at
 *            the end). FAIL on any test failure, timeout, or non-empty
 *            console errors.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface PlaywrightSuite {
  suites?: PlaywrightSuite[]
  specs?: PlaywrightSpec[]
}

interface PlaywrightSpec {
  title: string
  ok: boolean
  tests: PlaywrightTest[]
}

interface PlaywrightTest {
  results: PlaywrightResult[]
  status?: string
  expectedStatus?: string
}

interface PlaywrightResult {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
  duration: number
  errors?: Array<{ message: string }>
  stdout?: Array<{ text?: string }>
  stderr?: Array<{ text?: string }>
  attachments?: Array<{ name: string; path?: string; contentType?: string }>
}

interface PlaywrightReport {
  stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number; duration?: number }
  suites?: PlaywrightSuite[]
  errors?: Array<{ message: string }>
}

interface ContractStep {
  kind: string
  target?: string
  state_id?: string
  assertion?: string
}

interface Contract {
  phase_id?: string
  steps: ContractStep[]
}

interface Verdict {
  verdict: 'pass' | 'fail'
  phase_id: string
  ran_at: string
  spec_path: string | null
  steps_total: number
  steps_passed: number
  steps_failed: number
  console_errors: string[]
  screenshots: Array<{ state_id: string; path: string }>
  failures: Array<{
    spec: string
    error: string
    duration_ms: number
  }>
  wall_time_ms: number
}

function flag(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) {
    if (fallback !== undefined) return fallback
    fail(`missing --${name}`)
  }
  const v = process.argv[i + 1]
  if (!v || v.startsWith('--')) {
    if (fallback !== undefined) return fallback
    fail(`--${name} requires a value`)
  }
  return v
}

function fail(msg: string): never {
  process.stderr.write(`agent-browser-verify-parse: ${msg}\n`)
  process.exit(2)
}

function flattenSpecs(suites: PlaywrightSuite[] = []): PlaywrightSpec[] {
  const out: PlaywrightSpec[] = []
  for (const s of suites) {
    if (s.specs) out.push(...s.specs)
    if (s.suites) out.push(...flattenSpecs(s.suites))
  }
  return out
}

function main(): void {
  const phase = flag('phase', '')
  const playwrightPath = flag('playwright')
  const contractPath = flag('contract')
  const outPath = flag('out')

  if (!existsSync(playwrightPath)) fail(`playwright report not found: ${playwrightPath}`)
  if (!existsSync(contractPath)) fail(`contract not found: ${contractPath}`)

  let report: PlaywrightReport
  try {
    report = JSON.parse(readFileSync(playwrightPath, 'utf-8')) as PlaywrightReport
  } catch (err) {
    fail(`playwright report JSON parse failed: ${(err as Error).message}`)
  }
  let contract: Contract
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Contract
  } catch (err) {
    fail(`contract JSON parse failed: ${(err as Error).message}`)
  }

  const resolvedPhase = phase || contract.phase_id || 'unknown-phase'
  const specs = flattenSpecs(report.suites)

  const consoleErrors: string[] = []
  const failures: Verdict['failures'] = []
  let passed = 0
  let failed = 0
  let wallTime = 0

  for (const spec of specs) {
    for (const test of spec.tests) {
      for (const r of test.results) {
        wallTime += r.duration ?? 0
        if (r.status === 'passed') passed++
        else if (r.status === 'skipped') continue
        else {
          failed++
          failures.push({
            spec: spec.title,
            error: (r.errors ?? []).map((e) => e.message).join(' | ') || r.status,
            duration_ms: r.duration ?? 0,
          })
        }
        for (const e of r.stderr ?? []) {
          if (e.text && /console\.error/i.test(e.text)) consoleErrors.push(e.text)
        }
      }
    }
  }

  // Screenshots — collect any contract step that asked for one. The agent
  // copies them into `.artifacts/screenshots/` after this script runs;
  // we record the expected paths so the verdict cross-references the on-
  // disk artifact.
  const screenshots: Verdict['screenshots'] = []
  for (const s of contract.steps) {
    if (s.kind === 'screenshot' && s.state_id) {
      screenshots.push({
        state_id: s.state_id,
        path: `.artifacts/screenshots/${s.state_id}.png`,
      })
    }
  }

  const stepsTotal = passed + failed
  const verdict: Verdict = {
    verdict: failed === 0 && consoleErrors.length === 0 ? 'pass' : 'fail',
    phase_id: resolvedPhase,
    ran_at: new Date().toISOString(),
    spec_path: `.artifacts/generated-spec.ts`,
    steps_total: stepsTotal,
    steps_passed: passed,
    steps_failed: failed,
    console_errors: consoleErrors,
    screenshots,
    failures,
    wall_time_ms: Math.round(wallTime),
  }

  const dir = dirname(resolve(outPath))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(outPath), `${JSON.stringify(verdict, null, 2)}\n`)
  process.stdout.write(
    `agent-browser-verify-parse: ${verdict.verdict} (${passed}/${stepsTotal} steps, ${consoleErrors.length} console error${consoleErrors.length === 1 ? '' : 's'}) → ${outPath}\n`,
  )
  process.exit(verdict.verdict === 'pass' ? 0 : 1)
}

main()
