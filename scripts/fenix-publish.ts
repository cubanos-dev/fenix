#!/usr/bin/env bun
/**
 * fenix-publish — deterministic phase publisher (Stage 5e).
 *
 * Replaces the prior `fenix-publisher` agent. Pure transform:
 *   1. Read PLAN.md frontmatter + Goal section.
 *   2. Read every JSON in `.planning/phases/<phase>/.artifacts/`.
 *   3. Render COMPLETION.md with the five tables (acceptance traceability,
 *      visual fidelity, golden-path replay, non-happy state coverage,
 *      diff stats).
 *   4. Commit `feat(<phase>): <goal>`.
 *   5. Refresh `.planning/fenix.db` via `fenix-rehydrate.ts`.
 *   6. Optionally `gh pr create` with COMPLETION.md as body.
 *
 * Lesson harvest (the only LLM-needing piece of the old agent) moves to
 * the orchestrator: after this script returns success, the orchestrator
 * scans the same artifacts and proposes lessons inline via
 * `bun .claude/scripts/fenix-auto.ts lessons-propose ...`.
 *
 *   bun run scripts/fenix-publish.ts --phase <phase-id> [--pr]
 *
 * Exit codes:
 *   0  — COMPLETION.md written, commit made
 *   1  — bad input (missing phase, ungreen gate)
 *   2  — internal error
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

interface Args {
  phase: string
  pr: boolean
}

function fail(msg: string, code = 1): never {
  process.stderr.write(`fenix-publish: ${msg}\n`)
  process.exit(code)
}

function parseArgs(argv: string[]): Args {
  let phase = ''
  let pr = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--phase') phase = argv[++i] ?? ''
    else if (a === '--pr') pr = true
  }
  if (!phase) fail('usage: fenix-publish --phase <phase-id> [--pr]')
  return { phase, pr }
}

function sh(cmd: string, args: string[]): { stdout: string; status: number } {
  const r = spawnSync(cmd, args, { encoding: 'utf-8' })
  return { stdout: r.stdout ?? '', status: r.status ?? 0 }
}

function readJson<T = unknown>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function readPlan(phaseDir: string): { frontmatter: Record<string, string>; goal: string } {
  const planPath = join(phaseDir, 'PLAN.md')
  if (!existsSync(planPath)) fail(`no PLAN.md at ${planPath}`)
  const raw = readFileSync(planPath, 'utf-8')
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  const frontmatter: Record<string, string> = {}
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const eq = line.indexOf(':')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      if (key.length > 0) frontmatter[key] = val
    }
  }
  const goalMatch = raw.match(/^##\s+Goal\s*\n([\s\S]*?)(?:\n##\s|\n*$)/m)
  const goal = goalMatch ? goalMatch[1].trim() : '(no Goal section found)'
  return { frontmatter, goal }
}

function loadArtifacts(artifactsDir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!existsSync(artifactsDir)) return out
  for (const f of readdirSync(artifactsDir)) {
    if (!f.endsWith('.json')) continue
    const data = readJson(join(artifactsDir, f))
    if (data != null) out[f.replace(/\.json$/, '')] = data
  }
  return out
}

function assertGreen(artifacts: Record<string, unknown>): void {
  const reviewer = artifacts['phase-reviewer'] as { verdict?: string } | undefined
  const verify = artifacts['agent-browser-verify'] as { verdict?: string } | undefined
  if (!reviewer || reviewer.verdict !== 'done') {
    fail(`phase-reviewer verdict missing or != done (got: ${JSON.stringify(reviewer ?? null)})`)
  }
  if (!verify || verify.verdict !== 'pass') {
    fail(`agent-browser-verify verdict missing or != pass (got: ${JSON.stringify(verify ?? null)})`)
  }
}

function renderCompletion(opts: {
  phaseId: string
  frontmatter: Record<string, string>
  goal: string
  artifacts: Record<string, unknown>
  diffStat: string
  log: string
  headSha: string
  outOfScope: string
}): string {
  const { phaseId, frontmatter, goal, artifacts, diffStat, log, headSha, outOfScope } = opts
  const iso = new Date().toISOString()
  const fm = (k: string) => frontmatter[k] ?? '(unset)'
  const reviewer = JSON.stringify(artifacts['phase-reviewer'] ?? null, null, 2)

  return `# Phase ${phaseId} — Complete

**Feature:** ${fm('feature')}
**Version:** ${fm('version')}
**Closed:** ${iso}
**Closer:** fenix-publish (deterministic)

> No "operator sign-off" line. Done is JSON. Every claim below is backed
> by an artifact in \`.artifacts/\`.

## Goal (from PLAN.md)

${goal}

## Acceptance traceability

_Populated by the gate JSONs (\`coverage\`, \`validate\`, \`visual-diff\`,
\`agent-browser-verify\`). Each row maps one PLAN.md Acceptance item to
the check file + last verification result._

\`\`\`json
${JSON.stringify(artifacts['coverage'] ?? null, null, 2)}
\`\`\`

## Visual fidelity (vs pens)

\`\`\`json
${JSON.stringify(artifacts['visual-diff'] ?? null, null, 2)}
\`\`\`

## Golden Path replay

\`\`\`json
${JSON.stringify(artifacts['agent-browser-verify'] ?? null, null, 2)}
\`\`\`

## Non-happy state coverage

\`\`\`json
${JSON.stringify(artifacts['coverage'] ?? null, null, 2)}
\`\`\`

## Phase-reviewer verdict (gate #7)

\`\`\`json
${reviewer}
\`\`\`

## Diff stats

\`\`\`
${diffStat.trim() || '(no diff produced — empty phase)'}
\`\`\`

## Commits

\`\`\`
${log.trim() || '(no commits found in range)'}
\`\`\`

## Pinned SHAs

- **Contract:** \`${fm('CONTRACT_COMMIT_SHA')}\`
- **Checks (X_PASS_X anchor):** \`${fm('CHECKS_COMMIT_SHA')}\`
- **Phase head:** \`${headSha}\`

## Out-of-scope (human-only) items

${outOfScope || '(none)'}
`
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const phaseDir = join(process.cwd(), '.planning', 'phases', args.phase)
  if (!existsSync(phaseDir)) fail(`phase dir not found: ${phaseDir}`)
  const artifactsDir = join(phaseDir, '.artifacts')

  const { frontmatter, goal } = readPlan(phaseDir)
  const artifacts = loadArtifacts(artifactsDir)
  assertGreen(artifacts)

  const contractSha = frontmatter['CONTRACT_COMMIT_SHA']
  if (!contractSha || contractSha.startsWith('(')) {
    fail('CONTRACT_COMMIT_SHA missing from PLAN.md frontmatter')
  }

  const diffStat = sh('git', ['diff', '--stat', `${contractSha}..HEAD`]).stdout
  const log = sh('git', ['log', '--oneline', `${contractSha}..HEAD`]).stdout
  const headSha = sh('git', ['rev-parse', 'HEAD']).stdout.trim()

  const planRaw = readFileSync(join(phaseDir, 'PLAN.md'), 'utf-8')
  const oosMatch = planRaw.match(/^##\s+Out of scope\s*\n([\s\S]*?)(?:\n##\s|\n*$)/m)
  const outOfScope = oosMatch ? oosMatch[1].trim() : ''

  const md = renderCompletion({
    phaseId: args.phase,
    frontmatter,
    goal,
    artifacts,
    diffStat,
    log,
    headSha,
    outOfScope,
  })

  const completionPath = join(phaseDir, 'COMPLETION.md')
  writeFileSync(completionPath, md, 'utf-8')

  const featureGoal = frontmatter['feature'] ?? args.phase
  const commitMsg = `feat(${args.phase}): ${featureGoal}`
  const addRes = sh('git', ['add', completionPath])
  if (addRes.status !== 0) fail('git add COMPLETION.md failed')
  const commitRes = sh('git', ['commit', '-m', commitMsg])
  if (commitRes.status !== 0) fail(`git commit failed:\n${commitRes.stdout}`, 2)

  const commitSha = sh('git', ['rev-parse', 'HEAD']).stdout.trim()

  const rehydrate = sh('bun', ['run', 'scripts/fenix-rehydrate.ts', '--phase', args.phase])
  const rehydrateOk = rehydrate.status === 0

  let prUrl: string | null = null
  if (args.pr) {
    const prRes = sh('gh', [
      'pr',
      'create',
      '--title',
      `${args.phase}: ${featureGoal}`,
      '--body-file',
      completionPath,
    ])
    if (prRes.status === 0) {
      const urlMatch = prRes.stdout.match(/https?:\/\/\S+/)
      prUrl = urlMatch ? urlMatch[0] : null
    } else {
      process.stderr.write(
        `fenix-publish: warning — gh pr create failed (commit was made):\n${prRes.stdout}\n`,
      )
    }
  }

  process.stdout.write(
    JSON.stringify(
      {
        status: 'ok',
        phase_id: args.phase,
        completion_path: completionPath,
        commit_sha: commitSha,
        pr_url: prUrl,
        fenix_db_updated: rehydrateOk,
      },
      null,
      2,
    ) + '\n',
  )
}

main()
