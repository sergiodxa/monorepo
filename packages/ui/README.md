# @sdxc/ui

Styled, accessible `remix/ui` components rendered as server HTML.

Every component is a plain function taking a `Handle<Props>` and rendered through JSX, with
variants, states and colors driven by a `data-*` attribute contract and a set of `--ui-*`
semantic color variables applied through `css()` mixins.

Baseline behavior comes from the platform itself — `<dialog>`, the Popover API, Invoker
Commands, `<details>` and native form controls — so a page built from these components works
before, and without, any client JavaScript.

## Installation

```bash
npm add @sdxc/ui
```

Components render through `remix`, draw their built-in glyphs from
[`@sdxc/icons`](https://www.npmjs.com/package/@sdxc/icons), and read their theme variables
from [`@sdxc/u`](https://www.npmjs.com/package/@sdxc/u). All three install alongside this
package.

## Usage

### Render A Component

Every component takes a `Handle<Props>` and returns a render closure, and is used as JSX:

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

That is static server HTML: `color` becomes `data-color`, and a CSS attribute selector
paints the rest — no hydration, no client JavaScript.

### Set Up The Stylesheets

Import the reset and the theme ahead of your own styles, then define the five palette
scales the theme derives every semantic variable from:

```css
@import "@sdxc/ui/reset.css";
@import "@sdxc/ui/theme.css";

:root {
	--ui-color-brand-50: oklch(0.97 0.02 250);
	--ui-color-brand-500: oklch(0.6 0.18 250);
	--ui-color-brand-950: oklch(0.22 0.08 250);

	/* the same 50-950 shape for neutral, danger, warning and success */
}
```

`reset.css` zeroes margins, sets `box-sizing: border-box`, and lets form controls inherit
font and color. Every selector sits inside `:where()` for zero specificity, and the file
opens with `@layer base, rmx;` so component styles always win. It leaves `<dialog>`'s
`::backdrop` and the `dialog`/`[popover]` margins alone, since overlays rely on that native
centering — an app shipping an equivalent reset can import `theme.css` on its own.

`theme.css` is the `--ui-*` semantic layer: a light `:root` block, a `.dark` class on
`<html>` for forced dark mode, a `.system` class that follows `prefers-color-scheme`, and
the `--ui-chart-1` through `--ui-chart-8` categorical sequence for multi-series charts. Two
apps supplying the same scales render the same design, because components read the derived
contract rather than any raw scale value.

### Open A Dialog Without JavaScript

Overlays ride native platform mechanisms, so a trigger is an ordinary button:

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

The pairing is
[Invoker Commands](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
against the native
[`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)
element, so the page needs no open-state bookkeeping.

### Add Behavior With A Mixin

A widget that wants interactivity gets it from a mixin applied through `mix` inside a
hydrated island. The components themselves stay pure UI:

```tsx
import type { Handle } from "remix/ui";

import { clientEntry } from "remix/ui";

import { Command } from "@sdxc/ui";
import { FilterModel } from "@sdxc/ui/behaviors";
import { commandFilter } from "@sdxc/ui/mixins";

type Props = { pages: Array<{ id: string; title: string }> };

export default clientEntry(
	"/app/components/search-palette.tsx#default",
	function SearchPalette(handle: Handle<Props>) {
		let model = new FilterModel();

		return () => (
			<Command mix={commandFilter(model)}>
				<Command.Input placeholder={t("search.placeholder")} />
				<Command.List>
					{handle.props.pages.map((page) => (
						<Command.Item key={page.id} value={page.title}>
							{page.title}
						</Command.Item>
					))}
				</Command.List>
				<Command.Empty>{t("search.empty")}</Command.Empty>
			</Command>
		);
	},
);
```

Only the island that applies a mixin needs a `clientEntry`; a page that sticks to baseline
behavior ships no library JavaScript at all. Every example here writes user-facing copy as
`t(key)`, standing in for whatever localization function your app has — the library ships no
copy of its own, so each visible or accessible string is a prop you supply.

## API

Every export carries its own JSDoc, so hover and autocomplete give the full signature. What
follows is the index.

| Import                | Contains                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| `@sdxc/ui`            | Every component and its compound parts.                                               |
| `@sdxc/ui/animations` | CSS-only motion factories plus the shared `durations`/`easings` tokens.               |
| `@sdxc/ui/behaviors`  | Headless, DOM-free state classes built on `TypedEventTarget`.                         |
| `@sdxc/ui/mixins`     | Opt-in DOM behaviors applied through a component's `mix` prop.                        |
| `@sdxc/ui/styles`     | Shared style recipes composed inside a `mix` array.                                   |
| `@sdxc/ui/utils`      | Framework-free color, scale, path, geometry and field helpers, plus the shared types. |
| `@sdxc/ui/reset.css`  | The base reset.                                                                       |
| `@sdxc/ui/theme.css`  | The `--ui-*` semantic variable layer.                                                 |

### The Shared Contract

One contract covers the whole catalog, which is what keeps the component index below to a
line each.

**Props become `data-*` attributes.** `color`, `variant`, `size` and their neighbours are
written onto the host element, and every style rule keys off them. Wherever a `color` prop
appears it takes one of `"brand"`, `"neutral"`, `"success"`, `"warning"` or `"danger"` — the
`SemanticColor` union — and the theme resolves the actual values.

**Compound parts hang off the root.** `Dialog.Header`, `Card.Title`, `Chart.Legend.Item`:
each is its own component with its own props, and `data-slot` marks its role in the layout.

**`mix` styles the host.** It takes a `css()` call, a style recipe, an animation factory, or
an array of them. A wrapper rendering several elements takes a `parts` prop instead, one
`mix` per named part.

**Every measurement is an overridable variable**, emitted as
`var(--ui-<component>-<property>, <default>)`, so retuning a component is one declaration.
One radius scale is shared across every rounded surface — `--ui-radius-none` (`0px`), `-sm`
(`0.25rem`), `-md` (`0.375rem`), `-lg` (`0.5rem`), `-xl` (`0.75rem`), `-full` (`9999px`) —
and well over a hundred more are scoped to a single component each, among them
`--ui-sidebar-width` (`16rem`), `--ui-sheet-size` (`24rem`), `--ui-slider-thumb-size`
(`1.25rem`), `--ui-popover-offset` (`0.5rem`) and `--ui-chart-line-width` (`2px`). Each is
named in the JSDoc of the component that reads it.

**Accessibility media features are handled centrally.** `prefers-reduced-motion: reduce`
collapses every animation factory to an opacity-only fade, `prefers-contrast: more` promotes
each color role's border to its stronger value, and `prefers-reduced-transparency: reduce`
keeps `backdrop-filter` blur additive over an already-opaque background.

### Components: Forms

- `Form` — the wrapper a multi-field layout starts from; set `issues` from a `parseSafe`
  result and each field beneath reads its own errors by name.
- `Label`, `Description`, `FieldError` — a control's caption, its supporting copy as a `<p>`
  for `aria-describedby`, and its validation message with a stable id.
- `Input`, `TextArea` — a single-line native text field (the foundation the other text
  controls build on) and a multi-line one that grows through `field-sizing: content`.
- `TextField`, `DateField`, `TimeField` — labeled, described, validated wrappers around a
  text, date, or time input.
- `NumberField`, `OtpField` — a number input framed with decrement and increment buttons,
  and a one-time-code field with a numeric keyboard and the platform's autofill hint.
- `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `ToggleButton` — native checked-state
  controls: a styled checkbox, the landmark grouping a run of them, mutually exclusive
  radios sharing one name, an on/off pill, and a button carrying `aria-pressed`.
- `Slider`, `Meter`, `ProgressBar` — a range input with a fill track and an `<output>`, and
  styled native `<meter>` and `<progress>`; an unset `value` on the last drops into the
  indeterminate state.
- `Select`, `ComboBox`, `SearchField` — a native `<select>` upgraded to customizable-select
  rendering wherever the browser resolves `appearance: base-select`, a text control paired
  with a `<datalist>`, and a `<search>` landmark around a `type="search"` control.
- `FileTrigger`, `DropZone` — a pressable surface opening the file picker, and a dashed drop
  target, both backed by a native file input.

### Components: Overlays And Menus

Each surface rides one of three native mechanisms: `<dialog>` with Invoker Commands, the
[Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) with CSS anchor
positioning, or a custom `--ui-*` command answered by a mixin.

- `Dialog` — a modal built on native `<dialog>`, opened and closed through
  `commandfor`/`command`.
- `AlertDialog` — an interruptive modal sealed against light dismiss
  (`closedby="closerequest"`).
- `Modal`, `Drawer`, `Sheet` — `Dialog` presets: pop-in motion, an edge-docked panel, and a
  fixed inline-side column.
- `Confirm` — a two-control confirmation prompt in one call; pass `form` and the confirming
  control submits a real form.
- `Popover`, `Tooltip`, `HoverCard` — a surface anchored to whatever invoker opened it, a
  small label revealed by `:hover`/`:focus-visible` on the preceding sibling, and a detail
  panel revealed by `:hover`/`:focus-within` on a shared root.
- `Menu`, `Menubar`, `ContextMenu` — a popover-based menu surface, a horizontal row of
  triggers each opening one, and a menu meant to open at a right-click's pointer position.
- `NavigationMenu` — a row of navigation triggers, each a link or a button opening a panel
  of related links.
- `Command` — a bordered panel listing selectable rows for searching among a set of actions.
- `OverlayArrow` — a pointer glyph anchoring a floating surface back to its trigger.

### Components: Navigation And Data

- `Button` — a single immediate action; `isPending` swaps content for a spinner while
  keeping the footprint.
- `Link`, `NavLink`, `LinkButton` — an inline anchor kept underlined, a navigation link
  colored by a semantic role, and a link styled as a button.
- `Tabs` — tabs whose active view comes from routing: whichever `.Tab` points at the current
  page carries `aria-selected="true"`.
- `Breadcrumbs`, `Pagination` — a trail of parent sections, and a landmark for moving
  between pages of results.
- `Sidebar` — an application shell's navigation rail; collapse rides one checkbox's native
  `:checked` state.
- `Disclosure`, `Accordion` — a single expand/collapse section built on `<details>`, and a
  divider-separated stack of them.
- `Table` — tabular data whose column headers become sort links and whose trailing row
  becomes a load-more link, both from URLs you compute.
- `GridList`, `Tree`, `ListBox` — an interactive row list, a hierarchical list of nested
  `<details>`, and a run of selectable rows built from visually-hidden inputs.
- `SelectionIndicator`, `DropIndicator` — a marker reserving its own layout slot for the
  current selection, and a bar marking a drop position.

### Components: Feedback

- `Alert`, `Toast` — an inline status panel with `role="alert"` and a configurable
  politeness, and a transient notification whose `.Region` stacks the queue.
- `Badge`, `TagGroup` — a compact status pill, and a labeled set of pills each optionally
  paired with a remove control.
- `Skeleton`, `Spinner`, `Empty` — a loading placeholder block, a busy indicator inside a
  `role="progressbar"` host, and a dashed placeholder for a section with nothing to show.

### Components: Color

- `ColorSwatch` — a preview box for one CSS color, backed by a checkerboard so translucent
  values read correctly.
- `ColorArea`, `ColorWheel`, `ColorSlider` — a 2D saturation/brightness picker from two
  overlaid range inputs, a circular hue picker from one, and a single-channel (`hue`,
  `saturation`, `lightness`, `alpha`) control.
- `ColorSwatchPicker` — mutually exclusive preset colors built from native radios.
- `ColorField`, `ColorPicker` — a labeled, described, validated color text field with a live
  swatch, and that field extended with a trigger and a popover-hosted picking surface.

### Components: Charts And Conversation

- `Chart` — the coordinate space every Cartesian series renders into, with `.Line`, `.Area`,
  `.Pie`, `.Bar`, `.Legend` and `.Tooltip` parts.
- `Message`, `MessageScroller` — a conversational turn laid out with grid areas keyed off
  each part's `data-slot`, and a scrollable log frame whose content is a `role="log"`.
- `Bubble`, `Marker`, `Attachment` — the framed surface inside a turn's content slot, an
  inline row calling out a small event between turns, and a card for one attached file.

### Components: Layout And Content

- `Card` — a bordered, tinted panel grouping a header, content, and footer actions.
- `ImagePlaceholder` — a fixed-size image-with-fallback box; `Avatar` and `Logo` are its
  circular and rounded-square presets.
- `AspectRatio`, `Resizable`, `ScrollArea`, `Carousel` — a ratio lock, a split-pane layout
  of panels and handles, a bordered scrollable region, and a slide collection riding CSS
  scroll snap.
- `Group`, `Section`, `Separator`, `Toolbar` — a cluster of related controls, a grouping
  inside a listbox or menu, a divider, and a strip of controls along one axis.
- `Item` — a single-line row with leading media, title and description, and trailing
  actions.
- `Text`, `Header`, `Keyboard`, `Typeset` — muted body copy, an uppercase section label in a
  `<header>`, a shortcut hint in a `<kbd>`, and a typography layer for already-rendered
  markup with `docs`, `chat` and `reading` presets.
- `HeadingScope`, `Heading` — an ambient heading-depth scope and the heading that reads it.
- `SharedElement` — a host carrying a stable view-transition identity across page loads.
- `Calendar`, `RangeCalendar`, `DatePicker`, `DateRangePicker` — a month grid for one day or
  a connected range, and either extended with a trigger and a popover-hosted calendar.
  Rendered with no children, `Calendar` falls back to a native `<input type="date">`.

### Mixins

A mixin is a `createMixin` adapter attached through `mix`. Each module opens with a doc
comment naming what the platform cannot express on its own and what still works when the
script never runs, so the cost of every behavior stays visible before you apply it.

| Mixin                           | Host                       | What it adds                                                                                                     |
| ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ariaChecked()`                 | a native checked control   | Keeps `aria-checked` following live checkedness, including across a radio group.                                 |
| `attachmentTrigger()`           | `Attachment.Trigger`       | Makes the whole card one activation target while nested buttons keep their own clicks.                           |
| `calendarKeys(model)`           | `Calendar.Grid`            | Arrow/Page/Home/End navigation over a `CalendarModel`, mirrored as roving `tabindex`.                            |
| `carouselControls()`            | `Carousel.Viewport`        | Answers `--ui-prev`/`--ui-next`/`--ui-goto` commands as `scrollBy()` calls.                                      |
| `channelSync()`                 | a `ColorSlider` group      | Keeps sibling channel gradients current with each other's live values.                                           |
| `chartTooltip()`                | a `Chart` root             | Tracks the nearest plotted point to the pointer or focus and fills the sibling `Chart.Tooltip`.                  |
| `clearField()`                  | a `SearchField` clear      | Empties its own `commandfor` input and reveals itself on mount.                                                  |
| `colorAreaDrag()`               | `ColorArea`                | Drags the root as one 2D gesture across its paired axis inputs.                                                  |
| `colorPreview()`                | `ColorField`               | Updates the paired `ColorSwatch` as a typed value parses.                                                        |
| `colorWheelDrag()`              | `ColorWheel`               | Reshapes the hue input into a ring and drags it as an angular gesture.                                           |
| `comboboxFilter()`              | `ComboBox.Input`           | As-you-type narrowing through `remix/ui/combobox`.                                                               |
| `commandFilter(model)`          | `Command`                  | Filtering against a `FilterModel`, mirrored onto items as `hidden`.                                              |
| `commandKeys(model)`            | `Command`                  | Arrow keys move the active match; Enter activates its nested link or button.                                     |
| `contextMenu(id)`               | `ContextMenu.Trigger`      | Opens the named popover at the pointer on right-click or the Context Menu key.                                   |
| `copyToClipboard()`             | a footer button            | Copies the text content of its `commandfor` target.                                                              |
| `dismiss(options?)`             | an alert or toast host     | An auto-dismiss countdown, pausable on hover, plus a `--ui-dismiss` command.                                     |
| `dragReorder(session)`          | `GridList` / `Tree`        | Pointer reorder against a `DragSession`, computing before/after/on drop position.                                |
| `dropZone(session)`             | `DropZone`                 | File drag-and-drop acceptance backed by a `DragSession`.                                                         |
| `dualRange()`                   | a two-thumb `Slider`       | Keeps paired range inputs ordered, clamping the moved thumb at its partner.                                      |
| `gridListKeys(model)`           | `GridList`                 | The ARIA grid keyboard pattern against a `SelectionModel`.                                                       |
| `headingLevelFallback(options)` | an island's heading root   | Recovers the ambient heading depth from `data-heading-level` at a hydration boundary.                            |
| `hotkey(combo)`                 | any `<dialog>`/`[popover]` | A document-level shortcut opening or closing its host regardless of focus.                                       |
| `imageFallback()`               | `Avatar` / `Logo` images   | Flags a failed image load, including retroactively for cached images.                                            |
| `listboxKeys()`                 | `ListBox`                  | Arrow/Home/End/typeahead through `remix/ui/listbox`.                                                             |
| `longPress(options?)`           | any element                | Fires once a pointer holds still past a duration and movement tolerance.                                         |
| `menuKeys(options?)`            | `Menu`                     | The WAI-ARIA menu pattern: roving tabindex, arrows, Home/End, typeahead.                                         |
| `menubarKeys(options?)`         | `Menubar`                  | The WAI-ARIA menubar pattern, handing off into whichever `Menu` opens.                                           |
| `messageFollow(model)`          | `MessageScroller.Viewport` | Bridges the viewport to a `ScrollFollowModel`: measurement, scroll intents, pinned state.                        |
| `otpSlots()`                    | an `OtpField` group        | Moves focus across slots and splits a pasted code.                                                               |
| `persist(key)`                  | a `Sidebar` root           | Mirrors the collapsed checkbox into a cookie and answers a `--ui-toggle` command.                                |
| `pressToggle()`                 | `ToggleButton`             | Flips `aria-pressed` on each click.                                                                              |
| `rangePreview(model)`           | `RangeCalendar.Grid`       | Hover and focus range preview against a `CalendarModel`'s pending anchor.                                        |
| `resizeHandle(axis, session)`   | `Resizable.Handle`         | Pointer resize against a `ResizeSession`, mirrored as a custom property.                                         |
| `stepper(options?)`             | `NumberField.Group`        | Press-and-hold repeat for the increment and decrement buttons.                                                   |
| `tabKeys(options?)`             | `Tabs.List`                | Delegated arrow/Home/End activation through the shared `remix/ui/tabs` context.                                  |
| `themeToggle(options?)`         | any host                   | Switches `<html>` between light, dark and system through commands, persisted to a cookie.                        |
| `treeKeys(model)`               | `Tree`                     | The WAI-ARIA tree pattern against a `SelectionModel`, typeahead included.                                        |
| `validate(schema)`              | a native form control      | Applies a `remix/data-schema` schema through `setCustomValidity()`, mirrored into a `FieldError`.                |
| `viewTransition()`              | a `SharedElement` island   | Bridges a same-document reload to the View Transition API.                                                       |
| `trackHostNode(handle)`         | inside a mixin             | Caches a mixin's live host node across insert and remove, for the mixins above that read the DOM outside render. |

### Behavior Classes

Headless, DOM-free state models. Each is unit-testable on its own, and an island subscribes
to it and re-renders.

- `Announcer` — a priority-ordered queue of `aria-live` announcements.
- `CalendarModel` — the keyboard-focused day, the visible month, and an in-progress range.
- `DragSession` — the dragged item, the drop candidate under the pointer, and the computed
  drop position.
- `FilterModel` — query, matched subset, and active match for search-as-you-type.
- `ResizeSession` — resize constraint solving across a panel group, cascading once a
  neighbor bottoms out.
- `ScrollFollowModel` — auto-follow pinning, anchor turn, visible messages, and pending
  scroll intents.
- `SelectionModel` — a selected-key set with toggle, contiguous-range, and select-all
  semantics.
- `Toaster` — a toast queue owning each toast's auto-dismiss timer and pause/resume.

### Animations

CSS-only `css()` factories keyed off native open states, all sharing `easings` (`standard`,
`decelerate`, `accelerate`, `linear`) and `durations` (`fast` 150ms, `normal` 200ms, `slow`
300ms, `slower` 400ms).

- `enterExit(options?)` — the composer: exit declarations on the host, entered state under
  `[open]`/`:popover-open` or a selector you name, a `@starting-style` block, and a
  reduced-motion override.
- `fade(options?)`, `zoom(options?)`, `slide(options)` — sugar over `enterExit` for a plain
  fade, a fade with a scale, and a fade with a directional offset.
- `spin(options?)`, `pulse(options?)` — continuous rotation for a busy glyph, and a gentle
  opacity breathe for a placeholder.
- `shimmer(options?)`, `textShimmer(options?)` — a sweeping highlight across a progress
  fill, and the same sweep through text via `background-clip: text`.
- `scrollShadow(options?)`, `scrollProgress(options?)`, `scrollFade(options?)` — a sticky
  header's shadow, a fill that grows with scroll distance, and faded scroll-container edges,
  all on `animation-timeline: scroll()`.
- `viewReveal(options?)` — an entry motion played as an element scrolls into view, on a
  `view()` timeline.

### Style Mixins

Recipes composed directly in a `mix` array.

- `floatingSurface()`, `panelChrome()`, `semanticColorPanel()` — the border, rounding, tint
  and elevation a floating surface carries; the border and rounding a framed panel applies;
  and the `&[data-color="…"]` branches a tinted panel keys its colors on.
- `interactiveTransition()` — the shared transition property, timing and duration for a
  control's hover, focus, press and validity changes.
- `fieldStackLayout()`, `outputCaptionText()` — the single-column stacking every field
  wrapper's host uses, and the muted caption typography every `<output>` shares.
- `graphicHostStyle()` — the flex-item layout and `currentColor` declarations a leading icon
  or loading graphic shares, so the two swap without shifting layout.
- `rangeThumbAppearance(sizeVar, borderWidthVar)` — the circular range thumb: appearance
  reset, fill and border, elevation, pressed scale, focus ring, disabled dimming.
- `rtlAwareGradientDirection(propertyName)` — a custom-property pairing behind a gradient
  direction, flipped under `&:dir(rtl)`.
- `chartPalette(property, combinator?)`, `legendToggle()` — paints one property from
  whichever of the `CHART_COLOR_SLOT_COUNT` `--ui-chart-*` slots an element's `data-color`
  names, and the position-keyed rules pairing a chart root with a later-sibling legend.

### Utilities

Plain TypeScript with no rendering dependency, importable on its own.

- **Color** — `parseColor`, `formatHex`/`formatRgb`/`formatHsl`, `rgbToHsl`/`hslToRgb`,
  `rgbToHsv`/`hsvToRgb`, `clampChannel`, `roundChannel`, and the `HSLColor`, `HSVColor`,
  `RGBColor`, `RGBAColor` interfaces.
- **Charts** — `linearScale`, `bandScale`, `ticks`, `linePath`, `areaPath`, `arcPath`,
  `pieAngles`, `computeMarkerIndices`, `HUE_GRADIENT_STOPS`.
- **Geometry** — `normalizedPointerPosition`, `angleFromCenter`, `angleToHue`/`hueToAngle`,
  `resolveFillPercent`, `FULL_TURN_RADIANS`, and the `Point`/`Rect` interfaces.
- **Fields** — `resolveFieldWiring` and `findPairedRangeInputs`, plus the `FieldWiring`,
  `FieldWiringOptions` and `FieldPartsProps` shapes behind every wrapper's `parts` prop.
- **DOM** — `asCommandEvent`, `dispatchChange`, `isNewPrimaryPress`, `isPrintableKey`,
  `focusItem`, `queryItems`, `setRovingTabindex`, `labelFor`, `hasAccessibleText`,
  `mergeStyle`, `prefersReducedMotion`, `writeCookie`, `DISABLED_SELECTOR`.
- **Types** — `SemanticColor` (the five-tone union every `color` prop resolves to),
  `AnchorPlacement`, `AriaInvalid`, `CSSStyles`, `StyleProp`, `FieldColor`.

## Pattern: A Behavior Class Behind A Hydrated Widget

State with real shape — a toast queue, a selection set — lives in a behavior class, not in
the component and not in the mixin. The island owns the instance and re-renders on its
events:

```tsx
import type { Handle } from "remix/ui";

import { clientEntry } from "remix/ui";

import { Toast } from "@sdxc/ui";
import { Toaster } from "@sdxc/ui/behaviors";

export const AppToaster = clientEntry(
	"/app/components/app-toaster.tsx#AppToaster",
	function AppToaster(handle: Handle) {
		let toaster = new Toaster<{ title: string; color?: Toast.Color }>();

		toaster.addEventListener("change", () => handle.update(), { signal: handle.signal });
		handle.context.set({ toaster });

		return () => (
			<Toast.Region aria-label={t("toasts.region")}>
				{toaster.toasts.map((toast) => (
					<Toast key={toast.id} color={toast.data.color}>
						<Toast.Content>
							<Toast.Title>{toast.data.title}</Toast.Title>
						</Toast.Content>
					</Toast>
				))}
			</Toast.Region>
		);
	},
);
```

Any descendant reaches the queue through context:
`handle.context.get(AppToaster).toaster.add({ title: t("toasts.saved") })`.

## Pattern: The Custom Command Trigger Contract

[Invoker Commands](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
go beyond the built-in `show-modal`, `close` and `toggle-popover` values: any `command`
prefixed with `--` dispatches a `CommandEvent` on its `commandfor` target with no built-in
behavior. That is the trigger contract between static server buttons and hydrated widgets.

A widget-root mixin listens for `command` on its host and switches on `event.command`.
Library commands carry the `--ui-` prefix (`--ui-next`, `--ui-dismiss`, `--ui-toggle`), and
unknown commands pass through, so an app's own `--` commands can target the same elements.
Trigger buttons stay static markup anywhere on the page, including outside the island that
owns the widget. Parameters ride the invoker — `event.source` is the triggering button, so
this carries its payload in `event.source.dataset`:

```tsx
<button commandfor="cart-carousel" command="--ui-goto" data-slide="3">
	{t("carousel.goto", { slide: 3 })}
</button>
```

`Button` renders `type="button"` on its own whenever it carries `command` or `commandfor`,
as do `Dialog.Close`, `AlertDialog.Cancel` and the other invoker parts. A button inside a
`<form>` otherwise defaults to `"submit"`, and the platform then treats the pairing as
ambiguous and runs nothing. A hand-rolled `<button commandfor=…>` inside a form spells
`type="button"` out, written ahead of `command`/`commandfor`, since the platform judges the
pairing as it parses those attributes.

## Pattern: The Ambient Heading Scope

`HeadingScope` publishes a heading depth through `handle.context`, one level deeper than the
`HeadingScope` it is nested inside, or `1` where nothing wraps it. `Heading` — and every
title slot, such as `Dialog.Title`, `Alert.Title` and `Empty.Title` — reads that depth:

```tsx
<HeadingScope>
	<Heading>{t("doc.title")}</Heading> {/* <h1>, no ancestor scope */}
	<HeadingScope>
		<Heading>{t("doc.section")}</Heading> {/* <h2>, one level deeper */}
	</HeadingScope>
</HeadingScope>
```

An independently hydrated island has no ancestor context to read, even where the
server-rendered page nests it under a real scope. Threading the level down as an explicit
`level` prop is the first choice. Where that is impractical, apply
`headingLevelFallback({ onLevel })` to the island's own `HeadingScope`: it reads the
`data-heading-level` attribute `HeadingScope` and `Heading` already stamp on the DOM, hands
the detected `HeadingLevel` to the callback once on attach, and the island stores it and
re-renders with `level` set.

## Pattern: Composing Recipes In One `mix` Array

A style recipe, an animation factory, and a local `css()` call compose as disjoint siblings
in one array:

```tsx
import { css } from "remix/ui";

import { zoom } from "@sdxc/ui/animations";
import { floatingSurface, interactiveTransition } from "@sdxc/ui/styles";

<div
	id="account-menu"
	popover="auto"
	mix={[
		floatingSurface(),
		interactiveTransition(),
		zoom({ scale: 0.95, duration: 150 }),
		css({ margin: "0", inset: "auto", paddingBlock: "0.5rem" }),
	]}
>
	{menuItems}
</div>;
```

`floatingSurface()` supplies the chrome, `interactiveTransition()` the shared transition
triplet for descendants, and `zoom()` the open and close motion off the popover's own
`:popover-open` state.

Each entry compiles to one hashed class in its own cascade sublayer, and a class's layer
position is fixed the first time that exact declaration set appears on the page — so `mix`
is where declarations the component does not already set belong. To settle a declaration the
component already makes, four routes win outright: the `style` prop, an inline override of
the component's own token (`style={{ "--ui-text-2xl": "0.875rem" }}`), a `raw()` declaration
marked `!important`, or a rule in an app cascade layer declared after `rmx`.

## Pattern: Styling One Part Of A Wrapper

A wrapper rendering more than one host element takes a `parts` prop, one `mix` per named
part. `TextField`'s four — `label`, `input`, `description`, `error` — are the base shape
every field wrapper extends:

```tsx
import { css } from "remix/ui";

import { TextField } from "@sdxc/ui";

<TextField
	label={t("form.username.label")}
	name="username"
	parts={{ input: css({ fontFamily: "var(--ui-font-mono)" }) }}
/>;
```

`ColorField` adds `control` (the row wrapping input and swatch) and `swatch` to that base.
`Confirm` exposes parts matching each of its composed pieces — `header`, `title`,
`description`, `footer`, `cancel`, `action`, and `form` in submit mode. Where `parts` runs
out, composing the underlying components directly — `Label` plus `Input` plus `Description`
plus `FieldError`, or `AlertDialog` and its own parts — covers the rest.

## Pattern: A Confirmed Destructive Action

Given a `form` prop, `Confirm` wraps its content in a real `<form>` and the confirming
control becomes that form's submit button, so a destructive action runs as an ordinary form
post with no client JavaScript. `fields` renders the hidden inputs the submission needs:

```tsx
import { Button, Confirm } from "@sdxc/ui";

<Button commandfor="revoke-session" command="show-modal" color="danger">
	{t("session.revoke")}
</Button>
<Confirm
	id="revoke-session"
	title={t("session.revokeTitle")}
	confirmLabel={t("actions.revoke")}
	cancelLabel={t("actions.cancel")}
	form={{
		action: revokeUrl,
		fields: <input type="hidden" name="intent" value="revoke" />,
	}}
/>;
```

Without `form`, the confirming control closes the panel and the page decides what a
confirmed decision means. The cancel control stays a close-command button in both modes, so
cancelling never submits. Submit mode renders a `<form>`, so the panel belongs outside any
other form's markup, per the platform's own nesting rule. For a shape this does not cover,
compose `AlertDialog` directly and give `AlertDialog.Action` a `type="submit"`: it then
submits the enclosing form instead of running a command.

## Pattern: A Validated Form

`Form` takes a parsed validation result and hands each field its own errors by name through
context. The canonical shape is an action that parses the submission and re-renders the same
page with `issues` set:

```tsx
import type { Handle } from "remix/ui";

import * as s from "remix/data-schema";
import { parseSafe } from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

import { Button, Form, TextField } from "@sdxc/ui";

let ContactSchema = f.object({
	email: f.field(s.string().pipe(checks.minLength(1), checks.email())),
});

function ContactPage(handle: Handle<{ issues?: ReadonlyArray<Form.Issue> }>) {
	return () => (
		<Form method="post" issues={handle.props.issues}>
			<TextField label={t("contact.email.label")} name="email" type="email" required />
			<Button type="submit">{t("contact.submit")}</Button>
		</Form>
	);
}

// In the handler for the POST:
let result = parseSafe(ContactSchema, formData);
if (!result.success) return render(<ContactPage issues={result.issues} />, { status: 400 });
```

The native constraint attributes (`required`, `type="email"`) block submission with no
JavaScript at all, and a failed parse re-renders the same page with its issues carried
through a plain prop.

`issues` is the only thing the page passes: `TextField`, `DateField`, `TimeField` and
`ColorField` each look their own message up by `name` through form context. A field found in
`issues` renders its `FieldError`, marks `aria-invalid`, wires `aria-describedby` at the
message, and — for the first invalid field of the render — picks up `autofocus`. An explicit
`errorMessage` or `autoFocus` decides that field instead, for a message the schema does not
produce.

## Pattern: A Chart With A Legend

`Chart.Legend` renders as a later sibling of the chart root, and each `Chart.Legend.Item`
appears in the same order as its matching series: the toggle wiring keys off sibling
position rather than a series id.

```tsx
import { css } from "remix/ui";

import { Chart } from "@sdxc/ui";

<>
	<Chart
		width={480}
		height={240}
		xDomain={[0, 11]}
		yDomain={[0, 5000]}
		aria-label={t("chart.label")}
	>
		<Chart.Line color={1} points={revenuePoints} />
		<Chart.Line color={3} points={refundPoints} parts={{ path: css({ strokeDasharray: "4 4" }) }} />
	</Chart>
	<Chart.Legend aria-label={t("chart.legend")}>
		<Chart.Legend.Item color={1}>{t("chart.series.revenue")}</Chart.Legend.Item>
		<Chart.Legend.Item color={3}>{t("chart.series.refunds")}</Chart.Legend.Item>
	</Chart.Legend>
</>;
```

Each point carries `x`, `y` and a `label` that becomes its native `<title>`, and every wedge,
bar and marker stays keyboard-reachable on its own — this chart needs no `clientEntry` at
all. `chartTooltip()` is the separate, opt-in mixin for a floating tooltip synced to the
nearest point under the pointer or focus.

## Pattern: A Message Thread

`MessageScroller`, `Message`, `Bubble` and `Marker` compose into a conversational thread, and
`messageFollow()` bridges the viewport to a `ScrollFollowModel` so the log follows new turns
until a person scrolls away from the live edge:

```tsx
import { css } from "remix/ui";

import { Bubble, Message, MessageScroller } from "@sdxc/ui";
import { ScrollFollowModel } from "@sdxc/ui/behaviors";
import { messageFollow } from "@sdxc/ui/mixins";

let model = new ScrollFollowModel({ pinned: true });

<MessageScroller mix={css({ blockSize: "32rem" })}>
	<MessageScroller.Viewport mix={messageFollow(model)}>
		<MessageScroller.Content>
			{turns.map((turn, index) => (
				<MessageScroller.Item key={turn.id} messageId={turn.id} scrollAnchor={index === 0}>
					<Message>
						<Message.Content>
							<Bubble align={turn.isSelf ? "end" : "start"} variant="muted">
								<Bubble.Content>{turn.text}</Bubble.Content>
							</Bubble>
						</Message.Content>
					</Message>
				</MessageScroller.Item>
			))}
		</MessageScroller.Content>
	</MessageScroller.Viewport>
	<MessageScroller.Button aria-label={t("chat.jumpToLatest")}>
		{t("chat.jumpToLatest")}
	</MessageScroller.Button>
</MessageScroller>;
```

`MessageScroller.Item`'s `messageId` is required and unique per turn.
`MessageScroller.Button` starts `hidden` and is revealed by the
`messageFollow()`/`ScrollFollowModel` pairing.

## Pattern: A ColorPicker Composition

`ColorPicker.Dialog` hosts whichever picking surfaces a page wants. Each part operates on its
own through its native range or text input, and sharing one live color across the composition
is the island's job — it listens for each part's change event and re-renders the others:

```tsx
import { ColorArea, ColorField, ColorPicker, ColorWheel } from "@sdxc/ui";
import { colorAreaDrag, colorPreview, colorWheelDrag } from "@sdxc/ui/mixins";

<ColorPicker.Dialog id="brandColor-panel">
	<ColorArea
		aria-label={t("colorPicker.area")}
		hue={hue}
		defaultSaturation={saturation}
		defaultValue={brightness}
		mix={colorAreaDrag()}
	>
		<ColorArea.SaturationThumb data-color-area-axis="x" aria-label={t("colorPicker.saturation")} />
		<ColorArea.ValueThumb data-color-area-axis="y" aria-label={t("colorPicker.brightness")} />
	</ColorArea>

	<ColorWheel aria-label={t("colorPicker.hue")} defaultValue={hue} mix={colorWheelDrag()} />
	<ColorField label={t("colorPicker.hex")} format="hex" mix={colorPreview()} />
</ColorPicker.Dialog>;
```

`ColorSlider` and `ColorSwatchPicker` drop into the same panel for a per-channel track and a
preset row. `ColorArea.SaturationThumb` and `.ValueThumb` carry an explicit
`data-color-area-axis` so `colorAreaDrag()` can pair them. Server-rendered alone, each part
still works through keyboard and native range operation; the island is what keeps the
siblings in sync.

## Pattern: Development-Mode Contract Warnings

Where the type system cannot enforce a required accessibility wiring, a component logs a
`console.warn` gated behind `import.meta.env.DEV`, stripped entirely from production
bundles — an icon-only `Button` or `Menu.Item` with no visible text and no `aria-label`, a
`Command.Item` rendered without the `value` a filter matches against, a `Menubar`,
`Toast.Region` or `Table` rendered without the `aria-label`/`aria-labelledby` identifying the
landmark, a `Dialog` rendered without the `id` a trigger's `commandfor` targets. These are a
development-time nudge rather than runtime validation, so rendering continues either way.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/ui": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
