/**
 * Derived queries against `.planning/fenix.db`.
 *
 * Every query returns a default empty shape if the DB has not been created
 * yet (the project hasn't run `/fenix-init` — or the read model has not been
 * rehydrated). UI uses these defaults to render an empty state instead of
 * crashing.
 */

import { readDb } from './db'

export interface Version {
  name: string
  status: string
  approved_at: number | null
  pen_path: string | null
}

export interface Phase {
  id: string
  slug: string
  version: string
  feature: string | null
  status: string
  contract_sha: string | null
  checks_sha: string | null
  started_at: number | null
  finished_at: number | null
}

export interface Gate {
  phase_id: string
  gate_name: string
  status: string
  json_path: string | null
  ran_at: number
}

export interface FenixEvent {
  id: number
  ts: number
  stage: string
  phase_id: string | null
  kind: string
  payload_json: string | null
}

export interface FeedbackRow {
  id: number
  version: string
  frame: string | null
  feature: string | null
  change: string
  why: string | null
  ts: number
  applied: number
}

export interface Approval {
  stage: string
  payload_id: string
  approved_at: number
  signer: string | null
}

export interface Lesson {
  id: string
  ts: number
  scope: string
  category: string
  severity: string
  applies_to: string[]
  evidence: string[]
  phase: string | null
  status: 'proposed' | 'applied' | 'archived'
  title: string
  body_md_path: string
}

export function listVersions(): Version[] {
  const db = readDb()
  if (!db) return []
  return db.prepare(`SELECT name, status, approved_at, pen_path FROM versions ORDER BY name`).all() as Version[]
}

export function listPhases(version?: string): Phase[] {
  const db = readDb()
  if (!db) return []
  if (version) {
    return db.prepare(`SELECT * FROM phases WHERE version = ? ORDER BY id`).all(version) as Phase[]
  }
  return db.prepare(`SELECT * FROM phases ORDER BY id`).all() as Phase[]
}

export function getPhase(id: string): Phase | null {
  const db = readDb()
  if (!db) return null
  return (db.prepare(`SELECT * FROM phases WHERE id = ?`).get(id) as Phase | null) ?? null
}

export function listGatesForPhase(phaseId: string): Gate[] {
  const db = readDb()
  if (!db) return []
  return db
    .prepare(
      `SELECT phase_id, gate_name, status, json_path, ran_at FROM gates
       WHERE phase_id = ? ORDER BY ran_at DESC`,
    )
    .all(phaseId) as Gate[]
}

export function listEvents(opts: { phase?: string; limit?: number; sinceId?: number } = {}): FenixEvent[] {
  const db = readDb()
  if (!db) return []
  const limit = Math.max(1, Math.min(500, opts.limit ?? 50))
  if (opts.phase != null) {
    return db
      .prepare(
        `SELECT id, ts, stage, phase_id, kind, payload_json FROM events
         WHERE phase_id = ? AND id > ? ORDER BY id DESC LIMIT ?`,
      )
      .all(opts.phase, opts.sinceId ?? 0, limit) as FenixEvent[]
  }
  return db
    .prepare(
      `SELECT id, ts, stage, phase_id, kind, payload_json FROM events
       WHERE id > ? ORDER BY id DESC LIMIT ?`,
    )
    .all(opts.sinceId ?? 0, limit) as FenixEvent[]
}

export function listPendingFeedback(version?: string): FeedbackRow[] {
  const db = readDb()
  if (!db) return []
  if (version) {
    return db
      .prepare(`SELECT * FROM feedback WHERE version = ? AND applied = 0 ORDER BY ts DESC`)
      .all(version) as FeedbackRow[]
  }
  return db.prepare(`SELECT * FROM feedback WHERE applied = 0 ORDER BY ts DESC`).all() as FeedbackRow[]
}

export function listApprovals(): Approval[] {
  const db = readDb()
  if (!db) return []
  return db
    .prepare(`SELECT stage, payload_id, approved_at, signer FROM approvals ORDER BY approved_at DESC`)
    .all() as Approval[]
}

interface LessonRow {
  id: string
  ts: number
  scope: string
  category: string
  severity: string
  applies_to_json: string
  evidence_json: string
  phase: string | null
  status: 'proposed' | 'applied' | 'archived'
  title: string
  body_md_path: string
}

function rowToLesson(r: LessonRow): Lesson {
  let appliesTo: string[] = []
  let evidence: string[] = []
  try {
    const parsed = JSON.parse(r.applies_to_json) as unknown
    if (Array.isArray(parsed)) appliesTo = parsed.map(String)
  } catch {
    /* leave empty */
  }
  try {
    const parsed = JSON.parse(r.evidence_json) as unknown
    if (Array.isArray(parsed)) evidence = parsed.map(String)
  } catch {
    /* leave empty */
  }
  return {
    id: r.id,
    ts: r.ts,
    scope: r.scope,
    category: r.category,
    severity: r.severity,
    applies_to: appliesTo,
    evidence,
    phase: r.phase,
    status: r.status,
    title: r.title,
    body_md_path: r.body_md_path,
  }
}

export function listLessons(opts: { scope?: string; status?: string; category?: string } = {}): Lesson[] {
  const db = readDb()
  if (!db) return []
  const filters: string[] = []
  const args: string[] = []
  if (opts.scope) {
    filters.push('scope = ?')
    args.push(opts.scope)
  }
  if (opts.status) {
    filters.push('status = ?')
    args.push(opts.status)
  }
  if (opts.category) {
    filters.push('category = ?')
    args.push(opts.category)
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT id, ts, scope, category, severity, applies_to_json, evidence_json, phase, status, title, body_md_path
       FROM lessons ${where} ORDER BY ts DESC`,
    )
    .all(...args) as LessonRow[]
  return rows.map(rowToLesson)
}

export function getLesson(id: string): Lesson | null {
  const db = readDb()
  if (!db) return null
  const row = db
    .prepare(
      `SELECT id, ts, scope, category, severity, applies_to_json, evidence_json, phase, status, title, body_md_path
       FROM lessons WHERE id = ?`,
    )
    .get(id) as LessonRow | null
  return row ? rowToLesson(row) : null
}

export interface Overview {
  dbReady: boolean
  totalVersions: number
  totalPhases: number
  phasesGreen: number
  phasesHalted: number
  phasesInFlight: number
  pendingApprovals: number
  pendingFeedback: number
  latestEvent: FenixEvent | null
  latestEventAgeMs: number | null
}

export function getOverview(): Overview {
  const db = readDb()
  if (!db) {
    return {
      dbReady: false,
      totalVersions: 0,
      totalPhases: 0,
      phasesGreen: 0,
      phasesHalted: 0,
      phasesInFlight: 0,
      pendingApprovals: 0,
      pendingFeedback: 0,
      latestEvent: null,
      latestEventAgeMs: null,
    }
  }
  const totalVersions = (db.prepare(`SELECT COUNT(*) AS n FROM versions`).get() as { n: number }).n ?? 0
  const phaseStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'green'  THEN 1 ELSE 0 END) AS green,
         SUM(CASE WHEN status = 'halted' THEN 1 ELSE 0 END) AS halted,
         SUM(CASE WHEN status NOT IN ('green','halted','planned') THEN 1 ELSE 0 END) AS in_flight
       FROM phases`,
    )
    .get() as { total: number; green: number; halted: number; in_flight: number }
  const pendingApprovals = (db.prepare(`SELECT COUNT(*) AS n FROM approvals`).get() as { n: number }).n ?? 0
  const pendingFeedback =
    (
      db.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE applied = 0`).get() as {
        n: number
      }
    ).n ?? 0
  const latestEvent =
    (db
      .prepare(`SELECT id, ts, stage, phase_id, kind, payload_json FROM events ORDER BY id DESC LIMIT 1`)
      .get() as FenixEvent | null) ?? null
  return {
    dbReady: true,
    totalVersions,
    totalPhases: phaseStats.total ?? 0,
    phasesGreen: phaseStats.green ?? 0,
    phasesHalted: phaseStats.halted ?? 0,
    phasesInFlight: phaseStats.in_flight ?? 0,
    pendingApprovals,
    pendingFeedback,
    latestEvent,
    latestEventAgeMs: latestEvent ? Date.now() - latestEvent.ts : null,
  }
}
