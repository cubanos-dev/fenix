# @fenix/domain

Shared TypeScript types and pure domain functions. Zero framework dependencies — no React, no Next.js, no database client.

## What belongs here

- Bounded-context types (entities, value objects, events)
- Pure validation and construction helpers
- Domain events

Anything that reaches out to a runtime (db, http, filesystem, React) belongs in a different workspace.

## Bounded-context pattern

One folder per bounded context under `src/`. Each folder owns its aggregates, types, and pure functions, and re-exports a public surface from `index.ts`. The package root `src/index.ts` then re-exports each context.

```
src/
  index.ts        # re-exports every context
  user/
    index.ts      # public surface of the `user` context
  <new-context>/
    index.ts
```

## Adding a new context

1. Copy `src/user/` to `src/<new-context>/`.
2. Replace the example types with the new context's entities, events, and pure helpers.
3. Add `export * from './<new-context>'` to `src/index.ts`.
4. Add `"./<new-context>": "./src/<new-context>/index.ts"` to `exports` in `package.json` if you want a direct subpath import.

## Usage

```ts
import { type User, isValidEmail, createUserId } from '@fenix/domain'

if (!isValidEmail(raw)) {
  throw new Error('invalid email')
}

const id = createUserId(crypto.randomUUID())
```

Import from a specific context when you want to keep the surface narrow:

```ts
import { type UserId, userCreated } from '@fenix/domain/user'
```
