import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildRenameMap, isValidKebabCase, renameProject } from '../lib/rename.ts'

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'fenix-rename-test-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

function writeFixture(path: string, content: string): void {
  const full = join(workdir, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

function readFixture(path: string): string {
  return readFileSync(join(workdir, path), 'utf8')
}

describe('isValidKebabCase', () => {
  test('accepts simple kebab-case', () => {
    expect(isValidKebabCase('thera-desk')).toBe(true)
    expect(isValidKebabCase('a')).toBe(true)
    expect(isValidKebabCase('app2')).toBe(true)
    expect(isValidKebabCase('my-app-42')).toBe(true)
  })

  test('rejects invalid names', () => {
    expect(isValidKebabCase('')).toBe(false)
    expect(isValidKebabCase('Thera-Desk')).toBe(false)
    expect(isValidKebabCase('thera_desk')).toBe(false)
    expect(isValidKebabCase('-thera')).toBe(false)
    expect(isValidKebabCase('thera-')).toBe(false)
    expect(isValidKebabCase('thera--desk')).toBe(false)
    expect(isValidKebabCase('1thera')).toBe(false)
  })
})

describe('buildRenameMap', () => {
  test('produces case variants and scope replacement', () => {
    const map = buildRenameMap('thera-desk', 'thera-desk')
    expect(map['@fenix/']).toBe('@thera-desk/')
    expect(map['fenix']).toBe('thera-desk')
    expect(map['Fenix']).toBe('TheraDesk')
    expect(map['FENIX']).toBe('THERA_DESK')
  })

  test('strips leading @ from scope', () => {
    const map = buildRenameMap('my-app', '@myorg')
    expect(map['@fenix/']).toBe('@myorg/')
  })
})

describe('renameProject', () => {
  test('rewrites package.json name and description', async () => {
    writeFixture('package.json', JSON.stringify({ name: 'fenix', description: 'Fenix template' }, null, 2))
    const map = buildRenameMap('thera-desk', 'thera-desk')
    const report = await renameProject({ cwd: workdir, rename: map })
    expect(report.filesTouched).toBe(1)
    const pkg = JSON.parse(readFixture('package.json')) as {
      name: string
      description: string
    }
    expect(pkg.name).toBe('thera-desk')
    expect(pkg.description).toBe('TheraDesk template')
  })

  test('rewrites @fenix/ imports in .ts files', async () => {
    writeFixture('apps/app/index.ts', "import { auth } from '@fenix/auth'\nimport { db } from '@fenix/db'\n")
    const map = buildRenameMap('my-app', 'my-app')
    await renameProject({ cwd: workdir, rename: map })
    const src = readFixture('apps/app/index.ts')
    expect(src).toContain("from '@my-app/auth'")
    expect(src).toContain("from '@my-app/db'")
    expect(src).not.toContain('@fenix/')
  })

  test('case-preserving replacement (fenix/Fenix/FENIX)', async () => {
    writeFixture('README.md', '# Fenix\nwelcome to fenix. Env var FENIX_URL matters.\n')
    const map = buildRenameMap('thera-desk', 'thera-desk')
    await renameProject({ cwd: workdir, rename: map })
    const content = readFixture('README.md')
    expect(content).toContain('# TheraDesk')
    expect(content).toContain('welcome to thera-desk')
    expect(content).toContain('THERA_DESK_URL')
    expect(content).not.toMatch(/fenix/i)
  })

  test('excludes node_modules, .git, and lockfiles', async () => {
    writeFixture('node_modules/fake/package.json', JSON.stringify({ name: 'fenix' }))
    writeFixture('.git/config', '[core]\n  ref = fenix\n')
    writeFixture('bun.lock', 'fenix = "1.0.0"\n')
    writeFixture('package.json', JSON.stringify({ name: 'fenix' }))

    const map = buildRenameMap('new-app', 'new-app')
    const report = await renameProject({ cwd: workdir, rename: map })

    expect(report.filesTouched).toBe(1)
    expect(readFixture('node_modules/fake/package.json')).toContain('fenix')
    expect(readFixture('.git/config')).toContain('fenix')
    expect(readFixture('bun.lock')).toContain('fenix')
    expect(readFixture('package.json')).toContain('new-app')
  })

  test('does not rewrite the rename utility itself', async () => {
    const self = "const map = { 'fenix': 'x' }\n"
    writeFixture('scripts/lib/rename.ts', self)
    const map = buildRenameMap('thera-desk', 'thera-desk')
    await renameProject({ cwd: workdir, rename: map })
    expect(readFixture('scripts/lib/rename.ts')).toBe(self)
  })

  test('dry run produces a plan without writing', async () => {
    writeFixture('package.json', JSON.stringify({ name: 'fenix' }))
    const before = readFixture('package.json')
    const map = buildRenameMap('drycheck', 'drycheck')
    const report = await renameProject({ cwd: workdir, rename: map, dryRun: true })
    expect(report.filesTouched).toBe(1)
    expect(report.plan.length).toBe(1)
    expect(readFixture('package.json')).toBe(before)
  })

  test('longer keys beat shorter ones (@fenix/ not split by fenix)', async () => {
    writeFixture('apps/app/foo.ts', "import x from '@fenix/ui'\nconst msg = 'fenix is cool'\n")
    const map = buildRenameMap('new-name', 'new-name')
    await renameProject({ cwd: workdir, rename: map })
    const content = readFixture('apps/app/foo.ts')
    expect(content).toContain("'@new-name/ui'")
    expect(content).toContain("'new-name is cool'")
    expect(content).not.toContain('@fenix/')
    expect(content).not.toContain('fenix')
  })
})
