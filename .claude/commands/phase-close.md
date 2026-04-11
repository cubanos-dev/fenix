# Phase Close — run the hard gates and write COMPLETION.md

Close a phase only when every gate is green. The gate script refuses to proceed past a failure — fix the cause and re-run.

## Usage

```
/phase-close <phase-id>
```

## What this does

### Step 1: Run the gate script

```
bun run phase:gate --phase <phase-id>
```

This runs, in order:

1. **pattern-audit** — informational. Cited in PLAN.md.
2. **coverage-audit** — hard. Blocks if any new screen / route / pure fn is missing its story / E2E / unit test.
3. **bun run validate** — hard. Typecheck + format + lint + Storybook/Vitest unit run.

If any hard gate fails: stop, fix the root cause, re-run. **Do not paper over a failure** — the point of the gate is to force fixes, not to invent waivers.

### Step 2: Invoke `phase-reviewer`

Once the gate script is green, invoke the `phase-reviewer` subagent with:

- Phase diff: `git diff main..HEAD -- <phase-scoped paths>`
- `.planning/phases/<phase-id>/PLAN.md`
- `.planning/phases/<phase-id>/DEFINITION-OF-DONE.md`

The reviewer runs in a fresh context and returns JSON: `{ verdict, blockers, suggestions }`. If the verdict is not `"done"`, fix the blockers and re-run from Step 1.

### Step 3: Browser-verify

Invoke the `agent-browser-verify` skill against the golden path for this phase:

1. Open the app's dev server.
2. Click through the flow the phase delivered.
3. Screenshot each state.
4. Check the console for errors.

If the skill is unavailable, manually exercise the golden path in a browser and paste screenshots + a console-error summary into `COMPLETION.md`.

If this gate fails, stop — fix and re-run from Step 1.

### Step 4: Soft pen gates

```
bun run pen:drift --since main
bun run visual:diff --all
```

Both are soft gates. `pen:drift` flags stories whose referenced pen PNGs changed since `main`; list every flagged story in `COMPLETION.md` under **Accepted deviations** or fix the story. `visual:diff --all` prints every (story, @pen) pair it would compare; in M3 this is the scaffold — pixel-diff lands later.

### Step 5: Write `COMPLETION.md`

Use the template at `.planning/phases/_template/COMPLETION.md`. Fill every slot:

- Phase ID + title
- Final diff stats (`git diff --shortstat main..HEAD`)
- Coverage report (paste `bun run coverage:audit --phase <id> --json` output)
- Reviewer verdict + JSON
- Browser-verify evidence (screenshots + console summary)
- Visual-diff summary + list of accepted deviations
- Closing commit SHA (filled after commit)

### Step 6: Commit

Commit with a message that cites the phase ID in conventional-commit context form:

```
feat(<phase-id>): <short description>
```

The orchestrator handles the commit. **Only commit when every gate above is green.**

## Guardrails

- **No gate skipping.** The coverage gate exists because verse.church phases shipped broken when it didn't. Don't regress the starter.
- **No reviewer bypass.** The reviewer runs in a fresh context on purpose; self-review is the failure mode this gate prevents.
- **No browser-verify bypass.** "Tests pass" is not "feature works". The gate catches hydration errors, missing env vars, broken imports.
