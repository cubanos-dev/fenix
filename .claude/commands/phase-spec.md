# Phase Spec — scaffold stories + test contracts

Generate Storybook story skeletons, unit test `.todo`s, and Playwright `.skip` E2Es from the phase plan. **No component implementation yet.**

## Usage

```
/phase-spec <phase-id>
```

## Prerequisite

`.planning/phases/<phase-id>/PLAN.md` exists with screens, states, data shapes, and verbatim pen notes filled in (run `/phase-start` first).

## What this does

### Step 1: Story meta per screen

For each screen listed in PLAN.md, create a Storybook meta file next to the screen's source (`_components/screen.tsx` → `_components/screen.stories.tsx`):

- One `Meta<typeof Screen>` export.
- One story per state from PLAN.md's **State enumeration** (Default, Loading, Error, Empty, edges).
- Each story's `args` reflect the data shape in PLAN.md.
- If an `@pen` reference exists for the screen, include it in the story's JSDoc:

```tsx
/**
 * @pen pens/exports/<section-slug>/<screen-slug>.png
 */
export const Default: Story = { args: { /* ... */ } }
```

The `@pen` tag is load-bearing: `bun run pen:drift` and `bun run visual:diff --all` both parse it.

### Step 2: Unit test `.todo`s per pure fn

For every pure function the plan calls out, create a co-located `*.test.ts` file with `.todo` cases:

```ts
import { describe, test } from 'vitest'

describe('calculateFoo', () => {
  test.todo('returns zero for empty input')
  test.todo('sums positive numbers')
})
```

The todos are the contract. Implementation fills them in.

### Step 3: Playwright `.skip` E2Es per route

For every new route in the plan, add an `e2e/<route>.spec.ts` file with `.skip` tests covering the golden path:

```ts
import { expect, test } from '@playwright/test'

test.skip('user can reach the dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
})
```

`.skip` means: "we know this exists and the flow is agreed; implementation flips `.skip` to a real test."

### Step 4: Update `STORY-SPEC.md` and `TEST-CONTRACTS.md`

Fill in the phase template files under `.planning/phases/<phase-id>/`:

- `STORY-SPEC.md` — row per (screen, state, story file path, @pen reference)
- `TEST-CONTRACTS.md` — unit test and E2E test tables

These are the single source of truth for the coverage gate.

## Guardrails

- **Do not implement components.** Stories should compile and render a stub placeholder; filling in the real UI is the `implement` step.
- **Do not inline pen notes into stories.** Stories cite `@pen <path>` only. The notes live in PLAN.md verbatim.
- **Every screen in PLAN.md needs a story.** Every state in the enumeration needs a story variant. No exceptions.
