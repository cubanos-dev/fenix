#!/usr/bin/env bun
/**
 * visual-diff — gate 5 (HARD).
 *
 * Compares Storybook story screenshots to their pinned pen PNG, per state.
 * The budget is per-component-class (text / layout / hero / icon) from
 * `fenix.config.ts`. Runs across **all states** — happy + non-happy + edge.
 *
 * Pixelmatch is the comparison engine when `pixelmatch` + `pngjs` are
 * installed (they ship via `bun install` once the orchestrator pulls them
 * into root devDependencies). On a fresh template without those deps yet,
 * the gate degrades to sha256 equality (exact match) and writes
 * `pixelmatch_available: false` into the artifact so the operator can see
 * the comparison was approximate.
 *
 *   bun scripts/visual-diff.ts --phase <id> [--all] [--story <name>]
 *
 * Inputs read per story:
 *   - `<story>.png`  — Storybook capture (test-storybook + screenshot)
 *   - `@pen <pens/exports/<v>/<frame>.png>` JSDoc tag → expected baseline
 *   - `@state-id <id>` → state class (resolves to component-class tolerance)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { writeGateArtifact, verdictExitCode } from './lib/artifacts'
import { loadFenixConfig } from './lib/config'
import { readPlan } from './lib/plan'

interface StoryRecord {
  story: string
  stateId: string | null
  pen: string | null
  storyShot: string | null
  componentClass: string
}

interface DiffResult {
  story: string
  state_id: string | null
  pen: string | null
  story_shot: string | null
  component_class: string
  tolerance: number
  diff_pct: number | null
  status: 'pass' | 'fail' | 'no-baseline' | 'no-shot'
  reason?: string
}

function safeStat(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

function safeIsDir(p: string): boolean {
  const s = safeStat(p)
  return s != null && s.isDirectory()
}

function findStoryFiles(repoRoot: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    if (!safeIsDir(dir)) return
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '.turbo') continue
      const full = join(dir, entry)
      const s = safeStat(full)
      if (s == null) continue
      if (s.isDirectory()) walk(full)
      else if (/\.stories\.tsx?$/.test(full)) out.push(full)
    }
  }
  walk(resolve(repoRoot, 'apps'))
  walk(resolve(repoRoot, 'packages'))
  return out
}

function findStoryShot(repoRoot: string, storyFile: string, stateId: string): string | null {
  // Conventions (in order):
  //   <dir>/__screenshots__/<state-id>.png
  //   storybook-static/screenshots/<state-id>.png
  //   .planning/phases/<phase>/.artifacts/screenshots/<state-id>.png  (last resort)
  const dir = storyFile.replace(/[^/]+\.stories\.tsx?$/, '')
  const candidates = [
    resolve(repoRoot, dir, '__screenshots__', `${stateId}.png`),
    resolve(repoRoot, 'storybook-static/screenshots', `${stateId}.png`),
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

function classify(stateId: string | null): string {
  if (stateId == null) return 'layout'
  if (/hero|landing|splash/.test(stateId)) return 'hero'
  if (/icon|badge|chip/.test(stateId)) return 'icon'
  if (/text|copy|prose|paragraph/.test(stateId)) return 'text'
  return 'layout'
}

function buildRecords(repoRoot: string): StoryRecord[] {
  const records: StoryRecord[] = []
  for (const storyFile of findStoryFiles(repoRoot)) {
    const src = readFileSync(storyFile, 'utf-8')
    const rel = relative(repoRoot, storyFile)
    // Each story file may export multiple stories; this gate operates at file
    // granularity unless individual @state-id / @pen tags are placed per export.
    const stateMatches = [...src.matchAll(/@state-id\s+([a-z0-9][a-z0-9-]*)/gi)].map(
      (m) => m[1],
    )
    const penMatches = [...src.matchAll(/@pen\s+(\S+)/g)].map((m) => m[1].split('#')[0])
    if (stateMatches.length === 0 && penMatches.length === 0) continue
    // Pair stateId[i] with pen[i]; if uneven, fill from the longer side.
    const n = Math.max(stateMatches.length, penMatches.length)
    for (let i = 0; i < n; i++) {
      const stateId = stateMatches[i] ?? null
      const penPath = penMatches[i] ?? null
      const storyShot = stateId ? findStoryShot(repoRoot, storyFile, stateId) : null
      records.push({
        story: rel,
        stateId,
        pen: penPath,
        storyShot,
        componentClass: classify(stateId),
      })
    }
  }
  return records
}

// Pixelmatch path — only used if deps are installed. We dynamic-import so
// missing deps don't break Bun module resolution at load time.
async function tryPixelmatch(): Promise<
  | {
      ok: true
      run: (a: Buffer, b: Buffer) => { width: number; height: number; diffPixels: number }
    }
  | { ok: false; reason: string }
> {
  try {
    const pixelmatchMod = (await import('pixelmatch')) as {
      default: (
        img1: Uint8Array,
        img2: Uint8Array,
        out: Uint8Array | null,
        w: number,
        h: number,
        opts?: { threshold?: number },
      ) => number
    }
    const pngMod = (await import('pngjs')) as { PNG: typeof import('pngjs').PNG }
    const PNG = pngMod.PNG
    const pixelmatch = pixelmatchMod.default
    return {
      ok: true,
      run(a, b) {
        const pa = PNG.sync.read(a)
        const pb = PNG.sync.read(b)
        const w = Math.min(pa.width, pb.width)
        const h = Math.min(pa.height, pb.height)
        const diffPixels = pixelmatch(pa.data, pb.data, null, w, h, { threshold: 0.1 })
        return { width: w, height: h, diffPixels }
      },
    }
  } catch (err) {
    return {
      ok: false,
      reason: `pixelmatch or pngjs not installed (${(err as Error).message}); falling back to sha256-equality`,
    }
  }
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function main(): Promise<number> {
  const startedAt = Date.now()
  const argv = process.argv.slice(2)
  const phaseIdx = argv.indexOf('--phase')
  if (phaseIdx < 0) {
    process.stderr.write('usage: visual-diff --phase <id> [--all] [--story <name>]\n')
    return 2
  }
  const phase = argv[phaseIdx + 1]
  if (!phase) {
    process.stderr.write('--phase requires a phase id\n')
    return 2
  }

  const repoRoot = process.cwd()
  readPlan(phase, repoRoot) // validate phase exists; not consumed further here
  const config = await loadFenixConfig(repoRoot)
  const tolerances = config.visualDiff.tolerance

  const records = buildRecords(repoRoot)
  if (records.length === 0) {
    const { path } = writeGateArtifact({
      phase,
      gate: 'visual:diff',
      verdict: 'soft-warn',
      hard: true,
      startedAt,
      reasons: ['No @state-id / @pen tagged stories — nothing to diff (gate skipped)'],
      details: { pixelmatch_available: false, results: [] },
    })
    process.stdout.write(`visual:diff: soft-warn → ${relative(repoRoot, path)}\n`)
    return 0
  }

  const px = await tryPixelmatch()
  const pixelmatchAvailable = px.ok
  const pxNotes: string[] = []
  if (!px.ok) pxNotes.push(px.reason)

  const results: DiffResult[] = []
  for (const r of records) {
    const tolerance = tolerances[r.componentClass] ?? tolerances.layout ?? 0.05
    if (!r.pen) {
      results.push({
        story: r.story,
        state_id: r.stateId,
        pen: null,
        story_shot: r.storyShot,
        component_class: r.componentClass,
        tolerance,
        diff_pct: null,
        status: 'no-baseline',
        reason: '@pen tag missing — cannot compare to a baseline',
      })
      continue
    }
    const penAbs = resolve(repoRoot, r.pen)
    if (!existsSync(penAbs)) {
      results.push({
        story: r.story,
        state_id: r.stateId,
        pen: r.pen,
        story_shot: r.storyShot,
        component_class: r.componentClass,
        tolerance,
        diff_pct: null,
        status: 'no-baseline',
        reason: `pen PNG does not exist: ${r.pen}`,
      })
      continue
    }
    if (!r.storyShot) {
      results.push({
        story: r.story,
        state_id: r.stateId,
        pen: r.pen,
        story_shot: null,
        component_class: r.componentClass,
        tolerance,
        diff_pct: null,
        status: 'no-shot',
        reason:
          'No Storybook screenshot captured for this state — run `bun run test-storybook` to generate.',
      })
      continue
    }

    if (px.ok) {
      const a = readFileSync(penAbs)
      const b = readFileSync(r.storyShot)
      const m = px.run(a, b)
      const total = m.width * m.height || 1
      const diffPct = m.diffPixels / total
      results.push({
        story: r.story,
        state_id: r.stateId,
        pen: r.pen,
        story_shot: relative(repoRoot, r.storyShot),
        component_class: r.componentClass,
        tolerance,
        diff_pct: diffPct,
        status: diffPct <= tolerance ? 'pass' : 'fail',
        reason:
          diffPct <= tolerance
            ? undefined
            : `diff ${(diffPct * 100).toFixed(2)}% exceeds budget ${(tolerance * 100).toFixed(2)}% for class "${r.componentClass}"`,
      })
    } else {
      // sha equality fallback — exact only.
      const exact = sha256(penAbs) === sha256(r.storyShot)
      results.push({
        story: r.story,
        state_id: r.stateId,
        pen: r.pen,
        story_shot: relative(repoRoot, r.storyShot),
        component_class: r.componentClass,
        tolerance,
        diff_pct: exact ? 0 : null,
        status: exact ? 'pass' : 'fail',
        reason: exact
          ? undefined
          : 'sha256 mismatch (fallback engine — install pixelmatch + pngjs for pixel-tolerance budgets)',
      })
    }
  }

  const failed = results.filter((r) => r.status === 'fail').length
  const noBaseline = results.filter((r) => r.status === 'no-baseline').length
  const noShot = results.filter((r) => r.status === 'no-shot').length
  const reasons: string[] = [...pxNotes]
  if (failed > 0) reasons.push(`${failed} story(ies) over visual-diff budget`)
  if (noBaseline > 0) reasons.push(`${noBaseline} story(ies) missing pen baseline`)
  if (noShot > 0) reasons.push(`${noShot} story(ies) missing Storybook screenshot`)
  if (reasons.length === pxNotes.length) reasons.push('All states within budget')

  const verdict: 'pass' | 'fail' = failed > 0 || noBaseline > 0 || noShot > 0 ? 'fail' : 'pass'

  const { path } = writeGateArtifact({
    phase,
    gate: 'visual:diff',
    verdict,
    hard: true,
    startedAt,
    reasons,
    details: { pixelmatch_available: pixelmatchAvailable, results },
  })

  process.stdout.write(`visual:diff: ${verdict} → ${relative(repoRoot, path)}\n`)
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)

  return verdictExitCode(verdict, true)
}

main().then((code) => process.exit(code))
