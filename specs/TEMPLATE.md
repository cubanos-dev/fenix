# <Screen/Feature Name>

## Metadata
- **Pen ID**: <frame ID from pen file>
- **Route**: <app route, e.g., /(app)/dashboard>
- **Role**: <who uses this screen, e.g., admin, member>

## Purpose
<What this screen/feature does — one paragraph>

## Design Description
<Visual description matching the pen design — layout, key elements, styling>

## API / Server Actions
<Data mutations and queries needed>

```typescript
// Example:
'use server'
async function createProject(data: CreateProjectInput): Promise<Project>
async function listProjects(orgId: string): Promise<Project[]>
```

## State
<Client state, URL params, form state>

- URL params: `?tab=active`
- Form state: controlled via React state
- Server state: fetched via Server Components

## Navigation
- **From**: <where users come from>
- **To**: <where users go next>

## Validation Rules
<Input validation, business rules>

- Name: required, 3-100 characters
- Description: optional, max 500 characters

## Behavior
<Interactions, loading states, error states, empty states>

- **Loading**: Skeleton with `<Suspense>` boundary
- **Empty**: Centered message with CTA
- **Error**: Error boundary with retry button
- **Success**: Toast notification via Sonner

## Implementation Notes
<Technical decisions, component reuse, edge cases>
