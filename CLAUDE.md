# Fenix — Claude Code Instructions

> Fenix is a starter template that takes a non-dev user from `USER_IDEA.md`
> to a deployed app. Research validates the idea; Pencil designs the UI before
> code is written; the user approves designs by sight; then an autonomous dev
> loop builds against a gold-standard stack with implementation-moves-to-the-
> check enforcement. **Done is JSON, never an operator sign-off.**

## The autonomous loop (5 stages, one command set)

```
USER_IDEA.md  →  RESEARCH (idea validation)
              →  miniLoopDESIGN per version (Pencil CLI authors version.pen)
              →  user approves pens by sight
              →  TECH research (post-pen, informed; non-locked concerns only)
              →  phase breakdown per version
              →  miniLoopDEV per phase (CONTRACT → CHECKS → IMPLEMENT → VALIDATE → PUBLISH)
              →  PR + commit
```

The user does **five** things: writes USER_IDEA via `/fenix-init`, reviews
research artifacts, approves pens, reviews tech picks, reviews the PR.
Everything else is autonomous.

### Starting a new project from this template

```bash
bun create cubanos-dev/fenix my-project
cd my-project
```

`bun create` clones the template, runs `bun install`, then runs
`scripts/init-project.ts` (wired via `bun-create.postinstall` in
`package.json`). The script resets `.git` history, drops fenix-source-
only artifacts (`docs/PRODUCT.md`, `.claude/plans`), makes the first
clean commit, and prints next steps. Open the new directory in Claude
Code and run `/fenix-init` to walk the seven setup questions.

### Commands

- `/fenix-init` — interactive scaffolder, run **inside** the cloned
  project. Walks 7 questions → writes `USER_IDEA.md`, renames `@fenix/*`
  packages to `@<project>/*`, installs the `pbakaus/impeccable` skill,
  configures MCP wiring based on opt-ins, scaffolds `apps/fenix` +
  `.planning/fenix.db`, makes the second commit. After this, the loop
  is ready.

- `/fenix-auto research` — Stage 1. Spawns three agents in parallel:
  `fenix-researcher --target=market`, `fenix-researcher --target=competitors`,
  and `fenix-brand-agent`. Then runs `fenix-features-synthesizer` once
  all three return. Produces `.planning/research/{MARKET, COMPETITORS,
  BRAND}.md` + `.planning/research/shadcn-theme.css` (synced into
  `packages/ui/src/styles/globals.css`) + `.planning/FEATURES.md`. Halts
  with STOP-confirm in Fenix UI for user approval.

- `/fenix-auto design <version>` — Stage 2. `mvp`, `v1`, `v2`, ... Spawns
  `fenix-design-planner` (composes Pencil brief) → `fenix-design-runner`
  with `--mode=author` (mvp) or `--mode=iterate-from-prior` (vN+) → user
  reviews exports in Fenix UI → on feedback, `fenix-design-runner` is
  re-spawned with `--mode=feedback` to iterate via `pencil --in`.
  Versioning: `vN.pen` is always `git mv v(N-1).pen vN.pen` + iteration;
  lineage via `git log --follow`.

- `/fenix-auto tech` — Stage 3. Spawns tech-researcher. Reads
  `docs/STACK.md` (locked picks; not re-researched) + `FEATURES.md` +
  approved version pen. Researches ONLY non-locked concerns specific to
  the project. Doc hierarchy: provider MCP → Context7 → WebSearch.
  Writes `.planning/research/TECH.md`. STOP-confirm.

- `/fenix-auto phases <version>` — Stage 4. Spawns phaser. Translates
  `<version>.pen` + `FEATURES.md` filtered to version into per-feature
  PLAN.md skeletons under `.planning/phases/<NN-slug>/`. For `vN+`: only
  diff features get new phases (existing phases stay untouched).

- `/fenix-auto build <phase|version> [--auto]` — Stage 5. Per-phase
  miniLoopDEV: CONTRACT → DEFINE_CHECKS → IMPLEMENT → VALIDATE → PUBLISH.
  Single phase by default; `--auto` walks every unstarted phase in the
  version sequentially with a 30-second `ctrl-c` window between phases.

- `/fenix-auto status` / `/fenix-auto feedback` — utility subcommands
  consumed by the Fenix UI.

## Source of truth (in order)

1. `USER_IDEA.md` — non-dev user's idea, filled by `/fenix-init`
2. `docs/STACK.md` — locked gold-standard stack + MCP/doc tier per concern
3. `docs/features/*.md` — optional rich PRDs per feature (most projects skip)
4. `.planning/research/*` — MARKET, COMPETITORS, BRAND, shadcn-theme.css, TECH
5. `.planning/FEATURES.md` — versioned features (MVP / v1 / v2 / ...)
6. `pens/<version>.pen` — design source; drives Stage 4 phases
7. `.planning/phases/<NN-slug>/PLAN.md` — per-phase contract (frontmatter
   pins `CONTRACT_COMMIT_SHA` + `CHECKS_COMMIT_SHA`)
8. The code in `apps/*` + `packages/*` — the implementation under gates

State files **explicitly removed** from prior framework: `STATE.md`,
`ROADMAP.md`, `REQUIREMENTS.md`, `MILESTONES.md`, `HANDOFF.json`,
`.continue-here.md`, `.planning/config.json`. Phase order = lex on
directory name. Milestones = git tags. Git history is the handoff.

## Stack (locked — see `docs/STACK.md` for the full table)

- **Web framework:** Next.js 16.2.0 (App Router) + React Compiler 1.0 (`reactCompiler: true` in every app)
- **Runtime:** Bun 1.3+
- **Monorepo:** Turborepo
- **Auth:** BetterAuth + org plugin (BetterAuth MCP installed)
- **Database:** Neon Postgres + Kysely
- **Email:** Resend + React Email
- **Storage:** Cloudflare R2 via S3 SDK
- **UI:** shadcn/ui + Tailwind v4 + Geist (lives in **`packages/ui`** — single source)
- **Design taste (anti-slop):** `impeccable` skill (`pbakaus/impeccable`) — installed by `fenix-init`, taught from `docs/PRODUCT.md` at the start of Stage 1. `brand-agent` and `design-planner` both halt if `.impeccable.md` is missing; both call `Skill(skill="impeccable", args="audit|critique <file>")` before exit. The slop catalog lives in the skill, not duplicated into agent prompts.
- **i18n:** next-intl (en-US, es-ES)
- **Testing:** Vitest + Storybook 10 + Playwright + axe a11y
- **Browser-drive (agent):** `@playwright/mcp`
- **Format + Lint:** **Biome only** (no ESLint)
- **Git hooks:** Lefthook
- **Observability:** Sentry (errors) + PostHog (analytics + flags + replay)
- **Background jobs / durable workflows:** Vercel Workflows
- **Rate limit + pub/sub:** Upstash Redis
- **Search:** Postgres full-text → Meilisearch when scale demands
- **Payments (opt-in):** Stripe
- **LLM (opt-in):** Vercel AI SDK + Vercel AI Gateway
- **Geocoding (opt-in):** Mapbox
- **Deployment:** Vercel

**Doc hierarchy** per stack component: provider MCP (tier 1) → Context7
(tier 2) → WebSearch (tier 3). The `tech-researcher` agent enforces this.

## Workspace layout

```
apps/
  web/       Next.js 16 marketing site + sign-in (port 3000)
  app/       Next.js 16 authenticated app (port 3001)
  fenix/     Next.js 16 loop-observation dashboard (port 3002)
packages/
  ui/        shadcn primitives + globals.css + Tailwind config (SINGLE UI source)
  auth/      BetterAuth wrapper
  db/        Kysely + Neon
  email/     Resend + React Email
  storage/   R2 via S3 SDK
  domain/    DDD bounded contexts
  config/    Shared TypeScript + Biome configs
docs/
  STACK.md       Locked stack + doc-source hierarchy
  features/*.md  Optional rich PRDs per feature
.planning/
  research/      MARKET, COMPETITORS, BRAND, shadcn-theme.css, TECH
  FEATURES.md
  design/        Pencil briefs + feedback histories per version
  phases/<NN-slug>/
    PLAN.md
    COMPLETION.md (on green)
    .artifacts/  Gate JSON, screenshots, diff PNGs, reviewer transcripts
  sign-offs/<YYYY-Qn>.md  Quarterly batch of human-only items
  fenix.db       SQLite read model for apps/fenix (gitignored)
pens/
  <version>.pen           Git-tracked; vN.pen is git mv of v(N-1).pen
  exports/<version>/*.png
  inventory/<section>.md  From bun run pen:extract
USER_IDEA.md
fenix.config.ts            Profile, ports, dev-seed, gate flags, tolerances
```

## The 13 agents

Each agent is defined at `.claude/agents/<name>.md` with frontmatter
specifying model, tools, MCPs, permissions, allowed paths, timeout, and
retry policy. The orchestrator (`/fenix-auto`) reads frontmatter and
spawns each as a fresh-context subagent via the Claude Code SDK.

**Six on Opus 4.7** (reasoning-heavy):
- `fenix-brand-agent`, `fenix-features-synthesizer`,
  `fenix-design-planner`, `fenix-contract-author`, `fenix-checks-author`,
  `phase-reviewer`

**Seven on Sonnet 4.6** (research + execution):
- `fenix-init`, `fenix-researcher` (parameterized via `--target=market|competitors`),
  `fenix-design-runner` (parameterized via `--mode=author|iterate-from-prior|feedback`),
  `fenix-tech-researcher`, `fenix-phaser`, `fenix-builder`, `agent-browser-verify`

**Deterministic publish step** (no agent): `scripts/fenix-publish.ts`
renders `COMPLETION.md` from the gate JSONs, commits `feat(<phase>):
<goal>`, refreshes `fenix.db`, optionally opens a PR. The orchestrator
performs lesson harvest inline after the script returns green.

**Profile presets** (in `fenix.config.ts`): `quality` (all Opus), `balanced`
(default — per the split above), `budget` (all Sonnet except `phase-reviewer`
stays Opus).

## The X_PASS_X rule (the single most important law)

**The implementation moves to the check, never the other way around.**

Three layers enforce it:

1. **DEFINE_CHECKS commits separately.** `fenix-checks-author` writes all
   check files (stories, unit tests, golden-path contract, axe assertions)
   in a single commit titled `chore(<phase-id>): pin checks before
   implementation`. The SHA of this commit is pinned in PLAN.md frontmatter
   as `CHECKS_COMMIT_SHA`.

2. **Lefthook `fenix-pin-checks` hook** runs at pre-commit during IMPLEMENT.
   It computes `git diff <CHECKS_COMMIT_SHA>^ <CHECKS_COMMIT_SHA> --name-only`
   to get the list of pinned files. Any commit that touches a pinned file
   is rejected with a clear error.

3. **The only escape** is `git revert <CHECKS_COMMIT_SHA>` — a deliberate,
   visible, auditable action that re-runs DEFINE_CHECKS from scratch. The
   builder cannot silently soften checks to make tests pass.

This is what makes "agent-verified" mean something. Without it, the agent
could "pass" by softening checks. With it, the agent must produce
implementation that bends to the original contract.

## The miniLoopDEV per phase (Stage 5 detail)

```
CONTRACT  →  fenix-contract-author (Opus)
             Reads PLAN.md skeleton + pens + research.
             Fills: Golden Path + State Enumeration (happy / non-happy / edge)
                    + Acceptance JSON + Out of scope.
             Halts on ambiguity with ONE specific question.
             Commits, records CONTRACT_COMMIT_SHA in frontmatter.

DEFINE_CHECKS  →  fenix-checks-author (Opus)
                  Generates one Storybook story per state (with @state-id
                  and @pen JSDoc tags), unit tests per Acceptance kind:unit,
                  golden-path contract JSON per kind:browser, axe per kind:a11y.
                  Commits all in ONE separate commit → CHECKS_COMMIT_SHA pinned.

IMPLEMENT  →  fenix-builder (Sonnet)
              Three sub-phases, bounded retry max 3 each:
              5c.A — happy path. @playwright/mcp loop until snapshot matches
                     every happy_path_state.
              5c.B — state variants. Drive app to each non_happy_path_state
                     and verify story renders correctly.
              5c.C — edge cases. Unit/component tests pass.
              Lefthook fenix-pin-checks rejects any commit touching pinned
              check files.

VALIDATE  →  bun run phase:gate --phase <id>
             1. pattern:audit (soft)
             2. coverage:audit (HARD — every state has a story, every route
                has E2E, every pure fn has unit test)
             3. validate (HARD — typecheck + Biome lint + Biome format
                + Vitest + Storybook interaction + axe a11y)
             4. pen:drift (HARD — @pen PNGs intact)
             5. visual:diff --all (HARD — pixelmatch budget per component
                class from fenix.config.ts; ACROSS ALL STATES, not just
                happy path)
             6. slop:test (soft — impeccable absolute-bans)
             7. phase-reviewer (HARD — fresh-context Opus subagent, JSON
                verdict parsed)
             8. agent-browser-verify (HARD — generates spec from Golden Path,
                runs bun run e2e --reporter=json, parses; verdict pass
                requires all steps green AND zero console errors)

PUBLISH  →  bun run scripts/fenix-publish.ts --phase <id> [--pr]
            Deterministic — no agent. Reads PLAN.md + every gate JSON,
            renders COMPLETION.md (acceptance traceability, visual
            fidelity, golden-path replay, non-happy state coverage,
            edge cases), commits feat(<phase-id>): <feature goal>,
            refreshes .planning/fenix.db. Defensively asserts
            phase-reviewer.verdict == done AND agent-browser-verify.verdict
            == pass before writing — script exits non-zero otherwise.
            Lesson harvest runs inline in the orchestrator after the
            script returns green.
```

## `packages/ui` — the single UI source

All shadcn primitives + the theme live in `packages/ui`. **No
`apps/<x>/components/ui/` directories.** No override pattern. App-specific
custom components live in `apps/<x>/components/` and wrap `@<project>/ui`
primitives.

```ts
// apps/<any>/app/[locale]/layout.tsx
import '@<project>/ui/styles/globals.css'

// apps/<any>/app/<route>/page.tsx
import { Button } from '@<project>/ui/components/button'
```

`shadcn-theme.css` is authored by `fenix-brand-agent` in Stage 1 and copied
verbatim to `packages/ui/src/styles/globals.css`. **One** globals.css in the
whole repo. Apps import via bare path.

`npx shadcn@latest add <component>` is configured via
`packages/ui/components.json` aliases to install into
`packages/ui/src/components/ui/`. All three apps see the new component
immediately.

## Conventions

### Next.js 16

- Server Components by default. Push `'use client'` as far down the tree
  as possible.
- Server Actions for mutations, not Route Handlers (unless public API).
- Request APIs are async: `await cookies()`, `await headers()`,
  `await params`, `await searchParams`.
- Use `proxy.ts` (not `middleware.ts`) for route protection.

### React Compiler

React Compiler 1.0 is enabled in all three apps (`reactCompiler: true`
in each `next.config.ts`). The compiler auto-memoizes components and
hook return values at build time. This is non-negotiable for agents:

- **Never** add `useMemo`, `useCallback`, or `memo` / `React.memo`. The
  compiler handles this. Manual memoization is redundant under the
  compiler and is rejected by the `noRestrictedImports` Biome rule in
  `@fenix/biome-config` (so you'll see it in your editor, at `bun run
  lint`, and at the `biome` pre-commit job — three layers, one source).
- Write idiomatic React: pure render functions, no mutation of props or
  state inline, no `setState` during render. The compiler relies on the
  Rules of React being followed; violating them produces wrong output,
  not a runtime warning.
- Dependency arrays for `useEffect` / `useLayoutEffect` still matter —
  the compiler does not infer effect dependencies. Biome's
  `useExhaustiveDependencies` rule still applies.
- The only valid opt-out for a single file is the `'use no memo'`
  directive at the very top. Use it sparingly — typically only when a
  third-party hook requires referential stability the compiler can't
  guarantee.

### Page / Screen / Component pattern

- **Page** (`page.tsx`) — thin shell, auth + data fetch, passes props to Screen.
- **Screen** (`_components/screen.tsx`) — pure props, renders UI. Primary
  Storybook testing surface.
- **Components** (`_components/*.tsx`) — route-specific with co-located stories.
- Reusable components → `packages/ui/` (shadcn) or `apps/<x>/components/`
  (app-specific).

### Domain-Driven Design

- Domain logic in `packages/domain/src/<context>/` (or `apps/<x>/lib/domain/`
  for app-specific contexts).
- Each bounded context gets its own dir.
- Custom error classes per context (`packages/domain/<context>/errors.ts`).

### Testing

- **One Storybook story per State Enumeration entry** — happy + non-happy +
  edge — with `@state-id` and `@pen` JSDoc tags.
- **Unit tests** co-located, one per pure function.
- **Playwright E2E** per route in `apps/app/e2e/`.
- **`bun run validate`** runs typecheck + Biome lint + Biome format +
  Vitest + Storybook interaction.

### Code quality

- Run `bun run validate` before committing.
- Pre-commit hooks: Biome format on staged + Biome lint + typecheck.
- Pre-push hooks: build + test.
- **Never bypass git hooks** (`--no-verify`).
- Commit format: Conventional Commits, scope is phase id during build
  (`feat(03-billing): ...`) or area otherwise (`chore(framework): ...`).

## Error handling

- **Server Actions** return `{ ok: true, data } | { ok: false, error }`.
- **BetterAuth + Kysely errors** bubble to `error.tsx`.
- **Domain-level failures** use custom error classes; callers catch by
  `instanceof`.
- **Logging:** mask emails, never log secrets, include user/workspace/path
  context.

## Naming conventions

- Files + workspace packages: `kebab-case`. Next.js reserved names exact.
- Variables, fns, methods: `camelCase`. Booleans prefixed `is/has/should`.
- Types, interfaces, React components: `PascalCase`. Prop interfaces end
  in `Props`.
- React hooks: `use` prefix.
- Event handlers: `on<Event>` for props, `handle<Event>` for internal.
- Env vars: `UPPER_SNAKE_CASE`, `NEXT_PUBLIC_*` for client-visible.
- Directories: plural for collections, `(parens)` for route groups,
  `_underscore` for non-routable children.
- Domain contexts in `packages/domain/src/`: `kebab-case`.

## Versioning

Single-monorepo versioning: one version in root `package.json`, mirrored
in every app's `package.json`. Internal packages stay at `0.0.0` —
not published independently. Pre-release: bump every tracked
`package.json`, commit `chore: bump monorepo version to X.Y.Z`, tag
`git tag -a vX.Y.Z -m "vX.Y.Z — summary"`.

Phases number features within a milestone, not releases. A phase like
`03-billing` ships inside whatever semver bump it requires.

## What dies (vs the previous framework)

These are **removed** from Fenix. If you encounter references in a fork,
delete them on sight:

- `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `MILESTONES.md`,
  `HANDOFF.json`, `.continue-here.md`, `.planning/config.json`.
- `/phase-start`, `/phase-spec`, `/phase-close` user commands (the
  underlying stages live inside `/fenix-auto build` now).
- UAT (User Acceptance Testing) as a separate phase — done is JSON; no
  "operator sign-off" line in COMPLETION.md.
- "UAT buckets" (deferred / attested / handled-by / cleared / not-feasible) —
  if an item is genuinely human-only, it lands in `.planning/sign-offs/<Q>.md`
  for quarterly review, never per-phase gating.
- ESLint — Biome only.
- Trigger.dev — Vercel Workflows.
- Anthropic SDK direct — Vercel AI Gateway.
- Per-app shadcn install — single source in `packages/ui`.
- `apps/*/components/ui/<override>/` override directories.
- Per-app `globals.css` files — single source in `packages/ui/src/styles/globals.css`.

## Help

- `/help` — Claude Code help
- Feedback / issues — <https://github.com/anthropics/claude-code/issues>
