#!/usr/bin/env bun
/**
 * pen-drift-check — gate 4 (HARD).
 *
 * Every story can pin itself to a specific exported pen frame via a
 * `@pen <pens/exports/<version>/<frame>.png>` JSDoc tag. If the PNG on
 * disk has changed since the story was authored — without a corresponding
 * deviation note in PLAN.md — the gate fails.
 *
 * Drift detection: sha256 of the PNG bytes. The expected sha lives next
 * to the PNG as `<frame>.png.sha256` (a one-line file). The story's @pen
 * tag may also optionally embed the sha inline as `@pen <path>#<sha>` —
 * the gate accepts either source as the pinned reference.
 *
 *   bun scripts/pen-drift-check.ts --phase <id>
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative, resolve } from 'node:path'
import { readPlan, extractSection } from './lib/plan'
import { writeGateArtifact, verdictExitCode } from './lib/artifacts'

interface PenRef {
  story: string
  pen: string
  pinnedSha: string | null
  diskSha: string | null
  driftStatus: 'pinned-match' | 'pinned-mismatch' | 'unpinned-no-sha' | 'missing-pen'
}

function sha256(path: string): string | null {
  try {
    const bytes = readFileSync(path)
    return createHash('sha256').update(bytes).digest('hex')
  } catch {
    return null
  }
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

function findPenRefs(repoRoot: string): PenRef[] {
  const out: PenRef[] = []
  for (const file of findStoryFiles(repoRoot)) {
    const src = readFileSync(file, 'utf-8')
    const rel = relative(repoRoot, file)
    // Matches `@pen <path>` or `@pen <path>#<sha>`
    for (const m of src.matchAll(/@pen\s+(\S+)/g)) {
      const raw = m[1]
      const [penPath, inlineSha] = raw.split('#')
      const sidecarPath = resolve(repoRoot, `${penPath}.sha256`)
      let pinnedSha: string | null = inlineSha ?? null
      if (!pinnedSha && existsSync(sidecarPath)) {
        pinnedSha = readFileSync(sidecarPath, 'utf-8').trim().split(/\s+/)[0] ?? null
      }
      const absPen = resolve(repoRoot, penPath)
      if (!existsSync(absPen)) {
        out.push({
          story: rel,
          pen: penPath,
          pinnedSha,
          diskSha: null,
          driftStatus: 'missing-pen',
        })
        continue
      }
      const diskSha = sha256(absPen)
      const status: PenRef['driftStatus'] =
        pinnedSha == null
          ? 'unpinned-no-sha'
          : pinnedSha === diskSha
            ? 'pinned-match'
            : 'pinned-mismatch'
      out.push({ story: rel, pen: penPath, pinnedSha, diskSha, driftStatus: status })
    }
  }
  return out
}

function deviationNote(planText: string, penPath: string): boolean {
  const section = extractSection(planText, 'Pen drift deviations')
  if (section == null) return false
  return section.includes(penPath)
}

function main(): number {
  const startedAt = Date.now()
  const argv = process.argv.slice(2)
  const phaseIdx = argv.indexOf('--phase')
  if (phaseIdx < 0) {
    process.stderr.write('usage: pen-drift-check --phase <id>\n')
    return 2
  }
  const phase = argv[phaseIdx + 1]
  if (!phase) {
    process.stderr.write('--phase requires a phase id\n')
    return 2
  }

  const repoRoot = process.cwd()
  const plan = readPlan(phase, repoRoot)
  const refs = findPenRefs(repoRoot)

  const drifts = refs.filter((r) => r.driftStatus === 'pinned-mismatch')
  const missing = refs.filter((r) => r.driftStatus === 'missing-pen')
  const unpinned = refs.filter((r) => r.driftStatus === 'unpinned-no-sha')

  const acceptedDrifts: PenRef[] = []
  const rejectedDrifts: PenRef[] = []
  for (const d of drifts) {
    if (deviationNote(plan.raw, d.pen)) acceptedDrifts.push(d)
    else rejectedDrifts.push(d)
  }

  const reasons: string[] = []
  if (refs.length === 0) {
    reasons.push('No @pen-tagged stories found — gate skipped (nothing to verify)')
  }
  if (missing.length > 0) {
    reasons.push(
      `${missing.length} story(ies) reference a pen PNG that does not exist on disk`,
    )
  }
  if (rejectedDrifts.length > 0) {
    reasons.push(
      `${rejectedDrifts.length} pen PNG(s) drifted from their pinned sha without a deviation note in PLAN.md`,
    )
  }
  if (unpinned.length > 0) {
    reasons.push(
      `${unpinned.length} @pen tag(s) without a pinned sha (add inline #<sha> or create ${unpinned[0].pen}.sha256)`,
    )
  }
  if (acceptedDrifts.length > 0) {
    reasons.push(
      `${acceptedDrifts.length} drift(s) accepted via deviation note in PLAN.md`,
    )
  }

  let verdict: 'pass' | 'fail' | 'soft-warn' = 'pass'
  if (refs.length === 0) verdict = 'soft-warn'
  else if (rejectedDrifts.length > 0 || missing.length > 0) verdict = 'fail'
  else if (unpinned.length > 0) verdict = 'fail'

  const { path } = writeGateArtifact({
    phase,
    gate: 'pen:drift',
    verdict,
    hard: true,
    startedAt,
    reasons,
    details: { refs, accepted_drifts: acceptedDrifts },
  })

  process.stdout.write(`pen:drift: ${verdict} → ${relative(repoRoot, path)}\n`)
  for (const r of reasons) process.stdout.write(`  • ${r}\n`)

  return verdictExitCode(verdict, true)
}

process.exit(main())
