# docs/ — Product Requirements

This directory is the **upstream source of product truth** for a Fenix project. It is the one place where the *what* and the *why* of the product are written in prose — everything downstream (pen designs, GSD requirements, phase plans, impeccable design context) synthesizes from here.

## Layout

```
docs/
├── README.md            — this file
├── PRODUCT.md           — project-level PRD: audience, brand, aesthetic direction
└── features/
    ├── _template.md     — copy to scaffold a new feature PRD
    └── <feature>.md     — one PRD per feature / section of the product
```

## Writing order

1. **Fill `PRODUCT.md` first.** It carries the brand and aesthetic context every feature inherits. `/impeccable teach` reads only this file to produce `.impeccable.md`.
2. **Write one feature PRD per bounded slice of product.** Copy `features/_template.md` and rename. Each feature is a candidate for a GSD phase — or a cluster of phases if the feature is large.
3. **Rewrite, do not grow.** PRDs are living documents. When scope changes, edit the PRD before editing code or pens. If the PRD and the code disagree, the PRD is wrong or the code is wrong — never both.

## Who reads these files

| Consumer | Reads | Writes |
|---|---|---|
| `/impeccable teach` (skill) | `PRODUCT.md` | `.impeccable.md` |
| `/gsd:new-project` | `PRODUCT.md` + `features/*.md` | `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` |
| `/gsd:discuss-phase` | the feature PRD(s) in scope | phase context |
| `/gsd:plan-phase` | the feature PRD(s) in scope | `.planning/phases/<id>/PLAN.md` |
| Humans authoring pens | the feature PRD(s) in scope | `pens/` |

## Rules

- **Rich, not thin.** A PRD that skips the Aesthetic Direction or Users section forces downstream tools to ask the human — that defeats the whole point.
- **Concrete, not abstract.** "Modern and clean" is not a brand voice. "Warm, mechanical, opinionated" is.
- **Reference-ful.** Name sites/apps that capture the right feel *and* anti-references (what this must NOT look like). The reflex font list in impeccable exists because "elegant" defaults to the same four serifs every time — references break that.
- **One PRD per feature, not per screen.** A feature PRD covers the user-facing capability; individual screens live in pens, not here.
