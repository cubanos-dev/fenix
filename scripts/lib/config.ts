/**
 * fenix.config.ts loader for scripts.
 *
 * The config lives in repo root as a TS module. Bun can import it directly.
 * We hold the result behind a function so scripts can call once and cache.
 */

import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

export interface ResolvedFenixConfig {
  profile: 'quality' | 'balanced' | 'budget'
  ports: { web: number; app: number; fenix: number }
  visualDiff: { tolerance: Record<string, number> }
  gates: {
    coverageAudit: boolean
    validate: boolean
    penDrift: boolean
    visualDiff: boolean
    phaseReviewer: boolean
    agentBrowserVerify: boolean
  }
  builder: { maxRetriesPerSubphase: number; escalateAfterMs: number }
  agentRetry: { onTransientErrors: number }
  devSeed: { email: string; password: string }
  pencilCliKeyEnvVar: string
  agents?: Record<string, { model?: string; maxTurns?: number }>
}

let cached: ResolvedFenixConfig | null = null

export async function loadFenixConfig(
  repoRoot: string = process.cwd(),
): Promise<ResolvedFenixConfig> {
  if (cached) return cached
  const path = resolve(repoRoot, 'fenix.config.ts')
  if (!existsSync(path)) {
    throw new Error(`fenix.config.ts not found at ${path}`)
  }
  const mod = (await import(path)) as { default: ResolvedFenixConfig }
  cached = mod.default
  return cached
}

export function clearConfigCache(): void {
  cached = null
}
