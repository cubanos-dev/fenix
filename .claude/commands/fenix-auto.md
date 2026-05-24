---
description: Fenix autonomous loop dispatcher. Subcommands: research | design <version> | tech | phases <version> | build <phase|version> [--auto] | status | feedback. After /fenix-init, this is the only command the user runs.
argument-hint: <research|design|tech|phases|build|status|feedback> [args]
allowed-tools: Task, Bash(bun *), Bash(git *), Read, Edit
---

# `/fenix-auto` — orchestrator

You dispatch one of seven subcommands. Each stage is implemented by spawning the right subagent(s) via the **Task tool** (their definitions live in `.claude/agents/`), parsing their JSON exit, writing events to `.planning/fenix.db` via the `bun run fenix:*` helper, and honoring STOP-confirm gates.

**The orchestrator is *you* — Claude in this session.** The `.claude/scripts/fenix-auto.ts` helper is deterministic state plumbing only; it does not spawn agents.

## Argument parsing

The first positional argument is the subcommand. Subsequent positionals + `--flags` are subcommand-specific. If `$ARGUMENTS` is empty, print the summary below and stop.

```
research                            (no args)
design   <version>                  e.g. design mvp, design v1
tech                                (no args)
phases   <version>
build    <phase|version> [--auto]
status                              (no args)
feedback <args>                     pass-through to bun run fenix:feedback
```

## Pre-flight on every invocation

1. Verify `.planning/fenix.db` exists. If missing, run `bun run fenix:init-db`. (This is recovery — `/fenix-init` should have done it.)
2. Append a `dispatch-start` event:
   ```
   bun run fenix:event orchestrator dispatch-start --payload '{"sub":"<sub>","args":<JSON of args>}'
   ```
3. Run `bun run fenix:status --json` and read the snapshot so you know what's already done. Use it to enforce stage ordering.

---

## Subcommand: `research` (Stage 1 — idea validation)

**Stage ordering check:** require `USER_IDEA.md` to exist and be non-template. If not, refuse with "run /fenix-init first".

**Pre-flight: ensure `.impeccable.md` exists.** The brand-agent halts without it. Check:

1. If `.impeccable.md` exists at repo root, proceed.
2. Else if `docs/PRODUCT.md` exists and is non-template, invoke the impeccable skill: `Skill(skill="impeccable", args="teach")`. This reads `docs/PRODUCT.md` and produces `.impeccable.md`. Commit it: `chore(design): teach impeccable from PRODUCT.md`.
3. Else refuse: "Fill `docs/PRODUCT.md` (brand voice, audience, aesthetic direction, anti-references) before running `/fenix-auto research`. The design pipeline needs an explicit taste contract."

If the `impeccable` skill itself isn't installed, refuse with: "Run `claude skills install pbakaus/impeccable` first (fenix-init was supposed to handle this — check the `impeccable_installed` field in the last init JSON)."

**Parallel work — spawn three subagents in a single message with three Task tool calls**:
- `subagent_type="fenix-researcher"` with prompt `--target=market` → writes `.planning/research/MARKET.md`
- `subagent_type="fenix-researcher"` with prompt `--target=competitors` → writes `.planning/research/COMPETITORS.md`
- `subagent_type="fenix-brand-agent"` → reads `.impeccable.md`, writes `BRAND.md` + `shadcn-theme.css`, runs impeccable `audit`/`critique`, syncs theme to `packages/ui/src/styles/globals.css`

For each: pass the `--target=...` (or `--mode=...`) flag in the prompt followed by "Run per your agent definition; emit the JSON exit contract to stdout." Wait for all three to return.

**Sequential synthesizer** — spawn `fenix-features-synthesizer` once the three above are green. It reads MARKET + COMPETITORS + BRAND and writes `.planning/FEATURES.md`.

**Per-agent event writes** as each returns:
```
bun run fenix:event research <agent-name>-completed --payload '<their JSON exit>'
```

**STOP-confirm at end:**
1. Append `bun run fenix:event research stop-pending`.
2. Tell the user:
   > Stage 1 research complete. Review `.planning/research/{MARKET,COMPETITORS,BRAND}.md` + `shadcn-theme.css` + `.planning/FEATURES.md` (or open the Fenix UI at localhost:3002 once it's built). When ready, approve with `bun run fenix:approve --stage research --signer <your-email>`, then run `/fenix-auto design mvp`.
3. **Exit** — do not proceed to design until the next invocation. `/fenix-auto design <v>` will verify approval via `bun run fenix:check-approval --stage research` before proceeding.

---

## Subcommand: `design <version>` (Stage 2 — miniLoopDESIGN)

**Stage ordering check:** `bun run fenix:check-approval --stage research`. If pending, refuse.

**Version rules:**
- `mvp`: fresh design. Pen target = `pens/mvp.pen`.
- `vN` (N ≥ 1): if `pens/v<N-1>.pen` exists and `pens/vN.pen` does not, run `git mv pens/v<N-1>.pen pens/vN.pen && git commit -m "chore(design): start <version> from v<N-1>"` first. Then iterate via `pencil --in pens/vN.pen`.

**Subagent sequence:**
1. `subagent_type="fenix-design-planner"` → writes `.planning/design/<version>-brief.md`.
2. `subagent_type="fenix-design-runner"` with **one** of these modes in the prompt:
   - `--mode=author` for `version=mvp`
   - `--mode=iterate-from-prior` for `version=vN` (N ≥ 1) on the first pass of that version
   - `--mode=feedback` when pending feedback rows exist for this version (see Feedback loop below)
3. **STOP-confirm**: tell the user where to look at exports (`pens/exports/<version>/`) and how to approve / give feedback:
   - Approve: `bun run fenix:approve --stage design:<version>`
   - Feedback: `bun run fenix:feedback --version <version> --change "…" --why "…"`

**Feedback loop:** if `bun run fenix:status --json` shows pending feedback rows for this version on the next invocation, materialize them into `FEEDBACK.md` at repo root (one block per pending row in the schema the agent expects), then spawn `subagent_type="fenix-design-runner"` with `--mode=feedback`. Loop until approval lands.

**On approval:** record version row, commit pen state with `feat(design): <version> approved by user`, append event `design <version>-approved`.

---

## Subcommand: `tech` (Stage 3 — informed tech research)

**Stage ordering check:** at least one design version must be approved (`bun run fenix:check-approval --stage design:mvp` or higher).

**Single subagent:**
- `subagent_type="fenix-tech-researcher"` → reads `docs/STACK.md` (locked picks; not re-researched) + `FEATURES.md` + the latest approved pen; writes `.planning/research/TECH.md` covering only non-locked concerns.

**STOP-confirm at end:**
- Tell the user where to review (`.planning/research/TECH.md`); approve with `bun run fenix:approve --stage tech`.

---

## Subcommand: `phases <version>` (Stage 4 — phase breakdown)

**Stage ordering check:** `bun run fenix:check-approval --stage tech` AND `bun run fenix:check-approval --stage design:<version>`.

**Single subagent:**
- `subagent_type="fenix-phaser"` → reads `pens/<version>.pen` + `FEATURES.md` filtered to this version; writes one `.planning/phases/<NN-slug>/PLAN.md` skeleton per feature with all three state-enum subsections (`happy_path_states`, `non_happy_path_states`, `edge_cases`) left empty for the contract author to fill.

**vN+ rule:** only `diff(vN.pen, v(N-1).pen)` features get new phases. Existing phases are not touched.

**After:** run `bun run fenix:rehydrate` so the SQLite read model picks up the new PLAN.md rows. Then tell the user the next command is `/fenix-auto build <version> --auto` (or per-phase `/fenix-auto build <phase-id>`).

---

## Subcommand: `build <phase|version> [--auto]` (Stage 5 — miniLoopDEV)

**The heart of the loop.** Implements one phase end-to-end through CONTRACT → DEFINE_CHECKS → IMPLEMENT (A/B/C) → VALIDATE → PUBLISH.

**Argument resolution:**
- If the arg looks like a phase id (`<NN-slug>`), build that one phase.
- If it's a version (`mvp`, `v1`, …) AND `--auto`, iterate every unstarted phase in that version in lex order with a **30-second ctrl-c window** between phases.
- If it's a version without `--auto`, build just the first unstarted phase, then stop.

**Per-phase pipeline (run each step, do not parallelize across steps):**

### 5a. CONTRACT
```
bun run fenix:phase-update --id <phase> --status contract --started
```
Spawn `subagent_type="fenix-contract-author"` with the phase id. It fills Golden Path + all three State Enumeration subsections + Acceptance JSON, then commits PLAN.md (`feat(<phase>): contract authored`). Parse its JSON exit; if it halts on ambiguity, surface the question to the user and stop. Otherwise record the SHA:
```
bun run fenix:phase-update --id <phase> --contract-sha <sha>
bun run fenix:event build contract-done --phase <phase> --payload '<JSON>'
```

### 5b. DEFINE_CHECKS
```
bun run fenix:phase-update --id <phase> --status checks
```
Spawn `subagent_type="fenix-checks-author"`. It generates one Storybook story per state (with `@state-id` + `@pen` JSDoc tags), unit tests per `kind:unit` acceptance, axe assertions per `kind:a11y`, and Playwright spec stubs per `kind:browser`. **All check files commit in a single pinned commit** titled `chore(<phase>): pin checks before implementation`. Record the SHA:
```
bun run fenix:phase-update --id <phase> --checks-sha <sha>
bun run fenix:event build checks-pinned --phase <phase> --payload '<JSON>'
```

This SHA is the X_PASS_X anchor. Lefthook's `fenix-pin-checks` job (Stream D) enforces it from here forward.

### 5c. IMPLEMENT (sub-phases A → B → C, sequential)

For each sub-phase, set status (`implement-a`, `implement-b`, `implement-c`) via `bun run fenix:phase-update --id <phase> --status …`. Spawn `subagent_type="fenix-builder"` with the sub-phase letter and a max-retry budget of 3 (read from `fenix.config.ts`).

- **A** — happy path implementation. Builder drives `@playwright/mcp` along the Golden Path until every `happy_path_states` snapshot matches.
- **B** — state variants. Builder drives the app to each `non_happy_path_states` and verifies the story renders.
- **C** — edge cases. Unit/component tests pass.

On 4th failure inside a sub-phase: surface diagnostic JSON; phase enters `halted` status; stop.

### 5d. VALIDATE
```
bun run fenix:phase-update --id <phase> --status validate
bun run phase:gate --phase <phase>     # Stream D delivers this script
```
The 8-gate stack (pattern:audit, coverage:audit, validate, pen:drift, visual:diff --all, slop:test, phase-reviewer, agent-browser-verify) runs in order. Each gate writes `.planning/phases/<phase>/.artifacts/<gate>.json` and reports via `bun run fenix:gate-record --phase <phase> --name <gate> --status <s> --json-path <path>`. On any HARD failure: phase enters `halted`; surface the JSON; stop.

Until Stream D ships `phase:gate`, you can call the individual gate scripts directly or skip validate (set the phase status manually) — but production runs require all hard gates.

### 5e. PUBLISH

```
bun run fenix:phase-update --id <phase> --status publish
bun run scripts/fenix-publish.ts --phase <phase> [--pr]
```

`fenix-publish.ts` is deterministic — no subagent. It reads PLAN.md + every gate JSON, renders `COMPLETION.md`, commits `feat(<phase>): <goal>`, refreshes `.planning/fenix.db`, and (with `--pr`) opens a PR. It defensively asserts `phase-reviewer.verdict == done` and `agent-browser-verify.verdict == pass` before writing — if either is missing or red, it exits non-zero, which means the gate stack let you through when it shouldn't have. On success, parse its JSON to stdout, then:

```
bun run fenix:phase-update --id <phase> --status green --finished
bun run fenix:event build phase-green --phase <phase> --payload '<JSON>'
```

**Lesson harvest (inline — replaces the prior publisher's reasoning step):** before announcing the phase green, scan `.planning/phases/<phase>/.artifacts/*.json` for non-obvious takeaways — phase-reviewer rejection rationales, gates that flipped fail→pass across builder retries, recurring user feedback. For each genuine lesson (default: zero), call `bun .claude/scripts/fenix-auto.ts lessons-propose --scope <agent:|gate:|stage:|loop> --category <state-coverage|tolerance|slop|pattern|quality|feedback-fit|infra> --severity <one-off|recurring|pattern> --title "…" --phase <phase> --evidence <path> --body-file /tmp/lesson-body.md`. Quality beats quantity — file nothing if nothing stood out. Surface proposed lessons in your stdout summary; promotion to `applied` is a human review step.

### Multi-phase `--auto` handoff

After PUBLISH on phase N, if `--auto` and there are unstarted phases left:
1. Announce: "Phase `<N>` green. Phase `<N+1>` starts in 30 seconds — `ctrl-c` to halt."
2. **Wait 30 seconds.**
3. Begin the next phase.

Stop after the last phase or when the user halts.

---

## Subcommand: `status`

Shell out: `bun run fenix:status`. Pipe stdout to the user verbatim. Add a one-line interpretation: "Next: `<command>`" based on which approval is the next missing one.

## Subcommand: `feedback`

Pass-through. Read the user's free-form args; require `--version` and `--change`; shell out to `bun run fenix:feedback`. Tell the user "Recorded — run `/fenix-auto design <version>` to iterate."

---

## Failure handling across all stages

- **Subagent emits `status: error`**: surface their reason + halted-question verbatim. Append `bun run fenix:event <stage> agent-error --payload '<their JSON>'`. Stop.
- **Bash command fails**: surface stderr; stop. Do not retry destructive ops automatically.
- **Approval missing**: refuse with the exact command the user needs to run.

## What `/fenix-auto` does NOT do

- It does not bypass STOP-confirm gates.
- It does not modify check files during IMPLEMENT (lefthook's `fenix-pin-checks` would reject the commit anyway).
- It does not auto-merge or auto-push.
- It does not run on a non-clean working tree without surfacing that first.

## Open args block

`$ARGUMENTS`
