# Fenix

> Starter template that takes a non-dev user from `USER_IDEA.md` to a deployed
> app. Research validates the idea, Pencil designs the UI before any code is
> written, the user approves designs by sight, then an autonomous dev loop
> builds against a gold-standard stack with implementation-moves-to-the-check
> enforcement and a real-time dashboard to watch the whole thing run.

**Done is JSON, never an operator sign-off.**

---

## What you actually do (five touchpoints)

1. Write `USER_IDEA.md` via `/fenix-init` (7 questions).
2. Review research artifacts (MARKET, COMPETITORS, BRAND, FEATURES).
3. Approve pen designs by sight.
4. Review tech picks for non-locked concerns.
5. Review the PR.

Everything else is autonomous.

---

## Quick start

### Option A — `bun create` (recommended)

```bash
bun create fenix my-app
cd my-app
claude
# inside Claude Code:
/fenix-init
```

### Option B — `git clone`

```bash
git clone <repo-url> my-app
cd my-app
bun install
bun run init-project   # resets .git, drops Fenix-source-only files
claude
# inside Claude Code:
/fenix-init
```

### Then run the loop

```
/fenix-auto research              # Stage 1 — idea validation (parallel)
/fenix-auto design mvp            # Stage 2 — Pencil-authored pens
/fenix-auto tech                  # Stage 3 — non-locked picks only
/fenix-auto phases mvp            # Stage 4 — PLAN.md per feature
/fenix-auto build mvp --auto      # Stage 5 — autonomous build loop
```

Each stage halts at a STOP-confirm gate. Approve in the Fenix UI
(`localhost:3002`) or via `bun run fenix:approve --stage <stage>`.

---

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Claude Code](https://claude.com/claude-code) CLI
- A Neon Postgres database (one-click via Vercel Marketplace)
- Pencil CLI auth key — set `PENCIL_CLI_KEY` in `.env.local` for Stage 2

Open `.env.example` for the full list. Production-only keys
(`BETTER_AUTH_SECRET`, OAuth client IDs, Resend, R2) can be deferred until
you're ready to deploy.

---

## The five stages

```
USER_IDEA.md  →  RESEARCH (idea validation, 4 agents in parallel)
              →  miniLoopDESIGN per version (Pencil CLI authors version.pen)
              →  user approves pens by sight
              →  TECH research (post-pen, informed; non-locked concerns only)
              →  phase breakdown per version
              →  miniLoopDEV per phase
                   CONTRACT → DEFINE_CHECKS → IMPLEMENT (A/B/C)
                            → VALIDATE (8 gates) → PUBLISH
              →  PR + commit
```

**The X_PASS_X rule:** `DEFINE_CHECKS` commits separately and the
Lefthook `fenix-pin-checks` hook rejects any `IMPLEMENT`-stage commit that
touches a pinned check file. The only escape is `git revert
<CHECKS_COMMIT_SHA>` — a deliberate, auditable action that re-opens
DEFINE_CHECKS. `--no-verify` is not an escape.

See `CLAUDE.md` for the full loop spec and `.claude/agents/*.md` for the
16 subagent definitions.

---

## The Fenix UI (apps/fenix)

Next.js 16 dashboard at `localhost:3002` that watches the loop:

- **/** — project overview + version timeline + metric strip
- **/versions/[v]** — pen exports, phase list, approve / feedback
- **/phases/[id]** — pipeline visualizer, gate results, live event tail (SSE)
- **/research** — MARKET / COMPETITORS / BRAND / TECH / FEATURES viewer
- **/controls** — approvals, halt actions, db rehydrate

Source of truth = Markdown + JSON in `.planning/`. The dashboard reads a
SQLite read model at `.planning/fenix.db` (gitignored, rebuilt by
`bun run fenix:rehydrate`).

---

## Workspace layout

```
apps/
  web/     Next.js marketing + sign-in     (port 3000)
  app/     Next.js authenticated app       (port 3001)
  fenix/   Loop observation dashboard      (port 3002)
  api/     Optional Python FastAPI sidecar (port 8000)
packages/
  ui/      shadcn primitives + theme — the SINGLE UI source
  auth/    BetterAuth wrapper
  db/      Kysely + Neon
  email/   Resend + React Email
  storage/ R2 via S3 SDK
  domain/  DDD bounded contexts
  config/  Shared TypeScript + Biome configs
docs/
  STACK.md       Locked stack picks + doc tier per concern
  features/*.md  Optional rich PRDs per feature
.planning/
  research/      MARKET, COMPETITORS, BRAND, shadcn-theme.css, TECH
  FEATURES.md
  design/        Pencil briefs + feedback histories per version
  phases/<NN-slug>/
    PLAN.md       (frontmatter pins CONTRACT_COMMIT_SHA + CHECKS_COMMIT_SHA)
    COMPLETION.md (on green)
    .artifacts/   gate JSON, screenshots, diff PNGs, reviewer transcripts
  sign-offs/<YYYY-Qn>.md  quarterly batch of human-only items
  fenix.db       SQLite read model for apps/fenix (gitignored)
pens/
  <version>.pen          git-tracked; vN.pen is `git mv` of v(N-1).pen
  exports/<version>/*.png
USER_IDEA.md
fenix.config.ts          profile, ports, dev-seed, gate flags, tolerances
```

---

## Locked stack

| Concern | Pick |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | Bun 1.3+ |
| Monorepo | Turborepo |
| Auth | BetterAuth + org plugin |
| Database | Neon Postgres + Kysely |
| Email | Resend + React Email |
| Storage | Cloudflare R2 (S3 SDK) |
| UI | shadcn/ui + Tailwind v4 + Geist (`packages/ui` — single source) |
| i18n | next-intl |
| Testing | Vitest + Storybook 10 + Playwright + axe |
| Format + Lint | **Biome only** (no ESLint) |
| Git hooks | Lefthook |
| Observability | Sentry (errors) + PostHog (analytics + flags + replay) |
| Background jobs | Vercel Workflows |
| Rate limit | Upstash Redis |
| Search | Postgres FTS → Meilisearch when scale demands |
| Payments (opt-in) | Stripe |
| LLM (opt-in) | Vercel AI SDK + Vercel AI Gateway |
| Geocoding (opt-in) | Mapbox |
| Deployment | Vercel |

Full table with doc-source tiers in `docs/STACK.md`. The
`fenix-tech-researcher` agent **only researches non-locked concerns**
specific to your features; the picks above are not re-researched.

---

## Useful commands

### Loop control

```bash
bun run fenix:status            # snapshot: latest event, phases, gates
bun run fenix:phases            # list phases
bun run fenix:events --limit 50 # tail recent events
bun run fenix:approve --stage research --signer you@example.com
bun run fenix:feedback --version mvp --change "tighten hero"
bun run fenix:rehydrate         # rebuild .planning/fenix.db
```

### Gates (per phase)

```bash
bun run phase:gate --phase 03-billing            # full 8-gate stack
bun run phase:gate:coverage --phase 03-billing   # gate 2 only (HARD)
bun run phase:gate:visual   --phase 03-billing   # gate 5 (HARD)
bun run phase:gate:pen-drift --phase 03-billing  # gate 4 (HARD)
```

### Standard development

```bash
bun run dev          # turbo dev — runs all apps
bun run validate     # typecheck + lint + format + vitest + storybook
bun run e2e          # Playwright across all apps
bun run build        # turbo build
```

---

## Documentation

- `CLAUDE.md` — full Fenix loop spec (read this first if you're contributing)
- `docs/STACK.md` — locked stack picks + per-concern doc hierarchy
- `.claude/agents/*.md` — the 16 subagent definitions
- `.claude/commands/*.md` — the user-facing slash commands

---

## License

MIT
