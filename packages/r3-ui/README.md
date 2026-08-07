# @pkg/r3-ui

A styled, accessible component library for `remix/ui`, rendered as server HTML and styled entirely through `css()` mixins.

## Overview

This package is a component catalog built on the Handle pattern: every component — with no exceptions — is a plain function that takes a `Handle<Props>` and returns a render closure, rendered only through JSX (`<Button />`), never called directly. Every variant, state, and color combination is driven by a `data-*` attribute contract (`data-color`, `data-variant`, `data-size`, `data-slot`, …) plus a set of `--ui-*` semantic color variables, styled through `css()` mixins applied to each component's host element. Baseline behavior comes from the platform itself — `<dialog>`, the Popover API, Invoker Commands (`commandfor`/`command`), `<details>`, and native form controls — so a page that renders only these components works correctly before, and without, any client JavaScript. The only two runtime dependencies are `remix` and `@pkg/lucide-remix`, which supplies every built-in icon.

Theming reads entirely from `--ui-*` semantic variables, which `theme.css` derives from five `--color-*` scales a consuming app defines once. Light mode is the bare `:root` block; a `.dark` class forces dark mode and a `.system` class follows the OS preference. Three accessibility media features get baseline handling rather than per-component discretion: `prefers-reduced-motion: reduce` collapses every animation-layer factory to an opacity-only fade, `prefers-contrast: more` promotes every color role's border to its stronger value centrally in `theme.css`, and `prefers-reduced-transparency: reduce` keeps `backdrop-filter` blur strictly additive over an already-opaque background wherever a floating surface uses it.

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

- **`reset.css`** is a base reset (zeroed margins, `box-sizing: border-box`, form controls inheriting font/color, …), every selector wrapped in `:where()` for zero specificity, opened with `@layer base, rmx;` so it always loses to component styles. It deliberately leaves `<dialog>`'s `::backdrop` and `dialog`/`[popover]` margin behavior untouched, since components rely on that native centering. Apps that already ship an equivalent reset can skip importing it.
- **`theme.css`** is the `--ui-*` semantic variable layer (light `:root`, forced-dark `.dark`, system-dark `.system`) — plain CSS with no cascade layer of its own.

### Define your color scales

Components read semantic `--ui-*` variables, which `theme.css` derives from five `--color-*` scales your app must define — `primary`, `neutral`, `danger`, `warning`, `success` — each with an 11-step scale from `50` through `950`:

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

A plain `:root` block defining these scales is enough. Any two apps that supply the same `--color-*` scales render the same design, since every component reads from the derived `--ui-*` contract rather than from a raw scale value. `theme.css` also derives a categorical, non-per-color sequence — `--ui-chart-1` through `--ui-chart-8` — for the `Chart` family and anything else that needs a rotating set of distinguishable tones rather than a single semantic role.

### Overridable component tokens

Every component-specific measurement — a size, a gap, a delay, a stroke width — is emitted as its own CSS custom property with the default baked in as the fallback, following `var(--ui-<component>-<property>, <default>)`. Overriding one is a single declaration; no component style needs touching:

```css
:root {
	--ui-radius-md: 0.5rem;
	--ui-sidebar-width: 18rem;
	--ui-hover-card-open-delay: 0.6s;
}
```

One radius scale is shared across every rounded surface in the catalog:

| Token              | Default    |
| ------------------ | ---------- |
| `--ui-radius-xs`   | `0.125rem` |
| `--ui-radius-sm`   | `0.25rem`  |
| `--ui-radius-md`   | `0.375rem` |
| `--ui-radius-lg`   | `0.5rem`   |
| `--ui-radius-xl`   | `0.75rem`  |
| `--ui-radius-full` | `9999px`   |

Well over a hundred more are scoped to a single component each — `--ui-sidebar-width` (`16rem`), `--ui-sheet-size` (`24rem`), `--ui-slider-thumb-size` (`1.25rem`), `--ui-switch-track-inline-size` (`2.75rem`), `--ui-popover-offset` (`0.5rem`), `--ui-hover-card-open-delay` (`0.4s`) / `--ui-hover-card-close-delay` (`0.2s`), `--ui-tree-indent` (`1.25rem`), and `--ui-chart-line-width` (`2px`) among them. Each one is named in the JSDoc of the component that reads it.

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

This renders as static server HTML — no hydration, no client JavaScript — with `data-color` driving the component's styling entirely through CSS attribute selectors.

### The other entry points

Every non-CSS entry point is a plain barrel import:

```tsx
import { Button, Dialog } from "@pkg/r3-ui";
import { fade, spin } from "@pkg/r3-ui/animations";
import { SelectionModel, Toaster } from "@pkg/r3-ui/behaviors";
import { menuKeys, validate } from "@pkg/r3-ui/mixins";
import { floatingSurface, focusRingPrimary } from "@pkg/r3-ui/styles";
import { parseColor } from "@pkg/r3-ui/utils";
```

Every example below that requires an accessibility string or visible copy uses a placeholder `t(key)` call standing in for whatever localization function a consuming app already wires up — the library ships no copy of its own, so every user-facing or accessible string is a required prop the consumer supplies.

## API

Every public export — every component and its props, every mixin, every behavior class, every animation and style factory — carries its own JSDoc, so hover and autocomplete in the editor are the first documentation surface. What follows is a browsable, categorized index across the catalog's roughly 100 components, 38 mixins, 8 behavior classes, 12 animation factories, and 14 style-mixin factories — not a prop-by-prop reference. Open the source file or hover the export in your editor for the full signature.

### Entry points

| Export                  | Source                    | Contains                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pkg/r3-ui`            | `src/index.ts`            | Every component and its compound subcomponents, re-exported from the package root.                                                                                                                                                                                                             |
| `@pkg/r3-ui/animations` | `src/animations/index.ts` | CSS-only motion factories (`fade`, `zoom`, `slide`, `enterExit`, `spin`, `pulse`, `shimmer`, `textShimmer`, `scrollShadow`, `scrollProgress`, `viewReveal`, `scrollFade`) plus the shared `durations`/`easings` tokens.                                                                        |
| `@pkg/r3-ui/behaviors`  | `src/behaviors/index.ts`  | Headless, DOM-free `TypedEventTarget` classes (`Announcer`, `CalendarModel`, `DragSession`, `FilterModel`, `ResizeSession`, `ScrollFollowModel`, `SelectionModel`, `Toaster`).                                                                                                                 |
| `@pkg/r3-ui/mixins`     | `src/mixins/index.ts`     | Opt-in `createMixin`-based DOM adapters (`menuKeys`, `validate`, `dismiss`, `dropZone`, `themeToggle`, and the rest of the 38-module mixin catalog) applied through a component's `mix` prop.                                                                                                  |
| `@pkg/r3-ui/styles`     | `src/styles/index.ts`     | Shared style-recipe factories (`focusRingPrimary`, `floatingSurface`, `panelChrome`, `semanticColorPanel`, and 10 more) composed directly inside a `mix` array.                                                                                                                                |
| `@pkg/r3-ui/utils`      | `src/utils/index.ts`      | Framework-free helper logic with no `remix/ui` dependency — color parsing and conversion (`parseColor`, `formatHex`/`formatRgb`/`formatHsl`, RGB/HSL/HSV conversions), scale and geometry math, the shared `SemanticColor` type, and the dev-mode accessible-name checks components call into. |
| `@pkg/r3-ui/reset.css`  | `src/reset.css`           | The base CSS reset (zeroed margins, border-box sizing, form-control inheritance, …), opened with `@layer base, rmx;`.                                                                                                                                                                          |
| `@pkg/r3-ui/theme.css`  | `src/theme.css`           | The `--ui-*` semantic variable layer (`:root`, `.dark`, `.system`).                                                                                                                                                                                                                            |

### Catalog areas

- [Form controls](#form-controls)
- [Overlays & menus](#overlays--menus)
- [Navigation & data display](#navigation--data-display)
- [Feedback & status](#feedback--status)
- [The `Color*` family](#the-color-family)
- [Chart & chat](#chart--chat)
- [Layout & media](#layout--media)
- [Mixins](#mixins)
- [Behavior classes](#behavior-classes)
- [Animations](#animations)
- [Style-mixin factories](#style-mixin-factories)

### Form controls

| Component                                                                    | Description                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Form`                                                                       | The wrapper every multi-field layout starts from; set `issues` from a `parseSafe` (or any Standard Schema) result and every field beneath it reads its own errors by name through component context. |
| `Label`                                                                      | A caption for a form control, associated by `htmlFor` or by wrapping the control as a child.                                                                                                         |
| `Description`                                                                | A short passage of supporting copy beneath a control, rendered as a native `<p>` for `aria-describedby` wiring.                                                                                      |
| `FieldError`                                                                 | A native field's validation message, styled in the danger foreground color, carrying a stable id and a `data-field-error` marker a validation script can locate.                                     |
| `Input`                                                                      | A single-line native text field and the shared foundation every other single-line text control builds on.                                                                                            |
| `TextArea`                                                                   | A multi-line native text field that grows with content through `field-sizing: content`.                                                                                                              |
| `TextField`                                                                  | A convenience wrapper composing a labeled, described, and validated text field in one call.                                                                                                          |
| `DateField`                                                                  | A convenience wrapper composing a labeled, described, and validated `<input type="date">` field in one call.                                                                                         |
| `TimeField`                                                                  | A convenience wrapper composing a labeled, described, and validated `<input type="time">` field in one call.                                                                                         |
| `NumberField` (+ `.Group`, `.Input`, `.DecrementButton`, `.IncrementButton`) | A numeric field pairing a native number input with decrement/increment buttons in one bordered frame; pairs with the `stepper()` mixin for press-and-hold repeat.                                    |
| `OtpField`                                                                   | A one-time-code field defaulting to a numeric keyboard and the platform's SMS/email autofill hint; pairs with the `otpSlots()` mixin for per-character slot focus.                                   |
| `Checkbox`                                                                   | A styled native checkbox paired with a decorative glyph box driven entirely by the input's own state.                                                                                                |
| `CheckboxGroup`                                                              | A landmark grouping a run of independently toggled checkboxes into one related set.                                                                                                                  |
| `RadioGroup` (+ `.Radio`)                                                    | Mutually exclusive options built from native radio inputs sharing one grouping name.                                                                                                                 |
| `Switch`                                                                     | A native checkbox styled and wired as an on/off pill switch.                                                                                                                                         |
| `ToggleButton`                                                               | A button toggling a pressed/unpressed state through `aria-pressed`; pairs with the `pressToggle()` mixin for the click behavior.                                                                     |
| `Slider` (+ `.Track`, `.Thumb`, `.Output`)                                   | A single-value range control pairing a native range input with a fill track and an `<output>`; pairs with the `dualRange()` mixin for a two-thumb variant.                                           |
| `Meter` (+ `.Indicator`, `.ValueLabel`)                                      | A styled native `<meter>` gauge paired with an optional value label.                                                                                                                                 |
| `ProgressBar` (+ `.Indicator`, `.ValueLabel`)                                | A styled native `<progress>` control; an unset `value` drops into the native indeterminate state, pairable with `shimmer()`/`pulse()`.                                                               |
| `Select` (+ `.Trigger`, `.Value`, `.Option`, `.Group`)                       | A native `<select>` progressively upgraded to customizable-select rendering wherever the browser resolves `appearance: base-select`.                                                                 |
| `ComboBox` (+ `.Group`, `.Input`, `.Button`)                                 | A text control paired with a native `<datalist>` of suggestions; pairs with the `comboboxFilter()` mixin for `remix/ui/combobox` narrowing.                                                          |
| `SearchField` (+ `.Input`)                                                   | A `<search>` landmark stacking a caption, a decorated `type="search"` control, and optional supporting/validation copy; pairs with the `clearField()` mixin for a single-field clear button.         |
| `FileTrigger`                                                                | A pressable surface opening the platform's file picker, backed by a native `<input type="file">` wrapped in a `<label>`.                                                                             |
| `DropZone`                                                                   | A dashed, centered drop target wrapping a native file input; the `data-drop-target` attribute it reads is written by a paired drag-and-drop mixin.                                                   |
| `ColorField`                                                                 | A convenience wrapper composing a labeled, described, validated color field with a live swatch preview — see the `Color*` family below.                                                              |

### Overlays & menus

Every surface here rides one of three native mechanisms: `<dialog>` plus Invoker Commands, the Popover API plus CSS anchor positioning, or a custom `--ui-*` Invoker Command answered by a mixin.

| Component                                                                                                                                                        | Description                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog` (+ `.Header`, `.Title`, `.Description`, `.Footer`, `.Close`)                                                                                            | A modal surface built on the native `<dialog>` element, opened and closed through `commandfor`/`command` instead of a JavaScript-tracked open state.                                                                                                                  |
| `AlertDialog` (+ same parts, `.Action`, `.Cancel`)                                                                                                               | An interruptive modal that demands an explicit response, sealed against light dismiss (`closedby="closerequest"`).                                                                                                                                                    |
| `Modal` (+ `Dialog`'s parts)                                                                                                                                     | A pre-animated `Dialog` preset with its panel's pop-in/pop-out motion already wired on the host.                                                                                                                                                                      |
| `Drawer` (+ `Dialog`'s parts)                                                                                                                                    | A `Dialog` preset docked flush against one physical viewport edge, sliding into place on open.                                                                                                                                                                        |
| `Sheet` (+ `Dialog`'s parts)                                                                                                                                     | A `Dialog` preset repositioned to a fixed inline-side column with a fluid `min(90vw, …)` measure.                                                                                                                                                                     |
| `Confirm`                                                                                                                                                        | A convenience wrapper composing a two-control `AlertDialog` confirmation prompt — heading, optional description, cancel/confirm pair — in one call; pass `form` and the confirming control submits a real form instead of just closing the panel.                     |
| `Popover`                                                                                                                                                        | A floating surface anchored to whatever invoker opened it, built entirely on the native Popover API and CSS anchor positioning.                                                                                                                                       |
| `Tooltip`                                                                                                                                                        | A small floating label revealed by plain `:hover`/`:focus-visible` selectors on the preceding sibling, riding `Popover`'s `"hint"` mode.                                                                                                                              |
| `HoverCard` (+ `.Trigger`, `.Content`)                                                                                                                           | A supplementary detail panel revealed by `:hover`/`:focus-within` on a shared root, stacked via `z-index` rather than the Popover API.                                                                                                                                |
| `Menu` (+ `.Item`, `.Separator`)                                                                                                                                 | A popover-based menu surface sized to its content; pairs with the `menuKeys()` mixin for the full ARIA menu keyboard pattern.                                                                                                                                         |
| `Menubar` (+ `.Trigger`)                                                                                                                                         | A horizontal row of top-level triggers, each opening its own `Menu` unchanged; pairs with `menubarKeys()`.                                                                                                                                                            |
| `ContextMenu` (+ `.Trigger`, `.Item`, `.Group`, `.Label`, `.Separator`, `.SubTrigger`, `.SubContent`, `.CheckboxItem`, `.RadioItem`, `.RadioGroup`, `.Shortcut`) | A `Menu`-based surface meant to open at a right-click's pointer position; its defining gesture requires the `contextMenu()` mixin — the one surface in this catalog with no working no-JS baseline for its trigger.                                                   |
| `NavigationMenu` (+ `.List`, `.Item`, `.Trigger`, `.Content`, `.Link`, `.Viewport`, `.ContentList`, `.ContentGrid`, `.ContentColumn`)                            | A row of top-level navigation triggers, each a plain link or a button opening a floating panel of related links, auto-paired through ambient component context.                                                                                                       |
| `Command` (+ `.Input`, `.List`, `.Item`, `.Empty`)                                                                                                               | A bordered, elevated panel listing selectable rows for searching and choosing among a set of actions; pairs with the `commandFilter()` mixin for as-you-type narrowing and match highlighting, and `commandKeys()` for arrow-key/Enter navigation across the matches. |

### Navigation & data display

| Component                                                                                                                                                                                                                                                                                                                                                       | Description                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tabs` (+ `.List`, `.Tab`, `.Panels`, `.Panel`)                                                                                                                                                                                                                                                                                                                 | A set of tabs whose active view comes from routing — whichever `.Tab` points at the current page carries `aria-selected="true"`; pairs with `tabKeys()`.          |
| `Breadcrumbs` (+ `.List`, `.Item`, `.Link`)                                                                                                                                                                                                                                                                                                                     | A trail of links marking the page's position within a hierarchy of parent sections.                                                                               |
| `Pagination` (+ `.List`, `.Item`, `.Link`, `.Button`)                                                                                                                                                                                                                                                                                                           | A navigation landmark for moving between pages of results.                                                                                                        |
| `NavLink`                                                                                                                                                                                                                                                                                                                                                       | An inline text link for site navigation, colored by a semantic role and underlined.                                                                               |
| `Link`                                                                                                                                                                                                                                                                                                                                                          | A native anchor for inline navigation, always underlined so its affordance never rests on color alone.                                                            |
| `LinkButton`                                                                                                                                                                                                                                                                                                                                                    | A navigation action styled to read as a button rather than inline text.                                                                                           |
| `Button`                                                                                                                                                                                                                                                                                                                                                        | An interactive control for a single, immediate action; `isPending` swaps content for a spinner while preserving footprint.                                        |
| `Sidebar` (+ `.Provider`, `.MobileNav`, `.Header`, `.Content`, `.Footer`, `.Nav`, `.Item`, `.Group`, `.GroupLabel`, `.GroupAction`, `.GroupContent`, `.Menu`, `.MenuItem`, `.MenuButton`, `.MenuLink`, `.MenuAction`, `.MenuBadge`, `.MenuSkeleton`, `.MenuSub`, `.MenuSubItem`, `.MenuSubButton`, `.MenuSubLink`, `.Rail`, `.Trigger`, `.Inset`, `.Separator`) | An application shell's primary navigation rail; collapse rides one checkbox's native `:checked` state, persistable across navigations with the `persist()` mixin. |
| `Disclosure` (+ `.Header`, `.Trigger`, `.Panel`, `.Group`)                                                                                                                                                                                                                                                                                                      | A single expand/collapse section built on native `<details>`/`<summary>`.                                                                                         |
| `Accordion` (+ `.Item`, `.Trigger`, `.Content`)                                                                                                                                                                                                                                                                                                                 | A set of expand/collapse sections built on `Disclosure`, stacked into one divider-separated list.                                                                 |
| `Table` (+ `.Container`, `.Header`, `.Body`, `.Column`, `.Row`, `.Cell`, `.LoadMore`)                                                                                                                                                                                                                                                                           | A tabular data display whose column headers become sort links and whose trailing row becomes a "load more" link, both driven by URLs the consumer computes.       |
| `GridList` (+ `.Item`, `.Section`, `.Header`, `.LoadMoreItem`, `.DragHandle`)                                                                                                                                                                                                                                                                                   | An interactive row list; pairs with `gridListKeys()` (a `SelectionModel` instance) for keyboard selection and `dragReorder()` for pointer reorder.                |
| `Tree` (+ `.Item`, `.ItemContent`, `.LoadMoreItem`, `.ExpandButton`)                                                                                                                                                                                                                                                                                            | A hierarchical list built from nested `<details>`/`<summary>`; pairs with `treeKeys()` (a `SelectionModel` instance) for the ARIA tree keyboard pattern.          |
| `ListBox` (+ `.Item`, `.LoadMoreItem`)                                                                                                                                                                                                                                                                                                                          | A run of selectable option rows sharing one native grouping name, built from visually-hidden radio/checkbox inputs; pairs with `listboxKeys()`.                   |

### Feedback & status

| Component                                                                                                       | Description                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Alert` (+ `.Icon`, `.Content`, `.Title`, `.Description`, `.Action`)                                            | An inline status message rendered as a bordered, tinted panel, announced via `role="alert"` and a configurable `aria-live` politeness.                                |
| `Toast` (+ `.Icon`, `.Loader`, `.Content`, `.Title`, `.Description`, `.Action`, `.Cancel`, `.Close`, `.Region`) | A transient notification panel; `.Region` is the fixed viewport that stacks queued toasts, typically backed by a `Toaster` behavior-class instance.                   |
| `Badge` (+ `.Icon`, `.Text`)                                                                                    | A compact pill communicating a short status, label, or count inline with surrounding content.                                                                         |
| `TagGroup` (+ `.List`, `.Tag`, `.Remove`)                                                                       | A labeled set of pill-shaped tags sharing `Badge`'s color contract, each optionally paired with a `.Remove` control that submits its enclosing form to drop that tag. |
| `Skeleton`                                                                                                      | A decorative loading placeholder rendered as a single static block; pairs with `pulse()`/`shimmer()` for motion.                                                      |
| `Spinner`                                                                                                       | A busy indicator rendered inside a `role="progressbar"` host; pairs with `spin()` for the rotating loop.                                                              |
| `Empty` (+ `.Icon`, `.Title`, `.Description`, `.Action`)                                                        | A dashed-bordered placeholder for a section that currently has nothing to show.                                                                                       |

### The `Color*` family

| Component                                         | Description                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ColorSwatch`                                     | A static preview box for one literal CSS color value, backed by a checkerboard so translucent values still read correctly.                             |
| `ColorArea` (+ `.SaturationThumb`, `.ValueThumb`) | A two-dimensional saturation/brightness picker for a given hue, built from two overlaid native range inputs; pairs with `colorAreaDrag()`.             |
| `ColorSlider` (+ `.Track`, `.Thumb`, `.Output`)   | A single-channel (`hue`/`saturation`/`lightness`/`alpha`) color control; siblings stay gradient-synced through the `channelSync()` mixin.              |
| `ColorWheel`                                      | A circular hue picker built from one range input; reshaped into a ring by the `colorWheelDrag()` mixin.                                                |
| `ColorSwatchPicker` (+ `.Swatch`)                 | Mutually exclusive preset color options built from native radio inputs.                                                                                |
| `ColorField`                                      | A labeled, described, validated color text field with a live `ColorSwatch` preview; pairs with the `colorPreview()` mixin for keystroke-live updates.  |
| `ColorPicker` (+ `.Group`, `.Trigger`, `.Dialog`) | `ColorField` extended with a trigger button and a popover-hosted picking surface composing `ColorArea`/`ColorWheel`/`ColorSlider`/`ColorSwatchPicker`. |

The `utils` entry point also exports the pure color math behind these controls — `parseColor`, `formatHex`/`formatRgb`/`formatHsl`, `rgbToHsl`/`hslToRgb`, `rgbToHsv`/`hsvToRgb`, and the pointer-geometry helpers (`normalizedPointerPosition`, `angleFromCenter`, `angleToHue`/`hueToAngle`) that back `ColorArea`'s and `ColorWheel`'s drag mixins.

### Chart & chat

| Component                                                                                                    | Description                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Chart` (+ `.Line`, `.Area`, `.Pie`, `.Bar`, `.Legend`, `.Legend.Item`, `.Tooltip` + its parts)              | The shared coordinate space every Cartesian series renders into, plus pie/bar variants that render their own independent `<svg>` root; pairs with `chartTooltip()`. |
| `Message` (+ `.Avatar`, `.Header`, `.Content`, `.Footer`, `.Group`)                                          | A conversational turn row laid out with CSS grid areas keyed off each part's `data-slot`.                                                                           |
| `MessageScroller` (+ `.Viewport`, `.Content`, `.Item`, `.Button`)                                            | A scrollable frame for a message log, its content region an ARIA `role="log"`; pairs with `messageFollow()` (a `ScrollFollowModel` instance).                       |
| `Bubble` (+ `.Content`, `.Reactions`, `.Group`)                                                              | The framed message surface nested inside a row's content slot, with seven tonal variants and edge alignment.                                                        |
| `Marker` (+ `.Icon`, `.Content`)                                                                             | An inline row calling out a small event between message rows — delivery status, system note, or labeled divider.                                                    |
| `Attachment` (+ `.Media`, `.Content`, `.Title`, `.Description`, `.Actions`, `.Action`, `.Trigger`, `.Group`) | A card presenting one attached file or image; `.Trigger` needs the `attachmentTrigger()` mixin to become a single activation target.                                |

### Layout & media

| Component                                                                                                                                   | Description                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Card` (+ `.Header`, `.Title`, `.Description`, `.Content`, `.Footer`)                                                                       | A bounded panel grouping a header, body content, and footer actions into one bordered, tinted, softly-shadowed surface keyed on a semantic color role.                                                      |
| `ImagePlaceholder` (+ `.Image`, `.Fallback`, `.Badge`, `.Group`, `.GroupCount`)                                                             | The shared foundation for a fixed-size image-with-fallback box; pairs with `imageFallback()` for load-error detection.                                                                                      |
| `Avatar` (+ same parts)                                                                                                                     | A circular `ImagePlaceholder` preset for a person's or entity's picture.                                                                                                                                    |
| `Logo` (+ same parts)                                                                                                                       | A softly-rounded-square `ImagePlaceholder` preset for a brand mark.                                                                                                                                         |
| `AspectRatio`                                                                                                                               | A layout primitive locking its host to a fixed width-to-height ratio.                                                                                                                                       |
| `Resizable` (+ `.Panel`, `.Handle`)                                                                                                         | A split-pane layout; pairs with `resizeHandle()` (a `ResizeSession` instance) for pointer-driven resize.                                                                                                    |
| `ScrollArea` (+ `.Viewport`)                                                                                                                | A bordered, scrollable region riding the catalog's shared scrollbar treatment.                                                                                                                              |
| `Group`                                                                                                                                     | A visual and semantic wrapper binding a cluster of related controls into one unit.                                                                                                                          |
| `Section`                                                                                                                                   | A grouping wrapper for related items inside a listbox, menu, or combobox.                                                                                                                                   |
| `Separator`                                                                                                                                 | A thin visual divider marking a boundary between two groups of content.                                                                                                                                     |
| `Toolbar`                                                                                                                                   | A bordered, tinted panel grouping interactive controls along one axis.                                                                                                                                      |
| `OverlayArrow`                                                                                                                              | A small pointer glyph anchoring a floating surface back to its trigger.                                                                                                                                     |
| `DropIndicator`                                                                                                                             | A thin bar rendered between two items of a reorderable list, marking a drop position.                                                                                                                       |
| `SharedElement`                                                                                                                             | A host carrying a stable view-transition identity across page loads; pairs with `viewTransition()`.                                                                                                         |
| `SelectionIndicator`                                                                                                                        | A marker reserving its own layout slot, invisible until the element carrying it is the current selection.                                                                                                   |
| `Text`                                                                                                                                      | A run of small body copy at the library's default muted style.                                                                                                                                              |
| `Header`                                                                                                                                    | A small, muted, uppercase section label inside a native `<header>`.                                                                                                                                         |
| `Keyboard`                                                                                                                                  | A keyboard-shortcut hint rendered inside a native `<kbd>`.                                                                                                                                                  |
| `Typeset`                                                                                                                                   | A typography layer wrapping already-rendered markdown/HTML, sized through three overridable custom properties (`docs`/`chat`/`reading` presets).                                                            |
| `Item` (+ `.Media`, `.Content`, `.Title`, `.Description`, `.Actions`)                                                                       | A single-line content row composing a leading media slot, title/description, and a trailing action slot.                                                                                                    |
| `Carousel` (+ `.Viewport`, `.Track`, `.Slide`, `.Controls`, `.Previous`, `.Next`)                                                           | A horizontally scrolling slide collection riding native CSS scroll snap; pairs with `carouselControls()`.                                                                                                   |
| `HeadingScope` / `Heading`                                                                                                                  | An ambient heading-depth scope and the heading element that reads it, keeping a document outline sequential without threading a level by hand; pairs with `headingLevelFallback()` at a hydration boundary. |
| `Calendar` (+ `.Header`, `.PreviousButton`, `.NextButton`, `.Heading`, `.Grid`, `.GridHeader`, `.Row`, `.HeaderCell`, `.GridBody`, `.Cell`) | A month-grid calendar surface, or a bare native `<input type="date">` fallback when rendered with no children; pairs with `calendarKeys()` (a `CalendarModel` instance).                                    |
| `RangeCalendar` (+ `.Cell`, sharing `Calendar`'s other parts)                                                                               | A calendar surface for choosing a connected start/end range; pairs with `calendarKeys()` and `rangePreview()`.                                                                                              |
| `DatePicker` (+ `.Group`, `.Button`, `.Dialog`)                                                                                             | `DateField` extended with a trigger button and a popover-hosted `Calendar`.                                                                                                                                 |
| `DateRangePicker` (+ `.Group`, `.Button`, `.Dialog`)                                                                                        | A paired start/end `DateField` extended with a trigger button and a popover-hosted `RangeCalendar`.                                                                                                         |

### Mixins

Every mixin module opens with a "Why JS" / "No-JS baseline" doc comment — see [Pattern: "Why JS" and "No-JS baseline"](#pattern-why-js-and-no-js-baseline-as-a-documentation-contract) below.

| Mixin                           | Applies to                                | What it does                                                                                                                                                             |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attachmentTrigger()`           | `Attachment.Trigger`                      | Turns the whole card into one activation target while nested action buttons keep answering their own clicks.                                                             |
| `calendarKeys(model)`           | `Calendar.Grid`                           | Arrow/Page/Home/End keyboard navigation over a `CalendarModel`, mirrored back as roving `tabindex`.                                                                      |
| `carouselControls()`            | `Carousel.Viewport`                       | Answers `--ui-prev`/`--ui-next`/`--ui-goto` invoker commands as `scrollBy()` calls.                                                                                      |
| `chartTooltip()`                | a `Chart.*` root                          | Tracks the nearest plotted point to the pointer/focus and fills the sibling `Chart.Tooltip`.                                                                             |
| `clearField()`                  | a `SearchField` clear button              | Empties only its own `commandfor` input and reveals itself on mount.                                                                                                     |
| `colorAreaDrag()`               | `ColorArea`                               | Drags the root as one 2D gesture across its paired axis inputs.                                                                                                          |
| `channelSync()`                 | a `ColorSlider` group                     | Keeps sibling channel tracks' gradients current with each other's live values.                                                                                           |
| `colorPreview()`                | `ColorField`                              | Live-updates the paired `ColorSwatch` as a typed value parses successfully.                                                                                              |
| `colorWheelDrag()`              | `ColorWheel`                              | Reshapes the hue input into a ring and drags it as an angular gesture.                                                                                                   |
| `comboboxFilter()`              | `ComboBox.Input`                          | Adapts `remix/ui/combobox`'s `input()` primitive for as-you-type narrowing.                                                                                              |
| `commandFilter(model)`          | `Command`                                 | Search-as-you-type filtering against a `FilterModel`, mirrored onto items as `hidden`.                                                                                   |
| `commandKeys(model)`            | `Command`                                 | ArrowDown/ArrowUp move the same `FilterModel`'s active match, mirrored as `aria-selected`/`aria-activedescendant`; Enter clicks the active item's nested link or button. |
| `contextMenu(id)`               | `ContextMenu.Trigger`                     | Opens the named popover at the pointer position on right-click or the Context Menu key.                                                                                  |
| `copyToClipboard()`             | a `Message.Footer` button                 | Copies the text content of its `commandfor` target to the clipboard.                                                                                                     |
| `dismiss(options?)`             | an alert/notification host                | Auto-dismiss countdown, pausable on hover, plus a `--ui-dismiss` invoker command.                                                                                        |
| `dragReorder(session)`          | `GridList`/`Tree`                         | Pointer-driven reorder against a `DragSession`, computing before/after/on drop position.                                                                                 |
| `dropZone(session)`             | `DropZone`                                | Drag-and-drop file acceptance backed by a shared `DragSession`.                                                                                                          |
| `dualRange()`                   | a two-thumb `Slider` group                | Keeps paired range inputs ordered, clamping the moved thumb at its partner.                                                                                              |
| `gridListKeys(model)`           | `GridList`                                | The ARIA grid keyboard pattern (arrows, Home/End, Space, Shift+Arrow, Ctrl/Cmd+A) against a `SelectionModel`.                                                            |
| `headingLevelFallback(options)` | an island's `HeadingScope`/`Heading` root | Recovers the ambient heading depth from `data-heading-level` on the DOM at a hydration boundary.                                                                         |
| `hotkey(combo)`                 | any `<dialog>` or `[popover]`             | A document-level keyboard shortcut opening/closing its host regardless of focus.                                                                                         |
| `imageFallback()`               | `Avatar`/`Logo` images                    | Flags a failed image load, including retroactively for cached images.                                                                                                    |
| `listboxKeys()`                 | `ListBox`                                 | Adapts `remix/ui/listbox`'s `list()` primitive for arrow/Home/End/typeahead.                                                                                             |
| `longPress(options?)`           | any element                               | Fires once a pointer holds still past a duration and movement tolerance.                                                                                                 |
| `menuKeys(options?)`            | `Menu`                                    | The WAI-ARIA menu keyboard pattern — roving tabindex, arrows, Home/End, typeahead.                                                                                       |
| `menubarKeys(options?)`         | `Menubar`                                 | The WAI-ARIA menubar pattern, handing off into whichever `Menu` opens.                                                                                                   |
| `messageFollow(model)`          | `MessageScroller.Viewport`                | Bridges the viewport to a `ScrollFollowModel` — measurement, scroll intents, pinned state.                                                                               |
| `otpSlots()`                    | an `OtpField` group                       | Advances/retreats focus across slots and splits a pasted code.                                                                                                           |
| `persist(key)`                  | a `Sidebar` root                          | Mirrors the collapsed checkbox into a cookie and answers a `--ui-toggle` command.                                                                                        |
| `pressToggle()`                 | `ToggleButton`                            | Flips `aria-pressed` on every click.                                                                                                                                     |
| `rangePreview(model)`           | `RangeCalendar.Grid`                      | Hover/focus range preview against a `CalendarModel`'s pending anchor.                                                                                                    |
| `resizeHandle(axis, session)`   | a `Resizable.Handle`                      | Pointer-driven resize against a `ResizeSession`, mirrored as a CSS custom property.                                                                                      |
| `stepper(options?)`             | a `NumberField.Group`                     | Press-and-hold repeat for the increment/decrement buttons.                                                                                                               |
| `tabKeys(options?)`             | `Tabs.List`                               | Delegated arrow/Home/End activation via the shared `remix/ui/tabs` context.                                                                                              |
| `themeToggle(options?)`         | any host                                  | Switches `<html>`'s light/dark/system scheme via invoker commands, persisted to a cookie.                                                                                |
| `trackHostNode()`               | internal                                  | A helper caching a mixin's live host node across insert/remove; used by several mixins above, not applied directly to a component.                                       |
| `treeKeys(model)`               | `Tree`                                    | The WAI-ARIA tree keyboard pattern against a `SelectionModel`, including typeahead.                                                                                      |
| `validate(schema)`              | a native form control                     | Applies a `remix/data-schema` schema via `setCustomValidity()`, mirrored into a `FieldError` slot.                                                                       |
| `viewTransition()`              | `SharedElement`'s enclosing island        | Bridges a same-document reload to the native View Transition API.                                                                                                        |

### Behavior classes

| Class               | Owns                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Announcer`         | A priority-ordered queue of aria-live announcements (polite/assertive), backing Command match counts, drag position updates, and toast messages. |
| `CalendarModel`     | Keyboard-focused day, visible month page, and in-progress range selection (anchor + hover preview) for a `Calendar`/`RangeCalendar`.             |
| `DragSession`       | The dragged item, the drop candidate under the pointer, and the computed drop position for reorder/drop-zone/drop-indicator widgets.             |
| `FilterModel`       | Query, matched subset, and active match for search-as-you-type option filtering (`Command`).                                                     |
| `ResizeSession`     | Pointer-resize constraint solving across a `Resizable` panel group, cascading to further panels once a neighbor bottoms out.                     |
| `ScrollFollowModel` | Auto-follow pinning, anchor turn, visible-message set, reachable edges, and pending scroll intents for `MessageScroller`.                        |
| `SelectionModel`    | Selected-key set plus toggle/contiguous-range/select-all semantics backing `GridList`, `Tree`, and `Table` selection.                            |
| `Toaster`           | A queue of toast notifications, owning each toast's auto-dismiss timer and pause/resume-with-remaining-time semantics.                           |

### Animations

Shared tokens back every factory below: `easings` (`standard`, `decelerate`, `accelerate`, `linear`) and `durations` (`fast` 150ms, `normal` 200ms, `slow` 300ms, `slower` 400ms).

| Factory                    | What it does                                                                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enterExit(options?)`      | Composes a CSS-only enter/exit transition: exit-state declarations on the host, entered-state under `[open]`/`:popover-open` (or a custom selector), a `@starting-style` block, and a reduced-motion override collapsing scale/translate to opacity-only. |
| `fade(options?)`           | Sugar over `enterExit` for a surface that only fades, no movement.                                                                                                                                                                                        |
| `zoom(options?)`           | A fade paired with a scale, entering from slightly smaller than rest.                                                                                                                                                                                     |
| `slide(options)`           | A fade paired with a directional offset, entering from just off one edge.                                                                                                                                                                                 |
| `spin(options?)`           | Continuous rotation for a busy indicator's glyph; replaced by an opacity breathe under reduced motion.                                                                                                                                                    |
| `pulse(options?)`          | A gentle opacity breathe for a skeleton placeholder.                                                                                                                                                                                                      |
| `shimmer(options?)`        | A sweeping highlight band for an indeterminate progress fill, gated by default on `:indeterminate`.                                                                                                                                                       |
| `textShimmer(options?)`    | A sweeping highlight through a run of text's own glyphs via `background-clip: text`.                                                                                                                                                                      |
| `scrollShadow(options?)`   | A shadow that ramps in on a sticky header once content scrolls beneath it, via `animation-timeline: scroll()`.                                                                                                                                            |
| `scrollProgress(options?)` | Grows a fill element in lockstep with how far its nearest scrollable ancestor has scrolled.                                                                                                                                                               |
| `viewReveal(options?)`     | Plays an entry motion as an element scrolls into its nearest scrollable ancestor's viewport, via `view()` timelines.                                                                                                                                      |
| `scrollFade(options?)`     | Fades a scroll container's own edges through a scroll-position-tracking mask.                                                                                                                                                                             |

### Style-mixin factories

| Factory                                         | What it does                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `floatingSurface()`                             | The border, rounding, tint, and elevation shadow a floating surface (popover, hover card, nav panel) carries ahead of its own content styling. |
| `focusRingPrimary(options?)`                    | The shared primary-color focus-visible ring.                                                                                                   |
| `focusRingByColor(options?)`                    | The same ring recipe, switched to whichever semantic role the host's own `data-color` names.                                                   |
| `graphicHostStyle()`                            | Flex-item layout and current-color declarations shared by a leading icon/loading-graphic slot, so the two swap without shifting layout.        |
| `interactiveTransition()`                       | The shared transition-property/timing/duration triplet for a control's hover/focus/press/validity changes.                                     |
| `outputCaptionText()`                           | The muted caption typography shared by every `<output>` live readout.                                                                          |
| `panelChrome()`                                 | The border and rounding a bordered, framed panel applies ahead of its own padding/layout.                                                      |
| `fieldStackLayout()`                            | The single-column stacking layout shared by every field convenience wrapper's outermost host.                                                  |
| `visuallyHiddenInput()`                         | The screen-reader-only-but-focusable clipping recipe a compound option's native input applies while a sibling paints the visible indicator.    |
| `chartPalette(property, combinator?)`           | Paints one CSS property from whichever of the 8 categorical `--ui-chart-*` slots an element's `data-color` names.                              |
| `legendToggle()`                                | Static, position-keyed visibility rules pairing a chart root with a later-sibling `Chart.Legend`.                                              |
| `semanticColorPanel()`                          | The `&[data-color="..."]` branches — one per semantic role — a tinted panel keys its border/background/foreground on.                          |
| `rtlAwareGradientDirection(propertyName)`       | A custom-property pairing behind a gradient direction, flipped under `&:dir(rtl)`.                                                             |
| `rangeThumbAppearance(sizeVar, borderWidthVar)` | The circular `<input type="range">` thumb recipe — appearance reset, fill/border, elevation, pressed scale, focus ring, disabled dimming.      |

## Patterns

Every example below that requires an accessibility string or visible copy uses a placeholder `t(key)` call standing in for whatever localization function a consuming app already wires up.

### Pattern: applying a mixin to a pure UI component

Library components ship no JavaScript. When a widget needs interactivity, the app's island applies the matching mixin from the mixins entry point — the components stay pure UI either way:

```tsx
// App island — the only hydrated module. The Command components are pure UI;
// commandFilter() is what makes them interactive. Its FilterModel lives in
// this island, not inside the mixin, since state always lives in the
// consumer.
import type { Handle } from "remix/ui";

import { clientEntry } from "remix/ui";

import { Command } from "@pkg/r3-ui";
import { FilterModel } from "@pkg/r3-ui/behaviors";
import { commandFilter } from "@pkg/r3-ui/mixins";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type SearchPaletteProps = { pages: Array<Page> };

export const SearchPalette = clientEntry(
	"/app/components/search-palette.tsx#SearchPalette",
	function SearchPalette(handle: Handle<SearchPaletteProps>) {
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

export default SearchPalette;
```

Only the island that applies the mixin gets a `clientEntry(...)` — a page that sticks to baseline behavior ships zero library JavaScript.

### Pattern: behavior classes power hydrated widgets

State with real shape — a toast queue, a selection set — lives in a headless behavior class from the behaviors entry point, not in the component or the mixin. The class is DOM-free and unit-testable on its own; the island subscribes to it and re-renders:

```tsx
// App island — Toaster is a headless class; the Toast components stay pure UI.
import type { Handle } from "remix/ui";

import { clientEntry } from "remix/ui";

import { Toast } from "@pkg/r3-ui";
import { Toaster } from "@pkg/r3-ui/behaviors";

export const AppToaster = clientEntry(
	"/app/components/app-toaster.tsx#AppToaster",
	function AppToaster(handle: Handle) {
		let toaster = new Toaster<{ title: string; color?: Toast.Color }>();

		toaster.addEventListener("change", () => handle.update(), {
			signal: handle.signal,
		});

		handle.context.set({ toaster });

		return () => (
			<Toast.Region aria-label={t("toasts.region")}>
				{toaster.toasts.map((toast) => (
					<Toast key={toast.id} color={toast.data.color}>
						<Toast.Content>
							<Toast.Title>{toast.data.title}</Toast.Title>
						</Toast.Content>
						<Toast.Close
							aria-label={t("actions.dismiss")}
							onClick={() => toaster.dismiss(toast.id)}
						/>
					</Toast>
				))}
			</Toast.Region>
		);
	},
);

export default AppToaster;

// Any descendant of the island:
// handle.context.get(AppToaster).toaster.add({ title: t("toasts.saved") });
```

### Pattern: the custom-command trigger contract

Invoker Commands aren't limited to the built-in `show-modal`/`close`/`toggle-popover` values: any `command` prefixed with `--` dispatches a `CommandEvent` on its `commandfor` target with no built-in behavior, and this becomes the standard trigger contract between static server buttons and hydrated widgets:

- A widget-root mixin listens for `command` on its host and switches on `event.command`. Library commands use the `--ui-` prefix (e.g. `--ui-next`, `--ui-dismiss`, `--ui-toggle`); unknown commands are ignored, so an app's own `--` commands can safely target the same elements.
- Trigger buttons stay static server HTML with no mixin and no hydration of their own — `<button commandfor="cart-carousel" command="--ui-next">` works anywhere on the page, including outside the island that owns the widget.
- Parameters ride the invoker: `event.source` is the triggering button, so `<button commandfor="cart-carousel" command="--ui-goto" data-slide="3">` carries its payload in `event.source.dataset`.

This keeps islands as small as the widget root itself — every external control is declarative, hydration-free markup wired by `commandfor`.

### Pattern: the ambient heading-level scope

`HeadingScope` publishes a semantic heading depth through `handle.context`, one level deeper than whatever `HeadingScope` it's nested inside, or starting at `1` where nothing wraps it. `Heading` (and every component with a title slot — `Dialog.Title`, `Alert.Title`, `Empty.Title`) reads that depth automatically:

```tsx
<HeadingScope>
	<Heading>Document title</Heading> {/* renders <h1>, no ancestor scope */}
	<HeadingScope>
		<Heading>Section title</Heading> {/* renders <h2>, nested one level deeper */}
	</HeadingScope>
</HeadingScope>
```

This purity meets its limit at a hydration boundary: an independently hydrated island has no ancestor context to read even when the server-rendered page nests it under a real scope. Threading the level down as an explicit prop is the first choice whenever it's practical; where it isn't, `headingLevelFallback()` recovers the level once, on attach, from the `data-heading-level` attribute `HeadingScope`/`Heading` already stamp on the DOM:

```tsx
import type { Handle, HeadingLevel } from "remix/ui";

import { clientEntry } from "remix/ui";

import { Heading, HeadingScope } from "@pkg/r3-ui";
import { headingLevelFallback } from "@pkg/r3-ui/mixins";

export const CommentsIsland = clientEntry(
	"/app/components/comments-island.tsx#CommentsIsland",
	function CommentsIsland(handle: Handle) {
		let level: HeadingLevel | undefined;

		return () => (
			<HeadingScope
				level={level}
				mix={[
					headingLevelFallback({
						onLevel(detected) {
							level = detected;
							handle.update();
						},
					}),
				]}
			>
				<Heading>{t("comments.title")}</Heading>
			</HeadingScope>
		);
	},
);

export default CommentsIsland;
```

### Pattern: "Why JS" and "No-JS baseline" as a documentation contract

Every mixin module opens with a doc comment naming exactly what the platform can't express on its own and exactly what still works if the mixin's script never runs — this is the record that keeps the JavaScript cost of every behavior explicit and reviewable, not optional boilerplate:

```ts
/**
 * Why JS: the WAI-ARIA grid keyboard pattern moves a single logical focus
 * position across a two-dimensional grid of days using arrow, page, home,
 * and end keys, which HTML has no declarative mechanism for.
 * No-JS baseline: every day cell still renders as its own reachable cell, so
 * the grid stays fully usable one `Tab` stop at a time — only the day/week/
 * month shortcuts are unavailable.
 */
```

Reading this comment on any mixin before applying it answers the only question that matters for progressive enhancement: what does this screen look like, and does it still work, the instant before this mixin's script has run.

### Pattern: dev-mode contract-check warnings

Where the type system can't enforce a required accessibility wiring, a component logs a `console.warn` gated behind `import.meta.env.DEV`, stripped entirely from production bundles:

```tsx
if (import.meta.env.DEV && !id) {
	console.warn(
		'Dialog rendered without an "id" — "commandfor" on a trigger or close control has nothing to target.',
	);
}
```

The same shape recurs across the catalog wherever markup alone can't guarantee the wiring is complete — an icon-only `Button`, `Calendar.PreviousButton`, or `Menu.Item` with no visible text and no `aria-label`; a `Command.Item` rendered without the `value` a filter mixin matches against; a `Menubar`, `Toast.Region`, or `Table` rendered without an `aria-label`/`aria-labelledby` identifying the landmark. None of these throw or block rendering — they're a development-time nudge, not runtime validation the app ships.

### Pattern: composing style-mixin factories in one `mix` array

A style-mixin factory, an animation factory, and a component's own local `css()` call compose as disjoint siblings in one `mix` array — never merged into a single object:

```tsx
import { zoom } from "@pkg/r3-ui/animations";
import { floatingSurface, interactiveTransition } from "@pkg/r3-ui/styles";
import { css } from "remix/ui";

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

`floatingSurface()` supplies the border/tint/shadow chrome, `interactiveTransition()` supplies the shared hover/focus transition triplet for descendants, and `zoom()` supplies the open/close animation off the popover's own `:popover-open` state — three independent recipes, none of them reimplemented by hand.

### Pattern: the `parts` prop escape hatch

A convenience wrapper that renders more than one host element accepts a `parts` prop for per-part styling instead of a single `mix` applied to the whole tree. `TextField`'s four parts (`label`, `input`, `description`, `error`) are the shared base shape most field wrappers extend:

```tsx
<TextField
	label={t("form.username.label")}
	name="username"
	parts={{ input: css({ fontFamily: "var(--ui-font-mono)" }) }}
/>
```

`ColorField` extends that same base shape with two more named parts (`control`, the row wrapping the input and swatch; `swatch`, the preview itself) rather than repeating the four it inherits. `Confirm` — composing `AlertDialog` internally — exposes parts matching each of its composed pieces (`header`, `title`, `description`, `footer`, `cancel`, `action`, plus `form` in submit mode):

```tsx
<Button commandfor="confirm-delete" command="show-modal" color="danger">
	{t("project.delete")}
</Button>
<Confirm
	id="confirm-delete"
	title={t("project.deleteTitle")}
	description={t("project.deleteDescription")}
	confirmLabel={t("actions.delete")}
	cancelLabel={t("actions.cancel")}
	parts={{ action: css({ fontWeight: 700 }) }}
/>
```

When `parts` isn't enough, the ultimate escape hatch is always composing the underlying compound components directly — `Label` + `Input` + `Description` + `FieldError`, or `AlertDialog` and its own parts — instead of the convenience wrapper.

### Pattern: a confirmed destructive action

Without a `form` prop, `Confirm`'s confirming control only closes the panel — the client-side shape, where the page decides what a confirmed decision means. Passing `form` switches it into the server-side shape: the panel's content is wrapped in a real `<form>` and the confirming control becomes that form's submit button, so a destructive action runs as an ordinary form post with no client JavaScript. `fields` renders the hidden inputs the submission needs — a CSRF token, an intent, the id of the record being acted on:

```tsx
<Button commandfor="revoke-session" command="show-modal" color="danger">
	{t("session.revoke")}
</Button>
<Confirm
	id="revoke-session"
	title={t("session.revokeTitle")}
	description={t("session.revokeDescription")}
	confirmLabel={t("actions.revoke")}
	cancelLabel={t("actions.cancel")}
	form={{
		action: revokeUrl,
		fields: (
			<>
				<input type="hidden" name="csrf" value={token} />
				<input type="hidden" name="intent" value="revoke" />
			</>
		),
	}}
/>
```

The cancel control stays a close-command button in both modes, so cancelling never submits. Because submit mode renders a `<form>`, a submitting panel must not sit inside another form's markup — the platform's own nesting rule. For a confirmation whose layout or wiring this doesn't cover, compose `AlertDialog` directly and give `AlertDialog.Action` a `type="submit"`: it then drops the `command` it could not run and submits the enclosing form instead.

### Pattern: a validated form

`Form` takes a parsed validation result and hands each field its own errors by name through component context — the canonical shape is an action that parses `ctx.formData` and re-renders the same page with `issues` set on failure:

```tsx
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { parseSafe } from "remix/data-schema";
import { createAction } from "remix/fetch-router";
import type { Handle } from "remix/ui";

import { Button, Form, TextField } from "@pkg/r3-ui";
import routes from "~/routes/web";

let ContactSchema = f.object({
	email: f.field(s.string().pipe(checks.minLength(1), checks.email())),
});

export const submitContact = createAction(routes.contact.submit, async (ctx) => {
	let result = parseSafe(ContactSchema, ctx.formData);

	if (!result.success) {
		return ctx.render(<ContactPage issues={result.issues} />, { status: 400 });
	}

	// ...persist result.data
	return ctx.render(<ContactPage />);
});

function ContactPage(handle: Handle<{ issues?: ReadonlyArray<Form.Issue> }>) {
	return () => (
		<Form method="post" issues={handle.props.issues}>
			<TextField label={t("contact.email.label")} name="email" type="email" required />
			<Button type="submit">{t("contact.submit")}</Button>
		</Form>
	);
}
```

The native constraint attributes (`required`, `type="email"`) still block submission with no JavaScript at all; `ctx.formData` is already parsed into a plain object by the time an action reads it, so `parseSafe` runs against it directly with no manual `FormData` extraction, and a failed parse re-renders the exact same page with its issues carried through a plain prop rather than any client-side state.

`issues` is the only thing the page passes: `TextField`, `DateField`, `TimeField`, and `ColorField` each look their own message up by `name` through form context, so none of them needs an `errorMessage` prop of its own and there is no per-field error map to build. The field found in `issues` renders its `FieldError`, marks `aria-invalid`, and wires `aria-describedby` at the message; the first invalid field of the render also picks up `autofocus`, so keyboard focus lands on the first problem after the round-trip. An explicit `errorMessage` still wins over whatever context holds, for a message the schema doesn't produce (an address already taken, say), and an explicit `autoFocus` still decides focus for that field.

### Pattern: a chart with a legend

`Chart.Legend` must render as a later sibling of the chart root, and each `Chart.Legend.Item` must appear in the same order as its matching series — the toggle wiring keys off sibling position, not an explicit series id:

```tsx
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { Chart } from "@pkg/r3-ui";

type RevenueChartProps = { months: Array<{ index: number; revenue: number; refunds: number }> };

function RevenueChart(handle: Handle<RevenueChartProps>) {
	return () => {
		let { months } = handle.props;

		return (
			<>
				<Chart
					width={480}
					height={240}
					xDomain={[0, 11]}
					yDomain={[0, 5000]}
					aria-label={t("chart.revenue.label")}
				>
					<Chart.Line
						color={1}
						points={months.map((month) => ({
							x: month.index,
							y: month.revenue,
							label: t("chart.revenue.point", { month: month.index, amount: month.revenue }),
						}))}
					/>
					<Chart.Line
						color={3}
						points={months.map((month) => ({
							x: month.index,
							y: month.refunds,
							label: t("chart.refunds.point", { month: month.index, amount: month.refunds }),
						}))}
						parts={{ path: css({ strokeDasharray: "4 4" }) }}
					/>
				</Chart>
				<Chart.Legend aria-label={t("chart.legend")}>
					<Chart.Legend.Item color={1}>{t("chart.series.revenue")}</Chart.Legend.Item>
					<Chart.Legend.Item color={3}>{t("chart.series.refunds")}</Chart.Legend.Item>
				</Chart.Legend>
			</>
		);
	};
}
```

Every wedge, bar, and marker renders with a native `<title>` and stays keyboard-reachable on its own — `RevenueChart` needs no `clientEntry` at all, since nothing here applies a mixin; `chartTooltip()` is a separate, opt-in mixin for a floating tooltip synced to the nearest point under the pointer or focus, only worth hydrating when a page actually wants it.

### Pattern: a message thread

`MessageScroller`, `Message`, `Bubble`, and `Marker` compose into a full conversational thread; `messageFollow()` bridges the viewport to a `ScrollFollowModel` so the log auto-follows new turns until a person scrolls away from the live edge:

```tsx
import type { Handle } from "remix/ui";

import { clientEntry, css } from "remix/ui";

import { Bubble, Marker, Message, MessageScroller } from "@pkg/r3-ui";
import { ScrollFollowModel } from "@pkg/r3-ui/behaviors";
import { messageFollow } from "@pkg/r3-ui/mixins";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type ChatThreadProps = { turns: Array<Turn> };

export const ChatThread = clientEntry(
	"/app/components/chat-thread.tsx#ChatThread",
	function ChatThread(handle: Handle<ChatThreadProps>) {
		let model = new ScrollFollowModel({ pinned: true });

		return () => {
			let { turns } = handle.props;

			return (
				<MessageScroller mix={css({ blockSize: "32rem" })}>
					<MessageScroller.Viewport mix={messageFollow(model)}>
						<MessageScroller.Content aria-busy={turns.some((turn) => turn.streaming)}>
							<Marker variant="separator">
								<Marker.Content>{t("marker.today")}</Marker.Content>
							</Marker>

							<Message.Group>
								{turns.map((turn, index) => (
									<MessageScroller.Item
										key={turn.id}
										messageId={turn.id}
										scrollAnchor={index === 0}
									>
										<Message>
											{index === 0 && (
												<Message.Header>
													<strong>{turn.sender.name}</strong>
													<time dateTime={turn.sentAt}>{turn.formattedTime}</time>
												</Message.Header>
											)}
											<Message.Content>
												<Bubble align={turn.sender.isSelf ? "end" : "start"} variant="muted">
													<Bubble.Content>{turn.text}</Bubble.Content>
												</Bubble>
											</Message.Content>
										</Message>
									</MessageScroller.Item>
								))}
							</Message.Group>
						</MessageScroller.Content>
					</MessageScroller.Viewport>
					<MessageScroller.Button aria-label={t("chat.jumpToLatest")}>
						{t("chat.jumpToLatest")}
					</MessageScroller.Button>
				</MessageScroller>
			);
		};
	},
);

export default ChatThread;
```

`MessageScroller.Item`'s `messageId` is required and unique per turn; `MessageScroller.Button` starts `hidden` and is revealed by the `messageFollow()`/`ScrollFollowModel` pairing rather than by any prop set on it directly.

### Pattern: a ColorPicker composition

Composing `ColorPicker.Dialog` with `ColorArea`, `ColorWheel`, `ColorSlider`, `ColorField`, and `ColorSwatchPicker` builds the full picking surface. None of these parts share state with one another on their own — sharing one live color across the whole composition is the consuming island's job, listening for each part's own change event and re-rendering the others:

```tsx
import type { Handle } from "remix/ui";

import { clientEntry } from "remix/ui";

import {
	ColorArea,
	ColorField,
	ColorPicker,
	ColorSlider,
	ColorSwatchPicker,
	ColorWheel,
	Input,
	Label,
} from "@pkg/r3-ui";
import { colorAreaDrag, colorPreview, colorWheelDrag } from "@pkg/r3-ui/mixins";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type BrandColorPickerProps = { hue: number; saturation: number; brightness: number; alpha: number };

export const BrandColorPicker = clientEntry(
	"/app/components/brand-color-picker.tsx#BrandColorPicker",
	function BrandColorPicker(handle: Handle<BrandColorPickerProps>) {
		return () => {
			let { hue, saturation, brightness, alpha } = handle.props;

			return (
				<ColorPicker>
					<Label htmlFor="brandColor">{t("form.brandColor.label")}</Label>
					<ColorPicker.Group>
						<Input id="brandColor" type="text" name="brandColor" defaultValue="#3b82f6" />
						<ColorPicker.Trigger
							commandfor="brandColor-panel"
							command="toggle-popover"
							aria-label={t("form.brandColor.toggle")}
							value="#3b82f6"
						/>
					</ColorPicker.Group>
					<ColorPicker.Dialog id="brandColor-panel">
						<ColorArea
							aria-label={t("colorPicker.area")}
							hue={hue}
							defaultSaturation={saturation}
							defaultValue={brightness}
							mix={colorAreaDrag()}
						>
							<ColorArea.SaturationThumb
								data-color-area-axis="x"
								aria-label={t("colorPicker.saturation")}
							/>
							<ColorArea.ValueThumb
								data-color-area-axis="y"
								aria-label={t("colorPicker.brightness")}
							/>
						</ColorArea>

						<ColorWheel
							aria-label={t("colorPicker.hue")}
							defaultValue={hue}
							mix={colorWheelDrag()}
						/>

						<ColorSlider channel="alpha" defaultValue={alpha}>
							<ColorSlider.Track hue={hue}>
								<ColorSlider.Thumb aria-label={t("colorPicker.alpha")} />
							</ColorSlider.Track>
						</ColorSlider>

						<ColorField
							label={t("colorPicker.hex")}
							format="hex"
							defaultValue="#3b82f6"
							mix={colorPreview()}
						/>

						<ColorSwatchPicker aria-label={t("colorPicker.presets")}>
							<ColorSwatchPicker.Swatch value="#ef4444" aria-label={t("color.red")} />
							<ColorSwatchPicker.Swatch
								value="#3b82f6"
								aria-label={t("color.blue")}
								defaultChecked
							/>
						</ColorSwatchPicker>
					</ColorPicker.Dialog>
				</ColorPicker>
			);
		};
	},
);

export default BrandColorPicker;
```

`ColorArea.SaturationThumb`/`.ValueThumb` need an explicit `data-color-area-axis` so `colorAreaDrag()` can pair them; server-rendered alone (before that island hydrates), each part still works independently through keyboard/native-range operation — it just doesn't stay in sync with its siblings until the island wires that up.

## Tips

1. **Unlayered CSS beats every layer, including `rmx`** - `remix/ui` emits component styles under the `rmx` cascade layer, so `reset.css` → `theme.css` → component styles naturally stack in the right order. But an app's own _unlayered_ global rule (a bare `button { ... }` outside any `@layer` block) still outranks all of it. Keep app-level element globals inside a layer ordered before `rmx`, and reserve unlayered rules for overrides you actually intend to win.
2. **Non-color design tokens are overridable too** - see [Overridable component tokens](#overridable-component-tokens): the shared radius scale plus well over a hundred per-component size/spacing/timing tokens all follow the same `var(--ui-x, default)` pattern, so denser tables or a slower hover-card delay is a handful of variable overrides, not per-component style overrides.
3. **Reach for `parts` before reaching into internals** - Convenience wrappers like `TextField` and `Confirm` accept a `parts` prop for per-part styling; if that isn't enough, compose the underlying compound components directly rather than fighting the wrapper.
4. **`mix` does not override by array position** - Each `css()`/`@pkg/u` mixin compiles to one hashed class emitted in its own cascade sublayer (`@layer rmx.rmxc-…`), byte-identical style objects dedupe to a single shared class, and a class's layer position is fixed the first time that exact declaration set appears anywhere on the page. So when a mixin passed through `mix` collides with one of the component's own declarations, the winner is whichever class was registered _earlier in the document_ — not whichever came later in the array. That is why `Card.Title mix={[text("sm")]}` keeps the component's 24px (dozens of components already emit `text("sm")`, so its layer is registered early), while `rounded("md")` over `NavLink`'s `rounded("sm")` happened to win: same rule, different page contents. Every generated class carries the same specificity and sits in its own sublayer, so specificity tricks cannot fix it. To _guarantee_ an override, use the `style` prop, override the component's own `--ui-*` token inline (`style={{ "--ui-text-2xl": "0.875rem" }}`), mark the declaration `!important` through `raw()`, or put the rule in an app cascade layer declared after `rmx`. Use `mix` for declarations the component doesn't already set.
5. **A command invoker is never a submit button** - `Button` renders `type="button"` on its own whenever it carries `command`/`commandfor`, and `Dialog.Close`, `AlertDialog.Cancel`, and the other invoker parts do the same, because a button inside a `<form>` otherwise defaults to `"submit"` and the platform then refuses to run the command at all — it calls the pairing ambiguous and takes no action, so the control looks wired up and does nothing. A hand-rolled `<button commandfor …>` inside a form still needs the attribute spelled out.
