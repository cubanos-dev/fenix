---
description: Interactive scaffolder — the one command the user runs before the autonomous loop begins. Walks 7 questions, writes USER_IDEA.md, renames @fenix/* packages to @<project>/*, configures MCPs, scaffolds apps/fenix + .planning/fenix.db, makes the initial commit.
argument-hint: (no args — interactive)
allowed-tools: Task, Bash(bun *), Bash(git *), Read, Edit
---

# `/fenix-init`

You are running the **one-and-done scaffolder** that prepares a fresh Fenix project for the autonomous loop. After this finishes, the user runs `/fenix-auto research` and never touches scaffolding again.

## Pre-flight (do these first)

1. **Refuse on a project that's already initialized.** If `USER_IDEA.md` already has content (not the template stub — actual user answers), tell the user `/fenix-init` is idempotent-refusing and exit. Detection rule: the audience heading is non-empty AND not equal to the template placeholder.
2. **Refuse outside a git repo.** Run `git rev-parse --is-inside-work-tree` via Bash; abort with a clear message if not inside one.
3. **Initialize the SQLite read model.** Run `bun run fenix:init-db` so the loop's event log exists from the start.

## The work

Delegate the actual interactive flow to the `fenix-init` subagent:

```
Use the Task tool with subagent_type="fenix-init"
prompt: "Run the /fenix-init scaffolder per your agent definition. Ask the seven questions in order, write USER_IDEA.md verbatim, rename @fenix/* packages to @<project>/*, write docs/STACK.md filtered to opt-ins, update .claude/settings.json MCPs, scaffold apps/fenix skeleton, make the initial commit. Emit the JSON exit contract to stdout."
```

The subagent owns the questions, the validation, the renames, and the initial commit. **Do not duplicate that work here.** The slash command's only jobs are pre-flight checks (above) and post-flight bookkeeping (below).

## Post-flight (after the subagent returns)

1. **Parse the subagent's JSON exit.** It looks like:
   ```json
   { "status": "ok", "project_name": "…", "opt_ins": { … }, "next_command": "/fenix-auto research" }
   ```
2. **Write an init event** to the loop's event log:
   ```
   bun run fenix:event init project-initialized --payload '<the JSON above>'
   ```
3. **Tell the user**: "Project `<name>` scaffolded. Next: `/fenix-auto research`."

## Failure modes

- If the subagent returns `{ "status": "error", "reason": …, "halted_question": … }`:
  - Surface the reason and the halted question verbatim.
  - **Do not** record an event (the project isn't initialized).
  - Suggest the user re-run `/fenix-init` once they have the answer ready.

- If the subagent times out (`Task` returns an error): tell the user the scaffolder didn't complete; suggest re-running.

## What `/fenix-init` does NOT do

- It does not run research, design, tech, phases, or build. Those are `/fenix-auto` stages.
- It does not install dependencies beyond what's already in the template's `bun.lock`.
- It does not push to a remote.
- It does not prompt the user about locked stack picks (Next.js, BetterAuth, Neon, Resend, R2, etc.). Only opt-ins (Stripe, AI Gateway, Mapbox) are surfaced.
