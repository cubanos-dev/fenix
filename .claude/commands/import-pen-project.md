# Import Pen as GSD Project

Extract project requirements from an existing pen file to bootstrap a GSD project. This is a one-time import — the pen file is used for requirements extraction only, not as a design source.

## Usage

```
/import-pen-project <pen-file-path>
```

If no path is provided, scan `pens/` for available pen files.

## What This Does

Reads an existing pen file and extracts structured requirements for GSD's `/gsd:new-project` flow. The original pen designs are NOT used as the design source of truth — GSD will recreate all designs from scratch using the Fenix design skills.

## Process

### Step 1: Open and Inventory the Pen File

Use Pencil MCP tools:
1. `open_document(penFilePath)` — open the pen file
2. `batch_get` with broad patterns — read all top-level frames
3. `get_screenshot` — capture visual overview of each frame

Build a screen inventory:

| Frame | Screen Name | Purpose | Key Elements |
|-------|-------------|---------|--------------|

### Step 2: Extract Requirements (NOT Design)

For each screen/frame, extract:
- **What it does** — the feature/functionality (e.g., "user dashboard showing project stats")
- **User flows** — navigation between screens, what actions lead where
- **Data displayed** — what information is shown (lists, cards, metrics, forms)
- **User interactions** — what can the user do (create, edit, filter, search, etc.)
- **Roles/permissions** — who sees this screen

Do NOT extract:
- Colors, typography, spacing, or any visual design tokens
- Component styling or layout specifics
- Design system elements
- Any aesthetic choices

### Step 3: Generate GSD Project Input

Compile the extracted requirements into a structured brief:

```markdown
## Project Overview
<One paragraph describing the application based on what the pen file shows>

## Screens & Features
<List each screen with its purpose, data, and interactions>

## User Flows
<Key navigation paths through the application>

## Data Model (inferred)
<Entities and relationships visible from the screens>
```

### Step 4: Hand Off to GSD

Present the extracted brief to the user for review, then run `/gsd:new-project` with the brief as input. GSD will:
1. Research and expand the requirements
2. Generate PROJECT.md, REQUIREMENTS.md, ROADMAP.md
3. The Fenix design skills will create a fresh design system and screen designs

### Step 5: Archive the Source Pen

After GSD has the requirements:
- The original pen file is no longer the source of truth
- It can be moved to `pens/archive/` or deleted
- GSD + Fenix skills will recreate all designs from scratch

## Important

- This is a **requirements extraction** tool, not a design migration tool
- The goal is to capture WHAT the app does, not HOW it looks
- All visual design will be recreated by GSD using `fenix-design` + `frontend-design` skills
- The output quality test: if GSD reproduces (or improves on) the original, the autonomous loop works
