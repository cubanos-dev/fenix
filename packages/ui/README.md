# @fenix/ui

Shared React UI primitives consumed by every Next.js app in the monorepo.

## What's in here

Layout primitives and a minimal set of shadcn-style components built on Radix, Sonner, and Tailwind CSS v4.

- `AppShell`, `Sidebar` (with `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarNav`, `SidebarNavItem`), `PageHeader`
- `Button`, `Card`, `Input`, `Dialog`, `Toaster`
- `cn()` class-merging utility
- `tokens.css` — Tailwind v4 `@theme` variables (neutral defaults; apps can override)

## Installation

Already wired as a workspace dependency in `apps/app` and `apps/web`:

```json
{
  "dependencies": {
    "@fenix/ui": "workspace:*"
  }
}
```

## Usage

Import components from the barrel or from individual subpaths:

```tsx
import { Button, Card, PageHeader } from '@fenix/ui/components'
import { Dialog, DialogContent, DialogTitle } from '@fenix/ui/components/dialog'
import { cn } from '@fenix/ui/lib/cn'
```

Wire the default theme tokens once in your app's global stylesheet:

```css
@import 'tailwindcss';
@import '@fenix/ui/styles/tokens.css';
```

Override any token in your app's own CSS after the import — the generic defaults exist only so `@fenix/ui` components render without configuration.

## Adding a new component

1. Create `src/components/<name>.tsx`. Use `cn()` for class merging and the shared tokens for colors/radii.
2. Re-export from `src/index.ts`.
3. Add a new entry to `exports` in `package.json` under `./components/<name>`.
4. Run `bun install` from the repo root so workspaces relink.

Keep components presentational — no data fetching, no app-specific state. Route-specific components belong in the consuming app, not here.
