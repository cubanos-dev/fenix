#!/usr/bin/env bun
/**
 * fenix-rehydrate — rebuild `.planning/fenix.db` from artifacts.
 *
 * Thin pass-through to the orchestrator helper. We keep this script in
 * `scripts/` so `bun run` from the repo root sees it next to its peers
 * (phase-gate, coverage-audit, …), but the actual logic lives once in
 * `.claude/scripts/fenix-auto.ts`.
 *
 *   bun scripts/fenix-rehydrate.ts
 */

import { spawnSync } from 'node:child_process'

const res = spawnSync('bun', ['.claude/scripts/fenix-auto.ts', 'rehydrate'], {
  stdio: 'inherit',
})

process.exit(res.status ?? 1)
