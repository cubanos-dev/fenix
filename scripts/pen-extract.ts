#!/usr/bin/env bun
/**
 * pen-extract — utility.
 *
 * Refreshes `pens/inventory/<section>.md` from the active version's `.pen`
 * file. The actual extraction is delegated to the Pencil CLI / MCP — this
 * script just sequences the right command and writes a manifest the gate
 * scripts can consume.
 *
 * Pencil access:
 *   - Preferred: `npx pencil export-inventory --in pens/<v>.pen --out pens/inventory/`
 *   - Fallback: emit a stub manifest noting the CLI was not invocable; the
 *     orchestrator can rerun once Pencil CLI is installed.
 *
 *   bun scripts/pen-extract.ts --version <v> [--cli pencil]
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

interface Manifest {
  schema: 'fenix.pen.inventory.v1'
  version: string
  pen_path: string
  cli: string | null
  generated_at: string
  files: string[]
  status: 'ok' | 'cli-unavailable' | 'pen-missing'
  note?: string
}

function main(): number {
  const argv = process.argv.slice(2)
  const vIdx = argv.indexOf('--version')
  if (vIdx < 0) {
    process.stderr.write('usage: pen-extract --version <v> [--cli pencil]\n')
    return 2
  }
  const version = argv[vIdx + 1]
  if (!version) return 2
  const cliIdx = argv.indexOf('--cli')
  const cli = cliIdx >= 0 ? argv[cliIdx + 1] : 'pencil'

  const repoRoot = process.cwd()
  const penPath = resolve(repoRoot, 'pens', `${version}.pen`)
  const inventoryDir = resolve(repoRoot, 'pens', 'inventory')

  const manifestPath = resolve(inventoryDir, `${version}.manifest.json`)

  if (!existsSync(penPath)) {
    const m: Manifest = {
      schema: 'fenix.pen.inventory.v1',
      version,
      pen_path: relative(repoRoot, penPath),
      cli,
      generated_at: new Date().toISOString(),
      files: [],
      status: 'pen-missing',
      note: `pens/${version}.pen does not exist — run /fenix-auto design ${version} first`,
    }
    writeManifest(manifestPath, m)
    process.stderr.write(`${m.note}\n`)
    return 1
  }

  // Try the CLI. Tolerate failure — Pencil CLI is optional in CI.
  const res = spawnSync(
    cli,
    ['export-inventory', '--in', penPath, '--out', inventoryDir],
    { stdio: 'pipe', encoding: 'utf-8' },
  )

  if (res.status !== 0) {
    const m: Manifest = {
      schema: 'fenix.pen.inventory.v1',
      version,
      pen_path: relative(repoRoot, penPath),
      cli,
      generated_at: new Date().toISOString(),
      files: existsSync(inventoryDir) ? listInventoryFiles(inventoryDir, repoRoot) : [],
      status: 'cli-unavailable',
      note: `Pencil CLI not invocable (exit ${res.status ?? 'n/a'}): ${res.stderr.trim() || res.error?.message || 'unknown'}. Existing inventory left as-is.`,
    }
    writeManifest(manifestPath, m)
    process.stderr.write(`${m.note}\n`)
    return 1
  }

  const m: Manifest = {
    schema: 'fenix.pen.inventory.v1',
    version,
    pen_path: relative(repoRoot, penPath),
    cli,
    generated_at: new Date().toISOString(),
    files: listInventoryFiles(inventoryDir, repoRoot),
    status: 'ok',
  }
  writeManifest(manifestPath, m)
  process.stdout.write(
    `pen-extract: ${m.files.length} inventory section(s) for ${version} → ${relative(repoRoot, manifestPath)}\n`,
  )
  return 0
}

function listInventoryFiles(dir: string, repoRoot: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => relative(repoRoot, join(dir, f)))
    .sort()
}

function writeManifest(path: string, m: Manifest): void {
  const dir = path.replace(/[^/]+$/, '')
  if (!existsSync(dir)) {
    // mkdir -p
    spawnSync('mkdir', ['-p', dir])
  }
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`)
}

process.exit(main())
