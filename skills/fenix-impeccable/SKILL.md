---
name: fenix-impeccable
description: Fenix-aware wrapper around the user-level impeccable skill. Reads docs/PRODUCT.md instead of interviewing the user, respects the pen-upstream rule, and wires impeccable's quality rails into the Fenix phase flow. Invoke with 'teach' to synthesize .impeccable.md from PRDs, 'seed' to author the design-system pen once at project inception, 'audit' to run slop-test against the current phase diff, or a companion name (polish/distill/critique/animate/layout/etc.) to delegate.
user-invocable: true
argument-hint: "[teach|seed|audit|<companion>]"
---

# fenix-impeccable

Fenix has two hard rules that shape how impeccable plugs in:

1. **Pens are upstream.** Once a design-system pen exists, the human owns aesthetic direction. Impeccable's `craft` mode does not run during a phase.
2. **`docs/` PRDs are the one place product intent lives.** The brand, voice, audience, and aesthetic direction are already written there — `teach` synthesizes from those files instead of interviewing the user.

This wrapper enforces both. Do not bypass it by calling `/impeccable` directly during a phase — the rails only apply when this skill is in the chain.

---

## Modes

### `teach` — synthesize `.impeccable.md` from PRDs (non-interactive)

Run this once per project after `docs/PRODUCT.md` is filled in.

**Inputs**
- `docs/PRODUCT.md` (required — error if missing or contains unfilled template placeholders)
- `docs/features/*.md` (optional — used for cross-feature signal)
- Existing `.impeccable.md` (if present — update in place rather than overwrite)

**Procedure**
1. Read `docs/PRODUCT.md` end-to-end. If sections 2 (Target Audience), 4 (Brand Personality), or 5 (Aesthetic Direction) contain italic template guidance or "TODO"-style placeholders, STOP and tell the user which sections need filling in. Do not guess to fill gaps.
2. Map PRD sections to `.impeccable.md` Design Context:

   | `.impeccable.md` section | Source in `PRODUCT.md` |
   |---|---|
   | Users | § 2 Target Audience (primary persona, context of use) |
   | Brand Personality | § 4 (three-word voice, emotions, copy tone) |
   | Aesthetic Direction | § 5 (visual tone, theme + justification, references, anti-references, color/typography constraints) |
   | Design Principles | Derived — 3-5 principles that fall out of §§ 2, 4, 5 in combination |

3. Write `.impeccable.md` to the repo root with exactly the sections the user-level impeccable expects (§ Users, § Brand Personality, § Aesthetic Direction, § Design Principles). Quote verbatim from `PRODUCT.md` where possible — same rule as pen notes, paraphrasing introduces drift.
4. Derived Design Principles are the only section where synthesis happens. Write 3-5 principles that are **specific to this product** (not "be consistent" or "prefer clarity" — those are universal). Every principle must be traceable to a line in `PRODUCT.md`.
5. Do NOT append to `.github/copilot-instructions.md`. Fenix agents read `.impeccable.md` directly.

**Output**: `.impeccable.md` at repo root. Report the Design Principles back to the user in the response.

**If the PRD is thin** (missing sections, placeholders still present): list the missing inputs and tell the user "Rich PRDs are the contract for this project — fill these sections in `docs/PRODUCT.md` and re-run." Do not fall back to interactive Q&A; the PRD is the single source of product intent.

---

### `seed` — author the design-system pen (one-shot)

Run this once, after `teach`, before any phase ships UI. This is the only moment `/impeccable craft` runs in Fenix.

**Inputs**
- `.impeccable.md` (required)
- Pencil MCP connection (required — the pen is authored via Pencil MCP, not generated as code)

**Procedure**
1. Confirm with the user that no design-system pen exists yet. If `pens/` already contains a design-system pen, STOP — the pen is upstream and human-owned.
2. Delegate to `/impeccable craft` with the argument: "Author the design-system pen for [product name from PRODUCT.md § 1] per `.impeccable.md`. Output is a Pencil file with the color palette, typography scale, spacing scale, border-radius scale, component patterns (buttons, cards, inputs, nav, form controls), and dark-mode variants. Do NOT output code. Use Pencil MCP tools from the `fenix-design` skill."
3. After craft finishes, remind the user to:
   - Open the pen in Pencil and refine — craft is a seed, not a deliverable
   - Run `bun run pen:tokens` to emit CSS custom properties once satisfied
   - Run `bun run pen:extract` to generate the inventory

**Output**: A seeded design-system pen in `pens/`. Human refines and owns from there.

---

### `audit` — slop-test the current phase diff

Run this as part of `/phase-close` (wired into `bun run phase:gate` as informational). Also callable standalone during implement/simplify.

**Procedure**
1. Resolve the phase diff via `scripts/slop-test.ts --phase <id>` (see § Slop Test below).
2. The script greps for impeccable's absolute bans:
   - **Side-stripe accents**: `border-left:` or `border-right:` with width > 1px applied as a color accent
   - **Gradient text**: `background-clip: text` combined with a gradient `background` / `background-image`
   - **Reflex font imports**: `next/font/google` or `@import` pulling any font in impeccable's reflex-font reject list (Inter, DM Sans, Fraunces, Space Grotesk, Playfair, Cormorant, Syne, IBM Plex, Outfit, Plus Jakarta, Instrument Sans/Serif, Crimson, Lora, Newsreader, Space Mono)
3. Report findings with file:line references. The audit is informational in phase-gate — it flags, it doesn't block. Humans decide per finding.

**Exception**: Geist (Fenix's default sans/mono) is explicitly allowed. If a project has replaced Geist and the replacement is on the reflex list, that's a real finding.

---

### Companion delegation — `polish` / `distill` / `critique` / `animate` / `layout` / etc.

For any argument that matches a user-level companion skill, pass through unchanged. Fenix does not customize these — they are purely quality passes that improve whatever's already there.

**Where to run each**

| Companion | When in phase flow |
|---|---|
| `layout` | After initial Screen/Component implementation, before first simplify pass |
| `typeset` | Alongside `layout` if typography feels off |
| `polish` | Final pass before `phase-close` |
| `distill` | When a Screen accrues too many affordances — simplify to essence |
| `critique` | During `/gsd:ui-review` — layered into the 6-pillar score |
| `audit` (companion, not this skill's `audit`) | During `/gsd:ui-review` for a11y/perf/theming checks |
| `animate` | Only when the feature PRD § 8 names motion moments worth attention |
| `delight` | Only when the feature PRD § 4 emotional goals include delight/playfulness |
| `clarify` | When UX copy feels robotic — before `phase-close` |

Running companions against pens-derived stories is fine. Running `craft` during a phase is NOT fine — it will try to re-decide aesthetic direction that pens already own.

---

## Context-Gathering Protocol (Override)

The user-level impeccable says: "You cannot infer this context by reading the codebase. Only the creator can provide this context."

Fenix's override: **the creator already provided it in `docs/PRODUCT.md`.** Follow this order:

1. If `.impeccable.md` exists at repo root → use it. Done.
2. If `.impeccable.md` is missing but `docs/PRODUCT.md` is filled in → run `teach` first.
3. If both are missing or `PRODUCT.md` is still the template → STOP. Tell the user to write `PRODUCT.md` before any design work begins.

Never fall back to interactive Q&A. The whole point of the PRD system is that product intent is written once, in one place, and read by many tools.

---

## Slop Test — implementation reference

The slop-test script lives at `scripts/slop-test.ts` and is wired into `bun run phase:gate`. It greps the phase diff (`git diff --name-only --diff-filter=AM main...HEAD`) filtered to `.tsx`, `.ts`, `.css`, `.scss` files. Reports are informational — flags surface in the phase-gate output, humans decide.

See § `audit` mode above for the canonical list of patterns.

---

## What this skill does NOT do

- Does NOT re-interview the user. PRDs are the contract.
- Does NOT run `craft` during a phase. Craft is one-shot at project inception.
- Does NOT author `.github/copilot-instructions.md`. Fenix agents read `.impeccable.md` directly.
- Does NOT block phase-gate on slop findings. Flags only. Hard gates are coverage, validate, phase-reviewer, browser-verify.
- Does NOT override the pen-upstream rule. Pens remain the source of truth for screen-level visual decisions once seeded.
