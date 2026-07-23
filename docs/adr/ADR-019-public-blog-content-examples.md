# ADR-019: Public Blog Content Examples

## Status

**Accepted** - 2026-07-22

## Background

Generated blog drafts accidentally described internal monorepo packages and used older Remix and React Router route-module patterns in tutorials intended to teach Remix v3.

Public articles and tutorials must stand on their own. They should teach transferable patterns without exposing private package names, internal repository paths, or APIs that do not exist in the public Remix v3 surface.

## Context

- Internal packages such as the design-system package are implementation details of this repository.
- Public content examples may be inspired by repository patterns, but they must use local example module names or public package imports.
- Remix v3 uses route contracts, controllers, middleware context, and `remix/ui` components rather than React Router route modules, React hooks, or top-level `remix` imports.
- Tutorials that show form handling should use controller actions and `FormData` from middleware, then validate with `remix/data-schema` and `remix/data-schema/form-data`.

## Decision

Public blog content must not mention internal package names, internal package import paths, or monorepo-private module paths. Articles should describe patterns generically, such as a component library, behavior layer, utility layer, or design system.

Tutorial code may use local example imports such as `../ui/mixins`, `../ui/behaviors`, or `../ui/utils` when demonstrating reusable code. It must not present internal package imports as public APIs.

Remix tutorials must use Remix v3 patterns: route contracts from `remix/routes`, controllers from `remix/router`, explicit `Response` returns, `remix/data-schema` validation, middleware-provided `FormData`, and `remix/ui` component shapes. They must not use React Router route-module exports, `Route.*` types, `useLoaderData`, `useActionData`, React hooks, or top-level `remix` imports unless the post is explicitly about React or legacy React Router.

## Consequences

### Positive

- Public content stays useful outside this repository.
- Tutorials avoid teaching private APIs or stale Remix patterns.
- Future agents have a clear rule for converting internal implementation ideas into public examples.

### Negative

- Drafting takes more adaptation because internal package examples must be generalized before publication.
- Some examples need small local modules to stand in for reusable behavior that exists internally.

### Neutral

- Internal repository patterns can still inspire content, but the published code must describe the pattern through public Remix APIs or local tutorial modules.
