# ADR-016: Remix UI Instance DOM IDs

## Status

**Accepted** - 2026-07-21

## Background

A public Remix UI tutorial used module-level constants for DOM IDs that connected buttons to dialogs and popovers. That works for a single instance, but it breaks when the same component is rendered more than once on a page.

Remix UI provides `handle.id`, a unique ID for each component instance, so components do not need hardcoded instance-local DOM IDs.

## Context

- Native features such as Invoker Commands, the Popover API, and `aria-labelledby` often require matching DOM IDs.
- Reusable Remix UI components can render multiple times on the same page.
- A module-level ID constant is shared by every instance of the component.
- `handle.id` is available from the component handle and is unique per instance.

## Decision

Reusable Remix UI components and public examples should prefer `handle.id` for instance-local DOM IDs.

When a component needs related IDs, derive them from `handle.id`, for example `${handle.id}-title` for an accessible heading referenced by `aria-labelledby`.

When the component is passed directly to `clientEntry(...)`, let Remix infer the `handle` type unless props require an explicit component signature. Public snippets should avoid unnecessary `Handle<Record<string, never>>` annotations.

Module-level ID constants are acceptable only when the code intentionally models a single global target and that constraint is part of the behavior contract.

## Consequences

### Positive

- Reusable UI examples remain safe when rendered multiple times.
- Native command targets and accessibility relationships stay instance-local.
- Public tutorials teach the Remix UI component model more accurately.

### Negative

- Examples must use the actual `handle` value when they need instance-local IDs, instead of ignoring it with `_handle`.

### Neutral

- Global singleton UI, such as one app shell modal, can still use a fixed ID when that singleton behavior is intentional.
