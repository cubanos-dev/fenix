/**
 * PLAN.md parser — frontmatter + State Enumeration extraction.
 *
 * Every gate script reads PLAN.md to know what it's verifying against.
 * Single parser keeps the contract consistent across the gate suite.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface PlanFrontmatter {
  phase?: string
  version?: string
  feature?: string
  status?: string
  CONTRACT_COMMIT_SHA?: string
  CHECKS_COMMIT_SHA?: string
  [key: string]: string | undefined
}

export interface StateEnumeration {
  happy_path_states: string[]
  non_happy_path_states: string[]
  edge_cases: string[]
}

export interface AcceptanceCriterion {
  id: string
  kind: 'unit' | 'browser' | 'visual' | 'a11y'
  description: string
}

export interface Plan {
  /** Phase id (frontmatter `phase` or the directory slug). */
  id: string
  /** Directory slug under .planning/phases/. */
  slug: string
  /** Absolute path to PLAN.md. */
  path: string
  /** Repo-root relative path to PLAN.md. */
  relPath: string
  frontmatter: PlanFrontmatter
  states: StateEnumeration
  acceptance: AcceptanceCriterion[]
  pens: Array<{ path: string; role: string }>
  goal: string
  raw: string
}

const PHASES_DIR = '.planning/phases'

export function phasesDir(repoRoot: string = process.cwd()): string {
  return resolve(repoRoot, PHASES_DIR)
}

export function planPath(phaseSlug: string, repoRoot: string = process.cwd()): string {
  return resolve(repoRoot, PHASES_DIR, phaseSlug, 'PLAN.md')
}

export function listPhases(repoRoot: string = process.cwd()): Plan[] {
  const dir = phasesDir(repoRoot)
  if (!existsSync(dir)) return []
  const out: Plan[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (!statSync(full).isDirectory()) continue
    const plan = readPlanOptional(entry, repoRoot)
    if (plan) out.push(plan)
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function readPlanOptional(
  phaseSlug: string,
  repoRoot: string = process.cwd(),
): Plan | null {
  const path = planPath(phaseSlug, repoRoot)
  if (!existsSync(path)) return null
  return readPlan(phaseSlug, repoRoot)
}

export function readPlan(phaseSlug: string, repoRoot: string = process.cwd()): Plan {
  const path = planPath(phaseSlug, repoRoot)
  if (!existsSync(path)) {
    throw new Error(`PLAN.md not found at ${path}`)
  }
  const raw = readFileSync(path, 'utf-8')
  const frontmatter = parseFrontmatter(raw)
  return {
    id: frontmatter.phase ?? phaseSlug,
    slug: phaseSlug,
    path,
    relPath: join(PHASES_DIR, phaseSlug, 'PLAN.md'),
    frontmatter,
    states: parseStateEnumeration(raw),
    acceptance: parseAcceptance(raw),
    pens: parsePens(raw),
    goal: extractSection(raw, 'Goal') ?? '',
    raw,
  }
}

export function parseFrontmatter(text: string): PlanFrontmatter {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: PlanFrontmatter = {}
  for (const line of m[1].split('\n')) {
    const eq = line.indexOf(':')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.startsWith('<') && val.endsWith('>')) continue // template placeholder
    if (val.length > 0) (out as Record<string, string>)[key] = val
  }
  return out
}

export function parseStateEnumeration(text: string): StateEnumeration {
  return {
    happy_path_states: parseStateList(text, 'happy_path_states'),
    non_happy_path_states: parseStateList(text, 'non_happy_path_states'),
    edge_cases: parseStateList(text, 'edge_cases'),
  }
}

function parseStateList(text: string, heading: string): string[] {
  const heading3 = new RegExp(`^###\\s+${heading}\\b`, 'm')
  const start = text.search(heading3)
  if (start < 0) return []
  const after = text.slice(start)
  const end = after.search(/\n(?:###|##|\n##)\s/)
  const section = end < 0 ? after : after.slice(0, end)
  const lines = section.split('\n').slice(1)
  const ids: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) continue
    // Accept "- state-id" or "- `state-id`" or "- **state-id** — desc"
    const bullet = line.match(/^[-*]\s+`?\*{0,2}([a-z0-9][a-z0-9-]*)\*{0,2}`?/i)
    if (bullet) ids.push(bullet[1])
  }
  return ids
}

export function parseAcceptance(text: string): AcceptanceCriterion[] {
  const section = extractSection(text, 'Acceptance')
  if (section == null) return []
  // Look for a fenced JSON block first.
  const fence = section.match(/```(?:json)?\n([\s\S]*?)```/)
  if (fence) {
    try {
      const parsed = JSON.parse(fence[1])
      if (Array.isArray(parsed)) return parsed.filter(isAcceptance)
    } catch {
      /* fall through */
    }
  }
  return []
}

function isAcceptance(x: unknown): x is AcceptanceCriterion {
  if (typeof x !== 'object' || x == null) return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.kind === 'string' &&
    ['unit', 'browser', 'visual', 'a11y'].includes(o.kind) &&
    typeof o.description === 'string'
  )
}

function parsePens(text: string): Array<{ path: string; role: string }> {
  const section = extractSection(text, 'Pens')
  if (section == null) return []
  const out: Array<{ path: string; role: string }> = []
  for (const line of section.split('\n')) {
    const m = line.match(/^[-*]\s+(\S+)\s+[—-]\s+(.+)$/)
    if (m) out.push({ path: m[1], role: m[2].trim() })
  }
  return out
}

export function extractSection(text: string, heading: string): string | null {
  const re = new RegExp(`^##\\s+${escapeRe(heading)}\\b`, 'm')
  const start = text.search(re)
  if (start < 0) return null
  const after = text.slice(start)
  const headerEnd = after.indexOf('\n')
  const body = after.slice(headerEnd + 1)
  const end = body.search(/\n##\s+/)
  return end < 0 ? body.trim() : body.slice(0, end).trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function allStates(plan: Plan): string[] {
  return [
    ...plan.states.happy_path_states,
    ...plan.states.non_happy_path_states,
    ...plan.states.edge_cases,
  ]
}

const LOCKED_STATUSES = new Set([
  'checks',
  'implement-a',
  'implement-b',
  'implement-c',
  'validate',
])

export function isLockedStatus(status: string | undefined | null): boolean {
  return status != null && LOCKED_STATUSES.has(status)
}
