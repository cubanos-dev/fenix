# PRODUCT.md — [Product Name]

> **This is a template.** Fill every section. Delete the italic guidance. A PRODUCT.md with hand-waves in it will produce a generic design — which is the failure mode this entire workflow exists to prevent.
>
> This file is read by `/impeccable teach` to produce `.impeccable.md` non-interactively, and by `/gsd:new-project` to seed `.planning/PROJECT.md`. It is the single upstream source of product intent.

## 1. Problem & Vision

### Problem
_What specific problem does this product solve? Write one paragraph. Name the user pain, not a market category. "Founders lose the first 30 minutes of every investor meeting re-explaining context that lives in seven different docs" beats "we're building productivity software for founders"._

### Vision
_One sentence. If someone asked the target user "what is this for," what would they say in their own words a year from now?_

### Non-vision (explicitly out)
_Name 2-4 adjacent things this is not. "Not a CRM," "not a Notion replacement," "not for enterprise," etc._

---

## 2. Target Audience

### Primary persona
_Who uses this? Not "busy professionals." Be specific: role, company size, years of experience, tools they already use, the hour of day they reach for this product._

### Context of use
_Where and when is this opened? On a phone in bed? On a second monitor during a trading session? On a laptop at a kitchen table on Sunday morning? The physical and emotional context dictates theme (see § 4) more than any other input._

### Secondary personas (optional)
_Other users the product must serve — name them and how their needs differ from primary._

### Anti-persona
_Who is this explicitly NOT for? Naming who you're rejecting sharpens decisions for who you're serving._

---

## 3. Jobs To Be Done

_List the top-level jobs the user hires this product to do. Use the "When I ___, I want to ___, so I can ___" format. Keep to 3-7 top-level jobs; feature PRDs break them down further._

1. When [context], I want to [action], so I can [outcome].
2. …

---

## 4. Brand Personality

### Three-word voice
_Pick three concrete words. **Reject**: modern, clean, elegant, sleek, minimal (these are dead categories — every AI picks them). Accept: "warm, mechanical, opinionated" / "calm, clinical, careful" / "fast, dense, unimpressed" / "handmade, a little weird"._

1. _[concrete word]_
2. _[concrete word]_
3. _[concrete word]_

### Emotions the interface should evoke
_Pick 2-3. Examples: confidence, delight, calm, urgency, focus, reassurance, playfulness, restraint. These must be consistent with the context of use (§ 2)._

### Tone in copy
_How should microcopy read? Direct and blunt? Warm and encouraging? Technical and precise? Give a one-sentence example error message in the right voice._

---

## 5. Aesthetic Direction

### Visual tone
_Pick a clear conceptual direction and commit. Examples: brutally minimal, maximalist editorial, retro-futuristic, organic, luxury refined, playful toy-like, industrial utilitarian, brutalist raw, art deco, pastel soft. Bold maximalism and refined minimalism both work — the failure mode is picking nothing and defaulting to generic._

### Theme (light / dark / both)
_**Derive from context of use, not preference.** A night-time trading dashboard wants dark. A patient-facing healthcare portal wants light. A children's reading app wants light. An observability dashboard wants dark. Justify the choice in one sentence._

### References
_Name 3-5 specific sites/apps/physical things that capture the right feel. Be precise about **what specifically** — "Linear's command palette density," not "something like Linear." Museum exhibit captions, 1970s terminal manuals, hand-painted signs, and fabric labels are fair game._

- [ref 1] — what specifically
- [ref 2] — what specifically
- …

### Anti-references
_Name 2-4 things this must NOT look like. Naming the negative space is often more useful than naming the positive. "Not another dark-purple-gradient SaaS dashboard." "Not a Material Design admin panel."_

- [anti-ref 1] — why not
- …

### Color constraints
_Any colors that must be used (brand mark, logo)? Any colors explicitly forbidden? If no brand color exists yet, say "none — derive from references"._

### Typography constraints
_Any fonts that must be used (licensed, brand face)? Any families to avoid beyond impeccable's built-in reflex-font ban list? If open, say "open — pick per impeccable's font selection procedure"._

---

## 6. Accessibility

### WCAG target
_Level A, AA, or AAA? Default to AA unless regulated._

### Known user needs
_Specific accommodations? Screen reader users, reduced motion, color blindness, keyboard-only, low-vision, non-native language speakers?_

### Internationalization
_Which locales at launch? Fenix ships with en-US and es-ES — add/remove here._

---

## 7. Technical Constraints

_The Fenix stack is locked (Next.js 16, React 19, Kysely, BetterAuth, shadcn, Tailwind v4). This section captures **domain** constraints, not platform ones._

- Data residency / compliance (GDPR, HIPAA, SOC2, PCI)
- Performance budgets (time-to-interactive targets, payload limits)
- Offline / low-connectivity requirements
- Third-party integrations that shape UX (Stripe flows, OAuth providers, etc.)
- Platform reach (web only, PWA, native wrappers later)

---

## 8. Success Criteria

### Launch-readiness signals
_How will you know the product is ready to open to real users? Qualitative and quantitative._

### Ongoing health metrics
_The 2-3 metrics you'll actually watch after launch. Not vanity metrics._

---

## 9. Open Questions

_Things the product team has NOT yet decided. List them so downstream tools can flag when they run into one._

- [ ] …
- [ ] …

---

_Last updated: [date]_
