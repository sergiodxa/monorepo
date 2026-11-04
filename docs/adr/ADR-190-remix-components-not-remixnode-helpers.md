# ADR-190: Remix markup helpers are components, not `RemixNode` factories

## Status

**Accepted** - 2026-11-04

## Background

A `remix/component` component is `function Name(handle: Handle<Props>) { return () => … }`
and is used as JSX (`<Name … />`). While building the `@sdxc/ui` export catalogue faces, an
agent introduced plain functions that return `RemixNode` and are called as
`{face()}` instead of mounted as components. That pattern also already exists in
`apps/sdxc-site/resources/components/ui-faces/scenes.tsx`. The correction is that every
reusable piece of Remix markup is a real component.

## Context

- Remix's JSX types accept `Handle`-based components as elements. A bare
  `function Foo(): RemixNode` is not a component: TypeScript rejects `<Foo />`, and calling
  `Foo()` bypasses the component model (props, updates, lifecycle).
- `RemixNode` remains the type for _values_ a component renders or accepts as
  `children` — it is not a return type for a factory that stands in for a component.
- Scene and face code wants small reusable pieces (a wireframe box, a duration bar, a
  state-machine node). Those pieces still need the component shape.

## Decision

- MUST author every reusable Remix markup unit as a `Handle` component and use it as JSX.
- MUST NOT create a function whose job is to return `RemixNode` unless that function is a
  real component (`handle: Handle<…>` and `return () => …`).
- MAY keep `RemixNode` as a type on props (`children`) and local render values.
- Existing `ui-faces/scenes.tsx` factories migrate to components when that file is next
  touched; new face and catalogue code follows this ADR immediately.

## Consequences

### Positive

- One composition model: everything that draws UI is a component.
- TypeScript accepts the helpers as JSX without casts.
- Props and future state/lifecycle stay available on the same API.

### Negative

- Small schematic pieces carry a little more boilerplate (`namespace` + `Handle`) than a
  one-line factory.
- `scenes.tsx` still needs a follow-up migration.

## Alternatives Considered

- **Keep `(): RemixNode` factories, call them as functions.** Rejected: it is a second,
  parallel UI API that the framework does not treat as components.
- **Inline every schematic and never extract.** Rejected: the export catalogues share
  stages, chains and wireframes; extraction is fine when the extract is a component.

## References

- [Remix component model](../../.agents/skills/remix/references/component-model.md)
- `apps/sdxc-site/resources/components/ui-export-faces/`
- `apps/sdxc-site/resources/components/ui-faces/chrome.tsx` (Handle-based pieces)
