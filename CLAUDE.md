# Fenix — Claude Code Instructions

## Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Web**: Next.js 16 (App Router) + React 19 + TypeScript 6 (public site)
- **App**: Next.js 16 (App Router) + React 19 + TypeScript 6 (authenticated app)
- **API**: Python FastAPI (Vercel Services at `/server`)
- **Auth**: BetterAuth (Google/GitHub OAuth + organization plugin) → `@fenix/auth`
- **Database**: Kysely + Neon Postgres → `@fenix/db`
- **UI**: shadcn/ui + Tailwind CSS v4 + Geist fonts
- **Email**: Resend + React Email → `@fenix/email`
- **Storage**: Cloudflare R2 via S3 SDK → `@fenix/storage`
- **i18n**: next-intl (en-US, es-ES)
- **Testing**: Vitest + Storybook 10 + Playwright
- **Formatting**: Biome (2-space, single quotes, no semicolons)
- **Linting**: ESLint 9 (flat config, next core-web-vitals + typescript)
- **Git hooks**: Lefthook (pre-commit: format + lint + typecheck, pre-push: build + test)
- **Deployment**: Vercel Services (web → `/`, app → `/` on subdomain, api → `/server`)

## Workspace Layout

```
apps/web     — Next.js 16 public website + sign-in (@fenix/web) → port 3000
apps/app     — Next.js 16 authenticated application (@fenix/app) → port 3001
apps/api     — Python FastAPI service
packages/db  — Kysely + Neon connection, types, migrator (@fenix/db)
packages/auth — BetterAuth config, client, server helpers (@fenix/auth)
packages/email — Resend send helpers + templates (@fenix/email)
packages/storage — R2/S3 upload/download helpers (@fenix/storage)
packages/config/ — Shared TypeScript, ESLint, Biome configs
```

## Conventions

### Next.js 16
- Server Components by default. Only add `'use client'` for interactivity.
- Push `'use client'` as far down the tree as possible.
- Server Actions (`'use server'`) for mutations, not Route Handlers (unless public API).
- All request APIs are async: `await cookies()`, `await headers()`, `await params`, `await searchParams`.
- Use `proxy.ts` (not `middleware.ts`) for route protection. Location: same level as `app/`.
- Turbopack is the default bundler — no webpack config needed.

### Page / Screen / Component Pattern
Every route uses a three-layer architecture:
- **Page** (`page.tsx`): Thin shell — auth + data fetching, passes typed props to Screen.
- **Screen** (`_components/screen.tsx`): Pure props, renders UI. Primary Storybook testing surface.
- **Components** (`_components/*.tsx`): Route-specific components with co-located stories.
- Reusable components go in `components/ui/` or `lib/domain/<context>/components/`.

### Testing
- **Storybook stories** for every Screen and Component (co-located in `_components/`).
- **Playwright E2E tests** in `apps/app/e2e/` — use dev auth credentials.
- Dev auth (email+password) is auto-enabled in development with seeded test user.
- `bun run validate` runs typecheck + format + lint + Storybook tests.
- `bun run e2e` runs Playwright E2E tests.

### DDD (Domain-Driven Design)
- Domain logic lives in `apps/app/lib/domain/<context>/`.
- Each bounded context gets its own directory.
- Use `DOMAIN_MODEL.md` to document contexts, aggregates, and events.

### Code Quality
- Run `bun run validate` before committing (typecheck + lint + test).
- Commit format: `feat(<context>): description`
- Pre-commit hooks enforce format, lint, typecheck.
- Pre-push hooks enforce build and test.
- Never bypass git hooks (`--no-verify`).

### UI
- Dark mode by default for dashboards and AI surfaces.
- Geist Sans for UI text, Geist Mono for code/metrics.
- shadcn/ui components — do not build primitives from scratch.
- Use `cn()` from `@/lib/utils` for class merging.
- Font slots are exposed as CSS custom properties in `app/globals.css` so each
  project can swap families without rewriting components: `--font-sans` for
  body copy, `--font-display` for hero/serif display faces, `--font-ui` for
  UI labels/numerals, `--font-mono` for code and metrics. Fenix ships with
  Geist mapped into `--font-sans` and `--font-mono`; the `--font-display` and
  `--font-ui` slots stay aliased to `--font-sans` until a project overrides
  them via `next/font/google` in `apps/app/app/[locale]/layout.tsx`.

## Agentic Development (GSD)

This repo uses **GSD (Get Shit Done)** for autonomous development. See `AGENTS.md` for details.

### Key GSD Commands
- `/gsd:new-project` — initialize a new project with research + requirements + roadmap
- `/gsd:discuss-phase [N]` — capture implementation preferences before planning
- `/gsd:plan-phase [N]` — research and create execution plans
- `/gsd:execute-phase [N]` — parallel execution with fresh context per agent
- `/gsd:verify-work [N]` — user acceptance testing with auto-diagnosis
- `/gsd:ship [N]` — create PR from verified work
- `/gsd:autonomous` — full autonomous mode (research → plan → execute → verify)
- `/gsd:progress` — show current workflow status
- `/gsd:next` — auto-detect and execute next logical step

### Fenix Agent Skills (`skills/`)
Custom skills injected into GSD agents for Fenix-specific enforcement:
- `fenix-architecture` — page/screen/component pattern, DDD, two-app structure
- `fenix-testing` — Storybook stories, E2E tests, validation commands
- `fenix-design` — Pencil MCP design creation + compliance, design system ownership (pen → CSS)

### Source of Truth (in order)
1. `docs/PRODUCT.md` + `docs/features/*.md` (product intent — the PRDs a human wrote)
2. `.planning/PROJECT.md` + `.planning/REQUIREMENTS.md` (what to build — synthesized by GSD from the PRDs)
3. `.impeccable.md` (design context — synthesized from `PRODUCT.md` by `/fenix-impeccable teach`)
4. Pen designs in `pens/` (how it looks) — **upstream, drives CSS and components**
5. `.planning/phases/` (plans, UI specs, context per phase — generated by GSD)
6. `DOMAIN_MODEL.md` (bounded contexts, aggregates, events)
7. `.planning/ROADMAP.md` + `.planning/STATE.md` (phases, progress, decisions)

## Commands

```bash
bun run dev           # Start all services (Turborepo)
bun run dev:api       # Start Python API only
bun run build         # Build all apps
bun run typecheck     # Type check all apps
bun run lint          # Lint all apps
bun run format        # Format all apps
bun run format:check  # Check formatting
bun run test          # Run all tests (Storybook + Vitest)
bun run validate      # Typecheck + format + lint + test (all apps)
bun run e2e           # Run Playwright E2E tests
bun run db:migrate    # Run database migrations
bun run env:pull      # Pull env vars from Vercel
bun run phase:gate    # Run all phase gates for a named phase
bun run coverage:audit # Assert a phase shipped its test artifacts
bun run pattern:audit  # Reuse-before-reinvent symbol lookup
bun run pen:extract    # Extract pen inventory (agent runs the MCP calls)
bun run pen:drift      # Flag stories whose @pen target changed
bun run pen:tokens     # Emit CSS custom properties from pen variables
bun run visual:diff    # Compare stories to their @pen references
bun run slop:test      # Scan phase diff for impeccable absolute-ban patterns
```

## Phase Flow

Work in this repo is organised into phases. A phase is a bounded slice of scope — a set of screens, routes, and domain functions that ship together. The flow is deliberately strict: every phase moves through the same twelve steps, and each step leaves a machine-checkable artifact behind. Prose is not evidence.

**Intake → plan → pattern audit.** `/phase-start <id>` copies the phase template into `.planning/phases/<id>/`, reads the pen inventory for every frame in scope, and quotes pen notes verbatim into `PLAN.md`. Before any code is authored, `bun run pattern:audit --symbol <name>` runs for every symbol the plan introduces; the findings are cited in the plan so reuse is visible. No production edits happen during intake.

**Spec → test contracts.** `/phase-spec <id>` scaffolds Storybook stories (one per screen state), unit test `.todo`s (one per pure function), and Playwright `.skip` E2Es (one per new route). Stories that reference a pen export carry a `@pen <path>` JSDoc tag — later gates parse it. The stories are the spec; implementation catches up to them, not the other way around.

**Implement → simplify.** Fill components so stories render, fns pass tests, and E2Es flip from `.skip` to passing. Run the `simplify` skill against the diff to remove duplication and dead code. This is a required pass, not a nice-to-have.

**Close.** `/phase-close <id>` runs `bun run phase:gate --phase <id>`, which chains the pattern audit (informational), the coverage audit (hard — no uncovered screen/route/fn), and `bun run validate` (hard — typecheck, format, lint, unit/Storybook tests). If the gate is green, the `phase-reviewer` subagent runs in a fresh context against the diff, the plan, and the Definition of Done. If the reviewer votes done, `agent-browser-verify` walks the golden path in a real browser. Only when every hard gate is green does the phase commit with `feat(<phase-id>):` and a `COMPLETION.md` carrying the evidence.

## Definition of Done

A phase is done only when every item below is backed by a machine-checkable artifact:

- Every new screen has a Storybook story covering every state listed in the plan's state enumeration.
- Every new pure function has a co-located unit test that actually imports the function.
- Every new route has a Playwright E2E spec exercising the golden path.
- The pattern audit ran for every new symbol; findings are cited in `PLAN.md` → Pattern audit findings.
- The simplify pass ran against the diff.
- `bun run coverage:audit --phase <id>` exits 0.
- `bun run phase:gate --phase <id>` exits 0.
- `phase-reviewer` voted `done` in a fresh context.
- `agent-browser-verify` exercised the golden path with no console errors.
- `bun run pen:drift` is clean, or each flagged story is documented as an accepted deviation.
- `bun run visual:diff --all` pairs were reviewed; accepted deviations are recorded.
- `COMPLETION.md` is written with the coverage JSON, the reviewer JSON, browser screenshots, and the closing diff stats.

Nothing here is optional. The gates exist because phases shipped "done" while features were broken — the point of the checklist is to make the failure mode impossible, not to document a recommendation.

## Pen Workflow

Pens are **input** and **reference**, never output. The agent does not author pens mid-phase. Pens drive the spec; the agent translates them into stories and code.

**Extraction is one-time per pen update.** `bun run pen:extract` prepares `pens/inventory/` and `pens/exports/` then points at the **fenix-pen-extract** skill. The skill is the canonical extraction workflow — it walks the pen via Pencil MCP, exports each screen as PNG, pairs sibling `note` nodes with their screens by title prefix, and writes per-section inventory markdown with verbatim note blocks plus `pens/inventory/INDEX.md` and `pens/inventory/COMPONENTS.md`. The script is a thin shim; all real work happens in the skill. Token extraction follows the same pattern — `bun run pen:tokens` + **fenix-pen-tokens** skill — and reads pen variables the user defined manually in Pencil first.

**Notes are quoted verbatim.** When a phase plan references a frame, it copies the note into `PLAN.md` → "Verbatim pen notes" exactly as it appears, typos and punctuation included. No paraphrasing, no summarising, no "cleaning up." Every lossy translation of a note is a chance for the story to drift from the design intent, which was the largest source of rework in prior projects.

**Stories cite pens by path.** Storybook stories whose behaviour comes from a pen export add a `@pen pens/exports/<section>/<screen>.png` JSDoc tag. `bun run pen:drift` greps for the tag and flags any story whose target PNG changed; `bun run visual:diff --all` collects every pair for the visual regression step. The `@pen` tag is the link between the spec and the rendered UI, and both gates depend on it.

**Tokens are user-defined.** `bun run pen:tokens` emits CSS custom properties from pen variables. Users define variables in Pencil once, per project — the script never guesses colours from raw hex, because guesses produce unstable tokens.

## Design Initialization

Every new Fenix project runs through a fixed sequence once, at inception, before any phase ships UI. The sequence exists because pens cannot be authored from nothing — they need an aesthetic point of view, and that point of view comes from the PRDs.

**The one-time sequence:**

1. **Write the PRDs.** Fill `docs/PRODUCT.md` (project-level: audience, brand voice, aesthetic direction, references, anti-references) and one `docs/features/<name>.md` per feature in scope. Templates in both locations. Rich PRDs are the contract for this project — thin PRDs break the whole downstream flow.
2. **Synthesize `.impeccable.md`.** Run `/fenix-impeccable teach`. The skill reads `docs/PRODUCT.md` only, maps § 2/§ 4/§ 5 into the Design Context sections the user-level impeccable expects, and writes `.impeccable.md` at the repo root. Does NOT interview the user — the PRD is the interview.
3. **Seed the design-system pen.** Run `/fenix-impeccable seed`. Delegates to `/impeccable craft` once, authoring a Pencil file with color palette, type scale, spacing, radii, and component patterns per `.impeccable.md`. This is the only moment craft runs in a Fenix project.
4. **Refine in Pencil, extract tokens.** Open the seeded pen, refine to taste, then `bun run pen:tokens` emits CSS custom properties and `bun run pen:extract` generates the inventory. From here on, **pens are upstream** and the normal Pen Workflow rules apply.

**Per-phase companion passes** (during implement → simplify, before `/phase-close`):

- `/fenix-impeccable audit` — runs `slop-test` against the phase diff. Flags impeccable's absolute bans (side-stripe accents, gradient text, reflex-font imports). Informational, not blocking. Wired into `phase-gate` as a soft gate.
- `/polish` — final alignment/spacing/consistency pass
- `/distill` — strip accumulated complexity when a Screen has drifted toward too many affordances
- `/critique` + `/audit` (companion skills) — layered into `/gsd:ui-review` for per-phase scoring
- `/animate` — only when the feature PRD § 8 explicitly names motion moments
- `/layout` + `/typeset` — when the initial implementation feels off before the first simplify pass
- `/clarify` — when UX copy feels robotic

**What does NOT run during a phase:** `/impeccable craft` (aesthetic direction is already owned by pens) and `/impeccable teach` (design context is already in `.impeccable.md`). If either seems needed, the project skipped a step in the one-time sequence above — fix that, don't re-run them per phase.

## Component Override Pattern

Shared shadcn primitives live in `apps/app/components/ui/*` and are treated as vendor source — do not edit them, and expect them to be refreshed with `npx shadcn@latest add`. Project-specific styling lives in a parallel directory keyed by the project name: `apps/app/components/ui/fenix/*` in the template, and `apps/app/components/ui/<project>/*` once the scaffolder renames it. App code imports from `@/components/ui/fenix/*` when an override exists for a component, otherwise from `@/components/ui/*` directly. Overrides wrap the shadcn base, apply the diff via `cn()`, and export a `<Project>`-prefixed wrapper (`FenixToggle`, `FenixButton`, etc.). Only add an override when a component actually needs project-specific styling; the directory stays empty in the template. See `apps/app/components/ui/fenix/README.md` for the full pattern and a worked example.

## Naming Conventions

- **Files and workspace packages**: `kebab-case` (`dev-seed.ts`, `packages/ui`, `components/ui/fenix/toggle.tsx`). Next.js reserved names (`page.tsx`, `layout.tsx`, `error.tsx`, `proxy.ts`) stay exact.
- **Variables, functions, and methods**: `camelCase` (`signInUrl`, `requireSession`). Booleans are prefixed with `is`/`has`/`should` (`isAdmin`, `hasAccess`).
- **Types, interfaces, and React components**: `PascalCase` (`DashboardScreenProps`, `DashboardScreen`). Prop interfaces end in `Props`.
- **React hooks**: `use` prefix (`useSession`, `useBreakpoint`).
- **Event handlers**: `on<Event>` for prop surfaces, `handle<Event>` for internal handlers (`onSubmit`, `handleSignIn`).
- **Environment variables**: `UPPER_SNAKE_CASE`, namespaced by concern (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`). Client-visible variables must start with `NEXT_PUBLIC_`.
- **Directories**: plural for collections (`components/`, `lib/`, `e2e/`), `(parens)` for Next route groups, `_underscore` for non-routable children (`_components/`).
- **Domain contexts** in `lib/domain/`: `kebab-case` (`lib/domain/billing/`, `lib/domain/workspaces/`).

## Error Handling

Errors are signal, not noise. Never swallow them silently. Every `catch` either rethrows with added context, logs with enough breadcrumbs to find the call site, or returns a structured error object the caller is designed to consume — there is no fourth option.

- **Server Actions** return `{ ok: true, data } | { ok: false, error }` and surface `error` to the UI. Never throw across the `'use server'` boundary for expected failures.
- **BetterAuth and Kysely errors** bubble out of `proxy.ts` and page components so Next's error boundaries can render `error.tsx`. Do not wrap them in try/catch just to `console.log` and move on.
- **Domain-level failures** use custom error classes exported from `packages/domain/*/errors.ts` (e.g. `WorkspaceNotFoundError`). Callers catch by `instanceof`, not by string matching on `.message`.
- **Logging**: include enough context to reproduce (user id, workspace id, request path). Never log secrets, tokens, raw request bodies, or full email addresses — mask first.
- **Error boundaries** (`error.tsx`) ship a user-facing message plus a reset button. They are the last line of defence, not the first.

## Versioning

Fenix uses **single-monorepo versioning**: one version number in the root `package.json`, mirrored in every app `package.json` (`apps/web`, `apps/app`). Internal packages under `packages/*` stay at `0.0.0` — they are not published independently. Before pushing a release, bump the version in every tracked `package.json`, commit as `chore: bump monorepo version to X.Y.Z`, then tag with `git tag -a vX.Y.Z -m "vX.Y.Z — summary"`. Follow semver: patch for bug fixes, minor for backwards-compatible features, major for breaking changes. Phases number *features*, not releases — a phase like `03-billing` ships inside whatever semver bump it needs. Commit messages follow Conventional Commits (see `## Conventions → Commit format` below); the phase id goes in the scope (`feat(03-billing): ...`) so phase-gate commits are easy to grep.

### Conventions → Commit format

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) spec and are enforced by the `gsd-validate-commit.sh` hook (opt-in). The shape is `<type>(<scope>): <subject>`:

- `feat(<context>): add workspace invite flow` — new user-visible functionality
- `fix(<phase-id>): fix race in billing webhook retry` — bug fix inside a phase
- `docs(<area>): clarify Pen Workflow section` — docs-only change
- `refactor(<area>): extract useSession hook` — internal restructuring
- `chore(<area>): bump turborepo to 2.6` — tooling, deps, version bumps

The scope is free-form but should be either a phase id (`03-billing`) or a coarse area (`auth`, `db`, `ci`). Subjects are lowercase, imperative mood, no trailing period, ≤72 characters. The body (optional) explains *why*, not *what* — the diff already shows the what.
