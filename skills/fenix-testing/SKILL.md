# Fenix Testing

Every feature you build must be testable. Follow these testing rules.

## Testing Layers

### 1. Storybook + Vitest (Every Task)
The primary verification surface. Runs on every `bun run validate`.

**Screen Stories** (`_components/screen.stories.tsx`):
- Every screen MUST have a story file co-located in `_components/`
- Include stories for: default state, empty state, loading state, error state
- Pass realistic mock data as typed props
- Use `fn()` from `storybook/test` for action handlers
- No auth mocking needed — screens are pure props

**Component Stories** (`_components/*.stories.tsx`):
- Every route-specific component MUST have a co-located story
- Include: default state, key variants, interactive states
- Reusable `components/ui/` components also get stories

**Example Screen Story:**
```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'
import DashboardScreen from './screen'

const meta = {
  title: 'Screens/Dashboard',
  component: DashboardScreen,
  args: {
    userName: 'Dev User',
    projects: [],
    onCreateProject: fn(),
  },
} satisfies Meta<typeof DashboardScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { projects: [] },
}

export const Loading: Story = {
  args: { isLoading: true },
}
```

### 2. Playwright E2E (End of Phase)
Written during implementation, run at the end of each GSD phase.

- E2E tests live in `apps/app/e2e/` and `apps/web/e2e/`
- Use dev auth credentials to sign in:
  - Email: `dev@fenix.local`
  - Password: `dev-password-123`
- The dev user is auto-seeded in development via `instrumentation.ts`
- Auth setup in `e2e/auth.setup.ts` saves storage state for reuse
- Test that routes load, key elements are visible, interactions work

**Example E2E Test:**
```ts
import { test, expect } from '@playwright/test'

test('dashboard loads for authenticated user', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
})
```

## Storybook Configuration

- Web stories: `components/**/*.stories.@(ts|tsx)` + `app/**/_components/**/*.stories.@(ts|tsx)`
- App stories: same pattern
- Web Storybook: port 6006
- App Storybook: port 6007

## Validation Commands

- `bun run validate` — typecheck + format check + lint + Storybook/Vitest tests
- `bun run e2e` — Playwright E2E tests (requires dev server or uses webServer config)
- `bun run build` — build all apps
- `bun run typecheck` — TypeScript type check all apps
- `bun run test` — run all tests

## Pre-Commit Hooks (Lefthook)

Pre-commit (parallel):
1. `biome format --write` on staged TS/TSX/JSON files
2. `turbo lint` across all apps
3. `turbo typecheck` across all apps

Pre-push:
1. `turbo build`
2. `turbo test`

## Quality Rules

- Run `bun run validate` before committing
- Automated check failure = blocking — fix issues, don't skip
- Never bypass git hooks (`--no-verify`)
- No stubs, placeholders, or TODO comments — implement fully or document as future work
- Commit format: `feat(<context>): description`
