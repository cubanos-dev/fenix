import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

export type RenameMap = Record<string, string>

export interface RenameOptions {
  cwd: string
  rename: RenameMap
  dryRun?: boolean
}

export interface RenameReport {
  filesTouched: number
  replacements: number
  plan: Array<{ path: string; replacements: number }>
}

const INCLUDE_FILENAMES = new Set([
  'package.json',
  'turbo.json',
  'vercel.json',
  'tsconfig.json',
  'biome.json',
  'CLAUDE.md',
  'AGENTS.md',
  'DOMAIN_MODEL.md',
  'README.md',
  '.env.example',
  '.env.local.example',
])

const INCLUDE_EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.json', '.yml', '.yaml'])

// Directories we never descend into.
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.vercel',
  'coverage',
  'storybook-static',
  '__pycache__',
  '.venv',
])

// Files whose contents must never be rewritten (self-referential or binary lockfiles).
const EXCLUDE_FILES = new Set(['bun.lockb', 'bun.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])

// Path suffix (POSIX) of the rename utility itself — excluded so the rename map here
// is never rewritten when running the scaffolder from inside fenix.
const SELF_PATH_SUFFIX = 'scripts/lib/rename.ts'

function extname(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.slice(dot)
}

function shouldConsiderFile(name: string): boolean {
  if (EXCLUDE_FILES.has(name)) return false
  if (INCLUDE_FILENAMES.has(name)) return true
  const ext = extname(name)
  return INCLUDE_EXTENSIONS.has(ext)
}

// Ordered replace: longer keys first so '@fenix/' beats 'fenix', and 'FENIX'/'Fenix' beat 'fenix'.
function orderedKeys(map: RenameMap): string[] {
  return Object.keys(map).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length
    return a.localeCompare(b)
  })
}

function applyRename(content: string, map: RenameMap): { next: string; count: number } {
  const keys = orderedKeys(map)
  let next = content
  let count = 0
  for (const key of keys) {
    if (key.length === 0) continue
    const value = map[key]
    if (value === undefined || value === key) continue
    const parts = next.split(key)
    if (parts.length === 1) continue
    count += parts.length - 1
    next = parts.join(value)
  }
  return { next, count }
}

async function walk(dir: string, root: string, acc: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue
      await walk(full, root, acc)
      continue
    }
    if (!entry.isFile()) continue
    if (!shouldConsiderFile(entry.name)) continue
    const rel = relative(root, full).split(sep).join('/')
    if (rel.endsWith(SELF_PATH_SUFFIX)) continue
    acc.push(full)
  }
}

export async function renameProject(options: RenameOptions): Promise<RenameReport> {
  const { cwd, rename, dryRun = false } = options
  const files: string[] = []
  await walk(cwd, cwd, files)

  let filesTouched = 0
  let replacements = 0
  const plan: RenameReport['plan'] = []

  for (const file of files) {
    const original = await readFile(file, 'utf8')
    const { next, count } = applyRename(original, rename)
    if (count === 0 || next === original) continue
    const rel = relative(cwd, file).split(sep).join('/')
    plan.push({ path: rel, replacements: count })
    filesTouched += 1
    replacements += count
    if (dryRun) continue
    const info = await stat(file)
    await writeFile(file, next, { encoding: 'utf8', mode: info.mode })
  }

  return { filesTouched, replacements, plan }
}

export function buildRenameMap(projectName: string, scope: string): RenameMap {
  const lower = projectName.toLowerCase()
  const upper = lower.toUpperCase().replace(/-/g, '_')
  const pascal = lower
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  const scopeTrimmed = scope.startsWith('@') ? scope.slice(1) : scope
  return {
    '@fenix/': `@${scopeTrimmed}/`,
    FENIX: upper,
    Fenix: pascal,
    fenix: lower,
  }
}

export function isValidKebabCase(name: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)
}
