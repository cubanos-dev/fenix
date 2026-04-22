# [Feature Name] — Feature PRD

> **This is a template.** Copy to `docs/features/<feature-kebab-name>.md` and fill every section. Delete the italic guidance. Thin PRDs force `/gsd:discuss-phase` to interrogate the human — rich PRDs let planning run non-interactively.
>
> This file is read by `/gsd:discuss-phase` and `/gsd:plan-phase` when scoping any phase that touches this feature. Multiple phases may share one feature PRD.

## 1. Summary

_One paragraph. What is this feature, who uses it, what problem does it solve? Must be understandable to someone who has never seen the product._

---

## 2. Users & Context

### Who
_Which persona(s) from `PRODUCT.md` § 2 use this feature? If this feature serves a secondary persona more than primary, say so._

### When
_What triggers them to reach for this feature? What's happening in their day?_

### What else they're doing
_What other tools / tabs / apps are open at the same time? Is this the focal task or a context-switch interruption?_

---

## 3. Jobs To Be Done

_Feature-scoped JTBD. Break down the top-level jobs from `PRODUCT.md` § 3 into the concrete actions this feature enables._

1. When [context], I want to [action], so I can [outcome].
2. …

---

## 4. User Flows

### Golden path
_The one flow that matters most. Write it as a numbered sequence from the user's point of view. Name screens, major interactions, and the success state. This becomes the Playwright E2E target in the phase that ships it._

1. User lands on …
2. User taps …
3. …
4. Success: user sees …

### Alternate paths
_2-4 realistic variants. Empty state, first-time use, error recovery, returning user, feature-flagged path, etc._

- **Empty state**: …
- **Error — [specific kind]**: …
- **First-time user**: …

### Edge cases worth naming
_Don't dump every theoretical edge. Name the ones where getting it wrong would harm the user experience or the business._

- …

---

## 5. Success Criteria

### User-visible behaviour
_Testable, observable statements. "User can invite a teammate by email and the teammate receives an invitation within 30 seconds." Not "invites should work."_

- …

### Non-goals
_What this feature deliberately does NOT do. Name the nearest-neighbor capability that users will ask for but we're not building yet._

- …

---

## 6. Scope

### In scope
- …

### Out of scope (for this feature)
- [deferred capability] — [what triggers revisiting]

### Depends on
_Other feature PRDs this one assumes are in place. If none, say "none."_

---

## 7. Data & State

_What data does this feature read, write, or derive? Which bounded contexts from `DOMAIN_MODEL.md` does it touch?_

- Reads: …
- Writes: …
- Emits events: …
- Bounded contexts touched: …

---

## 8. Visual & Interaction Notes

_Feature-specific design notes that don't belong in pens yet. The aesthetic direction is inherited from `PRODUCT.md` § 5 — this section captures **only** the parts that are feature-specific._

- Screens required (will be authored in pens): …
- States per screen (informs pen inventory + Storybook story enumeration): …
- Motion moments worth design attention: …
- Copy tone for this feature: _(if it deviates from product default)_

---

## 9. Open Questions

_Things the product team has NOT yet decided for this feature. Each one blocks the corresponding part of planning until resolved._

- [ ] …

---

## 10. References

- PRD(s) this depends on: …
- Design references specific to this feature (Linear's `Cmd+K`, Superhuman's keyboard chord pattern, etc.): …
- Competitive examples worth studying: …

---

_Last updated: [date]_
