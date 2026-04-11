# Fenix Pen Extract

This skill walks a pen file and produces a machine-readable inventory that phase planning can cite verbatim. It is the canonical way to bridge a Pencil design into the phase flow: no prose ui-spec, no re-summarization, no translation hops.

Invoke this skill whenever a project adds or updates a pen file, or at the start of a phase whose frames come from an unextracted section.

## Core rule

**Pen notes are quoted verbatim.** The agent never paraphrases, summarises, "cleans up", or interprets note content. Every lossy translation of a note is a chance for the downstream story to drift from the design intent, which was the single largest source of rework in prior projects. When in doubt, copy the text character-for-character and let typos stand.

## Prerequisites

- A pen file exists under `pens/` (default `pens/app.pen`). If missing, stop and tell the user to create one in Pencil first.
- `bun run pen:extract` has been run once — it creates `pens/inventory/` and `pens/exports/` directories, validates inputs, and points at this skill. The script is a thin shim; all real work happens here.
- Pencil MCP is connected (`mcp__pencil__*` tools are available).

## Expected pen structure

Every project's pen must follow this shape or extraction is unreliable:

```
Section frame   e.g. "SC -- Dashboard"     layout: none, large wrapper
├── Screen frame  "SC -- Dashboard -- Main"          1440×900 canvas
├── Screen frame  "SC -- Dashboard -- Notifications" 1440×900 canvas
├── note          title starts with "SC — Dashboard"
│   └── Purpose / Features / Workflow / Related screens
└── note          "SC — Dashboard (Notifications)"
    └── same structure
```

Naming convention: `{Persona} -- {Section} -- {Variant}`. Screen frames belong to the section whose name they prefix. Notes are matched to their screen by title prefix (the note's first line is the screen title with an em-dash instead of double-dash).

If a pen does not follow this convention, fix the pen first. Do not invent heuristics to work around it.

## Extraction workflow

Run these steps in order. If any step fails, stop and report — do not continue with incomplete data.

### 1. Open the document

```
mcp__pencil__open_document(<absolute path to pen file>)
```

Then `mcp__pencil__get_editor_state({ include_schema: true })` to confirm the document is active and get the top-level node list. This gives you every section frame (top-level `frame` nodes with `layout: "none"`) plus reusable components.

### 2. Enumerate sections

```
mcp__pencil__batch_get({
  filePath: "<pen path>",
  patterns: [{ type: "frame" }],
  readDepth: 0,
  searchDepth: 1,
})
```

Collect every top-level frame whose name matches `^<Persona> -- <Section>$` (no variant suffix). These are the sections. If the `batch_get` response is too large, narrow by pattern name prefix and loop.

### 3. Per-section extraction

For each section `S`:

**3a. Enumerate screens.** Match the pattern `^<S.name> -- ` (note the trailing space-dash-space). Every frame that matches is a screen variant of `S`.

```
mcp__pencil__batch_get({
  filePath: "<pen path>",
  patterns: [{ type: "frame", name: "^<Section Name> -- " }],
  readDepth: 1,
})
```

**3b. Export each screen as PNG.** For every screen frame `F`:

```
mcp__pencil__export_nodes({
  filePath: "<pen path>",
  nodeId: F.id,
  format: "png",
  outputPath: "pens/exports/<section-slug>/<screen-slug>.png",
})
```

Where `section-slug` is the section name converted to kebab-case (e.g. `SC -- Dashboard` → `sc-dashboard`) and `screen-slug` is the variant suffix converted to kebab-case (e.g. `SC -- Dashboard -- Main` → `main`, `SC -- Dashboard -- Notifications` → `notifications`). If the frame title has no variant (`SC -- Dashboard`), use `index` as the screen slug.

**3c. Collect notes.** Inside section `S` (via `parentId: S.id`):

```
mcp__pencil__batch_get({
  filePath: "<pen path>",
  parentId: S.id,
  patterns: [{ type: "note" }],
  readDepth: 0,
})
```

For every `note` returned, read its `content` field. The first line of the content is always the screen title (with em-dash `—`). Match each note to its screen by converting the title to the same canonical form as the screen frame name: `SC — Dashboard` matches `SC -- Dashboard -- Main` if the screen is the base variant, or `SC — Dashboard (Notifications)` matches `SC -- Dashboard -- Notifications`. If a note does not match any screen, log it under "unmatched notes" in the inventory — do not silently drop it.

**3d. Write the inventory file.** Create `pens/inventory/<section-slug>.md`:

````markdown
# <Section Name>

<section-level note content verbatim, if a section-level note exists — otherwise omit this line>

## Screens

### <Screen Name> — `<screen-slug>`

- Frame dimensions: <width>×<height>
- `@pen pens/exports/<section-slug>/<screen-slug>.png`

```
<verbatim note content — copy character-for-character, including typos,
 em-dashes, bullet glyphs, and blank lines. Wrap in a fenced code block
 so the agent and human readers both see it as opaque text.>
```

### <next screen>

...
````

Repeat 3a–3d for every section.

### 4. Write the top-level index

Create `pens/inventory/INDEX.md`:

```markdown
# Pen Inventory

Generated by fenix-pen-extract skill.

## <Section Name>

- [<Screen Name>](./<section-slug>.md#<screen-anchor>) — `pens/exports/<section-slug>/<screen-slug>.png`
- ...

## <next section>

...
```

The index is what phase plans reference — it maps every screen to its inventory entry and PNG export.

### 5. Write the components inventory

Reusable components (top-level frames with `reusable: true`) show up in the initial `get_editor_state` call. Write `pens/inventory/COMPONENTS.md`:

```markdown
# Reusable Pen Components

| ID | Name | Notes |
|----|------|-------|
| `<id>` | `<name>` | `<one-line hint from any attached note, or empty>` |
```

Components are referenced by stories when a single shared primitive (e.g. a sidebar) spans many screens.

### 6. Verify the extraction

After writing, confirm:

- Every section frame produced exactly one inventory file.
- Every screen frame produced exactly one PNG.
- Every note that matched a screen appears verbatim inside its screen block.
- `pens/inventory/INDEX.md` links resolve to the section files.
- `pens/inventory/COMPONENTS.md` lists every reusable component from the initial editor state.
- Unmatched notes are logged in each section file under an "Unmatched notes" heading.

If any verification fails, stop and report which section/screen broke. Do not paper over incomplete extraction with synthetic content.

## When the pen updates

Re-run the skill end-to-end. Do not attempt partial extraction. `scripts/pen-drift-check.ts` flags stories whose `@pen` target changed; those stories then need to be re-reviewed against the new PNG before the next phase closes.

## Related skills

- **fenix-design** — creating and maintaining pen designs, design system ownership, Pencil MCP tool reference
- **fenix-pen-tokens** — extracting CSS custom properties from pen variables (separate skill, same MCP-wrapper pattern)
- **fenix-architecture** — how inventory files plug into the phase flow
- **fenix-testing** — how `@pen` references in stories drive the visual-diff gate

## Anti-patterns

- **Paraphrasing notes.** Never. Copy verbatim. Every word.
- **Inferring behavior from a frame's visual layout.** The note is the source of truth for behavior. If a frame has no note, the extraction is incomplete — ask the user to add one.
- **Running mid-phase.** Pen extraction is a full pass against a pen snapshot. Do not extract a single screen in the middle of a phase; re-run the whole thing so the inventory stays internally consistent.
- **Writing agent interpretation alongside verbatim notes.** The inventory file contains exactly two kinds of content: structural metadata (section name, screen slug, frame dimensions, PNG path) and verbatim note text. No third category.
