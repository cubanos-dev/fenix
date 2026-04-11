# Phase <ID>: <Title> — Completion Report

> Fill every slot. Empty slots mean the phase is not done.

## Final diff stats

```
$ git diff --shortstat main..HEAD
<paste output>
```

## Coverage report

```json
$ bun run coverage:audit --phase <id> --json
<paste output — must show verdict: "green">
```

## Reviewer verdict

```json
<paste phase-reviewer JSON output — verdict must be "done">
```

## Browser-verify evidence

- Golden path walked: `<describe flow>`
- Screenshots: `<paths or attached>`
- Console error summary: `<"none" or list>`
- Tool used: `agent-browser-verify` skill / manual

## Visual diff

- `bun run pen:drift --since main` — `<clean | list of stories flagged>`
- `bun run visual:diff --all` — `<pair count | note>`

### Accepted deviations

- `<story path>` vs `<pen path>` — reason: `<why the pixel-perfect match was waived>`

## Closing commit

- SHA: `<fill after commit>`
- Message: `feat(<phase-id>): <short description>`
