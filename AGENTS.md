# Agentic Development — Ralph Loop

Operational guide for AI agents working on this monorepo. All agents must follow these conventions.

## Repository Structure

```
apps/web/     — Next.js 16 application (Vercel, route prefix /)
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

### Web App (apps/web)
- **Framework**: Next.js 16 + App Router, Bun runtime
- **UI**: shadcn/ui + Tailwind CSS v4, dark mode default
- **Auth**: BetterAuth + Google/GitHub OAuth + orgs → `@fenix/auth`
- **Database**: Kysely + Neon Postgres → `@fenix/db`
- **AI**: AI SDK v6 + AI Gateway + AI Elements
- **i18n**: next-intl (en-US, es-ES)
- **Storage**: Cloudflare R2 → `@fenix/storage`
- **Email**: Resend + React Email → `@fenix/email`

### API (apps/api)
- **Framework**: Python FastAPI
- **Route prefix**: `/server` (Vercel Services)

## Key Patterns

### Components
- All components are Server Components by default
- Only add `'use client'` when browser APIs or interactivity are needed
- Push client boundaries as far down the tree as possible
- Server Actions for all mutations (no API routes for internal operations)

### Route Protection
- `proxy.ts` (NOT `middleware.ts`) handles auth checks
- Public paths: `/`, `/sign-in`, `/api/auth`
- All other routes require a valid BetterAuth session

### Domain Structure
```
apps/web/lib/domain/
├── <context-name>/
│   ├── types.ts        — Domain types, aggregates
│   ├── actions.ts      — Server Actions ('use server')
│   ├── queries.ts      — Data fetching functions
│   └── components/     — Context-specific UI components
```

### AI Integration
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
- Run `bun run validate` (typecheck + lint + test)
- Commit format: `feat(<context>): description [spec:<spec-file>]`
- Other prefixes: `fix`, `chore`, `pen` (design-only changes)

## Guardrails

1. **Pen files are read-only** — agents read via Pencil MCP but never modify designs
2. **No git hook bypass** — never use `--no-verify` or `--no-gpg-sign`
3. **Complete implementations only** — no stubs, placeholders, or TODO comments
4. **Resolve all validation failures** — fix issues, don't skip them
5. **Both spec AND design must be satisfied** — code must match requirements and visual design
