/**
 * Lessons learned — the loop's institutional memory.
 *
 * Source of truth = `.planning/learnings/<id>.md` files with frontmatter.
 * The SQLite `lessons` table is a derived read model rebuilt by rehydrate.
 *
 * Lesson lifecycle:
 *   proposed    — published agent suggests this; agents see it as a
 *                 "candidate amendment" hint
 *   applied     — agent prompts or gate behavior have been amended to
 *                 reflect this lesson; promoted to a binding rule
 *   archived    — superseded, retracted, or moved into the agent prompt
 *                 directly (no longer needed as a runtime hint)
 *
 * Scope determines who reads the lesson at startup:
 *   loop                       — orchestrator-level
 *   agent:<name>               — that specific subagent (e.g. agent:fenix-contract-author)
 *   gate:<name>                — gate-script behavior
 *   stage:<name>               — stage-wide (research/design/tech/phases/build)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Database } from 'bun:sqlite'

export type LessonStatus = 'proposed' | 'applied' | 'archived'
export type LessonSeverity = 'one-off' | 'recurring' | 'pattern'

export interface Lesson {
  id: string
  ts: number
  scope: string
  category: string
  severity: LessonSeverity | string
  applies_to: string[]
  evidence: string[]
  phase: string | null
  status: LessonStatus
  title: string
  body_md_path: string
  body: string
}

const LEARNINGS_DIR = '.planning/learnings'
const ID_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{3}$/

export function learningsDir(repoRoot: string = process.cwd()): string {
  return resolve(repoRoot, LEARNINGS_DIR)
}

export function lessonPath(id: string, repoRoot: string = process.cwd()): string {
  return resolve(learningsDir(repoRoot), `${id}.md`)
}

export function ensureLearningsDir(repoRoot: string = process.cwd()): string {
  const dir = learningsDir(repoRoot)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listLessonFiles(repoRoot: string = process.cwd()): string[] {
  const dir = learningsDir(repoRoot)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && ID_RE.test(f.slice(0, -3)))
    .sort()
    .map((f) => join(dir, f))
}

export function readLessonFile(path: string, repoRoot: string = process.cwd()): Lesson | null {
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf-8')
  const fm = parseFrontmatter(raw)
  if (!fm) return null
  const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
  return {
    id: fm.id,
    ts: parseTs(fm.ts),
    scope: fm.scope,
    category: fm.category,
    severity: (fm.severity ?? 'one-off') as LessonSeverity,
    applies_to: parseList(fm.applies_to),
    evidence: parseList(fm.evidence),
    phase: fm.phase ?? null,
    status: (fm.status ?? 'proposed') as LessonStatus,
    title: fm.title ?? body.split('\n')[0]?.replace(/^#\s*/, '') ?? '(untitled)',
    body_md_path: relative(repoRoot, path),
    body,
  }
}

export function listLessons(repoRoot: string = process.cwd()): Lesson[] {
  const lessons: Lesson[] = []
  for (const file of listLessonFiles(repoRoot)) {
    const l = readLessonFile(file, repoRoot)
    if (l) lessons.push(l)
  }
  return lessons
}

export function nextLessonId(repoRoot: string = process.cwd(), today = new Date()): string {
  const ymd = today.toISOString().slice(0, 10)
  const prefix = `${ymd}-`
  const existing = listLessonFiles(repoRoot)
    .map((p) => p.split('/').pop()?.replace(/\.md$/, '') ?? '')
    .filter((id) => id.startsWith(prefix))
  let n = 1
  while (existing.includes(`${prefix}${String(n).padStart(3, '0')}`)) n++
  return `${prefix}${String(n).padStart(3, '0')}`
}

export interface LessonDraft {
  scope: string
  category: string
  title: string
  body: string
  severity?: LessonSeverity
  applies_to?: string[]
  evidence?: string[]
  phase?: string | null
  status?: LessonStatus
}

export function writeLesson(
  draft: LessonDraft,
  repoRoot: string = process.cwd(),
): Lesson {
  ensureLearningsDir(repoRoot)
  const id = nextLessonId(repoRoot)
  const ts = Date.now()
  const fm = {
    id,
    ts: new Date(ts).toISOString(),
    scope: draft.scope,
    category: draft.category,
    severity: draft.severity ?? 'one-off',
    applies_to: draft.applies_to ?? [],
    evidence: draft.evidence ?? [],
    phase: draft.phase ?? null,
    status: draft.status ?? 'proposed',
    title: draft.title,
  }
  const path = lessonPath(id, repoRoot)
  writeFileSync(path, `${serializeFrontmatter(fm)}\n\n${draft.body.trim()}\n`)
  const lesson = readLessonFile(path, repoRoot)
  if (!lesson) throw new Error(`failed to read lesson back: ${path}`)
  return lesson
}

export function setLessonStatus(
  id: string,
  status: LessonStatus,
  repoRoot: string = process.cwd(),
): Lesson {
  const path = lessonPath(id, repoRoot)
  if (!existsSync(path)) throw new Error(`lesson ${id} not found at ${relative(repoRoot, path)}`)
  const raw = readFileSync(path, 'utf-8')
  const rewritten = raw.replace(/^(status:\s*)\S+/m, `$1${status}`)
  writeFileSync(path, rewritten)
  const lesson = readLessonFile(path, repoRoot)
  if (!lesson) throw new Error(`lesson ${id} re-read failed`)
  return lesson
}

export function mirrorLessonsToDb(db: Database, repoRoot: string = process.cwd()): number {
  const lessons = listLessons(repoRoot)
  const insert = db.prepare(
    `INSERT INTO lessons (id, ts, scope, category, severity, applies_to_json, evidence_json, phase, status, title, body_md_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       ts              = excluded.ts,
       scope           = excluded.scope,
       category        = excluded.category,
       severity        = excluded.severity,
       applies_to_json = excluded.applies_to_json,
       evidence_json   = excluded.evidence_json,
       phase           = excluded.phase,
       status          = excluded.status,
       title           = excluded.title,
       body_md_path    = excluded.body_md_path`,
  )
  for (const l of lessons) {
    insert.run(
      l.id,
      l.ts,
      l.scope,
      l.category,
      l.severity,
      JSON.stringify(l.applies_to),
      JSON.stringify(l.evidence),
      l.phase,
      l.status,
      l.title,
      l.body_md_path,
    )
  }
  return lessons.length
}

interface RawFrontmatter {
  id: string
  ts: string
  scope: string
  category: string
  severity?: string
  applies_to?: string
  evidence?: string
  phase?: string
  status?: string
  title?: string
}

function parseFrontmatter(text: string): RawFrontmatter | null {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return null
  const out: Record<string, string> = {}
  let currentKey: string | null = null
  const arrayLines: Record<string, string[]> = {}
  for (const line of m[1].split('\n')) {
    if (/^\s+-\s+/.test(line) && currentKey) {
      const val = line.replace(/^\s+-\s+/, '').trim()
      ;(arrayLines[currentKey] ??= []).push(stripQuotes(val))
      continue
    }
    const eq = line.indexOf(':')
    if (eq < 1) continue
    currentKey = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (val.length === 0) {
      // value continues on following indented `- item` lines
      continue
    }
    out[currentKey] = stripQuotes(val)
    currentKey = null
  }
  // Fold array lines into out as JSON arrays so parseList can read uniformly.
  for (const [k, items] of Object.entries(arrayLines)) {
    if (!(k in out)) out[k] = JSON.stringify(items)
  }
  if (!out.id || !out.scope || !out.category || !out.ts) return null
  return out as unknown as RawFrontmatter
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    return s.slice(1, -1)
  }
  return s
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      /* fall through */
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseTs(raw: string): number {
  if (/^\d+$/.test(raw)) return Number(raw)
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : Date.now()
}

interface SerializableFrontmatter {
  id: string
  ts: string
  scope: string
  category: string
  severity: string
  applies_to: string[]
  evidence: string[]
  phase: string | null
  status: string
  title: string
}

function serializeFrontmatter(fm: SerializableFrontmatter): string {
  const lines: string[] = ['---']
  lines.push(`id: ${fm.id}`)
  lines.push(`ts: ${fm.ts}`)
  lines.push(`scope: ${fm.scope}`)
  lines.push(`category: ${fm.category}`)
  lines.push(`severity: ${fm.severity}`)
  lines.push(`status: ${fm.status}`)
  lines.push(`title: ${quoteIfNeeded(fm.title)}`)
  lines.push(`phase: ${fm.phase ?? ''}`)
  lines.push(`applies_to:`)
  for (const a of fm.applies_to) lines.push(`  - ${a}`)
  if (fm.applies_to.length === 0) lines.push(`  []`) // dummy retained line; readers tolerate either form
  lines.push(`evidence:`)
  for (const e of fm.evidence) lines.push(`  - ${e}`)
  if (fm.evidence.length === 0) lines.push(`  []`)
  lines.push('---')
  return lines.join('\n')
}

function quoteIfNeeded(s: string): string {
  if (s.includes(':') || s.includes('#') || s.startsWith('-')) {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  return s
}

export function scopesFor(name: string): string[] {
  // Helper: given an agent name like "fenix-contract-author", return the
  // canonical scopes that agent should query for lessons.
  return [`agent:${name}`, 'loop']
}

function safeStat(p: string) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

export function isLearningsDir(p: string): boolean {
  const s = safeStat(p)
  return s != null && s.isDirectory()
}
