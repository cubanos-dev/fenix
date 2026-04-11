# `components/ui/fenix/` — project overrides over shadcn primitives

This directory holds project-specific wrappers around the vanilla shadcn
primitives in `components/ui/*`. The convention is simple:

- **`components/ui/*`** — shadcn source. Never modify. Safe to refresh with
  `npx shadcn@latest add`.
- **`components/ui/fenix/*`** — project overrides. Apply project-specific
  styling on top of the shadcn base.
- **App code must import from `@/components/ui/fenix/*`** when an override
  exists, otherwise from `@/components/ui/*` directly.

## When to add an override

Only when a component needs project-specific styling that the theme tokens
alone cannot express (for example, a primary-coloured active state instead of
the default muted background). Do not pre-wrap components that do not need
changes — the directory should stay empty until a real override appears.

## Naming

Each override re-exports a PascalCased wrapper that imports the shadcn base and
applies the project diff via `cn()`:

```tsx
// components/ui/fenix/toggle.tsx
'use client'

import { Toggle as BaseToggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'

export function FenixToggle({ className, ...props }: React.ComponentProps<typeof BaseToggle>) {
  return (
    <BaseToggle
      className={cn('data-[state=on]:bg-primary data-[state=on]:text-primary-foreground', className)}
      {...props}
    />
  )
}
```

## Scaffolder rename

When a project is scaffolded via `bun create cubanos-dev/fenix <project>`, this
directory is renamed to `components/ui/<project>/` and every import specifier
is updated to match. The override convention itself stays the same.
