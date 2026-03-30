# Fenix Architecture

You are working in the Fenix monorepo. Follow these architecture rules strictly.

## Two-App Structure

- **`apps/web`** — Public website + sign-in page (port 3000)
- **`apps/app`** — Authenticated application (port 3001)
- **`apps/api`** — Python FastAPI service (port 8000)
- Shared packages: `@fenix/auth`, `@fenix/db`, `@fenix/email`, `@fenix/storage`

## Page / Screen / Component Pattern

Every route follows a three-layer architecture:

```
app/(main)/feature/
  page.tsx                    # Layer 1: Auth + data fetching
  _components/
    screen.tsx                # Layer 2: Pure props, renders UI
    screen.stories.tsx        # Storybook story
    feature-widget.tsx        # Layer 3: Route-specific component
    feature-widget.stories.tsx
```

### Page (`page.tsx`)
- Thin async Server Component
- Calls `requireSession()` for auth
- Fetches data via domain queries
- Passes typed props to Screen
- No UI logic — only auth and data wiring

### Screen (`_components/screen.tsx`)
- Receives ALL data as typed props
- Exports a typed props interface
- NEVER imports `@fenix/auth/client`, `@ai-sdk/react`, or any external service
- NEVER calls `requireSession()` or fetches data
- This is the primary Storybook testing surface

### Components (`_components/*.tsx`)
- Route-specific components used by the Screen
- Each gets a co-located story file
- Reusable components go in `components/ui/` (shadcn) or `lib/domain/<context>/components/`

## Server Components by Default

- All components are Server Components unless they need browser APIs or interactivity
- Only add `'use client'` when necessary — push it as far down the tree as possible
- Server Actions (`'use server'`) for mutations — use `lib/domain/<context>/actions.ts`
- Do NOT use Route Handlers for internal operations (only for public APIs)

## Domain-Driven Design

```
apps/app/lib/domain/
├── <context-name>/
│   ├── types.ts        — Domain types, aggregates
│   ├── actions.ts      — Server Actions ('use server')
│   ├── queries.ts      — Data fetching functions
│   └── components/     — Context-specific UI components
```

- Domain logic MUST stay in its bounded context directory
- No domain logic in route components or pages
- Reference `DOMAIN_MODEL.md` for bounded contexts and aggregates

## UI Stack

- **shadcn/ui** components — do not build primitives from scratch
- **Tailwind CSS v4** with OKLCH color system
- **Dark mode by default** for dashboards and AI surfaces
- **Geist Sans** for UI text, **Geist Mono** for code/metrics
- Use `cn()` from `@/lib/utils` for class merging
- AI text rendering: use `<MessageResponse>` from AI Elements (never raw strings)

## Import Conventions

- `@/*` — app-local imports
- `@fenix/*` — shared package imports
- `@/components/ui/*` — shadcn components

## Naming Conventions

- Components: PascalCase (`UserCard.tsx`)
- Screens: `screen.tsx` (scoped by route folder)
- Server Actions: camelCase verbs (`createProject`, `updateIssue`)
- Queries: camelCase with `get`/`list` prefix (`getProject`, `listIssues`)
- Types: PascalCase (`Project`, `Issue`)

## Route Protection

- `proxy.ts` (NOT `middleware.ts`) handles auth checks
- `apps/web` public paths: `/`, `/sign-in`, `/api/auth`
- `apps/app` public paths: `/api/auth` only — everything else requires session
- Unauthenticated app users redirect to web's sign-in page

## AI SDK v6

- Default to AI Gateway: `model: 'provider/model-name'`
- Use dots for version numbers in model slugs
- Server: `convertToModelMessages()` + `streamText()` + `toUIMessageStreamResponse()`
- Client: `useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`
- Render AI text with `<MessageResponse>` from AI Elements
- Use `inputSchema` (not `parameters`) and `outputSchema` (not `result`) for tool definitions

## i18n

- next-intl with en-US and es-ES locales
- Messages in `messages/en-US.json` and `messages/es-ES.json`
