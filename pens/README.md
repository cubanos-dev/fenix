# pens/

Pencil design files live here. Pen files are the source of truth for visual design — `globals.css`, component styles, and shadcn overrides are derived from the design system pen.

## Hosting options

The scaffolder (`bun run init`) offers three ways to wire up a pen file:

1. **In-repo** (default) — place your `app.pen` in this directory. Good for a single-project repo with a small team.
2. **Git submodule** — host the pen files in a separate repo and add this directory as a submodule. Good for sharing design tokens across multiple projects.
3. **Sibling directory** — keep the pen files in a sibling directory on disk and set `PENS_PATH=/abs/path` in `.env.local`. Good for a monorepo-of-monorepos or a designer-managed checkout.

If you pick "none yet" in the scaffolder you'll get a `.gitkeep` here and can drop in a pen file later.

## Extracting requirements from a pen

Once a pen file is in place, the phase flow can extract requirements (screens, features, flows — not visual design) from it:

```bash
bun run pen:extract
```

> Note: `pen:extract` is introduced in Theme H and may not exist yet on your branch. When it lands it will read the active pen file, produce a structured requirements block, and hand off to the plan/execute phases.

## See also

- `CLAUDE.md` § Source of Truth
- `.claude/agents/fenix-design-planner.md`, `fenix-design-runner.md`, `fenix-design-feedback.md` — the agents that author and iterate pen files via the Pencil MCP
