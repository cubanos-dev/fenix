#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { buildRenameMap, isValidKebabCase, renameProject, type RenameMap } from './lib/rename.ts'

const MARKER = '.fenix-initialized'

interface CliArgs {
  name?: string
  description?: string
  org?: string
  scope?: string
  pen?: 'file' | 'repo' | 'sibling' | 'none'
  penValue?: string
  python?: 'yes' | 'no'
  github?: 'yes' | 'no'
  resetGit?: 'yes' | 'no'
  yes: boolean
  dry: boolean
  smoke: boolean
  help: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { yes: false, dry: false, smoke: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const take = (): string => {
      const value = argv[i + 1]
      if (value === undefined) throw new Error(`Missing value for ${arg}`)
      i += 1
      return value
    }
    switch (arg) {
      case '--name':
        args.name = take()
        break
      case '--description':
        args.description = take()
        break
      case '--org':
        args.org = take()
        break
      case '--scope':
        args.scope = take()
        break
      case '--pen': {
        const value = take()
        if (!['file', 'repo', 'sibling', 'none'].includes(value)) {
          throw new Error(`--pen must be one of file|repo|sibling|none`)
        }
        args.pen = value as CliArgs['pen']
        break
      }
      case '--pen-value':
        args.penValue = take()
        break
      case '--python': {
        const value = take()
        if (!['yes', 'no'].includes(value)) throw new Error('--python must be yes|no')
        args.python = value as CliArgs['python']
        break
      }
      case '--github': {
        const value = take()
        if (!['yes', 'no'].includes(value)) throw new Error('--github must be yes|no')
        args.github = value as CliArgs['github']
        break
      }
      case '--reset-git': {
        const value = take()
        if (!['yes', 'no'].includes(value)) throw new Error('--reset-git must be yes|no')
        args.resetGit = value as CliArgs['resetGit']
        break
      }
      case '--yes':
      case '-y':
        args.yes = true
        break
      case '--dry':
        args.dry = true
        break
      case '--smoke':
        args.smoke = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: bun run init [options]',
      '',
      'Options:',
      '  --name <kebab>           Project name (kebab-case)',
      '  --description <text>     Project description',
      '  --org <name>             GitHub org (default: cubanos-dev)',
      '  --scope <name>           Package scope prefix (default: derived from name)',
      '  --pen file|repo|sibling|none',
      '  --pen-value <val>        Path/URL for pen option',
      '  --python yes|no          Keep the Python API service (default: no)',
      '  --github yes|no          Create a GitHub repo (default: no in non-interactive)',
      '  --reset-git yes|no       Reset git history (default: no)',
      '  --yes, -y                Accept defaults in non-interactive mode',
      '  --dry                    Print the rename plan without writing anything',
      '  --smoke                  Run the end-to-end smoke test on a fresh clone',
      '  --help, -h               Show this message',
      '',
    ].join('\n'),
  )
}

function log(message: string): void {
  process.stdout.write(`${message}\n`)
}

function warn(message: string): void {
  process.stderr.write(`${message}\n`)
}

async function promptInput(question: string, fallback?: string): Promise<string> {
  process.stdout.write(fallback ? `${question} (${fallback}) ` : `${question} `)
  const line = (await readLine()).trim()
  if (!line && fallback !== undefined) return fallback
  return line
}

async function promptChoice(
  question: string,
  choices: Array<{ key: string; label: string }>,
  fallback: string,
): Promise<string> {
  log(question)
  for (const choice of choices) log(`  [${choice.key}] ${choice.label}`)
  const answer = await promptInput('>', fallback)
  return answer
}

async function promptYesNo(question: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? 'Y/n' : 'y/N'
  process.stdout.write(`${question} (${suffix}) `)
  const line = (await readLine()).trim().toLowerCase()
  if (!line) return defaultYes
  return line === 'y' || line === 'yes'
}

function readLine(): Promise<string> {
  return new Promise((resolveLine) => {
    const onData = (chunk: Buffer) => {
      process.stdin.off('data', onData)
      process.stdin.pause()
      resolveLine(chunk.toString('utf8').replace(/\r?\n$/, ''))
    }
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function runCommand(cmd: string, args: string[], cwd: string): void {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${result.status})`)
  }
}

function runCommandCapture(
  cmd: string,
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function removePythonApi(cwd: string): void {
  const apiDir = join(cwd, 'apps', 'api')
  if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true })

  const vercelPath = join(cwd, 'vercel.json')
  if (existsSync(vercelPath)) {
    const raw = readFileSync(vercelPath, 'utf8')
    try {
      const parsed = JSON.parse(raw) as {
        experimentalServices?: Record<string, unknown>
      }
      if (parsed.experimentalServices && 'api' in parsed.experimentalServices) {
        delete parsed.experimentalServices.api
        writeFileSync(vercelPath, `${JSON.stringify(parsed, null, 2)}\n`)
      }
    } catch (error) {
      warn(`warn: could not rewrite vercel.json: ${String(error)}`)
    }
  }

  const rootPkgPath = join(cwd, 'package.json')
  if (existsSync(rootPkgPath)) {
    const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8')) as {
      scripts?: Record<string, string>
    }
    if (pkg.scripts && 'dev:api' in pkg.scripts) {
      delete pkg.scripts['dev:api']
      writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    }
  }
}

function setupPen(cwd: string, mode: 'file' | 'repo' | 'sibling' | 'none', value: string | undefined): void {
  const pensDir = join(cwd, 'pens')
  mkdirSync(pensDir, { recursive: true })
  switch (mode) {
    case 'file': {
      if (!value) throw new Error('--pen file requires --pen-value <path>')
      if (!existsSync(value)) throw new Error(`Pen file not found: ${value}`)
      cpSync(value, join(pensDir, 'app.pen'))
      log(`  copied ${value} -> pens/app.pen`)
      break
    }
    case 'repo': {
      if (!value) throw new Error('--pen repo requires --pen-value <git-url>')
      if (existsSync(join(cwd, '.git'))) {
        runCommand('git', ['submodule', 'add', value, 'pens'], cwd)
      } else {
        warn('  skipping submodule add (no .git yet); run later manually')
      }
      break
    }
    case 'sibling': {
      if (!value) throw new Error('--pen sibling requires --pen-value <path>')
      const envPath = join(cwd, '.env.local')
      const line = `PENS_PATH=${value}\n`
      if (existsSync(envPath)) {
        const current = readFileSync(envPath, 'utf8')
        if (!current.includes('PENS_PATH=')) writeFileSync(envPath, `${current}${line}`)
      } else {
        writeFileSync(envPath, line)
      }
      log(`  wrote PENS_PATH=${value} to .env.local`)
      break
    }
    case 'none':
    default: {
      const keep = join(pensDir, '.gitkeep')
      if (!existsSync(keep)) writeFileSync(keep, '')
      break
    }
  }
}

async function resolveAnswers(args: CliArgs): Promise<{
  name: string
  description: string
  org: string
  scope: string
  pen: 'file' | 'repo' | 'sibling' | 'none'
  penValue: string | undefined
  python: 'yes' | 'no'
  github: 'yes' | 'no'
  resetGit: 'yes' | 'no'
}> {
  const interactive = !args.yes && !args.smoke && args.name === undefined

  const name = args.name ?? (interactive ? await promptInput('Project name (kebab-case):') : '')
  if (!name) throw new Error('Project name is required (use --name)')
  if (!isValidKebabCase(name)) {
    throw new Error(`Invalid project name "${name}": must be kebab-case (a-z, 0-9, hyphens)`)
  }

  const description =
    args.description ??
    (interactive
      ? await promptInput('Description:', 'A new project scaffolded from fenix')
      : 'A new project scaffolded from fenix')

  const org = args.org ?? (interactive ? await promptInput('GitHub org:', 'cubanos-dev') : 'cubanos-dev')

  const scope = args.scope ?? (interactive ? await promptInput('Package scope:', name) : name)

  let pen: CliArgs['pen'] = args.pen
  let penValue = args.penValue
  if (!pen) {
    if (interactive) {
      const choice = await promptChoice(
        'Where is your pen file?',
        [
          { key: '1', label: 'Path to an existing .pen file (copied to pens/app.pen)' },
          { key: '2', label: 'Git repo URL (added as submodule at pens/)' },
          { key: '3', label: 'Existing sibling directory (PENS_PATH in .env.local)' },
          { key: '4', label: 'None yet' },
        ],
        '1',
      )
      const map: Record<string, CliArgs['pen']> = {
        '1': 'file',
        '2': 'repo',
        '3': 'sibling',
        '4': 'none',
      }
      pen = map[choice] ?? 'none'
      if (pen !== 'none') {
        penValue = await promptInput(
          pen === 'file' ? 'Path to .pen file:' : pen === 'repo' ? 'Git URL:' : 'Sibling path:',
        )
      }
    } else {
      pen = 'none'
    }
  }

  const python: 'yes' | 'no' =
    args.python ?? (interactive ? ((await promptYesNo('Include Python API service?', false)) ? 'yes' : 'no') : 'no')

  const github: 'yes' | 'no' =
    args.github ?? (interactive ? ((await promptYesNo('Create a GitHub repo now?', true)) ? 'yes' : 'no') : 'no')

  const resetGit: 'yes' | 'no' =
    args.resetGit ??
    (interactive ? ((await promptYesNo('Reset git history for a clean initial commit?', true)) ? 'yes' : 'no') : 'no')

  return { name, description, org, scope, pen, penValue, python, github, resetGit }
}

function isInsideFenixSource(cwd: string): boolean {
  if (basename(cwd) !== 'fenix') return false
  if (existsSync(join(cwd, MARKER))) return false
  return true
}

async function runInit(cwd: string, args: CliArgs): Promise<void> {
  if (existsSync(join(cwd, MARKER))) {
    log('Project already initialized (.fenix-initialized exists). Nothing to do.')
    return
  }

  const answers = await resolveAnswers(args)
  const rename: RenameMap = buildRenameMap(answers.name, answers.scope)

  if (args.dry) {
    const report = await renameProject({ cwd, rename, dryRun: true })
    log('--- dry run: rename plan ---')
    for (const entry of report.plan) {
      log(`  ${entry.path}  (${entry.replacements} replacements)`)
    }
    log(`--- total: ${report.filesTouched} files / ${report.replacements} replacements ---`)
    return
  }

  // Safety: running against a fenix source checkout corrupts the template.
  if (isInsideFenixSource(cwd) && !args.smoke) {
    throw new Error(
      'Refusing to initialize inside the fenix source checkout. Run `bun run init:smoke` to test, or run this command from inside a `bun create cubanos-dev/fenix` clone.',
    )
  }

  log(`Renaming fenix -> ${answers.name} (scope @${answers.scope.replace(/^@/, '')})...`)
  const report = await renameProject({ cwd, rename })
  log(`  rewrote ${report.filesTouched} files, ${report.replacements} replacements`)

  // Lockfiles pin the old workspace name ("fenix"); bun install will refuse to
  // honor a renamed package.json if the lockfile disagrees.
  for (const lock of ['bun.lock', 'bun.lockb']) {
    const lockPath = join(cwd, lock)
    if (existsSync(lockPath)) rmSync(lockPath, { force: true })
  }

  log('Setting up pens...')
  setupPen(cwd, answers.pen ?? 'none', answers.penValue)

  if (answers.python === 'no') {
    log('Removing Python API service...')
    removePythonApi(cwd)
  }

  if (answers.resetGit === 'yes') {
    log('Resetting git history...')
    if (existsSync(join(cwd, '.git'))) rmSync(join(cwd, '.git'), { recursive: true, force: true })
    runCommand('git', ['init', '-q'], cwd)
    runCommand('git', ['add', '-A'], cwd)
    runCommand('git', ['commit', '-q', '-m', 'chore: initial commit from fenix template'], cwd)
  }

  if (answers.github === 'yes') {
    log(`Creating GitHub repo ${answers.org}/${answers.name}...`)
    const gh = runCommandCapture(
      'gh',
      ['repo', 'create', `${answers.org}/${answers.name}`, '--private', '--source', '.', '--push'],
      cwd,
    )
    if (gh.status !== 0) {
      warn(`  gh failed: ${gh.stderr.trim()}`)
      warn(`  run manually: gh repo create ${answers.org}/${answers.name} --private --source . --push`)
    }
  } else {
    log(`  to publish later: gh repo create ${answers.org}/${answers.name} --private --source . --push`)
  }

  // The root `prepare` script runs `lefthook install`, which requires a .git dir.
  // Ensure one exists before bun install so the postinstall hook does not explode.
  if (!existsSync(join(cwd, '.git'))) {
    runCommand('git', ['init', '-q'], cwd)
  }

  if (!args.smoke) {
    log('Installing dependencies (bun install)...')
    runCommand('bun', ['install'], cwd)
    log('Running validation (bun run validate)...')
    runCommand('bun', ['run', 'validate'], cwd)
  }

  writeFileSync(join(cwd, MARKER), `${new Date().toISOString()}\nname=${answers.name}\nscope=${answers.scope}\n`)

  log('')
  log(`Project ready at ${cwd}`)
  log(`  name: ${answers.name}`)
  log(`  scope: @${answers.scope.replace(/^@/, '')}`)
  log('Next steps:')
  log(`  cd ${answers.name}`)
  log('  cp .env.example .env.local   # fill in secrets')
  log('  bun run dev')
}

async function runSmokeTest(sourceRoot: string): Promise<void> {
  const workdir = mkdtempSync(join(tmpdir(), 'fenix-smoke-'))
  log(`Smoke test working dir: ${workdir}`)
  const target = join(workdir, 'smoke-test')
  mkdirSync(target, { recursive: true })

  log('Copying fenix source (excluding node_modules/.git/.turbo/...)...')
  const exclude = [
    '--exclude=node_modules',
    '--exclude=.git',
    '--exclude=.turbo',
    '--exclude=.next',
    '--exclude=.vercel',
    '--exclude=dist',
    '--exclude=build',
    '--exclude=coverage',
    '--exclude=storybook-static',
  ]
  const rsync = runCommandCapture('rsync', ['-a', ...exclude, `${sourceRoot}/`, `${target}/`], sourceRoot)
  if (rsync.status !== 0) throw new Error(`rsync failed: ${rsync.stderr}`)

  const smokeArgs: CliArgs = {
    name: 'smoke-test',
    description: 'Fenix smoke test project',
    org: 'cubanos-dev',
    scope: 'smoke-test',
    pen: 'none',
    python: 'no',
    github: 'no',
    resetGit: 'no',
    yes: true,
    dry: false,
    smoke: true,
    help: false,
  }

  try {
    await runInit(target, smokeArgs)

    log('Grepping for stray fenix references...')
    const grepTargets = ['package.json', 'README.md', 'CLAUDE.md', 'AGENTS.md', 'DOMAIN_MODEL.md']
    const offenders: string[] = []
    for (const file of grepTargets) {
      const full = join(target, file)
      if (!existsSync(full)) continue
      const content = readFileSync(full, 'utf8')
      if (/fenix/.test(content)) offenders.push(file)
    }
    if (offenders.length > 0) {
      throw new Error(`stray 'fenix' references found in: ${offenders.join(', ')}`)
    }

    const rootPkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as {
      name: string
    }
    if (rootPkg.name !== 'smoke-test') {
      throw new Error(`root package.json name is "${rootPkg.name}", expected "smoke-test"`)
    }

    log('Running bun install in smoke-test dir...')
    runCommand('bun', ['install'], target)
    log('Running bun run validate in smoke-test dir...')
    runCommand('bun', ['run', 'validate'], target)

    log('')
    log('SMOKE TEST PASSED')
  } finally {
    log(`Cleaning up ${workdir}...`)
    rmSync(workdir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  let args: CliArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    warn(`error: ${String(error)}`)
    printHelp()
    process.exit(2)
  }
  if (args.help) {
    printHelp()
    return
  }

  const cwd = resolve(process.cwd())

  try {
    if (args.smoke) {
      await runSmokeTest(cwd)
      return
    }
    await runInit(cwd, args)
  } catch (error) {
    warn(`init-project failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

void main()
