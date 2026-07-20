# @pkg/r3-ui

A styled, accessible UI component library for `remix/ui`, rendered as server HTML and styled entirely through `css()` mixins.

## Overview

A component catalog for `remix/ui`, built on the Handle pattern: every component, variant, state, and dark-mode combination is driven entirely by a `data-*` attribute contract and a set of `--ui-*` semantic color variables, styled through `css()` mixins applied directly to each component's host element.

Components ship as markup plus inline `css()` styling only, and the library **never hydrates them** by default — most components (dialogs, popovers, disclosure, form controls) are complete with pure HTML and CSS, riding the platform's own `<dialog>`, Popover API, Invoker Commands, and `<details>`. Where a widget genuinely needs JavaScript, that behavior is an opt-in mixin or behavior class the consuming app attaches explicitly in its own hydrated island. This keeps the dependency footprint minimal — `remix` and `@pkg/lucide-remix` are the only runtime dependencies — and means every component works before, and without, JavaScript: pages render correctly on the very first byte, and interactivity is added deliberately rather than assumed.

## Usage

### Install

```bash
bun add @pkg/r3-ui
```

### Import order: reset, theme, then your styles

Two CSS files must be imported in this order, before your app's own styles:

```css
@import "@pkg/r3-ui/reset.css";
@import "@pkg/r3-ui/theme.css";

/* your app's styles */
```

- **`reset.css`** is a base reset (zeroed margins, `box-sizing: border-box`, form controls inheriting font/color, …), every selector wrapped in `:where()` for zero specificity, opened with `@layer base, rmx;` so it always loses to component styles. Apps that already ship an equivalent reset can skip importing it.
- **`theme.css`** is the `--ui-*` semantic variable layer (light `:root`, forced-dark `.dark`, system-dark `.system`) — plain CSS.

### Define your color scales

Components read semantic `--ui-*` variables, which `theme.css` derives from five `--color-*` scales your app must define, each with steps `50` through `950`:

```css
:root {
	--color-neutral-50: oklch(0.985 0 0);
	--color-neutral-100: oklch(0.97 0 0);
	--color-neutral-200: oklch(0.922 0 0);
	--color-neutral-300: oklch(0.87 0 0);
	--color-neutral-400: oklch(0.708 0 0);
	--color-neutral-500: oklch(0.556 0 0);
	--color-neutral-600: oklch(0.439 0 0);
	--color-neutral-700: oklch(0.371 0 0);
	--color-neutral-800: oklch(0.269 0 0);
	--color-neutral-900: oklch(0.205 0 0);
	--color-neutral-950: oklch(0.145 0 0);

	--color-primary-50: oklch(0.97 0.02 250);
	--color-primary-100: oklch(0.94 0.04 250);
	--color-primary-200: oklch(0.88 0.08 250);
	--color-primary-300: oklch(0.8 0.12 250);
	--color-primary-400: oklch(0.7 0.16 250);
	--color-primary-500: oklch(0.6 0.18 250);
	--color-primary-600: oklch(0.52 0.18 250);
	--color-primary-700: oklch(0.44 0.16 250);
	--color-primary-800: oklch(0.37 0.14 250);
	--color-primary-900: oklch(0.31 0.11 250);
	--color-primary-950: oklch(0.22 0.08 250);

	/* --color-danger-*, --color-warning-*, --color-success-* follow the same 50-950 shape */
}
```

A plain `:root` block defining these scales is enough. Any two apps that supply the same `--color-*` scales render the same design, since every component reads from the derived `--ui-*` contract rather than from hardcoded values.

### Basic example

Every component follows the Handle pattern and is rendered as JSX, never called as a plain function:

```tsx
import type { Handle } from "remix/ui";

import { Badge } from "@pkg/r3-ui";

export function OrderStatus(handle: Handle<{ paid: boolean }>) {
	return () => (
		<Badge color={handle.props.paid ? "success" : "warning"}>
			{handle.props.paid ? "Paid" : "Pending"}
		</Badge>
	);
}
```

This renders as static server HTML — no hydration, no client JavaScript — with `data-color`/`data-variant` driving the component's styling entirely through CSS attribute selectors.

## API

Six entry points are available:

| Export                  | Source                    | Contains                                                                                                                                                                                                     |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@pkg/r3-ui`            | `src/index.ts`            | Every component (`Badge`, `Dialog`, `Button`, `Table`, …) and their compound subcomponents, re-exported from the package root.                                                                               |
| `@pkg/r3-ui/animations` | `src/animations/index.ts` | CSS-only animation `css()` factories (`fade`, `zoom`, `slide`, `enterExit`, `spin`, `pulse`, `shimmer`, `scrollShadow`, `scrollProgress`, `viewReveal`) plus the shared `durations`/`easings` motion tokens. |
| `@pkg/r3-ui/behaviors`  | `src/behaviors/index.ts`  | Headless, DOM-free `TypedEventTarget` classes (`Toaster`, `Announcer`, `SelectionModel`, `FilterModel`, `CalendarModel`, `DragSession`, `ResizeSession`).                                                    |
| `@pkg/r3-ui/mixins`     | `src/mixins/index.ts`     | Opt-in `createMixin`-based behaviors (`menuKeys`, `commandFilter`, `validate`, `dismiss`, `dropZone`, `themeToggle`, and the rest of the mixin catalog) applied through a component's `mix` prop.            |
| `@pkg/r3-ui/reset.css`  | `src/reset.css`           | The base reset (zeroed margins, border-box sizing, form-control inheritance, …), layered `@layer base, rmx;`.                                                                                                |
| `@pkg/r3-ui/theme.css`  | `src/theme.css`           | The `--ui-*` semantic variable layer (`:root`, `.dark`, `.system`).                                                                                                                                          |

Every public export — components and their props, mixins, behavior classes, animation factories — carries its own JSDoc, so hover/autocomplete in the editor is the first documentation surface. A browsable, per-component documentation site renders on top of it (source examples, hydration notes, accessibility guidance) and complements this README rather than replacing it.

The library's only runtime dependencies are `remix`, which provides the Handle pattern and `css()` styling, and `@pkg/lucide-remix`, which supplies every built-in icon (select chevrons, toast icons, checkbox checkmarks, calendar navigation).

## Patterns

### Pattern: applying a mixin to a pure UI component

Library components ship no JavaScript. When a widget needs interactivity, the app's island applies the matching mixin from the mixins entry point — the components stay pure UI either way:

```tsx
// App island — the only hydrated code. The Command components are pure UI;
// commandFilter() is what makes them interactive.
import type { Handle } from "remix/ui";

import { Command } from "@pkg/r3-ui";
import { commandFilter } from "@pkg/r3-ui/mixins";

export function SearchPalette(handle: Handle<{ pages: Array<Page> }>) {
	return () => (
		<Command mix={commandFilter()}>
			<Command.Input placeholder="Search pages..." />
			<Command.List>
				{handle.props.pages.map((page) => (
					<Command.Item key={page.id} value={page.title}>
						{page.title}
					</Command.Item>
				))}
			</Command.List>
			<Command.Empty>No results found.</Command.Empty>
		</Command>
	);
}
```

Only the island that applies the mixin gets a `clientEntry(...)` — a page that sticks to baseline behavior ships zero library JavaScript.

### Pattern: behavior classes power hydrated widgets

State with real shape — a toast queue, a selection set — lives in a headless behavior class from the behaviors entry point, not in the component or the mixin. The class is DOM-free and unit-testable on its own; the island subscribes to it and re-renders:

```tsx
// App island — Toaster is a headless class; the Toast components stay pure UI.
import type { Handle } from "remix/ui";

import { Toast } from "@pkg/r3-ui";
import { Toaster } from "@pkg/r3-ui/behaviors";

export function AppToaster(handle: Handle) {
	let toaster = new Toaster();
	toaster.addEventListener("change", () => handle.update(), {
		signal: handle.signal,
	});
	handle.context.set({ toaster });

	return () => (
		<Toast.Region>
			{toaster.toasts.map((toast) => (
				<Toast key={toast.id} type={toast.type} onDismiss={() => toaster.dismiss(toast.id)}>
					{toast.title}
				</Toast>
			))}
		</Toast.Region>
	);
}

// Any descendant of the island:
// handle.context.get(AppToaster).toaster.success("Saved");
```

### Pattern: the custom-command trigger contract

Invoker Commands aren't limited to the built-in `show-modal`/`close`/`toggle` values: any `command` prefixed with `--` dispatches a `CommandEvent` on its `commandfor` target with no built-in behavior, and the library adopts this as the standard trigger contract between static server buttons and hydrated widgets:

- A widget-root mixin listens for `command` on its host and switches on `event.command`. Library commands use the `--ui-` prefix (e.g. `--ui-next`, `--ui-dismiss`, `--ui-toggle`); unknown commands are ignored, so an app's own `--` commands can safely target the same elements.
- Trigger buttons stay static server HTML with no mixin and no hydration of their own — `<button commandfor="cart-carousel" command="--ui-next">` works anywhere on the page, including outside the island that owns the widget.
- Parameters ride the invoker: `event.source` is the triggering button, so `<button commandfor="cart-carousel" command="--ui-goto" data-slide="3">` carries its payload in `event.source.dataset`.

This keeps islands as small as the widget root itself — every external control is declarative, hydration-free markup wired by `commandfor`.

## Tips

1. **Unlayered CSS beats every layer, including `rmx`** - `remix/ui` emits component styles under the `rmx` cascade layer, so `reset.css` → `theme.css` → component styles naturally stack in the right order. But an app's own _unlayered_ global rule (a bare `button { ... }` outside any `@layer` block) still outranks all of it. Keep app-level element globals inside a layer ordered before `rmx`, and reserve unlayered rules for overrides you actually intend to win.
2. **Check `TODO.md` for current status** - Not every component, mixin, and behavior class in the catalog is implemented yet; see [`TODO.md`](./TODO.md) in this package for the up-to-date implementation checklist before assuming an export exists.
3. **Non-color design tokens are overridable too** - Radii, control heights, and focus-ring width are emitted as custom properties with sensible default fallbacks (`var(--ui-radius-md, 0.375rem)`). An app that wants denser tables or squarer buttons sets a handful of variables instead of overriding styles per component.
4. **Reach for `parts` before reaching into internals** - Convenience wrappers like `TextField` accept a `parts` prop for per-part styling; if that isn't enough, compose the underlying compound components directly rather than fighting the wrapper.
