# Fenix — Claude Code Instructions

## Stack

- **Monorepo**: Turborepo + Bun workspaces
- **Web**: Next.js 16 (App Router) + React 19 + TypeScript 6 (public site)
- **App**: Next.js 16 (App Router) + React 19 + TypeScript 6 (authenticated app)
- **API**: Python FastAPI (Vercel Services at `/server`)
- **Auth**: BetterAuth (Google/GitHub OAuth + organization plugin) → `@fenix/auth`
- **Database**: Kysely + Neon Postgres → `@fenix/db`
- **UI**: shadcn/ui + Tailwind CSS v4 + Geist fonts
- **AI**: AI SDK v6 + AI Gateway (OIDC auth, no API keys) + AI Elements
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
- **Playwright E2E tests** in `apps/web/e2e/` — use dev auth credentials.
- Dev auth (email+password) is auto-enabled in development with seeded test user.
- `bun run validate` runs typecheck + format + lint + Storybook tests.
- `bun run e2e` runs Playwright E2E tests.

### DDD (Domain-Driven Design)
- Domain logic lives in `apps/app/lib/domain/<context>/`.
- Each bounded context gets its own directory.
- Use `DOMAIN_MODEL.md` to document contexts, aggregates, and events.

### AI SDK v6
- Default to AI Gateway: `model: 'provider/model-name'` (e.g., `'anthropic/claude-sonnet-4.5'`).
- Use dots for version numbers in model slugs (not hyphens).
- Server: `convertToModelMessages()` + `streamText()` + `toUIMessageStreamResponse()`.
- Client: `useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`.
- Render AI text with `<MessageResponse>` from AI Elements — never raw `{text}`.
- Use `inputSchema` (not `parameters`) and `outputSchema` (not `result`) for tool definitions.
- `maxSteps` is removed — use `stopWhen: stepCountIs(N)`.

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
1. `.planning/PROJECT.md` + `.planning/REQUIREMENTS.md` (what to build — generated by GSD)
2. Pen designs in `pens/` (how it looks) — **upstream, drives CSS and components**
3. `.planning/phases/` (plans, UI specs, context per phase — generated by GSD)
4. `DOMAIN_MODEL.md` (bounded contexts, aggregates, events)
5. `.planning/ROADMAP.md` + `.planning/STATE.md` (phases, progress, decisions)

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
```
