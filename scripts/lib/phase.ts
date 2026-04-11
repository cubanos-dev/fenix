import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface GitDiffOptions {
  base: string
  cwd: string
  pathSpecs?: string[]
}

export function resolveRepoRoot(start: string): string {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: start,
    encoding: 'utf8',
  })
  if (result.status === 0) return result.stdout.trim()
  return start
}

export function listChangedFiles(options: GitDiffOptions): string[] {
  const args = ['diff', '--name-only', '--diff-filter=AM', `${options.base}...HEAD`]
  if (options.pathSpecs && options.pathSpecs.length > 0) {
    args.push('--', ...options.pathSpecs)
  }
  const result = spawnSync('git', args, { cwd: options.cwd, encoding: 'utf8' })
  if (result.status !== 0) return []
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function listAddedFiles(options: GitDiffOptions): string[] {
  const args = ['diff', '--name-only', '--diff-filter=A', `${options.base}...HEAD`]
  if (options.pathSpecs && options.pathSpecs.length > 0) {
    args.push('--', ...options.pathSpecs)
  }
  const result = spawnSync('git', args, { cwd: options.cwd, encoding: 'utf8' })
  if (result.status !== 0) return []
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function hasGit(cwd: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8' })
  return result.status === 0
}

export function phaseDir(root: string, phase: string): string {
  return join(root, '.planning', 'phases', phase)
}

export function phaseExists(root: string, phase: string): boolean {
  return existsSync(phaseDir(root, phase))
}

export interface ParsedFlags {
  positionals: string[]
  flags: Record<string, string | boolean>
}

export function parseFlags(argv: string[]): ParsedFlags {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token) continue
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true
      continue
    }
    flags[key] = next
    i += 1
  }
  return { positionals, flags }
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}
