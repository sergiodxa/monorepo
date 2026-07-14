# ADR-013: Remix UI For Application Interfaces

## Status

**Accepted** - 2026-07-13

## Background

The monorepo has moved away from React-based application UI and Tailwind-based styling. A recent agent-created skill used React-style examples and utility CSS classes, which did not match the current architecture.

This ADR records the correction so future agents design and implement UI using the same framework and styling model as the repo.

## Context

Application interfaces in this monorepo are rendered with `remix/ui`. Remix UI uses JSX syntax, but it is not React: components receive a `Handle`, read current props from `handle.props`, keep component state in setup-scope variables, and update explicitly through `handle.update()` when hydrated behavior is needed.

Styling is done with `remix/ui` `css()` mixins attached through the `mix` prop. Behavior is attached through Remix UI mixins such as `on(...)`, `ref(...)`, and `link(...)`, or through native platform features like `<dialog>`, popovers, command invokers, and `<details>`.

React hooks, React component patterns, `className` styling, and Tailwind utility classes do not match the current UI architecture for new application code or agent-authored examples.

## Decision

Use `remix/ui` as the standard UI layer for applications and packages that render app UI in this monorepo.

All new UI examples, skills, documentation, and implementation code should:

- Render with `remix/ui` JSX and components
- Style host elements and primitives with `mix={css(...)}` or composed `mix={[...]}` descriptors
- Attach browser behavior with `on(...)`, `ref(...)`, `link(...)`, `clientEntry(...)`, or native HTML platform features
- Avoid React hooks, React component APIs, `className`-driven styling, and Tailwind utility classes

Correct pattern:

```tsx
import type { Handle } from "remix/ui";

import { css, on } from "remix/ui";

function SaveButton(handle: Handle<{ isSaving: boolean }>) {
	return () => (
		<button
			type="submit"
			aria-busy={handle.props.isSaving}
			mix={[
				css({
					minHeight: "2.75rem",
					paddingInline: "1rem",
					borderRadius: "999px",
				}),
				on("click", () => {
					// Add behavior only when the server-rendered path needs enhancement.
				}),
			]}
		>
			{handle.props.isSaving ? "Saving..." : "Save changes"}
		</button>
	);
}
```

## Consequences

### Positive

- Agents will produce examples and code that match the repo's current UI runtime.
- Styling stays colocated with Remix UI elements through `css()` mixins instead of drifting into utility class strings.
- New UI keeps the server-rendered Remix path as the default and adds hydrated behavior only when needed.

### Negative

- General React and Tailwind examples from third-party design guidance must be translated before use.
- Existing frontend skills that mention React or Tailwind are not directly applicable to implementation examples in this repo.

### Neutral

- `.tsx` remains the file extension for Remix UI JSX, but `.tsx` does not imply React.
- Native HTML platform features remain preferred for dialogs, popovers, menus, tooltips, disclosures, and command wiring.

## References

- [Remix skill](../../.agents/skills/remix/SKILL.md)
- [Apple HIG web app skill](../../.agents/skills/apple-hig-web-app-guidelines/SKILL.md)
