#!/usr/bin/env bun
/**
 * fenix-pin-checks — X_PASS_X enforcer.
 *
 * Runs as a Lefthook pre-commit job. Rejects any commit whose staged files
 * intersect the set of files pinned by an active phase's CHECKS_COMMIT_SHA.
 *
 * The pinned set per phase = `git diff <CHECKS_SHA>^ <CHECKS_SHA> --name-only`
 * — exactly the files the checks-author wrote in the DEFINE_CHECKS commit.
 *
 * "Active" = phase is in one of the implementation-locked statuses
 * (`checks` | `implement-a` | `implement-b` | `implement-c` | `validate`).
 * Once a phase goes `green` the lock releases for that phase.
 *
 * **The only escape is `git revert <CHECKS_COMMIT_SHA>`** — a deliberate,
 * auditable action that re-opens DEFINE_CHECKS. This script does not
 * provide a `--force` flag; bypass is `--no-verify` which the user has
 * directly forbidden in their working agreement.
 *
 *   bun scripts/fenix-pin-checks.ts                # default — read staged files
 *   bun scripts/fenix-pin-checks.ts --files a b c  # explicit files (for tests)
 *   bun scripts/fenix-pin-checks.ts --print-pins   # debug: print active pinned files
 *
 * Exit codes:
 *   0  — no overlap; commit can proceed
 *   1  — overlap; commit rejected (lefthook will fail the hook)
 *   2  — internal error
 */

import { spawnSync } from 'node:child_process'
import { listPhases, isLockedStatus, type Plan } from './lib/plan'

interface PinnedSet {
  phase: Plan
  checksSha: string
  files: Set<string>
}

function gitOutput(args: string[]): string {
  const res = spawnSync('git', args, { encoding: 'utf-8' })
  if (res.status !== 0) {
    process.stderr.write(`git ${args.join(' ')}\n${res.stderr}`)
    process.exit(2)
  }
  return res.stdout
}

function pinnedFilesFor(sha: string): Set<string> {
  // The CHECKS commit is the pinning commit. Its tree-diff vs its parent IS
  // the pinned set: only files that exist in this commit (and were touched
  // by it). `git diff-tree` handles the root-commit case (no parent) — using
  // `git diff <sha>^ <sha>` would fail with "ambiguous argument" and lock
  // every subsequent commit behind --no-verify.
  const out = gitOutput(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
  const files = new Set<string>()
  for (const line of out.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length > 0) files.add(trimmed)
  }
  return files
}

function collectPinned(): PinnedSet[] {
  const phases = listPhases().filter(
    (p) =>
      p.frontmatter.CHECKS_COMMIT_SHA != null &&
      p.frontmatter.CHECKS_COMMIT_SHA.length > 0 &&
      isLockedStatus(p.frontmatter.status),
  )
  return phases.map((phase) => ({
    phase,
    checksSha: phase.frontmatter.CHECKS_COMMIT_SHA as string,
    files: pinnedFilesFor(phase.frontmatter.CHECKS_COMMIT_SHA as string),
  }))
}

function stagedFiles(): string[] {
  const out = gitOutput(['diff', '--cached', '--name-only', '--diff-filter=ACMRT'])
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function main(): void {
  const argv = process.argv.slice(2)
  const printPins = argv.includes('--print-pins')
  const filesIdx = argv.indexOf('--files')
  const explicitFiles =
    filesIdx >= 0
      ? argv.slice(filesIdx + 1).filter((s) => !s.startsWith('--'))
      : null

  const pins = collectPinned()

  if (printPins) {
    for (const pin of pins) {
      process.stdout.write(
        `phase=${pin.phase.id} sha=${pin.checksSha} status=${pin.phase.frontmatter.status}\n`,
      )
      for (const f of pin.files) process.stdout.write(`  ${f}\n`)
    }
    if (pins.length === 0) process.stdout.write('(no active phases with pinned checks)\n')
    return
  }

  if (pins.length === 0) {
    // No locked phases; nothing to enforce.
    process.exit(0)
  }

  const staged = explicitFiles ?? stagedFiles()
  if (staged.length === 0) process.exit(0)

  // Build the union of all pinned files, with a map back to the phase that pinned each.
  const pinByFile = new Map<string, PinnedSet>()
  for (const pin of pins) {
    for (const f of pin.files) {
      if (!pinByFile.has(f)) pinByFile.set(f, pin)
    }
  }

  const violations: Array<{ file: string; phase: string; sha: string }> = []
  for (const f of staged) {
    const pin = pinByFile.get(f)
    if (pin) violations.push({ file: f, phase: pin.phase.id, sha: pin.checksSha })
  }

  if (violations.length === 0) {
    process.exit(0)
  }

  process.stderr.write('\n')
  process.stderr.write('  ╔═══════════════════════════════════════════════════════════════╗\n')
  process.stderr.write('  ║  X_PASS_X — checks are pinned                                 ║\n')
  process.stderr.write('  ╚═══════════════════════════════════════════════════════════════╝\n')
  process.stderr.write('\n')
  process.stderr.write(
    '  This commit touches files that were pinned by a DEFINE_CHECKS commit\n',
  )
  process.stderr.write(
    '  for a phase that is still in implementation. The implementation moves\n',
  )
  process.stderr.write(
    '  to the check — never the other way around.\n\n',
  )
  process.stderr.write('  Violations:\n')
  for (const v of violations) {
    process.stderr.write(
      `    • ${v.file}\n      pinned by phase ${v.phase} (checks commit ${v.sha.slice(0, 8)})\n`,
    )
  }
  process.stderr.write('\n')
  process.stderr.write('  To proceed you must either:\n')
  process.stderr.write(
    '    1. Drop these files from the commit (`git restore --staged <file>`) and\n',
  )
  process.stderr.write('       change the implementation to bend to the existing checks, or\n')
  process.stderr.write(
    '    2. Run `git revert <CHECKS_COMMIT_SHA>` for the affected phase. This is\n',
  )
  process.stderr.write(
    '       a deliberate, auditable action that re-opens DEFINE_CHECKS. The phase\n',
  )
  process.stderr.write('       will run checks-author again from scratch.\n\n')
  process.stderr.write('  `--no-verify` is not an escape hatch. Do not use it.\n\n')
  process.exit(1)
}

main()
