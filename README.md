# Fenix

## Start a new project

```bash
bun create cubanos-dev/fenix my-project
cd my-project
bun run init
```

The interactive scaffolder renames the template, sets up your pen file, optionally creates a GitHub repo, and runs the first validate pass. See `scripts/init-project.ts` for the flags used by non-interactive runs and the `bun run init:smoke` end-to-end check.

---

An autonomous-first monorepo template for building production-ready web applications with Claude Code. Fenix combines GSD (Get Shit Done) orchestration, Pencil MCP design tools, and custom agent skills to enable fully autonomous development — from requirements to deployed code.

## What This Is

Fenix is a starter template. Clone it, describe what you want to build, and let GSD + Claude Code handle the rest: research, design, plan, implement, test, and ship.

The stack is opinionated: Next.js 16, BetterAuth, Kysely + Neon, shadcn/ui, Tailwind v4. The architecture is enforced by agent skills that ensure every feature follows the same patterns — page/screen/component separation, Storybook-testable screens, domain-driven design.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- [Claude Code](https://claude.com/claude-code) CLI
- [Pencil](https://pencil.li) (for design tools via MCP)
- Neon Postgres database
- Google/GitHub OAuth credentials (for production auth)

### Setup

```bash
# Clone and install
git clone <repo-url> my-project
cd my-project
bun install

# Verify everything builds
bun run build
```

### Start a New Project

Open Claude Code in the repo and run:

```
/gsd:new-project
```

GSD will ask you questions about what you want to build, research the domain, and generate structured requirements, a roadmap, and phased plans. Then:

```
/gsd:autonomous
```

This runs the full loop: discuss → design → plan → execute → verify — autonomously.

### Import from Existing Designs

If you already have a pen file with designs:

```
/import-pen-project pens/my-designs.pen
```

This extracts requirements from the pen file (screens, features, flows — not visual design). GSD then recreates everything from scratch using the Fenix design skills, producing a fresh design system and implementation.

## Architecture

### Two-App Structure

```
apps/web     — Public website + sign-in (port 3000)
apps/app     — Authenticated application (port 3001)
apps/api     — Python FastAPI service (port 8000)
```

- `apps/web` handles landing pages, marketing, and the sign-in flow
- `apps/app` handles all authenticated features (dashboard, etc.)
- After sign-in, users are redirected from web to app
- Both apps share packages: `@fenix/auth`, `@fenix/db`, `@fenix/email`, `@fenix/storage`

### Page / Screen / Component Pattern

Every route follows three layers:

```
app/(main)/feature/
  page.tsx                    # Auth + data fetching (thin shell)
  _components/
    screen.tsx                # Pure props — Storybook-testable
    screen.stories.tsx        # Stories for the screen
    widget.tsx                # Route-specific component
    widget.stories.tsx        # Stories for the component
```

- **Page**: Server Component. Calls `requireSession()`, fetches data, passes typed props to Screen.
- **Screen**: Receives all data as props. No auth imports, no data fetching. This is what Storybook tests.
- **Components**: Route-specific pieces, each with co-located stories.

This pattern means every screen is testable without authentication — Storybook renders screens with mock data, no OAuth flow needed.

### Domain-Driven Design

```
apps/app/lib/domain/
  <context>/
    types.ts      — Domain types and aggregates
    actions.ts    — Server Actions ('use server')
    queries.ts    — Data fetching functions
    components/   — Context-specific UI components
```

## Autonomous Development (GSD)

Fenix uses [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) for autonomous development orchestration.

### How It Works

1. `/gsd:new-project` — describe what you want, GSD researches and generates requirements + roadmap
2. `/gsd:discuss-phase N` — capture implementation preferences and visual direction
3. `/gsd:plan-phase N` — research approaches, create atomic execution plans
4. `/gsd:execute-phase N` — parallel execution with fresh context per agent
5. `/gsd:verify-work N` — user acceptance testing with auto-diagnosis
6. `/gsd:ship N` — create PR from verified work

Or just: `/gsd:autonomous` to run everything.

### Fenix Agent Skills

Custom skills in `skills/` are injected into GSD agents to enforce Fenix conventions:

| Skill | Purpose |
|-------|---------|
| `fenix-architecture` | Page/screen/component pattern, DDD, two-app structure, naming conventions |
| `fenix-testing` | Storybook stories for every screen, Playwright E2E with dev auth, validation commands |
| `fenix-design` | Pencil MCP design creation, design system ownership (pen drives CSS), gap-fill lifecycle |
| `frontend-design` | Design craft — typography, color, motion, spatial composition (Anthropic official skill) |

Skills are registered in `.planning/config.json` under `agent_skills`.

### Design System

The design system lives in pen files and is the source of truth for all visual decisions:

- **Created once** at project start using Pencil MCP + the fenix-design and frontend-design skills
- **Never regenerated** — only extended when gaps are found (new color role, new component pattern)
- `globals.css` is derived from the design system pen — updated only when the design system changes
- Screens use existing design tokens; they don't introduce new ones ad hoc

## Testing

### Storybook (every task)

Every Screen and Component gets stories. This is the primary verification — no auth needed because screens are pure props.

```bash
bun run --cwd apps/app storybook   # port 6007
bun run --cwd apps/web storybook   # port 6006
```

### Playwright E2E (end of phase)

E2E tests verify real auth flows using dev-only email+password credentials:

- Email: `dev@fenix.local`
- Password: `dev-password-123`
- Auto-seeded in development via `instrumentation.ts`

```bash
bun run e2e
```

### Validation

```bash
bun run validate   # typecheck + format check + lint + Storybook tests
bun run build      # build all apps
bun run e2e        # Playwright E2E tests
```

## Commands

```bash
bun run dev           # Start all services (Turborepo)
bun run dev:api       # Start Python API only
bun run build         # Build all apps
bun run typecheck     # Type check all apps
bun run lint          # Lint all apps
bun run format        # Format all apps
bun run validate      # Typecheck + format + lint + test
bun run e2e           # Playwright E2E tests
bun run db:migrate    # Run database migrations
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + Bun workspaces |
| Web & App | Next.js 16, React 19, TypeScript 6 |
| API | Python FastAPI |
| Auth | BetterAuth (Google/GitHub OAuth + organizations) |
| Database | Kysely + Neon Postgres |
| UI | shadcn/ui + Tailwind CSS v4 + Geist fonts |
| Email | Resend + React Email |
| Storage | Cloudflare R2 via S3 SDK |
| i18n | next-intl (en-US, es-ES) |
| Testing | Vitest + Storybook 10 + Playwright |
| Formatting | Biome |
| Linting | ESLint 9 (flat config) |
| Git hooks | Lefthook |
| Deployment | Vercel Services |
| Orchestration | GSD (Get Shit Done) |
| Design | Pencil MCP |

## Project Structure

```
fenix/
  apps/
    web/              — Public website + sign-in
    app/              — Authenticated application
    api/              — Python FastAPI service
  packages/
    auth/             — BetterAuth config + helpers
    db/               — Kysely + Neon connection
    email/            — Resend send helpers + templates
    storage/          — R2/S3 upload/download helpers
    config/           — Shared TypeScript, ESLint, Biome configs
  skills/
    fenix-architecture/  — Architecture enforcement skill
    fenix-testing/       — Testing requirements skill
    fenix-design/        — Design system + Pencil MCP skill
    frontend-design/     — UI design craft skill (Anthropic)
  pens/               — Pencil design files (source of truth for UI)
  .planning/          — GSD state (roadmap, phases, plans)
  .claude/            — Claude Code config, GSD agents + commands
```

## License

MIT
