/**
 * /api/orchestrator - control surface for the Fenix UI.
 *
 * Accepts a JSON action and shells out to the orchestrator helper
 * (.claude/scripts/fenix-auto.ts). Every action is recorded in the events
 * table as `control:<action>` for audit.
 *
 * Fenix runs LOCAL-ONLY (dashboard binds to localhost:3002). Two defenses
 * keep the control plane out of reach of stray browser tabs:
 *
 *   1. Origin check - POSTs must come from the same host (or be explicitly
 *      same-origin with no Origin header, e.g. server-side fetch). Cross-
 *      origin tabs on the user's machine are rejected with 403.
 *   2. Allowlist on every string field - values are constrained to safe
 *      character classes, so a malicious value cannot inject extra CLI
 *      flags into fenix-auto.ts (`phaseId='--checks-sha'` etc).
 *
 * Actions:
 *   approve      { action, stage, payload_id?, signer? }
 *   feedback     { action, version, change, why?, frame?, feature? }
 *   phase-update { action, phaseId, status?, contractSha?, checksSha?, finished? }
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

const ALLOWED_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const u = new URL(origin)
    return ALLOWED_ORIGIN_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

// Value-shape allowlists. We never go through a shell (spawn with arg
// array), so the only injection risk is a value starting with `--` being
// reinterpreted by fenix-auto.ts's parseArgs as a flag boundary. The
// regexes below either constrain the alphabet (RE_STAGE, RE_VERSION,
// RE_PHASE_ID, RE_SHA, RE_FRAME, RE_FEATURE, RE_SIGNER, RE_PAYLOAD_ID,
// RE_PHASE_STATUS) or, for free-form text, reject leading `--` and NUL.
const RE_STAGE = /^(?:research|tech|design:[a-z][a-z0-9._-]{0,63})$/
const RE_VERSION = /^[a-z][a-z0-9._-]{0,63}$/
const RE_PHASE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/
const RE_PHASE_STATUS =
  /^(?:planned|contract|checks|implement-a|implement-b|implement-c|validate|publish|green|halted)$/
const RE_SHA = /^[0-9a-f]{7,64}$/
const RE_SIGNER = /^[A-Za-z0-9 ._@+-]{1,128}$/
const RE_PAYLOAD_ID = /^[A-Za-z0-9._:-]{0,128}$/
const RE_FRAME = /^[A-Za-z0-9._-]{1,128}$/
const RE_FEATURE = /^[A-Za-z0-9._-]{1,128}$/

function isFreeform(value: string): boolean {
  if (value.length === 0 || value.length > 1024) return false
  if (value.startsWith('--')) return false
  return true
}

function checked(value: string | null, pattern: RegExp): string | null {
  if (value == null) return null
  return pattern.test(value) ? value : null
}

function checkedFreeform(value: string | null): string | null {
  if (value == null) return null
  return isFreeform(value) ? value : null
}

function stringField(obj: ActionPayload, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function POST(req: Request): Promise<Response> {
  if (!originAllowed(req)) {
    return json({ error: 'forbidden: cross-origin requests are not permitted' }, 403)
  }
  let body: ActionPayload
  try {
    body = (await req.json()) as ActionPayload
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  switch (body.action) {
    case 'approve':
      return handleApprove(body, req)
    case 'feedback':
      return handleFeedback(body, req)
    case 'phase-update':
      return handlePhaseUpdate(body, req)
    case 'rehydrate':
      return runHelper(['rehydrate'], req)
    case 'init-db':
      return runHelper(['init-db'], req)
    default:
      return json({ error: `unknown action: ${body.action}` }, 400)
  }
}

async function handleApprove(body: ActionPayload, req: Request): Promise<Response> {
  const stage = checked(stringField(body, 'stage'), RE_STAGE)
  if (!stage) return json({ error: 'stage is required (research|tech|design:<v>)' }, 400)
  const args = ['approve', '--stage', stage]
  const payloadId = checked(stringField(body, 'payload_id'), RE_PAYLOAD_ID)
  if (payloadId) args.push('--payload-id', payloadId)
  const signer = checked(stringField(body, 'signer'), RE_SIGNER)
  if (signer) args.push('--signer', signer)
  return runHelper(args, req)
}

async function handleFeedback(body: ActionPayload, req: Request): Promise<Response> {
  const version = checked(stringField(body, 'version'), RE_VERSION)
  const change = checkedFreeform(stringField(body, 'change'))
  if (!version || !change) {
    return json({ error: 'version and change are required (and must match allowed shapes)' }, 400)
  }
  const args = ['feedback', '--version', version, '--change', change]
  const why = checkedFreeform(stringField(body, 'why'))
  if (why) args.push('--why', why)
  const frame = checked(stringField(body, 'frame'), RE_FRAME)
  if (frame) args.push('--frame', frame)
  const feature = checked(stringField(body, 'feature'), RE_FEATURE)
  if (feature) args.push('--feature', feature)
  return runHelper(args, req)
}

async function handlePhaseUpdate(body: ActionPayload, req: Request): Promise<Response> {
  const phaseId = checked(stringField(body, 'phaseId'), RE_PHASE_ID)
  if (!phaseId) return json({ error: 'phaseId is required' }, 400)
  const status = checked(stringField(body, 'status'), RE_PHASE_STATUS)
  const contractSha = checked(stringField(body, 'contractSha'), RE_SHA)
  const checksSha = checked(stringField(body, 'checksSha'), RE_SHA)
  const slug = checked(stringField(body, 'slug'), RE_PHASE_ID)
  const version = checked(stringField(body, 'version'), RE_VERSION)
  const feature = checked(stringField(body, 'feature'), RE_FEATURE)

  const args = ['phase-update', '--id', phaseId]
  if (status) args.push('--status', status)
  if (contractSha) args.push('--contract-sha', contractSha)
  if (checksSha) args.push('--checks-sha', checksSha)
  if (slug) args.push('--slug', slug)
  if (version) args.push('--version', version)
  if (feature) args.push('--feature', feature)
  if (body.finished === true) args.push('--finished')
  if (body.started === true) args.push('--started')
  return runHelper(args, req)
}

function runHelper(args: string[], req: Request): Promise<Response> {
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
    // Kill the subprocess if the client disconnects so a half-applied write
    // doesn't outlive the request that asked for it.
    const onAbort = () => {
      try {
        cmd.kill('SIGTERM')
      } catch {
        /* already exited */
      }
    }
    req.signal.addEventListener('abort', onAbort, { once: true })

    cmd.on('close', (code) => {
      req.signal.removeEventListener('abort', onAbort)
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
      req.signal.removeEventListener('abort', onAbort)
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
