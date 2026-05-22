/**
 * .planning/fenix.db — SQLite read model for the Fenix loop.
 *
 * Source of truth = Markdown + JSON in `.planning/`. This DB is rebuilt by
 * `bun run fenix:rehydrate` from those artifacts. Gitignored. Local-private.
 *
 * Consumed by:
 *   - `.claude/scripts/fenix-auto.ts` (writes events as the loop advances)
 *   - `apps/fenix/lib/db.ts` (reads for the dashboard UI; same schema)
 */

import { Database } from 'bun:sqlite'
import { dirname, resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

export type Stage =
  | 'init'
  | 'research'
  | 'design'
  | 'tech'
  | 'phases'
  | 'build'
  | 'orchestrator'

export type PhaseStatus =
  | 'planned'
  | 'contract'
  | 'checks'
  | 'implement-a'
  | 'implement-b'
  | 'implement-c'
  | 'validate'
  | 'publish'
  | 'green'
  | 'halted'

export type GateStatus = 'pass' | 'fail' | 'skipped' | 'soft-warn'

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  stage       TEXT    NOT NULL,
  phase_id    TEXT,
  kind        TEXT    NOT NULL,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts       ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_phase    ON events(phase_id);
CREATE INDEX IF NOT EXISTS idx_events_stage    ON events(stage);

CREATE TABLE IF NOT EXISTS versions (
  name        TEXT    PRIMARY KEY,
  status      TEXT    NOT NULL,        -- planned | designing | approved | building | green
  approved_at INTEGER,
  pen_path    TEXT
);

CREATE TABLE IF NOT EXISTS features (
  id           TEXT NOT NULL,
  version      TEXT NOT NULL,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL,           -- planned | building | green | dropped
  evidence_url TEXT,
  PRIMARY KEY (id, version)
);

CREATE TABLE IF NOT EXISTS phases (
  id            TEXT PRIMARY KEY,        -- e.g. "03-billing"
  slug          TEXT NOT NULL,
  version       TEXT NOT NULL,
  feature       TEXT,
  status        TEXT NOT NULL,           -- see PhaseStatus
  contract_sha  TEXT,
  checks_sha    TEXT,
  started_at    INTEGER,
  finished_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_phases_version ON phases(version);

CREATE TABLE IF NOT EXISTS gates (
  phase_id   TEXT NOT NULL,
  gate_name  TEXT NOT NULL,              -- pattern:audit | coverage:audit | validate | pen:drift | visual:diff | slop:test | phase-reviewer | agent-browser-verify
  status     TEXT NOT NULL,              -- see GateStatus
  json_path  TEXT,
  ran_at     INTEGER NOT NULL,
  PRIMARY KEY (phase_id, gate_name, ran_at)
);

CREATE TABLE IF NOT EXISTS approvals (
  stage       TEXT NOT NULL,              -- e.g. "research" | "design:mvp" | "tech"
  payload_id  TEXT NOT NULL DEFAULT '',   -- e.g. version name, frame id; empty for stage-level
  approved_at INTEGER NOT NULL,
  signer      TEXT,
  PRIMARY KEY (stage, payload_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  version   TEXT NOT NULL,
  frame     TEXT,
  feature   TEXT,
  change    TEXT NOT NULL,
  why       TEXT,
  ts        INTEGER NOT NULL,
  applied   INTEGER NOT NULL DEFAULT 0    -- 0 = pending, 1 = applied, -1 = rejected
);

CREATE TABLE IF NOT EXISTS lessons (
  id              TEXT PRIMARY KEY,         -- e.g. "2026-05-23-001"
  ts              INTEGER NOT NULL,
  scope           TEXT NOT NULL,            -- loop | agent:<name> | gate:<name> | stage:<name>
  category        TEXT NOT NULL,            -- state-coverage | tolerance | slop | pattern | quality | ...
  severity        TEXT NOT NULL,            -- one-off | recurring | pattern
  applies_to_json TEXT NOT NULL DEFAULT '[]',
  evidence_json   TEXT NOT NULL DEFAULT '[]',
  phase           TEXT,                     -- phase that surfaced it (optional)
  status          TEXT NOT NULL,            -- proposed | applied | archived
  title           TEXT NOT NULL,
  body_md_path    TEXT NOT NULL             -- relative to repo root
);
CREATE INDEX IF NOT EXISTS idx_lessons_scope    ON lessons(scope);
CREATE INDEX IF NOT EXISTS idx_lessons_status   ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category);
`

export function resolveDbPath(custom?: string): string {
  if (custom && custom.length > 0) return resolve(custom)
  const fromEnv = process.env.FENIX_DB
  if (fromEnv && fromEnv.length > 0) return resolve(fromEnv)
  return resolve(process.cwd(), '.planning/fenix.db')
}

export function openDb(custom?: string): Database {
  const path = resolveDbPath(custom)
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const db = new Database(path)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  return db
}

export interface EventRow {
  id?: number
  ts: number
  stage: Stage | string
  phase_id?: string | null
  kind: string
  payload_json?: string | null
}

export function appendEvent(db: Database, row: Omit<EventRow, 'id'>): number {
  const stmt = db.prepare(
    `INSERT INTO events (ts, stage, phase_id, kind, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const info = stmt.run(
    row.ts,
    row.stage,
    row.phase_id ?? null,
    row.kind,
    row.payload_json ?? null,
  )
  return Number(info.lastInsertRowid)
}

export function recordApproval(
  db: Database,
  stage: string,
  payloadId: string,
  signer: string | null,
): void {
  db.prepare(
    `INSERT INTO approvals (stage, payload_id, approved_at, signer)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(stage, payload_id) DO UPDATE
       SET approved_at = excluded.approved_at,
           signer      = excluded.signer`,
  ).run(stage, payloadId, Date.now(), signer)
}

export function hasApproval(
  db: Database,
  stage: string,
  payloadId = '',
): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS one FROM approvals WHERE stage = ? AND payload_id = ? LIMIT 1`,
    )
    .get(stage, payloadId) as { one: number } | null
  return row != null
}

export interface PhaseUpdate {
  id: string
  slug?: string
  version?: string
  feature?: string | null
  status?: PhaseStatus | string
  contractSha?: string | null
  checksSha?: string | null
  startedAt?: number | null
  finishedAt?: number | null
}

export function upsertPhase(db: Database, p: PhaseUpdate): void {
  const existing = db
    .prepare(`SELECT id FROM phases WHERE id = ?`)
    .get(p.id) as { id: string } | null

  if (existing == null) {
    if (!p.slug || !p.version || !p.status) {
      throw new Error(
        `phase ${p.id} does not exist — slug, version, and status are required to insert`,
      )
    }
    db.prepare(
      `INSERT INTO phases (id, slug, version, feature, status, contract_sha, checks_sha, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      p.id,
      p.slug,
      p.version,
      p.feature ?? null,
      p.status,
      p.contractSha ?? null,
      p.checksSha ?? null,
      p.startedAt ?? null,
      p.finishedAt ?? null,
    )
    return
  }

  const updates: string[] = []
  const values: unknown[] = []
  const set = (col: string, val: unknown) => {
    updates.push(`${col} = ?`)
    values.push(val)
  }
  if (p.slug !== undefined) set('slug', p.slug)
  if (p.version !== undefined) set('version', p.version)
  if (p.feature !== undefined) set('feature', p.feature)
  if (p.status !== undefined) set('status', p.status)
  if (p.contractSha !== undefined) set('contract_sha', p.contractSha)
  if (p.checksSha !== undefined) set('checks_sha', p.checksSha)
  if (p.startedAt !== undefined) set('started_at', p.startedAt)
  if (p.finishedAt !== undefined) set('finished_at', p.finishedAt)
  if (updates.length === 0) return

  values.push(p.id)
  db.prepare(`UPDATE phases SET ${updates.join(', ')} WHERE id = ?`).run(
    ...(values as (string | number | null)[]),
  )
}

export function recordGate(
  db: Database,
  phaseId: string,
  gateName: string,
  status: GateStatus | string,
  jsonPath: string | null,
): void {
  db.prepare(
    `INSERT INTO gates (phase_id, gate_name, status, json_path, ran_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(phaseId, gateName, status, jsonPath, Date.now())
}

export function recordFeedback(
  db: Database,
  args: {
    version: string
    change: string
    frame?: string | null
    feature?: string | null
    why?: string | null
  },
): number {
  const info = db
    .prepare(
      `INSERT INTO feedback (version, frame, feature, change, why, ts, applied)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      args.version,
      args.frame ?? null,
      args.feature ?? null,
      args.change,
      args.why ?? null,
      Date.now(),
    )
  return Number(info.lastInsertRowid)
}
