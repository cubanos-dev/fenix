# Phase Start — intake, plan, pattern audit

Kick off a phase by reading the pen inventory, drafting PLAN.md with verbatim notes, and running the pattern audit. **No production code yet.**

## Usage

```
/phase-start <phase-id>
```

Example: `/phase-start 01-foundation`

## What this does

### Step 1: Locate or create the phase directory

Look for `.planning/phases/<phase-id>/`. If missing:

1. Copy `.planning/phases/_template/` into `.planning/phases/<phase-id>/`.
2. Fill in the phase title and ID in `PLAN.md`.

### Step 2: Read pen inventory for every frame in scope

For each frame referenced by the plan (by section + screen name):

1. Read the matching `pens/inventory/<section-slug>.md` file.
2. Copy the note block into `PLAN.md` under **"Verbatim pen notes"** — **verbatim**, exactly as it appears. Do not paraphrase. Do not re-order sentences. Do not "clean up" punctuation.
3. Copy the `@pen <png-path>` reference line so later steps can cite it.

If `pens/inventory/` is missing or stale, run `bun run pen:extract` first and follow the instructions it prints.

### Step 3: Enumerate state variants per screen

For every screen in scope, list the states the UI must render:

- Default
- Loading
- Error
- Empty
- Any edge states the pen notes describe (e.g., "not-signed-in", "read-only", "offline")

Write these into `PLAN.md` under **"State enumeration"**.

### Step 4: Draft data shapes

Sketch the TypeScript types the screens need (props, API responses, form state). Place them under **"Data shapes"** in `PLAN.md`. Types are contracts — later steps verify them.

### Step 5: Run the pattern audit

For each symbol you plan to introduce (fn name, component name, hook name):

```
bun run pattern:audit --symbol <name> --json
```

Then cite every finding in `PLAN.md` under **"Pattern audit findings"** in the table:

| Symbol | Existing candidate | Decision |
|--------|--------------------|----------|
| `cn`   | `packages/ui/src/lib/cn.ts` | reuse |

If the audit returns candidates, the default answer is **reuse**. If you choose not to reuse, explain why in the Decision column. The point is to make reuse visible, not to force it.

### Step 6: Write acceptance criteria

Write machine-checkable acceptance criteria under **"Acceptance criteria"**. Each bullet should be something a test or a gate can verify.

## Guardrails

- **Do not touch production code** during phase-start. This is an intake step.
- **Verbatim means verbatim.** If the pen note says "click the save bvutton" (typo included), PLAN.md carries the typo. Notes are spec, not prose to polish.
- **No design decisions without a pen note or a pattern audit.** Unsourced decisions are how drift happens.
