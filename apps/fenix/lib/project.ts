/**
 * Read project identity from USER_IDEA.md.
 *
 * The autonomous loop is parameterized by USER_IDEA.md (written by
 * /fenix-init). We surface the project name + audience headers in the UI
 * so the operator always knows which project this dashboard observes.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function repoRoot(): string {
  return process.env.FENIX_REPO_ROOT ?? resolve(process.cwd(), '../..')
}

export interface ProjectIdentity {
  initialized: boolean
  name: string
  audience: string | null
  problem: string | null
  raw: string
}

export function getProjectIdentity(): ProjectIdentity {
  const path = resolve(repoRoot(), 'USER_IDEA.md')
  if (!existsSync(path)) {
    return { initialized: false, name: 'Fenix', audience: null, problem: null, raw: '' }
  }
  const raw = readFileSync(path, 'utf-8')

  const firstHeading = raw.match(/^#\s+(.+)$/m)
  // Headings track the USER_IDEA.md template (`/fenix-init`). If the
  // template wording changes, update both sides together.
  const audienceSection = extractSection(raw, 'Who is this for?')
  const problemSection = extractSection(raw, 'What problem does it solve?')

  // A non-initialized template still has the placeholder line starting with
  // '<' (e.g., '<one paragraph — concrete user role>'); treat that, an empty
  // section, or the literal `<project-name>` H1 as "not initialized yet".
  const audienceTrimmed = audienceSection?.trim()
  const initialized = audienceTrimmed != null && audienceTrimmed.length > 0 && !audienceTrimmed.startsWith('<')
  const name = firstHeading?.[1].trim().replace(/^<|>$/g, '').trim() ?? 'Fenix'
  const displayName = name === 'project-name' || name === '' ? 'Fenix' : name

  return {
    initialized,
    name: displayName,
    audience: audienceTrimmed ?? null,
    problem: problemSection?.trim() ?? null,
    raw,
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractSection(text: string, heading: string): string | null {
  // Match the heading at the start of a line; anchor at the next `##` (or
  // EOF) so we don't bleed into the following section. `\b` is wrong for
  // headings that end in punctuation like '?'.
  const re = new RegExp(`^##\\s+${escapeRe(heading)}\\s*$`, 'm')
  const start = text.search(re)
  if (start < 0) return null
  const after = text.slice(start)
  const nl = after.indexOf('\n')
  const body = after.slice(nl + 1)
  const end = body.search(/\n##\s+/)
  return end < 0 ? body.trim() : body.slice(0, end).trim()
}

export function readResearchDoc(name: 'MARKET' | 'COMPETITORS' | 'BRAND' | 'TECH'): string | null {
  const path = resolve(repoRoot(), '.planning/research', `${name}.md`)
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf-8')
}

export function readFeaturesDoc(): string | null {
  const path = resolve(repoRoot(), '.planning/FEATURES.md')
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf-8')
}

export function listPenExports(version: string): string[] {
  const dir = resolve(repoRoot(), 'pens', 'exports', version)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /\.png$/i.test(f))
    .sort()
}
