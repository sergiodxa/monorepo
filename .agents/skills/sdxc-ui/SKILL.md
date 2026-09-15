---
name: sdxc-ui
description: "@sdxc/ui is a catalog of styled, accessible `remix/ui` components rendered as server HTML — forms, overlays, navigation, feedback, charts, color and layout — with variants driven by `data-*` attributes and `--ui-*` variables. Use when building a page out of Dialog, Button, Form fields, Menu, Table, Toast or Chart, when adding DOM behavior through a `mix` mixin in a hydrated island, or for its headless behavior classes."
---

# @sdxc/ui

Every component is a plain function taking a `Handle<Props>` and rendered through JSX, with variants, states and colors driven by a `data-*` attribute contract and `--ui-*` semantic color variables applied through `css()` mixins. Baseline behavior comes from the platform — `<dialog>`, the Popover API, Invoker Commands, `<details>` and native form controls — so a page works before, and without, any client JavaScript. Interactivity is opt-in: a mixin applied through `mix` inside a hydrated island, usually over a headless behavior class. Subpaths carry the animations, behaviors, mixins, style recipes, framework-free utilities, and the reset and theme stylesheets. It builds on `remix`, `@sdxc/u` and `@sdxc/icons`.

Full API, options and examples: [packages/ui/README.md](packages/ui/README.md)

## When to reach for it

- A page needs a form, dialog, menu, table, toast, badge or card and should render as static server HTML.
- An overlay has to open and close without hydration, through `commandfor`/`command` against native `<dialog>` or the Popover API.
- A widget needs real interactivity — filtering, keyboard navigation, drag reorder, auto-dismiss — and you want the state in a testable class and the DOM work in a mixin.
- Component styling has to be retuned without forking: every measurement is an overridable `--ui-<component>-<property>` variable.
- A chart, a color picker, or a conversation log has to be built from parts rather than a third-party widget.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/ui": "workspace:*" } }
```

```tsx
import type { Handle } from "remix/ui";

import { Badge } from "@sdxc/ui";

export function OrderStatus(handle: Handle<{ paid: boolean }>) {
	return () => (
		<Badge color={handle.props.paid ? "success" : "warning"}>
			{handle.props.paid ? "Paid" : "Pending"}
		</Badge>
	);
}
```

Overlays ride native mechanisms, so a trigger is an ordinary button:

```tsx
import { Button, Dialog } from "@sdxc/ui";

<Button commandfor="invite-teammate" command="show-modal">
	{t("team.invite")}
</Button>
<Dialog id="invite-teammate">
	<Dialog.Header>
		<Dialog.Title>{t("team.inviteTitle")}</Dialog.Title>
	</Dialog.Header>
	<Dialog.Footer>
		<Dialog.Close>{t("actions.close")}</Dialog.Close>
	</Dialog.Footer>
</Dialog>;
```

Behavior is a mixin over a behavior class, inside a `clientEntry` island:

```tsx
import { Command } from "@sdxc/ui";
import { FilterModel } from "@sdxc/ui/behaviors";
import { commandFilter } from "@sdxc/ui/mixins";

let model = new FilterModel();

<Command mix={commandFilter(model)}>
	<Command.Input placeholder={t("search.placeholder")} />
	<Command.List>{/* Command.Item rows */}</Command.List>
</Command>;
```

### Entry points

- `@sdxc/ui` — every component and its compound parts: forms and fields, overlays and menus, navigation and data, feedback, color, charts and conversation, layout and content.
- `@sdxc/ui/animations` — CSS-only motion factories (`enterExit`, `fade`, `zoom`, `slide`, `spin`, `pulse`, `shimmer`, the scroll- and view-timeline ones) plus the shared `durations` and `easings` tokens.
- `@sdxc/ui/behaviors` — headless, DOM-free state classes on `TypedEventTarget`: `Toaster`, `SelectionModel`, `FilterModel`, `CalendarModel`, `DragSession`, `ResizeSession`, `ScrollFollowModel`, `Announcer`.
- `@sdxc/ui/mixins` — opt-in DOM behaviors applied through `mix`: keyboard patterns, filtering, drag and resize, dismissal, clipboard, theme toggling, form validation, and more.
- `@sdxc/ui/styles` — shared style recipes composed inside a `mix` array, such as `floatingSurface()`, `panelChrome()`, `interactiveTransition()` and `chartPalette()`.
- `@sdxc/ui/utils` — framework-free color, chart scale and path, geometry and field helpers, the DOM helpers the mixins share, and the shared types including `SemanticColor`.
- `@sdxc/ui/reset.css` and `@sdxc/ui/theme.css` — the base reset, and the `--ui-*` semantic variable layer.

## Suggestions

- Import `reset.css` and `theme.css` ahead of your own styles, then define the five palette scales (`brand`, `neutral`, `danger`, `warning`, `success`) as `--ui-color-{name}-{50..950}`; components read the derived semantic contract, never a raw scale value. An app that already ships an equivalent reset can import only `theme.css`.
- Every `color` prop takes the `SemanticColor` union — `"brand"`, `"neutral"`, `"success"`, `"warning"`, `"danger"` — and props become `data-*` attributes the style rules key off; compound parts hang off the root and mark their role with `data-slot`.
- The library ships no copy of its own: every visible or accessible string is a prop you supply, so route it through the app's localization rather than hardcoding.
- Only the island applying a mixin needs a `clientEntry`; a page that sticks to baseline behavior ships no library JavaScript. Keep state with real shape in a behavior class, let the island own the instance and re-render on its events, and keep the component pure UI.
- A `command` prefixed with `--` dispatches a `CommandEvent` on its `commandfor` target with no built-in behavior — that is the trigger contract between static server buttons and hydrated widgets, and library commands carry the `--ui-` prefix. `Button` sets `type="button"` itself when it carries `command`/`commandfor`; a hand-rolled `<button>` inside a form must spell that out ahead of those attributes or the platform runs nothing.
- Accessibility media features are handled centrally: reduced motion collapses every animation factory to an opacity-only fade, `prefers-contrast: more` promotes each role's border, and reduced transparency keeps blur additive over an opaque background.

## Related

- `@sdxc/u` — the utility mixins and `--ui-*` token layer the components style themselves with; skill `sdxc-u`
- `@sdxc/icons` — the glyph set the built-in components draw from; skill `sdxc-icons`
