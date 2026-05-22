#!/usr/bin/env bun
/**
 * fenix-auto.ts — orchestrator state helper.
 *
 * Lives behind every `/fenix-auto …` slash command. The slash command file
 * (`.claude/commands/fenix-auto.md`) tells *Claude* how to drive the loop;
 * this script handles the deterministic state ops (SQLite event log, status
 * queries, approval bookkeeping, feedback capture, rehydration).
 *
 * No LLM calls live here. No agent spawns. Pure state.
 *
 *   bun .claude/scripts/fenix-auto.ts init-db
 *   bun .claude/scripts/fenix-auto.ts event <stage> <kind> [--phase <id>] [--payload '<json>']
 *   bun .claude/scripts/fenix-auto.ts status [--json]
 *   bun .claude/scripts/fenix-auto.ts feedback --version <v> --change "…" [--why "…"] [--frame <f>] [--feature <f>]
 *   bun .claude/scripts/fenix-auto.ts approve --stage <s> [--payload-id <id>] [--signer <name>]
 *   bun .claude/scripts/fenix-auto.ts check-approval --stage <s> [--payload-id <id>]
 *   bun .claude/scripts/fenix-auto.ts phase-update --id <phase-id> [--status <s>] [--contract-sha <sha>] [--checks-sha <sha>] [--slug <slug>] [--version <v>] [--feature <f>] [--started] [--finished]
 *   bun .claude/scripts/fenix-auto.ts gate-record --phase <id> --name <gate> --status <pass|fail|soft-warn|skipped> [--json-path <path>]
 *   bun .claude/scripts/fenix-auto.ts phases [--version <v>] [--json]
 *   bun .claude/scripts/fenix-auto.ts events [--phase <id>] [--limit <n>] [--json]
 *   bun .claude/scripts/fenix-auto.ts rehydrate
 *   bun .claude/scripts/fenix-auto.ts dispatch <subcommand> [args…]    (advisory only)
 *
 * Exit code 0 on success, 1 on user error, 2 on internal error.
 * On --json the entire stdout is a single JSON object (for programmatic use).
 */

import {
  appendEvent,
  hasApproval,
  openDb,
  recordApproval,
  recordFeedback,
  recordGate,
  upsertPhase,
  type PhaseStatus,
} from './lib/db'
import {
  listLessons,
  mirrorLessonsToDb,
  setLessonStatus,
  writeLesson,
  type LessonSeverity,
  type LessonStatus,
} from './lib/lessons'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const HELP = `fenix-auto — Fenix loop state helper

Commands:
  init-db                 create .planning/fenix.db with schema
  event <stage> <kind>    append a single event row
                            --phase <id>      attach phase id
                            --payload '<json>' attach JSON payload
  status                  print loop snapshot (current stage, latest phase, gates)
                            --json             machine-readable
  feedback                capture user feedback row for the design loop
                            --version <v>      required
                            --change "…"       required (one-line change request)
                            --why "…"          optional reason
                            --frame <name>     optional frame id
                            --feature <id>     optional feature id
  approve                 record an approval
                            --stage <s>        required (e.g. research, design:mvp, tech)
                            --payload-id <id>  default ''
                            --signer <name>    default ''
  check-approval          exit 0 if approved, 1 if pending
                            --stage <s>        required
                            --payload-id <id>  default ''
  phase-update            upsert/advance a phase row
                            --id <phase-id>    required
                            --status <s>       see PhaseStatus
                            --slug <slug>
                            --version <v>
                            --feature <id>
                            --contract-sha <sha>
                            --checks-sha <sha>
                            --started          set started_at = now
                            --finished         set finished_at = now
  gate-record             record one gate execution result
                            --phase <id>       required
                            --name <gate>      required
                            --status <s>       required (pass|fail|soft-warn|skipped)
                            --json-path <path> path to gate artifact JSON
  phases                  list phases [--version <v>] [--json]
  events                  list recent events [--phase <id>] [--limit 50] [--json]
  lessons-list            list lessons applicable to a scope
                            --scope <s>        filter (e.g. agent:fenix-contract-author, loop)
                            --status <s>       filter (proposed|applied|archived)
                            --category <c>     filter
                            --json             machine-readable
  lessons-propose         write a new lesson .md + mirror to fenix.db
                            --scope <s>        required
                            --category <c>     required
                            --title "…"        required
                            --body "…"         lesson body (markdown); or --body-file <path>
                            --severity <s>     one-off|recurring|pattern (default one-off)
                            --applies-to a,b   comma-separated tags
                            --evidence a,b     comma-separated artifact paths
                            --phase <id>       phase that surfaced it
                            --status <s>       proposed|applied (default proposed)
  lessons-apply           mark a lesson applied (id) — agent prompt was amended
                            --id <id>          required
  lessons-archive         mark a lesson archived (id) — superseded or retracted
                            --id <id>          required
  rehydrate               rebuild fenix.db from .planning/ artifacts (phases, versions, lessons)
  dispatch <sub> [args…]  advisory: echo what /fenix-auto <sub> would orchestrate

Slash commands invoke these via Bash; see .claude/commands/fenix-auto.md.
`

type Argv = {
  positional: string[]
  flags: Record<string, string | boolean>
}

function parseArgs(argv: string[]): Argv {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      positional.push(a)
    }
  }
  return { positional, flags }
}

function requireFlag(flags: Argv['flags'], key: string): string {
  const v = flags[key]
  if (typeof v !== 'string' || v.length === 0) {
    fail(`missing --${key}`)
  }
  return v as string
}

function fail(msg: string): never {
  process.stderr.write(`fenix-auto: ${msg}\n`)
  process.exit(1)
}

function printJson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`)
}

/* ---------- commands ---------- */

function cmdInitDb(): void {
  const db = openDb()
  db.close()
  printJson({ status: 'ok', db: '.planning/fenix.db' })
}

function cmdEvent(args: Argv): void {
  const [stage, kind] = args.positional
  if (!stage || !kind) fail('usage: event <stage> <kind> [--phase <id>] [--payload <json>]')
  const phaseId = typeof args.flags.phase === 'string' ? args.flags.phase : null
  const payload = typeof args.flags.payload === 'string' ? args.flags.payload : null
  if (payload != null) {
    try {
      JSON.parse(payload)
    } catch {
      fail('--payload must be valid JSON')
    }
  }
  const db = openDb()
  const id = appendEvent(db, {
    ts: Date.now(),
    stage,
    phase_id: phaseId,
    kind,
    payload_json: payload,
  })
  db.close()
  printJson({ status: 'ok', event_id: id })
}

function cmdStatus(args: Argv): void {
  const db = openDb()
  const versions = db
    .prepare(`SELECT name, status, approved_at, pen_path FROM versions ORDER BY name`)
    .all()
  const phases = db
    .prepare(
      `SELECT id, slug, version, feature, status, contract_sha, checks_sha, started_at, finished_at
       FROM phases ORDER BY id`,
    )
    .all()
  const latestEvent = db
    .prepare(
      `SELECT id, ts, stage, phase_id, kind, payload_json
       FROM events ORDER BY id DESC LIMIT 1`,
    )
    .get()
  const pendingApprovals = db
    .prepare(
      `SELECT stage, payload_id FROM approvals
       WHERE 0 = 1`, // approvals table only holds approved rows; pending is derived elsewhere
    )
    .all()
  const recentGates = db
    .prepare(
      `SELECT phase_id, gate_name, status, json_path, ran_at
       FROM gates ORDER BY ran_at DESC LIMIT 8`,
    )
    .all()
  const pendingFeedback = db
    .prepare(
      `SELECT id, version, frame, feature, change, why, ts FROM feedback
       WHERE applied = 0 ORDER BY ts DESC LIMIT 8`,
    )
    .all()
  db.close()
  const snapshot = {
    status: 'ok',
    latest_event: latestEvent,
    versions,
    phases,
    recent_gates: recentGates,
    pending_feedback: pendingFeedback,
    pending_approvals: pendingApprovals,
  }
  if (args.flags.json) {
    printJson(snapshot)
    return
  }
  process.stdout.write('Fenix loop status\n')
  process.stdout.write('=================\n')
  if (latestEvent) {
    const e = latestEvent as {
      stage: string
      kind: string
      phase_id: string | null
      ts: number
    }
    process.stdout.write(
      `latest event: stage=${e.stage} kind=${e.kind} phase=${e.phase_id ?? '-'} ts=${new Date(e.ts).toISOString()}\n`,
    )
  } else {
    process.stdout.write('latest event: (none — loop has not started)\n')
  }
  process.stdout.write(`\nversions: ${versions.length}\n`)
  for (const v of versions as Array<{ name: string; status: string }>) {
    process.stdout.write(`  ${v.name.padEnd(8)}  ${v.status}\n`)
  }
  process.stdout.write(`\nphases: ${phases.length}\n`)
  for (const p of phases as Array<{ id: string; version: string; status: string }>) {
    process.stdout.write(`  ${p.id.padEnd(24)}  v=${p.version.padEnd(6)}  ${p.status}\n`)
  }
  if (pendingFeedback.length > 0) {
    process.stdout.write(`\npending feedback: ${pendingFeedback.length}\n`)
  }
  if (recentGates.length > 0) {
    process.stdout.write(`\nrecent gates:\n`)
    for (const g of recentGates as Array<{
      phase_id: string
      gate_name: string
      status: string
    }>) {
      process.stdout.write(`  ${g.phase_id.padEnd(24)}  ${g.gate_name.padEnd(22)}  ${g.status}\n`)
    }
  }
}

function cmdFeedback(args: Argv): void {
  const version = requireFlag(args.flags, 'version')
  const change = requireFlag(args.flags, 'change')
  const why = typeof args.flags.why === 'string' ? args.flags.why : null
  const frame = typeof args.flags.frame === 'string' ? args.flags.frame : null
  const feature = typeof args.flags.feature === 'string' ? args.flags.feature : null
  const db = openDb()
  const id = recordFeedback(db, { version, change, why, frame, feature })
  appendEvent(db, {
    ts: Date.now(),
    stage: 'design',
    phase_id: null,
    kind: 'feedback-received',
    payload_json: JSON.stringify({ id, version, frame, feature }),
  })
  db.close()
  printJson({ status: 'ok', feedback_id: id })
}

function cmdApprove(args: Argv): void {
  const stage = requireFlag(args.flags, 'stage')
  const payloadId = typeof args.flags['payload-id'] === 'string' ? args.flags['payload-id'] : ''
  const signer = typeof args.flags.signer === 'string' ? args.flags.signer : null
  const db = openDb()
  recordApproval(db, stage, payloadId, signer)
  appendEvent(db, {
    ts: Date.now(),
    stage,
    phase_id: null,
    kind: 'approved',
    payload_json: JSON.stringify({ payload_id: payloadId, signer }),
  })
  db.close()
  printJson({ status: 'ok', stage, payload_id: payloadId })
}

function cmdCheckApproval(args: Argv): void {
  const stage = requireFlag(args.flags, 'stage')
  const payloadId = typeof args.flags['payload-id'] === 'string' ? args.flags['payload-id'] : ''
  const db = openDb()
  const ok = hasApproval(db, stage, payloadId)
  db.close()
  if (args.flags.json) {
    printJson({ status: ok ? 'approved' : 'pending', stage, payload_id: payloadId })
  } else {
    process.stdout.write(ok ? 'approved\n' : 'pending\n')
  }
  process.exit(ok ? 0 : 1)
}

function cmdPhaseUpdate(args: Argv): void {
  const id = requireFlag(args.flags, 'id')
  const status =
    typeof args.flags.status === 'string' ? (args.flags.status as PhaseStatus) : undefined
  const slug = typeof args.flags.slug === 'string' ? args.flags.slug : undefined
  const version = typeof args.flags.version === 'string' ? args.flags.version : undefined
  const feature = typeof args.flags.feature === 'string' ? args.flags.feature : undefined
  const contractSha =
    typeof args.flags['contract-sha'] === 'string' ? args.flags['contract-sha'] : undefined
  const checksSha =
    typeof args.flags['checks-sha'] === 'string' ? args.flags['checks-sha'] : undefined
  const startedAt = args.flags.started === true ? Date.now() : undefined
  const finishedAt = args.flags.finished === true ? Date.now() : undefined
  const db = openDb()
  upsertPhase(db, {
    id,
    slug,
    version,
    feature,
    status,
    contractSha,
    checksSha,
    startedAt,
    finishedAt,
  })
  appendEvent(db, {
    ts: Date.now(),
    stage: 'build',
    phase_id: id,
    kind: 'phase-update',
    payload_json: JSON.stringify({ status, contractSha, checksSha, startedAt, finishedAt }),
  })
  db.close()
  printJson({ status: 'ok', phase: id })
}

function cmdGateRecord(args: Argv): void {
  const phaseId = requireFlag(args.flags, 'phase')
  const name = requireFlag(args.flags, 'name')
  const status = requireFlag(args.flags, 'status')
  const jsonPath = typeof args.flags['json-path'] === 'string' ? args.flags['json-path'] : null
  const db = openDb()
  recordGate(db, phaseId, name, status, jsonPath)
  appendEvent(db, {
    ts: Date.now(),
    stage: 'build',
    phase_id: phaseId,
    kind: 'gate-result',
    payload_json: JSON.stringify({ gate: name, status, jsonPath }),
  })
  db.close()
  printJson({ status: 'ok', phase: phaseId, gate: name, gate_status: status })
}

function cmdPhases(args: Argv): void {
  const version = typeof args.flags.version === 'string' ? args.flags.version : null
  const db = openDb()
  const rows = version
    ? db
        .prepare(
          `SELECT id, slug, version, feature, status, contract_sha, checks_sha, started_at, finished_at
           FROM phases WHERE version = ? ORDER BY id`,
        )
        .all(version)
    : db
        .prepare(
          `SELECT id, slug, version, feature, status, contract_sha, checks_sha, started_at, finished_at
           FROM phases ORDER BY id`,
        )
        .all()
  db.close()
  if (args.flags.json) {
    printJson({ status: 'ok', phases: rows })
    return
  }
  for (const r of rows as Array<{
    id: string
    version: string
    status: string
    feature: string | null
  }>) {
    process.stdout.write(
      `${r.id.padEnd(24)}  v=${r.version.padEnd(6)}  ${(r.feature ?? '-').padEnd(12)}  ${r.status}\n`,
    )
  }
  if (rows.length === 0) process.stdout.write('(no phases)\n')
}

function cmdEvents(args: Argv): void {
  const phase = typeof args.flags.phase === 'string' ? args.flags.phase : null
  const limit = Math.max(
    1,
    Math.min(
      500,
      typeof args.flags.limit === 'string' ? Number(args.flags.limit) || 50 : 50,
    ),
  )
  const db = openDb()
  const rows = phase
    ? db
        .prepare(
          `SELECT id, ts, stage, phase_id, kind, payload_json FROM events
           WHERE phase_id = ? ORDER BY id DESC LIMIT ?`,
        )
        .all(phase, limit)
    : db
        .prepare(
          `SELECT id, ts, stage, phase_id, kind, payload_json FROM events
           ORDER BY id DESC LIMIT ?`,
        )
        .all(limit)
  db.close()
  if (args.flags.json) {
    printJson({ status: 'ok', events: rows })
    return
  }
  for (const e of rows as Array<{
    ts: number
    stage: string
    phase_id: string | null
    kind: string
  }>) {
    const ts = new Date(e.ts).toISOString()
    process.stdout.write(
      `${ts}  ${e.stage.padEnd(12)}  ${(e.phase_id ?? '-').padEnd(24)}  ${e.kind}\n`,
    )
  }
}

/* ---------- lessons ---------- */

function cmdLessonsList(args: Argv): void {
  const scopeFilter = typeof args.flags.scope === 'string' ? args.flags.scope : null
  const statusFilter = typeof args.flags.status === 'string' ? args.flags.status : null
  const categoryFilter = typeof args.flags.category === 'string' ? args.flags.category : null
  const all = listLessons()
  const filtered = all.filter((l) => {
    if (scopeFilter && l.scope !== scopeFilter) return false
    if (statusFilter && l.status !== statusFilter) return false
    if (categoryFilter && l.category !== categoryFilter) return false
    return true
  })
  if (args.flags.json) {
    printJson({ status: 'ok', lessons: filtered })
    return
  }
  if (filtered.length === 0) {
    process.stdout.write('(no lessons matched)\n')
    return
  }
  for (const l of filtered) {
    process.stdout.write(
      `${l.id}  ${l.status.padEnd(9)}  ${l.scope.padEnd(28)}  ${l.category.padEnd(16)}  ${l.title}\n`,
    )
  }
}

function cmdLessonsPropose(args: Argv): void {
  const scope = requireFlag(args.flags, 'scope')
  const category = requireFlag(args.flags, 'category')
  const title = requireFlag(args.flags, 'title')

  let body: string
  const bodyFile = typeof args.flags['body-file'] === 'string' ? args.flags['body-file'] : null
  if (bodyFile) {
    if (!existsSync(bodyFile)) fail(`--body-file does not exist: ${bodyFile}`)
    body = readFileSync(bodyFile, 'utf-8')
  } else if (typeof args.flags.body === 'string') {
    body = args.flags.body
  } else {
    fail('one of --body "…" or --body-file <path> is required')
  }

  const severity = (typeof args.flags.severity === 'string' ? args.flags.severity : 'one-off') as LessonSeverity
  const status = (typeof args.flags.status === 'string' ? args.flags.status : 'proposed') as LessonStatus
  const phase = typeof args.flags.phase === 'string' ? args.flags.phase : null

  const appliesTo =
    typeof args.flags['applies-to'] === 'string'
      ? args.flags['applies-to'].split(',').map((s) => s.trim()).filter(Boolean)
      : []
  const evidence =
    typeof args.flags.evidence === 'string'
      ? args.flags.evidence.split(',').map((s) => s.trim()).filter(Boolean)
      : []

  const lesson = writeLesson({
    scope,
    category,
    title,
    body,
    severity,
    applies_to: appliesTo,
    evidence,
    phase,
    status,
  })

  const db = openDb()
  mirrorLessonsToDb(db)
  appendEvent(db, {
    ts: Date.now(),
    stage: 'orchestrator',
    phase_id: phase,
    kind: 'lesson-proposed',
    payload_json: JSON.stringify({ id: lesson.id, scope, category, severity }),
  })
  db.close()

  printJson({ status: 'ok', lesson: { id: lesson.id, path: lesson.body_md_path } })
}

function cmdLessonsApply(args: Argv): void {
  const id = requireFlag(args.flags, 'id')
  const lesson = setLessonStatus(id, 'applied')
  const db = openDb()
  mirrorLessonsToDb(db)
  appendEvent(db, {
    ts: Date.now(),
    stage: 'orchestrator',
    phase_id: null,
    kind: 'lesson-applied',
    payload_json: JSON.stringify({ id, scope: lesson.scope }),
  })
  db.close()
  printJson({ status: 'ok', lesson: { id, status: 'applied' } })
}

function cmdLessonsArchive(args: Argv): void {
  const id = requireFlag(args.flags, 'id')
  const lesson = setLessonStatus(id, 'archived')
  const db = openDb()
  mirrorLessonsToDb(db)
  appendEvent(db, {
    ts: Date.now(),
    stage: 'orchestrator',
    phase_id: null,
    kind: 'lesson-archived',
    payload_json: JSON.stringify({ id, scope: lesson.scope }),
  })
  db.close()
  printJson({ status: 'ok', lesson: { id, status: 'archived' } })
}

/* ---------- rehydrate ---------- */

function cmdRehydrate(): void {
  const db = openDb()
  const planning = resolve(process.cwd(), '.planning')
  if (!existsSync(planning)) {
    db.close()
    printJson({ status: 'ok', note: '.planning/ does not exist yet; nothing to rehydrate' })
    return
  }

  // Phases
  const phasesDir = join(planning, 'phases')
  let phaseCount = 0
  if (existsSync(phasesDir)) {
    for (const entry of readdirSync(phasesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const planMd = join(phasesDir, entry.name, 'PLAN.md')
      const completionMd = join(phasesDir, entry.name, 'COMPLETION.md')
      if (!existsSync(planMd)) continue
      const fm = parseFrontmatter(readFileSync(planMd, 'utf-8'))
      const status = existsSync(completionMd) ? 'green' : (fm.status ?? 'planned')
      upsertPhase(db, {
        id: fm.phase ?? entry.name,
        slug: entry.name,
        version: fm.version ?? 'unknown',
        feature: fm.feature ?? null,
        status,
        contractSha: fm.CONTRACT_COMMIT_SHA ?? null,
        checksSha: fm.CHECKS_COMMIT_SHA ?? null,
      })
      phaseCount++
    }
  }

  // Versions — derived from pens/
  let versionCount = 0
  const pensDir = resolve(process.cwd(), 'pens')
  if (existsSync(pensDir)) {
    for (const f of readdirSync(pensDir)) {
      if (!f.endsWith('.pen')) continue
      const name = f.slice(0, -'.pen'.length)
      db.prepare(
        `INSERT INTO versions (name, status, pen_path)
         VALUES (?, 'planned', ?)
         ON CONFLICT(name) DO UPDATE SET pen_path = excluded.pen_path`,
      ).run(name, join('pens', f))
      versionCount++
    }
  }

  // Lessons — derived from .planning/learnings/<id>.md
  const lessonCount = mirrorLessonsToDb(db)

  appendEvent(db, {
    ts: Date.now(),
    stage: 'orchestrator',
    phase_id: null,
    kind: 'rehydrated',
    payload_json: JSON.stringify({ phaseCount, versionCount, lessonCount }),
  })
  db.close()
  printJson({ status: 'ok', phases: phaseCount, versions: versionCount, lessons: lessonCount })
}

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const eq = line.indexOf(':')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    if (val.length > 0) out[key] = val
  }
  return out
}

/* ---------- dispatch (advisory) ---------- */

function cmdDispatch(args: Argv): void {
  const sub = args.positional[0]
  if (!sub) fail('usage: dispatch <research|design|tech|phases|build|status|feedback> [args…]')
  const hints: Record<string, string> = {
    research:
      'Stage 1 — spawn fenix-market-researcher, fenix-competitor-researcher, fenix-brand-agent in parallel via the Task tool, then fenix-features-synthesizer once all three return. STOP-confirm: bun run fenix:check-approval --stage research.',
    design:
      'Stage 2 — spawn fenix-design-planner, then fenix-design-runner for the given version. STOP-confirm per iteration: bun run fenix:check-approval --stage design:<version>.',
    tech: 'Stage 3 — spawn fenix-tech-researcher. STOP-confirm: bun run fenix:check-approval --stage tech.',
    phases: 'Stage 4 — spawn fenix-phaser for the given version.',
    build:
      'Stage 5 miniLoopDEV — for each phase: fenix-contract-author → fenix-checks-author (pin commit) → fenix-builder (A/B/C) → bun run phase:gate → fenix-publisher.',
    status: 'See `bun .claude/scripts/fenix-auto.ts status`.',
    feedback: 'See `bun .claude/scripts/fenix-auto.ts feedback --version <v> --change "…"`.',
  }
  const hint = hints[sub] ?? `unknown subcommand: ${sub}`
  printJson({ status: 'ok', subcommand: sub, hint })
}

/* ---------- main ---------- */

function main(): void {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(HELP)
    return
  }
  const cmd = argv[0]
  const args = parseArgs(argv.slice(1))
  try {
    switch (cmd) {
      case 'init-db':
        return cmdInitDb()
      case 'event':
        return cmdEvent(args)
      case 'status':
        return cmdStatus(args)
      case 'feedback':
        return cmdFeedback(args)
      case 'approve':
        return cmdApprove(args)
      case 'check-approval':
        return cmdCheckApproval(args)
      case 'phase-update':
        return cmdPhaseUpdate(args)
      case 'gate-record':
        return cmdGateRecord(args)
      case 'phases':
        return cmdPhases(args)
      case 'events':
        return cmdEvents(args)
      case 'rehydrate':
        return cmdRehydrate()
      case 'lessons-list':
        return cmdLessonsList(args)
      case 'lessons-propose':
        return cmdLessonsPropose(args)
      case 'lessons-apply':
        return cmdLessonsApply(args)
      case 'lessons-archive':
        return cmdLessonsArchive(args)
      case 'dispatch':
        return cmdDispatch(args)
      default:
        process.stderr.write(`fenix-auto: unknown command: ${cmd}\n\n`)
        process.stderr.write(HELP)
        process.exit(1)
    }
  } catch (err) {
    process.stderr.write(`fenix-auto: ${(err as Error).message}\n`)
    process.exit(2)
  }
}

main()
