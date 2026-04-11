# Phase <ID>: Test Contracts

The unit tests and E2E tests this phase must ship. Each row is a contract: no new pure fn without a unit test, no new route without an E2E.

## Unit tests

| Function | File | Expected behavior |
|----------|------|-------------------|
| `exampleFn(input)` | `apps/app/lib/<context>/example.ts` | returns `0` for empty input, sums positives, throws on non-numeric |
| `<fn>` | `<path>` | `<behavior>` |

For every row above, a co-located `*.test.ts` must exist with at least one test per behavior.

## E2E tests

| Route | Flow | Assertions |
|-------|------|-----------|
| `/dashboard` | sign in → land on dashboard → see user name | status 200, heading "Dashboard", `data-test="welcome-<user>"` visible |
| `<route>` | `<flow>` | `<assertions>` |

For every row above, a Playwright spec under `apps/<app>/e2e/` must exist. Use `.skip` during `/phase-spec`; flip to real tests during implement.
