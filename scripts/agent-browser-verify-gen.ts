#!/usr/bin/env bun
/**
 * agent-browser-verify-gen — synthesize a Playwright spec from a Golden-Path
 * contract JSON pinned by the checks-author.
 *
 * Consumed by the agent-browser-verify subagent (gate 8). The contract is
 * canonical; the spec is ephemeral and regenerated every run. The generated
 * file is archived to `.planning/phases/<phase>/.artifacts/generated-spec.ts`
 * by the agent after the run.
 *
 *   bun scripts/agent-browser-verify-gen.ts \
 *     --phase <phase-id> \
 *     --contract e2e/<phase-id>.golden.contract.json \
 *     --out apps/app/e2e/<phase-id>.golden.spec.ts
 *
 * Contract shape (kept loose so checks-author can iterate without coupling):
 *
 *   {
 *     "phase_id": "03-billing",
 *     "steps": [
 *       { "kind": "navigate", "target": "/sign-in" },
 *       { "kind": "assert", "assertion": "Visible: Welcome back" },
 *       { "kind": "screenshot", "state_id": "sign-in.empty" },
 *       { "kind": "fill", "target": "input[name=email]", "value": "dev@fenix.local" },
 *       { "kind": "click", "target": "button:has-text('Sign in')" },
 *       { "kind": "assert", "assertion": "URL: /dashboard" },
 *       { "kind": "screenshot", "state_id": "dashboard.signed-in" }
 *     ]
 *   }
 *
 * Supported assertion forms:
 *   "URL: /path"
 *   "Visible: <text>"
 *   "Text: <selector>,<text>"
 *   "AriaLabel: <selector>,<label>"
 *   "NoConsoleErrors: true"   (the spec always installs this listener)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface Step {
  kind: 'navigate' | 'click' | 'fill' | 'hover' | 'press' | 'wait' | 'screenshot' | 'assert'
  target?: string
  value?: string
  key?: string
  selector?: string
  state_id?: string
  assertion?: string
}

interface Contract {
  phase_id: string
  steps: Step[]
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
  process.stderr.write(`agent-browser-verify-gen: ${msg}\n`)
  process.exit(2)
}

function quote(s: string): string {
  // Single-quoted with backslash escapes for the spec source.
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function emitNavigate(s: Step): string {
  if (!s.target) fail('navigate step requires target')
  return `    await page.goto(${quote(s.target)})`
}

function emitClick(s: Step): string {
  if (!s.target) fail('click step requires target')
  return `    await page.locator(${quote(s.target)}).click()`
}

function emitFill(s: Step): string {
  if (!s.target || s.value == null) fail('fill step requires target and value')
  return `    await page.locator(${quote(s.target)}).fill(${quote(s.value)})`
}

function emitHover(s: Step): string {
  if (!s.target) fail('hover step requires target')
  return `    await page.locator(${quote(s.target)}).hover()`
}

function emitPress(s: Step): string {
  if (!s.target || !s.key) fail('press step requires target and key')
  return `    await page.locator(${quote(s.target)}).press(${quote(s.key)})`
}

function emitWait(s: Step): string {
  const sel = s.selector ?? s.target
  if (!sel) fail('wait step requires selector or target')
  return `    await page.locator(${quote(sel)}).waitFor()`
}

function emitScreenshot(s: Step, phase: string): string {
  const id = s.state_id ?? 'step'
  const path = `test-results/${phase}-golden/${id}.png`
  return `    await page.screenshot({ path: ${quote(path)}, fullPage: true })`
}

function emitAssert(s: Step): string {
  if (!s.assertion) fail('assert step requires assertion')
  const a = s.assertion.trim()
  const colon = a.indexOf(':')
  if (colon < 0) fail(`assert "${a}" must be "Kind: value"`)
  const kind = a.slice(0, colon).trim()
  const rest = a.slice(colon + 1).trim()
  switch (kind) {
    case 'URL':
      return `    await expect(page).toHaveURL(${quote(rest)})`
    case 'Visible':
      return `    await expect(page.getByText(${quote(rest)})).toBeVisible()`
    case 'Text': {
      const [sel, text] = splitOnce(rest, ',')
      return `    await expect(page.locator(${quote(sel)})).toHaveText(${quote(text)})`
    }
    case 'AriaLabel': {
      const [sel, label] = splitOnce(rest, ',')
      return `    await expect(page.locator(${quote(sel)})).toHaveAttribute('aria-label', ${quote(label)})`
    }
    case 'NoConsoleErrors':
      // The spec installs the listener unconditionally; this is documentation.
      return `    // NoConsoleErrors: enforced by global console listener`
    default:
      fail(`unsupported assertion kind: "${kind}" (try URL, Visible, Text, AriaLabel, NoConsoleErrors)`)
  }
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep)
  if (i < 0) fail(`expected "${sep}" in "${s}"`)
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()]
}

function renderSpec(contract: Contract, phase: string): string {
  const body = contract.steps
    .map((s) => {
      switch (s.kind) {
        case 'navigate':
          return emitNavigate(s)
        case 'click':
          return emitClick(s)
        case 'fill':
          return emitFill(s)
        case 'hover':
          return emitHover(s)
        case 'press':
          return emitPress(s)
        case 'wait':
          return emitWait(s)
        case 'screenshot':
          return emitScreenshot(s, phase)
        case 'assert':
          return emitAssert(s)
        default:
          fail(`unknown step kind: ${(s as { kind: string }).kind}`)
      }
    })
    .join('\n')

  return `// AUTOGENERATED by scripts/agent-browser-verify-gen.ts — do not edit.
// Regenerated from e2e/${phase}.golden.contract.json each gate run.
import { test, expect } from '@playwright/test'

test.describe('${phase} golden path', () => {
  test('walks the happy path end to end', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

${body}

    expect(consoleErrors, \`console errors: \${consoleErrors.join(' | ')}\`).toEqual([])
  })
})
`
}

function main(): void {
  const phase = flag('phase')
  const contractPath = flag('contract')
  const outPath = flag('out')

  if (!existsSync(contractPath)) fail(`contract not found: ${contractPath}`)
  let contract: Contract
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Contract
  } catch (err) {
    fail(`contract JSON parse failed: ${(err as Error).message}`)
  }
  if (contract.phase_id && contract.phase_id !== phase) {
    process.stderr.write(
      `agent-browser-verify-gen: contract phase_id "${contract.phase_id}" != --phase "${phase}" (proceeding with --phase)\n`,
    )
  }
  if (!Array.isArray(contract.steps) || contract.steps.length === 0) {
    fail('contract must have a non-empty "steps" array')
  }

  const source = renderSpec(contract, phase)
  const dir = dirname(resolve(outPath))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(outPath), source)
  process.stdout.write(`agent-browser-verify-gen: wrote ${outPath} (${contract.steps.length} step${contract.steps.length === 1 ? '' : 's'})\n`)
}

main()
