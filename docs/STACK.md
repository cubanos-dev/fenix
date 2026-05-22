# Stack (locked) — Fenix gold-standard

> Picks for every locked concern in a Fenix project. The `fenix-tech-researcher`
> agent only researches **non-locked** concerns specific to a project's
> features (e.g. SMS, document signing, geo-fencing). Locked components below
> are never re-researched per project.
>
> **Docs hierarchy** per concern: tier 1 (provider's own MCP) → tier 2
> (Context7) → tier 3 (WebSearch). Agents must consult tier 1 first; only
> fall back when the higher tier doesn't cover the question.

## Framework + runtime

| Concern | Pick | Doc source (tier 1 → 3) |
|---|---|---|
| Web framework | Next.js 16.2.0 (App Router) | Vercel/Next docs → Context7 |
| Runtime | Bun 1.3+ | Bun docs → WebSearch |
| Monorepo | Turborepo 2.5+ | Turbo docs → Context7 |
| Deployment | Vercel | Vercel CLI + docs |
| Domains | Multi-app (web/app/fenix) | Vercel docs |

## Auth + data

| Concern | Pick | Doc source |
|---|---|---|
| Auth | **BetterAuth** + org plugin | **BetterAuth MCP (always-on)** |
| Database | **Neon Postgres** + Kysely | Neon MCP → Context7 |
| Email | Resend + React Email | Resend docs → Context7 |
| Storage (S3-compatible) | Cloudflare R2 via S3 SDK | AWS SDK docs → Context7 |

## UI

| Concern | Pick | Doc source |
|---|---|---|
| Primitives + theme | shadcn/ui in `packages/ui` (the **single** UI source) | shadcn docs → Context7 |
| Styling | Tailwind v4 (CSS-driven, `@theme` directive) | Tailwind docs → Context7 |
| Fonts | Geist Sans + Geist Mono | next/font/google |
| i18n | next-intl (en-US, es-ES default) | next-intl docs → Context7 |

## Quality

| Concern | Pick | Doc source |
|---|---|---|
| **Format + Lint** | **Biome ONLY** (one linter, one config) | Biome docs |
| Unit/component tests | Vitest + Storybook 10 | Vitest + Storybook docs → Context7 |
| E2E tests | Playwright | Playwright docs → Context7 |
| Agent browser-drive | `@playwright/mcp` (always-on) | Playwright MCP docs |
| a11y | axe via `@storybook/addon-a11y` | axe docs → Context7 |
| Git hooks | Lefthook | Lefthook docs |

## Observability

| Concern | Pick | Doc source |
|---|---|---|
| Errors | **Sentry** | Sentry MCP if exists → Sentry docs |
| Analytics + flags + replay | **PostHog** (one tool, three jobs) | PostHog MCP if exists → docs |

## Infra

| Concern | Pick | Doc source |
|---|---|---|
| **Background jobs / durable workflows** | **Vercel Workflows** | Vercel docs |
| Rate limiting + pub/sub | **Upstash Redis** + `@upstash/ratelimit` | Upstash docs → Context7 |
| Search | Postgres full-text → Meilisearch when scale demands | Postgres docs → Context7 |

## Opt-ins (configured by `/fenix-init` based on user answers)

| Concern | Pick | Doc source |
|---|---|---|
| Payments | **Stripe** | **Stripe MCP** → Stripe docs |
| LLM | **Vercel AI SDK + Vercel AI Gateway** (unified provider routing) | Vercel AI docs |
| Geocoding | Mapbox | Mapbox docs → Context7 |

## MCP install sets

`/fenix-init` writes these to `.claude/settings.json` based on the project's opt-ins.

**Always-on:**
- Pencil MCP (read pens; tier 1 design source)
- Playwright MCP (`@playwright/mcp`)
- Context7 MCP (`@upstash/context7-mcp`)
- BetterAuth MCP (tier 1 for auth — pinned reading source for any auth code)

**Conditional (opt-in via `/fenix-init`):**
- Stripe MCP — if payments
- PostHog MCP — if released (when this doc is read, check `posthog/mcp`)
- Sentry MCP — if released
- Vercel AI Gateway MCP — if LLM features and a Vercel MCP for it exists

## Anti-stack (explicitly NOT in Fenix)

- **ESLint** — Biome handles lint; one linter only
- **Trigger.dev** — replaced by Vercel Workflows (Vercel-native, no extra service)
- **Direct Anthropic SDK** — replaced by Vercel AI Gateway when LLM is opted in
- **Multiple `globals.css`** — one in `packages/ui`, all apps import it
- **Per-app shadcn install** — shadcn lives in `packages/ui` only; the CLI is
  configured via `packages/ui/components.json` aliases
- **Per-app `components/ui/<override>/` directories** — override pattern killed;
  app-specific custom components wrap `packages/ui` primitives inside
  `apps/<x>/components/`
