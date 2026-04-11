# Phase <ID>: Definition of Done

The non-negotiable checklist. A phase is not done until every item is checked and backed by a machine-checkable artifact — not prose.

- [ ] Every new screen has a Storybook story covering all states listed in `PLAN.md` → State enumeration.
- [ ] Every new pure function has a co-located unit test.
- [ ] Every new route has a Playwright E2E spec exercising the golden path.
- [ ] Pattern audit ran for every new symbol; findings cited in `PLAN.md` → Pattern audit findings.
- [ ] Simplify pass ran against the diff; duplication and dead code removed.
- [ ] `bun run coverage:audit --phase <id>` exits 0.
- [ ] `bun run phase:gate --phase <id>` exits 0 (runs pattern-audit, coverage, and `bun run validate`).
- [ ] `phase-reviewer` subagent voted `done` in a fresh context.
- [ ] `agent-browser-verify` skill exercised the golden path in a real browser with no console errors.
- [ ] `bun run pen:drift --since main` is clean, or every flagged story is documented as an accepted deviation in `COMPLETION.md`.
- [ ] `bun run visual:diff --all` pairs reviewed; accepted deviations recorded in `COMPLETION.md`.
- [ ] `COMPLETION.md` written with evidence (coverage JSON, reviewer JSON, browser screenshots, diff stats).
- [ ] Closing commit message begins with `feat(<phase-id>):` or explicit phase marker.
