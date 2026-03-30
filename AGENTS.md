# Agentic Development — Ralph Loop

Operational guide for AI agents working on this monorepo. All agents must follow these conventions.

## Repository Structure

```
apps/web/     — Next.js 16 public website + sign-in (Vercel, port 3000)
apps/app/     — Next.js 16 authenticated application (Vercel, port 3001)
apps/api/     — Python FastAPI service (Vercel, route prefix /server)
packages/     — Shared packages (db, auth, email, storage, config)
docs/         — Project documentation
specs/        — Feature specifications (one per screen/feature)
pens/         — Pencil design files (read-only for agents)
```

## Ralph Loop (Autonomous Development)

The Ralph Loop is a continuous PLAN → BUILD → REVIEW cycle that implements features from specs and designs.

```
┌─────────────────────────────────────┐
│           RALPH (Orchestrator)       │
│                                      │
│  1. PLAN  → ralph-plan subagent     │
│     ↓ (design gap gate)             │
│  2. BUILD → ralph-build subagent    │
│  3. REVIEW → ralph-review subagent  │
│     ↓                                │
│  PASS? → next task                   │
│  FAIL? → loop back to BUILD         │
│  3 consecutive fails? → STOP        │
└─────────────────────────────────────┘
```

### When to Use Ralph

- Feature implementation from specs/designs
- Run: `ralph` agent from Claude Code (spawns the full loop)
- Ralph reads `IMPLEMENTATION_PLAN.md` for tasks, `specs/` for requirements, `pens/` for designs

### Prerequisites

Before running Ralph, ensure:
1. A PRD exists (in `docs/` or provided by user)
2. Pen designs exist in `pens/` for the screens being built
3. `DOMAIN_MODEL.md` has the relevant bounded contexts
4. The project builds cleanly (`bun run build`)

## Source of Truth

| Priority | Source | Purpose |
|----------|--------|---------|
| 1 | PRD | What to build |
| 2 | Pen designs (`pens/`) | How it looks (read-only) |
| 3 | Specs (`specs/`) | Bridge: PRD + design → implementation contract |
| 4 | `DOMAIN_MODEL.md` | Bounded contexts, aggregates, domain events |
| 5 | `IMPLEMENTATION_PLAN.md` | Task tracking, review verdicts |

## Tech Stack Quick Reference

### Public Website (apps/web) — port 3000
- **Framework**: Next.js 16 + App Router, Bun runtime
- **Purpose**: Landing pages, marketing, sign-in
- **UI**: shadcn/ui + Tailwind CSS v4
- **Auth**: BetterAuth sign-in page + OAuth routes → `@fenix/auth`
- **i18n**: next-intl (en-US, es-ES)

### Authenticated App (apps/app) — port 3001
- **Framework**: Next.js 16 + App Router, Bun runtime
- **Purpose**: Dashboard, AI chat, all protected features
- **UI**: shadcn/ui + Tailwind CSS v4, dark mode default
- **Auth**: BetterAuth session validation, proxy.ts redirects to web sign-in → `@fenix/auth`
- **Database**: Kysely + Neon Postgres → `@fenix/db`
- **AI**: AI SDK v6 + AI Gateway + AI Elements
- **i18n**: next-intl (en-US, es-ES)
- **Storage**: Cloudflare R2 → `@fenix/storage`
- **Email**: Resend + React Email → `@fenix/email`

### API (apps/api)
- **Framework**: Python FastAPI
- **Route prefix**: `/server` (Vercel Services)

## Key Patterns

### Page / Screen / Component Architecture

Every route follows a three-layer pattern that separates auth+data from rendering:

```
app/(app)/feature/
  page.tsx                    # Layer 1: Auth + data fetching → typed props to Screen
  _components/
    screen.tsx                # Layer 2: Pure props, renders full UI (Storybook-testable)
    screen.stories.tsx        # Stories for the screen
    feature-widget.tsx        # Layer 3: Route-specific component
    feature-widget.stories.tsx
```

- **Page** (`page.tsx`): Thin async Server Component. Calls `requireSession()`, fetches data, passes typed props to Screen. No UI logic.
- **Screen** (`_components/screen.tsx`): Receives all data as typed props. No auth or data fetching. This is the primary Storybook testing surface.
- **Components** (`_components/*.tsx`): Route-specific components. Each gets co-located stories.
- **Reusable components**: `components/ui/` (shadcn) or `lib/domain/<context>/components/`.

### Components
- All components are Server Components by default
- Only add `'use client'` when browser APIs or interactivity are needed
- Push client boundaries as far down the tree as possible
- Server Actions for all mutations (no API routes for internal operations)

### Route Protection
- `proxy.ts` (NOT `middleware.ts`) handles auth checks
- Public paths: `/`, `/sign-in`, `/api/auth`
- All other routes require a valid BetterAuth session

### Dev Auth (Development Only)
- Email+password auth is enabled when `NODE_ENV === 'development'`
- A test user (`dev@fenix.local` / `dev-password-123`) is auto-seeded on dev startup
- Used by Playwright E2E tests to sign in and test protected routes
- Never enabled in production — only OAuth providers are available

### Domain Structure
```
apps/app/lib/domain/
├── <context-name>/
│   ├── types.ts        — Domain types, aggregates
│   ├── actions.ts      — Server Actions ('use server')
│   ├── queries.ts      — Data fetching functions
│   └── components/     — Context-specific UI components
```

### AI Integration (apps/app)
- Chat endpoint: `app/api/chat/route.ts`
- Model: AI Gateway string (e.g., `'anthropic/claude-sonnet-4.5'`)
- Client: `useChat` + `DefaultChatTransport` from `@ai-sdk/react` / `ai`
- Render AI text: `<MessageResponse>` from AI Elements (never raw strings)

## Quality Gates

### Pre-commit (parallel, enforced by Lefthook)
1. **Format**: `biome format --write` on staged TS/TSX/JSON files
2. **Lint**: `eslint` on staged TS/TSX files
3. **Typecheck**: `tsc --noEmit`

### Pre-push
1. **Build**: `turbo build` (all apps)
2. **Test**: `turbo test` (all apps)

### Before Committing (Ralph agents)
- Run `bun run validate` (typecheck + format check + lint + test)
- Commit format: `feat(<context>): description [spec:<spec-file>]`
- Other prefixes: `fix`, `chore`, `pen` (design-only changes)

### Testing Strategy
- **Storybook + Vitest** (every BUILD→REVIEW cycle): Every Screen and Component gets stories. Vitest runs them as tests. This is the primary verification — no auth needed because Screens are pure props.
- **Playwright E2E** (end of slice): Written during BUILD, run at slice end. Uses dev email+password auth to sign in and verify real routes, auth redirects, and data flow.
- **`bun run validate`**: typecheck + format check + lint + Storybook/Vitest tests
- **`bun run e2e`**: Playwright E2E tests (requires dev server or uses webServer config)

## Guardrails

1. **Pen files are read-only** — agents read via Pencil MCP but never modify designs
2. **No git hook bypass** — never use `--no-verify` or `--no-gpg-sign`
3. **Complete implementations only** — no stubs, placeholders, or TODO comments
4. **Resolve all validation failures** — fix issues, don't skip them
5. **Both spec AND design must be satisfied** — code must match requirements and visual design
