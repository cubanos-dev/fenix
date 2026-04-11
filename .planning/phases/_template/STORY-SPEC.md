# Phase <ID>: Story Spec

One row per (screen, state). Each row maps to a Storybook story export.

| Screen | State | Story file | `@pen` reference | Notes |
|--------|-------|-----------|------------------|-------|
| `<screen-slug>` | `Default` | `apps/app/app/<route>/_components/screen.stories.tsx` | `pens/exports/<section>/<screen>.png` | — |
| `<screen-slug>` | `Loading` | same | same | show skeleton from design system |
| `<screen-slug>` | `Error` | same | same | error copy lives in `messages/*.json` |
| `<screen-slug>` | `Empty` | same | same | — |

## Rules

- Every row must resolve to a real file path after `/phase-spec` runs.
- The `@pen` reference is optional only if there is no pen export for the screen. When it exists, it is load-bearing: `bun run pen:drift` and `bun run visual:diff --all` parse it.
- Do not hand-write stories that do not appear in this table. Everything goes through the table.
