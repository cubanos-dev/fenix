/**
 * Fenix loop config — replaces the old .planning/config.json.
 *
 * Holds: visual-diff tolerances, retry budgets, gate enable/disable, dev-server
 * ports, seed credentials, Pencil CLI auth env var, agent model profile.
 *
 * Read by: .claude/scripts/fenix-auto.ts (orchestrator), scripts/phase-gate.ts,
 * scripts/visual-diff.ts, scripts/fenix-pin-checks.ts, apps/fenix.
 */

export type ModelProfile = 'quality' | 'balanced' | 'budget'

export type ComponentClass = 'text' | 'layout' | 'hero' | 'icon'

export interface FenixConfig {
  /** Model profile applied to every agent unless overridden per-agent. */
  profile: ModelProfile

  /** Per-agent overrides — takes precedence over the profile. */
  agents?: Record<string, { model?: string; maxTurns?: number }>

  /** Dev-server ports for each app. */
  ports: {
    web: number
    app: number
    fenix: number
  }

  /** Dev-seed credentials used by `agent-browser-verify` to sign in. */
  devSeed: {
    email: string
    password: string
  }

  /** Pencil CLI auth env var — used by design-runner skill. */
  pencilCliKeyEnvVar: string

  /** Hard-gate enable flags. Soft gates (pattern:audit, slop:test) are always on. */
  gates: {
    coverageAudit: boolean
    validate: boolean
    penDrift: boolean
    visualDiff: boolean
    phaseReviewer: boolean
    agentBrowserVerify: boolean
  }

  /** Visual-diff pixel budget per component class. 0.0 = exact, 1.0 = anything. */
  visualDiff: {
    tolerance: Record<ComponentClass, number>
  }

  /** Bounded auto-fix retries inside `fenix-builder`'s implement loop, per sub-phase. */
  builder: {
    maxRetriesPerSubphase: number
    /** ms — escalate on this many wall-clock seconds even if retries remain */
    escalateAfterMs: number
  }

  /** Agent-level retry on transient infra failure (rate-limit / network). */
  agentRetry: {
    onTransientErrors: number
  }

  /**
   * Hard spend ceilings in USD. The orchestrator tallies token-cost estimates
   * per stage and halts with STOP-confirm when a stage exceeds its budget.
   * `total` is a circuit breaker across the whole loop. Numbers are rough
   * guides; tune after the first real run.
   *
   * `designImpeccableMaxIterations` caps how many times the design stage
   * re-runs Pencil to address impeccable audit findings before bailing
   * to user STOP-confirm. Each iteration = one Pencil call (1–5 min, ~$1)
   * + two impeccable calls (~cents). 3 is a sensible cap; raise it for
   * brand-critical projects, lower it for cost-sensitive runs.
   */
  budget: {
    perStageUsd: {
      research: number
      design: number
      tech: number
      phases: number
      build: number
    }
    totalUsd: number
    designImpeccableMaxIterations: number
  }
}

export default {
  profile: 'balanced',

  ports: {
    web: 3000,
    app: 3001,
    fenix: 3002,
  },

  devSeed: {
    email: 'dev@fenix.local',
    password: 'dev-password-123',
  },

  pencilCliKeyEnvVar: 'PENCIL_CLI_KEY',

  gates: {
    coverageAudit: true,
    validate: true,
    penDrift: true,
    visualDiff: true,
    phaseReviewer: true,
    agentBrowserVerify: true,
  },

  visualDiff: {
    tolerance: {
      text: 0.01,
      layout: 0.05,
      hero: 0.02,
      icon: 0.01,
    },
  },

  builder: {
    maxRetriesPerSubphase: 3,
    escalateAfterMs: 45 * 60 * 1000,
  },

  agentRetry: {
    onTransientErrors: 2,
  },

  budget: {
    perStageUsd: {
      research: 5,
      design: 15,
      tech: 5,
      phases: 5,
      build: 50,
    },
    totalUsd: 100,
    designImpeccableMaxIterations: 3,
  },
} satisfies FenixConfig
