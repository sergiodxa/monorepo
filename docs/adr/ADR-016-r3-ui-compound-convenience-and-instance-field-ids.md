# ADR-016: R3 UI Compound Convenience And Instance Field IDs

## Status

**Accepted** - 2026-07-22

## Background

`@pkg/r3-ui` exposes server-rendered Remix UI components that should stay useful both for simple call sites and for screens that need direct control over layout, labels, errors, and per-part styling.

During article idea review, two API expectations were clarified: convenience components should not replace compound components as the customization path, and field wiring must derive IDs from each component instance instead of from shared module-level constants.

## Context

- ADR-014 defines `@pkg/r3-ui` as a Remix UI component library with pure components, `mix` passthroughs, compound components, and convenience wrappers.
- ADR-016 establishes `handle.id` as the source of instance-local DOM IDs for reusable Remix UI examples.
- Form field components need several related IDs for labels, descriptions, and errors.
- Rendering the same field component more than once must not reuse the same label, description, or error IDs.
- Convenience components such as a one-call field wrapper are useful, but consumers eventually need to rearrange or restyle individual parts.

## Decision

`@pkg/r3-ui` convenience components must compose the same compound components that consumers can use directly. The ergonomic wrapper is the default path for common layouts, but the compound API is the primary escape hatch when consumers need custom structure.

For example, a screen may start with a single `<NumberField />` convenience component and later expand it into its compound parts:

```tsx
<NumberField.Group>
	<NumberField.DecrementButton />
	<NumberField.Input />
	<NumberField.IncrementButton />
</NumberField.Group>
```

`parts` props remain useful for targeted mixin overrides inside convenience wrappers, but they do not replace the compound component API.

Field components must derive instance-local IDs from `handle.id`, then pass those IDs through centralized field wiring helpers such as `resolveFieldWiring`. Labels, descriptions, and errors should be wired from that instance-local base so multiple rendered copies of the same field never cross-reference each other.

Module-level DOM ID constants remain valid only for intentional singleton UI, not reusable form fields or component examples.

## Consequences

### Positive

- Consumers get a simple API for common cases and a predictable direct-composition path for custom cases.
- Convenience wrappers and compound components stay behaviorally aligned because wrappers compose the same primitives.
- Accessible form relationships stay correct when reusable fields render multiple times on the same page.

### Negative

- Component authors must maintain both ergonomic wrappers and well-documented compound parts for complex controls.
- Field wrappers must thread instance-derived IDs through their internal parts instead of relying on simpler shared constants.

### Neutral

- `parts` props are still supported as local styling and behavior hooks, but they are a secondary escape hatch after direct compound composition.
- This decision narrows and reinforces ADR-014 and ADR-016 rather than replacing either one.
