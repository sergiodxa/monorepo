# Content Ideas from Codebase

This document contains potential articles and tutorials based on patterns and code found in this monorepo.

## TUTORIALS (How To)

### React Router / Middleware Patterns

#### How to Use Client Actions with Toast Notifications in React Router

Combine `clientAction` with server actions for immediate UI feedback.

_Relevant Files_:

- `apps/uptime/app/routes/actions/$team.create-monitor/route.ts`

**Overlaps with**:

- Show toast after a Remix action (https://sergiodxa.com/tutorials/show-toast-after-a-remix-action)
- Validate Form in Remix with clientAction (https://sergiodxa.com/tutorials/validate-form-in-remix-with-clientaction)

#### How to Add Rolling Cookie Sessions to React Router

Automatically extend session expiration on every request.

_Relevant Files_:

- `apps/blog/app/middleware/rolling-cookie.ts`

**Overlaps with**:

- Add rolling sessions to Remix (https://sergiodxa.com/tutorials/add-rolling-sessions-to-remix)

### Utilities

#### How to Convert Throwing Functions to Result Types

The `wrap()` function for error handling.

_Relevant Files_:

- `packages/result/src/wrap.ts`

**Overlaps with**:

- Result Objects in TS (https://sergiodxa.com/articles/result-objects-in-ts)

## ARTICLES (Explanations/Opinions)

#### TypeScript Assertion Functions for Result Types

Using `asserts` keyword for cleaner code.

_Relevant Files_:

- `packages/result/src/succeeded.ts`
- `packages/result/src/failed.ts`

**Overlaps with**:

- Result Objects in TS (https://sergiodxa.com/articles/result-objects-in-ts)

---

## Summary

| Category                  | Total | Written | Remaining |
| ------------------------- | ----- | ------- | --------- |
| Tutorials (from codebase) | 3     | 0       | 3         |
| Articles (from codebase)  | 1     | 0       | 1         |
| **Total**                 | **4** | **0**   | **4**     |

### Remaining to Write

**Tutorials:**

1. How to Use Client Actions with Toast Notifications in React Router (overlaps with existing)
2. How to Add Rolling Cookie Sessions to React Router (overlaps with existing)
3. How to Convert Throwing Functions to Result Types (overlaps with existing)

**Articles (from codebase):**

1. TypeScript Assertion Functions for Result Types (overlaps with existing)
