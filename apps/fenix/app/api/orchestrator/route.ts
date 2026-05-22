/**
 * /api/orchestrator — control surface for the Fenix UI.
 *
 * Accepts a JSON action and shells out to the orchestrator helper
 * (.claude/scripts/fenix-auto.ts). Every action is recorded in the events
 * table as `control:<action>` for audit.
 *
 * Actions:
 *   approve      { action, stage, payload_id?, signer? }
 *   feedback     { action, version, change, why?, frame?, feature? }
 *   phase-update { action, phaseId, status }
 *   rehydrate    { action }
 *   init-db      { action }
 */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

function repoRoot(): string {
  return process.env.FENIX_REPO_ROOT ?? resolve(process.cwd(), '../..')
}

interface ActionPayload {
  action: string
  [key: string]: unknown
}

export async function POST(req: Request): Promise<Response> {
  let body: ActionPayload
  try {
    body = (await req.json()) as ActionPayload
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  switch (body.action) {
    case 'approve':
      return handleApprove(body)
    case 'feedback':
      return handleFeedback(body)
    case 'phase-update':
      return handlePhaseUpdate(body)
    case 'rehydrate':
      return runHelper(['rehydrate'])
    case 'init-db':
      return runHelper(['init-db'])
    default:
      return json({ error: `unknown action: ${body.action}` }, 400)
  }
}

async function handleApprove(body: ActionPayload): Promise<Response> {
  const stage = stringField(body, 'stage')
  if (!stage) return json({ error: 'stage is required' }, 400)
  const args = ['approve', '--stage', stage]
  const payloadId = stringField(body, 'payload_id')
  if (payloadId) args.push('--payload-id', payloadId)
  const signer = stringField(body, 'signer')
  if (signer) args.push('--signer', signer)
  return runHelper(args)
}

async function handleFeedback(body: ActionPayload): Promise<Response> {
  const version = stringField(body, 'version')
  const change = stringField(body, 'change')
  if (!version || !change) return json({ error: 'version and change are required' }, 400)
  const args = ['feedback', '--version', version, '--change', change]
  const why = stringField(body, 'why')
  if (why) args.push('--why', why)
  const frame = stringField(body, 'frame')
  if (frame) args.push('--frame', frame)
  const feature = stringField(body, 'feature')
  if (feature) args.push('--feature', feature)
  return runHelper(args)
}

async function handlePhaseUpdate(body: ActionPayload): Promise<Response> {
  const phaseId = stringField(body, 'phaseId')
  const status = stringField(body, 'status')
  if (!phaseId) return json({ error: 'phaseId is required' }, 400)
  const args = ['phase-update', '--id', phaseId]
  if (status) args.push('--status', status)
  if (body.contractSha) args.push('--contract-sha', String(body.contractSha))
  if (body.checksSha) args.push('--checks-sha', String(body.checksSha))
  if (body.finished === true) args.push('--finished')
  return runHelper(args)
}

function stringField(obj: ActionPayload, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

function runHelper(args: string[]): Promise<Response> {
  const repo = repoRoot()
  return new Promise((res) => {
    const cmd = spawn('bun', ['.claude/scripts/fenix-auto.ts', ...args], { cwd: repo })
    let stdout = ''
    let stderr = ''
    cmd.stdout.on('data', (b: Buffer) => {
      stdout += b.toString()
    })
    cmd.stderr.on('data', (b: Buffer) => {
      stderr += b.toString()
    })
    cmd.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout)
          res(json(parsed))
        } catch {
          res(json({ status: 'ok', stdout }))
        }
      } else {
        res(json({ error: stderr || `exit ${code}`, stdout }, 500))
      }
    })
    cmd.on('error', (err) => {
      res(json({ error: err.message }, 500))
    })
  })
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
