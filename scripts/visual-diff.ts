#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseFlags, printJson, resolveRepoRoot } from './lib/phase.ts'

const HELP = `visual-diff — render a story, screenshot it, compare to its @pen reference.

Usage:
  bun run scripts/visual-diff.ts --story <path> [--json]
  bun run scripts/visual-diff.ts --all [--json]

Options:
  --story <path>  Story file whose @pen reference to compare.
  --all           Scan every story with an @pen annotation.
  --json          Emit a machine-readable JSON report.
  --help          Show this help.

M3 ships a skeleton: it lists the (story, pen-reference) pairs that would
be compared. The actual pixel-diff step requires a running Storybook dev
server and Playwright; that lands in M4.
`

// TODO(M4-future): spawn Storybook + Playwright, take a screenshot per story,
//                  pixel-diff against the @pen PNG, emit a per-story diff score.

interface Pair {
  story: string
  penPath: string
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

function extractPenRefs(root: string, files: string[]): Pair[] {
  const pairs: Pair[] = []
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
      pairs.push({ story: relative(root, file), penPath })
    }
  }
  return pairs
}

function main(): number {
  const { flags } = parseFlags(process.argv.slice(2))
  if (flags.help === true) {
    process.stdout.write(HELP)
    return 0
  }
  const story = typeof flags.story === 'string' ? flags.story : null
  const all = flags.all === true
  const json = flags.json === true

  if (!story && !all) {
    process.stderr.write('visual-diff: pass --story <path> or --all. Run with --help.\n')
    return 2
  }

  const root = resolveRepoRoot(resolve('.'))
  let files: string[] = []
  if (all) {
    const appsDir = join(root, 'apps')
    if (existsSync(appsDir)) walkStories(appsDir, files)
    const pkgDir = join(root, 'packages')
    if (existsSync(pkgDir)) walkStories(pkgDir, files)
  } else if (story) {
    const full = resolve(story)
    if (!existsSync(full)) {
      process.stderr.write(`visual-diff: story file not found: ${full}\n`)
      return 1
    }
    files = [full]
  }

  const pairs = extractPenRefs(root, files)

  if (json) {
    printJson({ mode: all ? 'all' : 'story', pairs, pixelDiffImplemented: false })
  } else {
    process.stdout.write(`visual-diff mode=${all ? 'all' : 'story'}\n`)
    process.stdout.write(`  candidate pairs: ${pairs.length}\n`)
    for (const pair of pairs) {
      process.stdout.write(`    ${pair.story}  ->  ${pair.penPath}\n`)
    }
    if (pairs.length === 0) {
      process.stdout.write('  no @pen annotations found — nothing to compare\n')
    }
    process.stdout.write('\n  note: pixel-diff not yet implemented. Pairs listed above are the comparison set.\n')
  }
  return 0
}

process.exit(main())
