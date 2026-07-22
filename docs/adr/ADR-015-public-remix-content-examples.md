# ADR-015: Public Remix Content Examples

## Status

**Accepted** - 2026-07-21

## Background

A public tutorial was drafted from internal package code and referenced `@pkg/r3-ui`, a private workspace package. It also used a route module shape with a default route component, which is not the Remix v3 architecture this monorepo uses.

This matters because public content must be runnable by readers outside the monorepo and must teach the current Remix v3 model, not older Remix or React Router conventions.

## Context

- `@pkg/r3-ui` is private and cannot be installed by public readers.
- Public tutorials can still teach patterns that exist internally, but they must inline the relevant app code or use public packages.
- Remix v3 route contracts live in `app/routes.ts` and route responses are rendered by controllers under `app/actions`.
- Remix v3 UI is built with `remix/ui` components and mixins, not React route modules that export default components.

## Decision

Public tutorials must avoid private workspace package names and imports such as `@pkg/*` unless the package is publicly available and the article is explicitly about that package.

When public content teaches internal reusable behavior, it should present the behavior as app-owned code with public imports. For Remix v3, examples must use:

- `app/routes.ts` for route contracts,
- `createController(...)` in `app/actions/**/controller.tsx` for route responses,
- `render(...)` as the app-local HTML response adapter,
- `remix/ui` components, `clientEntry(...)`, and `mix` for UI and browser behavior.

Public Remix v3 tutorials must not use React Router terminology or route-module examples that export a default component.

## Consequences

### Positive

- Public tutorials remain runnable without access to private workspace packages.
- Examples teach the actual Remix v3 architecture used by this monorepo.
- Internal package implementations can still inspire content without exposing private import paths.

### Negative

- Tutorials may include more code because reusable private helpers must be shown inline.
- Public examples may diverge slightly from the monorepo's internal convenience APIs.

### Neutral

- Internal documentation and package docs can still reference private packages when the audience is the monorepo itself.
