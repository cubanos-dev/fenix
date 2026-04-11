#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseFlags, printJson, resolveRepoRoot } from './lib/phase.ts'

const HELP = `pen-drift-check — find stories whose @pen references point at changed pen PNGs.

Usage:
  bun run scripts/pen-drift-check.ts [--since <ref>] [--acknowledge <phase>] [--json]

Options:
  --since <ref>         Git ref to diff against (defaults to main).
  --acknowledge <phase> Waive the drift (use when the phase owner has reviewed it).
  --json                Emit a machine-readable JSON report.
  --help                Show this help.

Exit codes: 0 = no drift (or acknowledged), 1 = drift found.
`

interface StoryRef {
  story: string
  penPath: string
}

interface DriftReport {
  since: string
  changedPens: string[]
  impacted: StoryRef[]
  acknowledged: string | null
}

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'dist',
  'build',
  'coverage',
  'storybook-static',
])

function walkStories(dir: string, acc: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let info
    try {
      info = statSync(full)
    } catch {
      continue
    }
    if (info.isDirectory()) {
      walkStories(full, acc)
      continue
    }
    if (entry.endsWith('.stories.tsx') || entry.endsWith('.stories.ts')) {
      acc.push(full)
    }
  }
}

function extractPenRefs(root: string): StoryRef[] {
  const files: string[] = []
  const appsDir = join(root, 'apps')
  if (existsSync(appsDir)) walkStories(appsDir, files)
  const pkgDir = join(root, 'packages')
  if (existsSync(pkgDir)) walkStories(pkgDir, files)
  const refs: StoryRef[] = []
  const pattern = /@pen\s+([^\s*]+)/g
  for (const file of files) {
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    let match: RegExpExecArray | null
    while (true) {
      match = pattern.exec(text)
      if (match === null) break
      const penPath = (match[1] ?? '').trim()
      if (!penPath) continue
      refs.push({ story: relative(root, file), penPath })
    }
  }
  return refs
}

function listChangedPens(root: string, since: string): string[] {
  const result = spawnSync('git', ['diff', '--name-only', `${since}...HEAD`, '--', 'pens/exports/'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.status !== 0) return []
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const since = typeof flags.since === 'string' ? flags.since : 'main'
  const acknowledge = typeof flags.acknowledge === 'string' ? flags.acknowledge : null
  const json = flags.json === true

  const root = resolveRepoRoot(resolve('.'))
  const changed = listChangedPens(root, since)
  const refs = extractPenRefs(root)

  const changedSet = new Set(changed)
  const impacted = refs.filter((ref) => {
    const normalized = ref.penPath.replace(/^\.?\//, '')
    return changedSet.has(normalized) || changedSet.has(`pens/exports/${normalized}`)
  })

  const report: DriftReport = {
    since,
    changedPens: changed,
    impacted,
    acknowledged: acknowledge,
  }

  if (json) {
    printJson(report)
  } else {
    process.stdout.write(`pen-drift-check since=${since}\n`)
    process.stdout.write(`  changed pen exports: ${changed.length}\n`)
    process.stdout.write(`  impacted stories:    ${impacted.length}\n`)
    if (impacted.length > 0) {
      for (const ref of impacted) {
        process.stdout.write(`    - ${ref.story}  @pen ${ref.penPath}\n`)
      }
    }
    if (acknowledge) {
      process.stdout.write(`  acknowledged by phase: ${acknowledge}\n`)
    }
  }

  if (impacted.length === 0) return 0
  return acknowledge ? 0 : 1
}

process.exit(main())
