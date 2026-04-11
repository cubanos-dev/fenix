# Phase <ID>: <Title>

## Goal

<One sentence. What this phase delivers to a user.>

## Scope

**In scope**
- <concrete deliverable>
- <concrete deliverable>

**Out of scope**
- <explicitly excluded thing that feels adjacent>

## Frames in scope

| Section | Screen | Pen export | Inventory file |
|---------|--------|------------|----------------|
| `<section-slug>` | `<screen-slug>` | `pens/exports/<section-slug>/<screen-slug>.png` | `pens/inventory/<section-slug>.md` |

## Verbatim pen notes

> **Rule**: quote pen notes exactly as they appear in the inventory file. Do not paraphrase, reorder, or "clean up" punctuation. Copy typos. The note is the spec; rewriting it breaks fidelity.

### `<section-slug>` — `<screen-slug>`

```
<paste the pen note here, verbatim>
```

## State enumeration

| Screen | States to render |
|--------|------------------|
| `<screen-slug>` | Default, Loading, Error, Empty, `<edge-state-from-note>` |

Every state in this column must have a Storybook story with the same name.

## Data shapes

```ts
// Paste the TypeScript types this phase introduces.
// These are contracts for the screen props, API responses, and form state.
```

## Pattern audit findings

Run `bun run pattern:audit --symbol <name>` for every new symbol before authoring.

| Symbol | Existing candidate | Decision |
|--------|--------------------|----------|
| `exampleFn` | `packages/domain/src/.../example.ts` | reuse |
| `NewThing` | _none_ | new — no existing match |

## Acceptance criteria

Machine-checkable only. If a human has to read prose to verify it, rewrite it.

- [ ] `apps/app/app/<route>/page.tsx` renders with status 200 for a seeded user.
- [ ] `Screen` story exports Default, Loading, Error, Empty (verified by Storybook test runner).
- [ ] `exampleFn(...)` returns the expected value for the cases listed in `TEST-CONTRACTS.md`.
- [ ] Playwright spec `apps/app/e2e/<route>.spec.ts` passes the golden path.
- [ ] `bun run coverage:audit --phase <id>` exits 0.
