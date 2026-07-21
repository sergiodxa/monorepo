# ADR-014: R3 UI Component Library On Remix UI

## Status

**Proposed** - 2026-07-18

## Background

`@pkg/ui` is the monorepo's shared component library. It is built on React, React Aria Components (RAC), Sonner, `lucide-react`, and Tailwind CSS v4: every component's styling lives in `packages/ui/src/styles.css` (~4,550 lines) as `@utility ui-*` blocks driven by `data-*` attributes and a semantic color variable layer (`--ui-{color}-{property}-{state}`).

[ADR-013](./ADR-013-remix-ui-for-application-interfaces.md) established `remix/ui` as the standard UI layer for application interfaces. Remix apps (`r3-uptime`, `r3-blog`, `r3-gallery`) cannot consume `@pkg/ui`: it requires a React runtime, RAC's client-side behavior model, and a Tailwind build step. Today each Remix app hand-rolls its UI with inline `css()` mixins, which means the design system captured in `@pkg/ui` — its variants, states, dark mode model, and accessibility work — is not reusable in the part of the monorepo that is actively growing.

This ADR decides how to make the `@pkg/ui` component catalog available to Remix apps.

## Context

- **Remix UI is not React.** Components receive a `Handle`, read props from `handle.props`, keep state in setup-scope variables, and return a zero-argument render function. Behavior and styling attach to host elements through the `mix` prop with mixins: `css(...)`, `on(...)`, `ref(...)`, `link(...)`, `attrs(...)`.
- **`css()` covers what the stylesheet needs.** It supports nested selectors, attribute selectors (`&[data-color="primary"]`), pseudo-classes, pseudo-elements, descendant selectors, and media queries, and emits generated rules under the `rmx` cascade layer. Every selector pattern used by the `@utility ui-*` blocks is expressible as a `css()` object.
- **`remix/ui` ships headless behavior primitives** — `remix/ui/popover`, `menu`, `listbox`, `select`, `combobox`, `accordion`, `tabs`, `checkbox`, `radio`, `toggle`, `input`, `anchor`, `breadcrumbs`, `button` — that own behavior only and compose with app-owned `css()` styling.
- **The platform has caught up with most of what RAC does in JavaScript.** `<dialog>` with `showModal()`, the Popover API, Invoker Commands (`commandfor` / `command`), CSS anchor positioning, `<details name>` exclusive accordions, `@starting-style` + `transition-behavior: allow-discrete` for top-layer enter/exit transitions, `scroll-snap`, `field-sizing: content`, customizable `<select>` (`appearance: base-select`), and `:focus-visible` / `:active` / `:disabled` state selectors replace most of the client-side machinery `@pkg/ui` inherits from RAC.
- **Server-first is the repo's default.** Per the Remix skill, the server-rendered path must be correct before hydration is added, and `clientEntry(...)` is reserved for real browser interactivity.
- **Supporting pieces already exist**: `@pkg/lucide-remix` provides Lucide icons as Remix UI components, and the `--ui-*` semantic variable layer in `styles.css` (`:root`, `.dark`, `.system` blocks) is plain CSS with no Tailwind dependency.
- `@pkg/ui` remains in use by the React apps (`auth`, `auth-saas`, `blog`, `blog-saas`, `books`, `pkmn`, `uptime`) and cannot be broken.

## Decision

Create a new package, `packages/r3-ui` (`@pkg/r3-ui`), that ports the complete `@pkg/ui` component catalog to `remix/ui`. `@pkg/ui` stays as-is for the React apps; `@pkg/r3-ui` is the component library for Remix apps going forward.

The bar is external quality, not internal reuse: a library good enough to publish and to compare against shadcn/ui — minimizing JavaScript without apologizing for it where interaction quality demands it, and holding Apple-HIG-level interaction detail throughout. Section 10 makes that bar normative.

### 1. Package shape

```
packages/r3-ui/
├── package.json        # exports ".", "./animations", "./behaviors", "./mixins", "./utils", "./reset.css", and "./theme.css"
├── AGENTS.md           # the layer rules below, encoded for contributors and agents
├── README.md           # install, theme contract, layer rules, reset/theme import order
├── src/
│   ├── index.ts
│   ├── reset.css       # Preflight-equivalent base reset, layered before rmx
│   ├── theme.css       # the --ui-* semantic variable layer, copied from @pkg/ui
│   ├── components/     # one module per component, styles inlined via css()
│   ├── animations/     # CSS-only animation mixin factories + motion tokens
│   ├── behaviors/      # headless behavior classes (TypedEventTarget models)
│   ├── mixins/         # opt-in behavior mixins, one module per behavior
│   └── utils/          # framework-free scale/path/color math specific components build on
```

Dependencies: `remix` and `@pkg/lucide-remix`. No React, no `react-aria-components`, no Sonner, no Tailwind, no `lucide-react`. The package declares `"sideEffects": false` so a client bundle tree-shakes to exactly the components, mixins, and behaviors its islands import.

Components keep the compound pattern (`Dialog`, `Dialog.Header`, `Dialog.Title`, …) and the Handle pattern: every component is `function Name(handle: Handle<Props>) { return () => <...> }` and is always rendered through JSX, never called as a plain function. Host elements accept a `mix` passthrough prop so consumers can compose extra mixins onto the host. Convenience wrappers that render several elements (TextField and similar composition sugar) also accept per-part mixins through a `parts` prop (`parts={{ input: css({ ... }) }}`); the ultimate escape hatch is always composing the underlying compound components directly.

### 2. Styling: port `styles.css` into `css()` mixins

The visual design does not change. Each `@utility ui-*` block translates into the `css()` object of the component that owns it, applied inline on the host element (`mix={css({...})}`), preserving:

- the `data-*` attribute contract (`data-color`, `data-variant`, `data-size`, `data-placement`, …) as the variant mechanism, so selectors port one-to-one,
- the `--ui-*` semantic variables as the only color source, and
- the composition graph (e.g. `ui-textarea` extends `ui-input`) as shared style-object spreads within the package.

Tailwind `@apply` shorthand expands to plain CSS longhand using Tailwind v4's default scale (`--spacing: 0.25rem` base, default radii, shadows, and type scale), so the rendered output is pixel-identical for fine-pointer, left-to-right rendering. The deliberate deviations are each recorded where they are decided: viewport breakpoints become container queries (below), physical properties become logical, and the quality bar (section 10) adds touch-specific corrections. Example — the `ui-badge` utility becomes:

```tsx
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

namespace Badge {
	export interface Props {
		color?: "primary" | "neutral" | "success" | "warning" | "danger";
		variant?: "default" | "secondary" | "outline";
	}
}

const DEFAULT_COLOR = "primary";
const DEFAULT_VARIANT = "default";

export function Badge(handle: Handle<Badge.Props>) {
	return () => (
		<span
			data-color={handle.props.color ?? DEFAULT_COLOR}
			data-variant={handle.props.variant ?? DEFAULT_VARIANT}
			mix={css({
				display: "inline-flex",
				alignItems: "center",
				gap: "0.25rem",
				borderRadius: "calc(infinity * 1px)",
				border: "1px solid transparent",
				padding: "0.125rem 0.625rem",
				fontSize: "0.75rem",
				fontWeight: 600,
				lineHeight: 1,
				userSelect: "none",
				whiteSpace: "nowrap",
				'&[data-variant="default"][data-color="primary"]': {
					borderColor: "var(--ui-primary-bg-solid)",
					backgroundColor: "var(--ui-primary-bg-solid)",
					color: "var(--ui-primary-fg-on-solid)",
				},
				// ... remaining variant/color combinations, ported verbatim
			})}
		>
			{handle.props.children}
		</span>
	);
}
```

RAC state attributes map to native selectors, since the components now ride native elements and platform state instead of JavaScript-managed state:

| RAC attribute (`@pkg/ui`)          | `@pkg/r3-ui` selector                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| `[data-hovered]`                   | `:hover`                                                                                |
| `[data-pressed]`                   | `:active`                                                                               |
| `[data-focused]`                   | `:focus`                                                                                |
| `[data-focus-visible]`             | `:focus-visible`                                                                        |
| `[data-disabled]`                  | `:disabled`, `[aria-disabled="true"]`                                                   |
| `[data-selected]`                  | `:checked`, `[aria-selected="true"]`, `[aria-current]`                                  |
| `[data-invalid]`                   | `[aria-invalid="true"]`, `:user-invalid`                                                |
| `[data-entering]`/`[data-exiting]` | `@starting-style` + `transition-behavior: allow-discrete` on `[open]` / `:popover-open` |

The port also writes every direction-sensitive declaration with logical properties (`padding-inline`, `margin-block-start`, `inset-inline-end`, `text-align: start`) instead of the physical ones the Tailwind utilities compile to. Left-to-right rendering is identical, and the whole library becomes right-to-left-ready through the standard `dir` attribute — a translation-time decision that would cost a second full pass if taken later.

#### Responsive styling: container queries, not the viewport

Components never read the viewport. Every `sm:`/`md:` breakpoint in the source stylesheet (dialog footer stacking, sheet width, dialog header alignment) ports to an `@container` query. A component assumes it is rendered inside a container — which may well be the whole page, but never by assumption:

- Apps declare `container-type: inline-size` on their layout regions; the page body is simply the outermost container.
- Components that create a sizing context for their own parts (the Dialog panel, Sheet, Card, the Sidebar inset, the Table wrapper) declare named containers (e.g. `container: ui-dialog / inline-size`), and their part styles query that name — so a Card inside a Dialog responds to the dialog's width, not the page's.
- A container query cannot style the container itself, so a root host that must adapt to its own width carries an inner wrapper that holds the adapting styles.

When the container spans the viewport, rendering matches `@pkg/ui`. Embedded anywhere narrower — a dashboard column, a split pane, a `<Frame>` — components adapt to the space they actually occupy, where the React library's viewport breakpoints misread it.

The `tailwindcss-animate` enter/exit animations are replaced by CSS transitions keyed off native open states — no JavaScript drives overlay animation. Those transitions are packaged as their own layer:

#### Animation layer: `@pkg/r3-ui/animations`

Animations are `css()` factories: functions that take options and return a style mixin, applied like any other mixin — on library components through the `mix` passthrough, or on app-local elements directly:

```tsx
import { fade } from "@pkg/r3-ui/animations";

<div id="filters" popover="auto" mix={fade({ duration: 150 })}>
	...
</div>;
```

Rules for animation factories:

- **CSS-only, zero hydration.** A factory emits the `@starting-style` entry state, the base exit state, and a `transition` declaration with `transition-behavior: allow-discrete`, keyed off platform state (`[open]`, `:popover-open`, `details[open]`) — with a `when` option for custom states such as `[data-visible]`. `@starting-style` also fires on plain DOM insertion, so entry animation covers island-rendered elements like toasts.
- **Presets are sugar over one composer.** `fade(options)`, `zoom(options)`, and `slide({ from })` delegate to `enterExit({ opacity, scale, translate, duration, easing, when })`. One animation mixin per host: each owns the host's `transition` property, so composing two on one element is a conflict by design — pass combined effects to `enterExit()` instead.
- **Motion tokens are shared.** Exported `durations` and `easings` constants define the design system's motion vocabulary; hydrated islands feed the same tokens into `remix/ui/animation`'s `spring`/`tween` configs so CSS-driven and JS-driven motion match.
- **Reduced motion is built in.** Every factory emits a `@media (prefers-reduced-motion: reduce)` override that collapses movement to opacity-only, so honoring the preference stops being per-call-site discipline.
- **Looping keyframes live here too.** `spin()`, `pulse()`, and `shimmer()` back Spinner, Skeleton, and indeterminate ProgressBar.
- **Scroll-driven animations are in scope as progressive enhancement.** `scrollShadow()` (a sticky header or toolbar gains its shadow once content scrolls beneath it), `scrollProgress({ axis })` (a progress indicator linked to scroll position — Carousel progress, reading progress), and `viewReveal(options)` (entry motion as an element scrolls into view) ride `animation-timeline: scroll()` / `view()` inside `@supports (animation-timeline: scroll())`. Chromium-only support is acceptable under the same rule that governs anchor positioning and customizable `<select>`: the effect is pure polish, and the component is fully functional without it.
- **Boundary with `remix/ui/animation`.** State-driven enter/exit that the server can render uses this layer; elements that leave through island re-renders (toast dismissal, FLIP list reorder) use `animateEntrance`/`animateExit`/`animateLayout` directly — the library does not wrap those APIs.

The Dialog family, Popover, Menu surfaces, Sheet, Drawer, Tooltip, HoverCard, and Toast apply these factories internally with design-system defaults, replacing every `tailwindcss-animate` utility in the port with the equivalent motion.

### 3. Theme contract: `theme.css` stays plain CSS

The `--ui-*` semantic variable layer (light `:root`, forced-dark `.dark`, system-dark `.system` under `prefers-color-scheme`) copies into `src/theme.css` unchanged — it is already Tailwind-free. Apps import `@pkg/r3-ui/theme.css` and keep the same obligation they have today: define the `--color-{primary,neutral,danger,warning,success}-{50..950}` scales. An app can define those scales in a plain `:root` block; no Tailwind `@theme` is required. Because both packages read the same variables, a React app and a Remix app given the same color scales render the same design.

App-level palettes (such as `r3-uptime`'s system-color vocabulary from its ADR-002) remain app decisions; such apps can map their tokens onto the `--color-*` / `--ui-*` contract or keep hand-rolled UI.

Switching schemes is the `themeToggle()` mixin's job: it flips `.dark`/`.system` on `<html>` and persists the choice in a cookie so the server renders the next page correctly. The no-JS baseline is a plain form POST that sets the same cookie.

Color is not the only themable surface. The non-color constants the port would otherwise hardcode — radii, control heights, focus-ring width — are emitted as custom properties with their Tailwind-scale values as fallbacks (`border-radius: var(--ui-radius-md, 0.375rem)`). An app that defines nothing renders identically to `@pkg/ui`; an app that wants denser tables or squarer buttons sets a handful of variables instead of overriding styles per component. `@pkg/ui` could never offer this — its constants are baked into utility class names.

`theme.css` also answers `prefers-contrast: more`: under that media feature, every color's subtle `border` is promoted to its already-defined `border-strong` value, in every color scheme. Because every component reads `border` from the semantic variable rather than a literal, this one block raises border visibility library-wide with zero per-component work — the same mechanism (a variable swap keyed off a media feature) that makes the whole non-color-surface story work.

#### Base reset: `reset.css`

Dropping Tailwind drops Preflight, and the source styles were authored against Preflight's normalizations: `box-sizing: border-box`, zeroed margins, borders reset to `0 solid` (which is why bare border-widths work), form controls inheriting font and color, transparent button backgrounds, block-level media. Without an equivalent, user-agent styles leak through and the parity claim fails on the first `<button>`. The library therefore ships `@pkg/r3-ui/reset.css`:

- **Preflight-equivalent semantics** (Tailwind v4's), with every selector wrapped in `:where()` for zero specificity.
- **Layered before `rmx`.** The file opens with `@layer base, rmx;` and puts the reset in `base`, so component `css()` rules — which `remix/ui` emits under the `rmx` layer — always beat the reset without specificity games. This is the layer order `remix/ui`'s own documentation prescribes.
- **Top-layer UA styles survive.** Preflight is not copied blindly: the user-agent rules that are load-bearing for `<dialog>` and `[popover]` (centering via `margin: auto`, fixed positioning, `::backdrop`) are left intact, and the overlay components own their overrides explicitly.
- **Import order contract**: `reset.css` → `theme.css` → app styles. Apps with their own reset may skip it — components write self-sufficient declarations where cheap (full `border` shorthands rather than bare widths, explicit `font-size`/`line-height` on text-bearing hosts), so the reset is a guarantee, not a hidden dependency.
- **Consumer guidance on layers**: unlayered CSS outranks all layered CSS, so an app's unlayered `button { ... }` global would override component styles. Apps should keep their own element-level globals in a layer ordered before `rmx` and reserve unlayered rules for intentional overrides.

### 4. Behavior: HTML and CSS first, JavaScript as opt-in mixins

Every component starts from the most capable server-rendered baseline the platform offers:

- **`<dialog>`** for Dialog, AlertDialog, Modal, Drawer, Sheet, and Confirm. Opening uses Invoker Commands (`<button commandfor="id" command="show-modal">`); closing uses `command="close"` or `<form method="dialog">`. Placement (drawer sides, sheet edges) is pure CSS on the dialog element.
- **Popover API** for Popover, Menu surfaces, Select dropdowns, and NavigationMenu panels: `popover` attribute + invokers for open/close, CSS anchor positioning (`anchor-name` / `position-anchor` / `position-area`) for placement.
- **Invoker Commands** wherever a button toggles something the platform can target, so trigger wiring ships zero JavaScript.
- **`<details>`/`<summary>`** for Disclosure, and `<details name>` for exclusive Accordion groups, animated with `::details-content` + `interpolate-size: allow-keywords`.
- **Native form controls** styled with CSS: checkbox, radio, switch (styled checkbox; `switch` attribute where supported), range slider, search/file/date/time/number inputs, `<meter>`, `<progress>`, and native `<select>` upgraded with customizable-select (`appearance: base-select`) where available, falling back to default native rendering.
- **CSS-only interaction patterns**: scroll-snap for Carousel, `:hover`/`:focus-visible` reveal + anchor positioning for Tooltip and HoverCard (upgrading to Interest Invokers as `interestfor` ships), `field-sizing: content` for auto-growing textareas, scrollbar styling for ScrollArea, anchor-positioned transitions for the tab SelectionIndicator, `@view-transition` for cross-document SharedElement transitions.
- **Server round-trips instead of client state** where the repo's server-first model already covers the need: table sorting via query-param links, pagination via links, tab selection via links, row selection and tag removal via forms, sidebar collapse persisted via cookie + form. Components make no assumption about owning the full page, so wrapping such a region in a `<Frame>` upgrades its round-trips to partial page updates — sort a table without a full reload — still with zero library JavaScript.
- **CSS containment instead of virtualization**: long-list components (Table body, GridList, Tree, ListBox) set `content-visibility: auto` with `contain-intrinsic-size` hints so offscreen rows skip rendering work. True windowing is out of scope; the repo's answer to unbounded datasets remains server pagination.

One support policy governs all of it: Baseline platform features may be load-bearing; below-Baseline CSS needs either a fallback that keeps the component functional (anchor positioning degrading to static placement) or an `@supports` guard around pure polish (scroll-driven animations); and JavaScript only ever arrives as an opt-in mixin.

Components themselves never ship behavior: they are markup plus `css()` styling, and **the library never hydrates them**. When a widget needs JavaScript, the behavior is packaged as a standalone mixin (authored with `createMixin` from `remix/ui`) exported from `@pkg/r3-ui/mixins`. The consumer attaches it through the component's `mix` passthrough prop, and hydration belongs entirely to the consuming app: the island component that renders the widget and applies the mixin is what gets a `clientEntry(...)` — nothing inside `@pkg/r3-ui` does. A screen that sticks to baseline behavior renders the same components with zero library JavaScript.

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

Rules for mixins:

- **State lives in the consumer, not the mixin.** Mixins receive options, callbacks (the same shape as `remix/ui`'s `popover.surface({ open, onHide })`), or a behavior-class instance; they never own reactive state that would force the library component to call `handle.update()`.
- **Multi-element widgets coordinate through the DOM.** A mixin applies to the widget's root host and manages descendants through the same `data-*` contract the styles use (e.g. `otpSlots()` on the group host finds the slot inputs beneath it), so one widget needs one mixin, not one per element.
- **Custom events are namespaced** as `ui:*`, extend `Event` with typed payloads, and are declared on `HTMLElementEventMap`, so consumers subscribe with plain `on(...)`.
- **Adapt first-party primitives instead of reimplementing.** Where `remix/ui` already ships the behavior (`menu`, `listbox`, `combobox`, `tabs`, `popover`), the r3-ui mixin wraps it and binds it to the library's markup and data-attribute contract.
- **Every mixin module opens with a note** documenting why JavaScript is required and what the no-JS baseline does without it:

```tsx
/**
 * Why JS: the WAI-ARIA menu pattern requires roving tabindex, arrow-key
 * navigation, and typeahead, which HTML does not provide.
 * No-JS baseline: the menu still opens and closes via the Popover API and
 * items remain reachable in Tab order.
 */
```

Because no component carries behavior, every component works with JavaScript disabled by construction; applying a mixin without hydrating the island simply leaves the baseline in place.

#### Custom commands: the trigger contract for hydrated widgets

Invoker Commands are not limited to the built-in dialog and popover values: any `command` prefixed with `--` dispatches a `CommandEvent` on the `commandfor` target with no built-in behavior. The library adopts this as the standard contract between trigger buttons and hydrated widgets:

- **Widget-root mixins listen for `command`** on the host and switch on `event.command`. Library commands use the `--ui-` prefix (mirroring the `ui:*` event namespace); unknown commands are ignored, so apps can aim their own `--` commands at the same elements.
- **Trigger buttons are static server HTML.** `<button commandfor="cart-carousel" command="--ui-next">` needs no mixin and no hydration, and can live anywhere in the page — including outside the island that owns the widget. The island shrinks to the stateful widget root.
- **Parameters ride the invoker.** `event.source` is the triggering button, so `<button commandfor="cart-carousel" command="--ui-goto" data-slide="3">` carries its payload in `event.source.dataset`.

Concrete wirings: Carousel prev/next/goto buttons (`--ui-prev`, `--ui-next`, `--ui-goto`), toast close buttons (`--ui-dismiss`), the sidebar collapse trigger (`--ui-toggle`), and expand/collapse-all toolbar buttons for Tree and GridList (`--ui-expand-all`, `--ui-collapse-all`). Without hydration a custom-command button is inert, so widgets whose baseline matters keep their no-JS path (forms, links, the checkbox collapse) unchanged.

The same mechanism composes app-ward with zero library involvement: components pass invoker attributes through to their host elements, so a `Menu.Item` can open an app-owned dialog with `commandfor` + `command="show-modal"` and no JavaScript at all.

Built-in commands beyond dialog and popover are on the same trajectory — the spec adds `step-up`/`step-down` for number inputs, `show-picker` for selects and pickers, and `toggle`/`open`/`close` for `<details>`. As those ship, they retire `stepper()` and give DatePicker and Disclosure fully declarative triggers; the mixins remain the fallback until support is broad.

#### Behavior classes: headless models behind the mixins

Behavior with real state does not live inside mixins either. It lives in plain classes that extend `TypedEventTarget` from `remix/ui` — the framework's `EventTarget` subclass with a typed event map, so `addEventListener` and `dispatchEvent` are type-safe without ceremony — exported from `@pkg/r3-ui/behaviors`. A behavior class is a DOM-free model: it owns state (a toast queue, a selection set, a drag state machine), exposes imperative methods, and announces changes by dispatching typed `Event` subclasses. Mixins and island components are thin adapters around it — mixins translate DOM events into method calls, and components subscribe and re-render:

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

Rules for behavior classes:

- **They never touch the DOM.** Rendering belongs to components and DOM wiring to mixins. This is what makes the logic unit-testable without `createRoot` or a flush cycle: construct the class, call methods, assert on state and dispatched events.
- **Cleanup rides abort signals.** Subscriptions pass `{ signal: handle.signal }` so listeners detach when the island unmounts; classes that own timers expose disposal the same way.
- **They are client-only values.** A class instance is not serializable, so it is constructed in the island's setup scope (or shared with descendants through `handle.context`), never passed as a `clientEntry(...)` prop.
- **Class events use plain names** (`"change"`, `"toast"`); the `ui:*` namespace is reserved for events dispatched on DOM hosts, where collisions with other code are possible.

When logic deserves a class instead of staying inline in its mixin: the app calls an imperative API (`toaster.success(...)`), multiple components or elements observe the same state, or the state machine is complex enough to deserve DOM-free tests (timer queues, selection models, drag sessions). DOM glue (`imageFallback()`, `clearField()`, `stepper()`) stays inline in its mixin, and pure calculations (calendar date math, range clamping) are plain functions — a class there is ceremony.

This layer also resolves what would otherwise be the architecture's one exception: Toaster appends new DOM at runtime, which a host-element mixin cannot do. As a `Toaster` class plus pure `Toast` components rendered by the consumer's island, it follows the same component/mixin/behavior split as everything else — and the library ships no hydrated components at all.

#### Forms: `remix/data-schema` issues are the wiring

The field family speaks the repo's validation currency directly. `<Form issues={parsed.issues}>` provides parse issues through component context; each field picks out its own issues by `name`, sets `aria-invalid`, links its `FieldError` message through `aria-describedby` (generated with `handle.id`), and the first invalid field renders the `autofocus` attribute — so the canonical `parseSafe` → 400 re-render pattern lands focus on the first problem with zero JavaScript.

Client-side validation is layered on the platform, never bespoke:

1. **Native constraint attributes** (`required`, `pattern`, `min`, `max`, `type`) stay on the inputs as the browser's zero-JS first pass.
2. **The opt-in `validate(schema)` mixin** upgrades that first pass through the Constraint Validation API. It runs the same `remix/data-schema` field schema the controller parses with — imported from a shared module, so client and server can never disagree — and reports failures with `setCustomValidity()`, which plugs custom rules into the browser's own machinery: submission blocking, `checkValidity()`, focus routing, and the `:user-invalid`/`:user-valid` pseudo-classes the field styles already key off.
3. **Messages render in `FieldError`, not browser bubbles.** The mixin intercepts the `invalid` event (capture phase — it does not bubble) and mirrors `validationMessage` into the field's existing `FieldError` slot, so server-round-trip errors and client pre-flight errors share one surface, one styling, and one `aria-describedby` wiring. Message text comes from the schema's issue messages, so localization follows however the app builds its schemas.

Without hydration, layers 2–3 simply do not attach: native attributes and native bubbles still validate. And regardless of what the client reports, the server stays the authority — the mixin is a courtesy pre-flight, not a gate the server trusts.

### 5. Mixin catalog

The behavior gaps identified in the component inventory factor into this catalog. Adapters wrap a first-party `remix/ui` primitive; the rest are custom `createMixin` implementations. Mixins with real state delegate to the behavior classes listed at the end.

**Adapters over `remix/ui` primitives**

| Mixin              | Applied to | Why JavaScript is required                                                      |
| ------------------ | ---------- | ------------------------------------------------------------------------------- |
| `listboxKeys()`    | ListBox    | ARIA listbox selection model and keyboard interaction (`remix/ui/listbox`)      |
| `comboboxFilter()` | ComboBox   | As-you-type option filtering and active-option management (`remix/ui/combobox`) |
| `tabKeys()`        | Tabs list  | ARIA tabs arrow-key activation for in-page panels (`remix/ui/tabs`)             |

**Custom mixins**

| Mixin                | Applied to                             | Why JavaScript is required                                                                                                                                                                                  |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `menuKeys()`         | Menu surface                           | ARIA menu keyboard pattern: roving tabindex, arrow keys, Home/End, typeahead — a self-contained adapter over `Menu`'s own `data-*`/`role` markup, not a wrapper around `remix/ui/menu`'s composed primitive |
| `contextMenu(id)`    | ContextMenu trigger area               | `contextmenu` has no HTML equivalent; opens the surface at the pointer position                                                                                                                             |
| `commandFilter()`    | Command root                           | Hides non-matching pre-rendered items as the user types; toggles the empty state                                                                                                                            |
| `calendarKeys()`     | Calendar grid                          | Arrow/PageUp/PageDown/Home/End navigation across rendered month cells                                                                                                                                       |
| `rangePreview()`     | RangeCalendar grid                     | Hover preview of the pending date range                                                                                                                                                                     |
| `stepper()`          | NumberField group                      | `stepUp()`/`stepDown()` are JS-only APIs today; adds press-and-hold repeat. Retires once `step-up`/`step-down` invoker commands ship broadly                                                                |
| `otpSlots()`         | OtpField group                         | Focus advance/retreat between slot inputs; splits pasted codes                                                                                                                                              |
| `validate(schema)`   | Form fields                            | Runs the shared `remix/data-schema` field schema client-side via the Constraint Validation API: `setCustomValidity()`, intercepted `invalid` events rendered into `FieldError` instead of browser bubbles   |
| `pressToggle()`      | ToggleButton                           | Flips `aria-pressed` without a server round-trip                                                                                                                                                            |
| `dismiss(options)`   | Toast, Alert                           | Auto-dismiss timers with hover pause; dispatches `ui:dismiss`                                                                                                                                               |
| `dualRange()`        | Slider group                           | Native `<input type="range">` is single-thumb; clamps paired inputs into an ordered pair                                                                                                                    |
| `carouselControls()` | Carousel viewport                      | Handles `--ui-prev`/`--ui-next`/`--ui-goto` commands from static invoker buttons via `scrollBy()`; syncs disabled state at scroll edges                                                                     |
| `clearField()`       | SearchField clear button               | Clears one input without resetting the surrounding form                                                                                                                                                     |
| `dropZone()`         | DropZone                               | Drag-and-drop events are JS-only; toggles `data-drop-target`, dispatches `ui:drop-files`                                                                                                                    |
| `dragReorder()`      | GridList, Tree                         | Pointer-driven reorder; positions the DropIndicator, dispatches `ui:reorder`                                                                                                                                |
| `gridListKeys()`     | GridList                               | ARIA grid keyboard interaction                                                                                                                                                                              |
| `treeKeys()`         | Tree                                   | ARIA tree keyboard interaction                                                                                                                                                                              |
| `resizeHandle(axis)` | Resizable handle                       | Pointer-tracked panel resizing written to a CSS custom property on the group                                                                                                                                |
| `imageFallback()`    | Avatar/Logo image                      | The image `error` event is the only reliable load-failure signal; flags the host so CSS reveals the fallback                                                                                                |
| `viewTransition()`   | SharedElement                          | Same-document transitions require `document.startViewTransition()`                                                                                                                                          |
| `persist(key)`       | Sidebar root                           | Handles the `--ui-toggle` command and mirrors collapse state into a cookie so the server renders the next page already collapsed                                                                            |
| `hotkey(combo)`      | Command dialog, any `<dialog>`/popover | Global shortcuts (`⌘K`) have no declarative HTML wiring; shows or toggles the host                                                                                                                          |
| `themeToggle()`      | Theme switch control                   | Flips `.dark`/`.system` on `<html>` and persists the choice in a cookie so the server renders the next page in the right scheme                                                                             |

**Behavior classes** (`@pkg/r3-ui/behaviors`)

| Class            | Backs                                                   | State it owns                                                                |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Toaster`        | Toast / Toast.Region islands                            | Toast queue, auto-dismiss timers, pause-on-hover                             |
| `Announcer`      | Live-region island (Command counts, drag moves, toasts) | Queue of `aria-live` messages — announcements RAC previously made implicitly |
| `SelectionModel` | GridList, Tree, Table row selection                     | Selected keys; toggle, range, and select-all semantics                       |
| `FilterModel`    | `commandFilter()`                                       | Query, matched option set, active option, movement across matches            |
| `CalendarModel`  | `calendarKeys()`, `rangePreview()`, the picker family   | Focused date, visible month, range anchor and pending preview                |
| `DragSession`    | `dragReorder()`, `dropZone()`, DropIndicator            | Drag source, current target, computed drop position                          |
| `ResizeSession`  | `resizeHandle(axis)`                                    | Active pointer session; min/max constraint solving across the panel group    |

Deliberate non-classes, recorded so the reasoning is not relitigated later: ComboBox filtering belongs to `remix/ui/combobox` (the adapter mixin does not duplicate it into `FilterModel`); Tree and Accordion expansion stays native, since `<details>` already owns open state; typeahead matching uses `remix/ui`'s first-party typeahead utility; OTP focus, stepper repeat, carousel scrolling, and collapse persistence are DOM glue below the class threshold; and validation state lives on the server per the repo's boundary-validation rule. A class that nothing observes is a plain class — the `TypedEventTarget` base is only for state with subscribers.

The catalog grows only when a new behavior gap appears, under the same rules: consumer-owned state (or a behavior class), DOM-subtree coordination, namespaced events, a why-JS note — and a class only where the section 4 criteria hold.

### 6. Component inventory

Every `@pkg/ui` export gets an `@pkg/r3-ui` counterpart. Strategy per component:

**HTML + CSS only — complete without any mixin**

| Components                                                                                                                                                     | Notes                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| Alert, Badge, Card, Empty, Skeleton, Spinner, Separator, Keyboard, Header, Heading, Text, Section, Group, Toolbar, OverlayArrow, ImagePlaceholder, AspectRatio | Static styling ported verbatim                                                                           |
| Label, Description, FieldError, Form, TextField, Input, TextArea, SearchField, FileTrigger, DateField, TimeField                                               | Native form elements; `TextArea` auto-grows via `field-sizing`; date/time fields ride `<input type="date | time">` |
| Button, LinkButton, Link, NavLink, Breadcrumbs, Pagination                                                                                                     | Buttons/anchors; pending and active states server-rendered (`aria-current`, data attributes)             |
| Checkbox, CheckboxGroup, RadioGroup/Radio, Switch, Slider (single thumb), Meter, ProgressBar                                                                   | Styled native controls                                                                                   |
| Dialog, AlertDialog, Modal, Drawer, Sheet, Confirm                                                                                                             | `<dialog>` + Invoker Commands                                                                            |
| Popover, Tooltip, HoverCard, NavigationMenu                                                                                                                    | Popover API / CSS hover + anchor positioning                                                             |
| Disclosure, Accordion                                                                                                                                          | `<details>` / `<details name>`                                                                           |
| Select                                                                                                                                                         | Native `<select>` + customizable-select styling                                                          |
| ScrollArea, SelectionIndicator                                                                                                                                 | CSS scrollbars; anchor-positioned indicator                                                              |
| Table (display, sorting, pagination)                                                                                                                           | Sorting/selection via links and forms                                                                    |
| Tabs (link mode)                                                                                                                                               | Server-selected tabs as links                                                                            |
| ListBox (display mode)                                                                                                                                         | Static option list styling                                                                               |

**Pure UI + opt-in mixin — the component ships no JS; the consumer's island adds the mixin**

| Components                                           | No-JS baseline                                                    | Opt-in mixin(s)                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| Menu                                                 | Opens/closes via Popover API; items reachable in Tab order        | `menuKeys()`                                    |
| ContextMenu                                          | None — right-click has no HTML equivalent                         | `contextMenu(id)`, `menuKeys()`                 |
| ListBox (interactive selection)                      | Static option list; selection via form controls                   | `listboxKeys()`                                 |
| ComboBox                                             | `<input>` + `<datalist>`                                          | `comboboxFilter()`                              |
| Command                                              | Renders a plain searchable-looking list                           | `commandFilter()`                               |
| Calendar, RangeCalendar, DatePicker, DateRangePicker | Native `<input type="date">` fallback                             | `calendarKeys()`, `rangePreview()`              |
| NumberField (steppers)                               | Native `<input type="number">` spinners                           | `stepper()`                                     |
| OtpField                                             | Single `<input inputmode="numeric" autocomplete="one-time-code">` | `otpSlots()`                                    |
| Form fields (custom client validation)               | Native constraint attributes + browser bubbles; server re-render  | `validate(schema)`                              |
| Tabs (client mode)                                   | Link-mode Tabs (server-selected)                                  | `tabKeys()`                                     |
| GridList, Tree                                       | Static list / nested `<details>` rendering                        | `gridListKeys()`, `treeKeys()`, `dragReorder()` |
| TagGroup (removal), ToggleButton, ToggleButtonGroup  | Form-submission variants                                          | `pressToggle()`                                 |
| Toast                                                | Server flash messages render as static Alerts                     | `dismiss(options)`                              |
| Slider (multi-thumb)                                 | Two paired range inputs                                           | `dualRange()`                                   |
| Carousel (controls)                                  | Controls hidden; swipe/scroll still works via scroll-snap         | `carouselControls()`                            |
| SearchField (clear button)                           | Clear button hidden; WebKit shows the native cancel control       | `clearField()`                                  |
| DropZone, DropIndicator                              | `<input type="file">`                                             | `dropZone()`, `dragReorder()`                   |
| Resizable                                            | Fixed default layout                                              | `resizeHandle(axis)`                            |
| Avatar, Logo                                         | Fallback rendered beneath the image                               | `imageFallback()`                               |
| SharedElement                                        | Cross-document `@view-transition` in CSS                          | `viewTransition()`                              |
| Sidebar (collapse persistence)                       | Checkbox-driven CSS collapse; mobile drawer is a `<dialog>`       | `persist(key)`                                  |

**Toaster** (replaces Sonner) is not a hydrated library component: it is the `Toaster` behavior class plus pure `Toast` components, with the rendering loop owned by the consumer's island (section 4).

`ColorProvider`/`useColor` (React context) is not ported: color cascading is already expressed in the stylesheet as `[data-color="x"] &` descendant selectors, so a `data-color` attribute on any ancestor does the job without a runtime.

### 7. Icons

`@pkg/lucide-remix` replaces `lucide-react` everywhere an icon is built in (select chevrons, toast icons, checkbox checkmarks, calendar navigation).

### 8. Copy: the library ships no strings

Every user-facing string comes from the consumer. Visible copy arrives as children (`Command.Empty`, `Empty.Title`); accessibility strings that `@pkg/ui` defaulted to English — icon-only button labels, pagination's "Next", calendar navigation, OTP slot labels — become required props. Remix apps localize through the shared i18n middleware, and a built-in English default would silently bypass the app's locale, so the library has none.

Date and number rendering uses the platform's `Intl` APIs with a consumer-provided locale (defaulting to the document `lang`). That also lets `CalendarModel` drop `@internationalized/date`: month and weekday names come from `Intl.DateTimeFormat`, and arithmetic stays on plain `Date`.

### 9. Testing and the `ui-docs` app

Storybook is React-only and does not come along. Testing splits by what is being verified: logic runs on `bun:test` (the repo's runner — not `remix/test`), and UI is verified against a real app.

**Logic — `bun:test`, colocated `*.test.ts`:**

- Behavior classes get plain unit tests with no DOM at all: construct the class, call methods, assert on state and dispatched events. This is where most behavior logic gets tested.
- Pure helpers (calendar date math, filter matching, animation factory output) are ordinary units.
- Component purity is enforced mechanically, not by convention: a `bun:test` suite asserts that modules under `src/components/` import only `css`, `attrs`, and types from `remix/ui` — an `on`, `ref`, or `createMixin` import in a component module fails the suite.

**Documentation lives closest to its consumer.** Every public export — components and their props, mixins, behavior classes, animation factories — carries JSDoc, so the first documentation surface is the editor itself (hover, autocomplete); hydration notes and why-JS notes are part of that JSDoc, not separate files. The package README covers install, the theme contract, the layer rules, and the reset/theme import order. `apps/ui-docs` renders the browsable documentation on top of these — it complements the in-code docs, never replaces them.

**UI — `apps/ui-docs`, a Remix app that is the library's first consumer and its rendered documentation:**

- One page per component: rendered variants beside their source (ported from the Storybook stories, so the existing example coverage carries over), usage guidance, and the hydration note of every mixin the component pairs with. Writing the docs page is part of porting the component, not an afterthought.
- Being a real app built with `@pkg/r3-ui`, it dogfoods the library continuously — and when the package publishes, `ui-docs` is the public documentation site.
- Interaction and visual verification run against it with the `agent-browser` CLI: an axe-core audit on every page (replacing `@storybook/addon-a11y`), screenshot diffs against the `@pkg/ui` Storybook stories during the port to sign off the visual-parity claim in section 2, and scripted interaction checks for hydrated mixins.

**Dev-mode contract checks** ship in the library itself: a Dialog without an `id`, an icon-only Button without a label, a `Command.Item` without a `value` each log a console warning. The checks sit behind a dev-mode guard and are stripped from production bundles — the type system enforces required props, these catch what it cannot (children shapes, id wiring).

### 10. Quality bar

The target is a library that competes with shadcn/ui on quality while depending on less: no React, no Radix, no JavaScript until a mixin is applied. What it matches: composability (compound components + `mix` + `parts`), theming (color, shape, and density tokens), polished defaults, documentation with visible source. What differs by design: behavior comes from the platform first, and hydration is the consumer's explicit choice — a page of r3-ui components is fully functional before any JavaScript arrives, which a Radix-based library cannot claim. What is conceded: shadcn's ecosystem breadth; this catalog competes on depth per component, not marketplace volume.

Interaction detail follows the repo's [Apple HIG web skill](../../.agents/skills/apple-hig-web-app-guidelines/SKILL.md) as the normative reference. The port-wide rules it dictates:

- **Touch first, pointer enhanced.** On coarse pointers every control guarantees a ≥44px (`2.75rem`) hit area — visual size stays parity-identical; the extra area comes from padding or a pseudo-element hit extension under `@media (pointer: coarse)`. Density tightens only for fine pointers.
- **Hover is a capability, not an assumption.** All hover styles sit behind `@media (hover: hover)`, so touch devices never get sticky hover states, and anything reachable by hover (Tooltip, HoverCard) is also reachable by focus or tap.
- **Gestures, hover, and shortcuts are never the only path.** Swipe, drag reorder, and `hotkey()` always shadow a visible control — the mixin architecture enforces this by construction, since the baseline exists before the mixin.
- **Text inputs use ≥1rem type on coarse pointers.** iOS Safari zooms into any focused input below 16px; the source stylesheet's `text-sm` inputs trigger exactly that. Recorded as a deliberate parity deviation on touch devices.
- **Immediate feedback on every control**: designed `:hover`, `:active`, `:focus-visible`, disabled, invalid, and `aria-busy` pending states — none left as browser defaults — plus `touch-action: manipulation` to remove double-tap-zoom lag.
- **Scroll discipline.** Scrollable overlays (Menu, Dialog, Sheet, Drawer, Command list) set `overscroll-behavior: contain` so inner scroll never chains to the page.
- **Depth is a scale, not per-component taste.** One elevation token set (flat, raised, overlay, modal) shared by Card, Popover, Menu, and the Dialog family; optional backdrop material (blur/saturate behind `@supports (backdrop-filter: blur(0))`) as polish on top, itself gated behind `@media (prefers-reduced-transparency: reduce)` so it falls back to a solid/near-opaque surface rather than assuming transparency is always welcome.
- **Contrast is a preference, not a fixed design.** `prefers-contrast: more` promotes every color's subtle `border` to its strong variant library-wide (section 3) — components additionally never rely on color alone to carry a state distinction, so the promoted border always has something to reinforce.
- **Fixed chrome respects safe areas.** Sheet, Drawer, the Toast region, and Sidebar pad with `env(safe-area-inset-*)`.
- **Destructive actions are explicit.** Danger tone plus the AlertDialog/Confirm pattern; never a bare danger button for an irreversible operation.

**Definition of done** — a component counts as ported only when all of these hold:

1. All interactive states designed: hover, active, focus-visible, disabled, invalid, selected, pending
2. Dark mode, RTL, and container adaptation verified
3. Touch, pointer, and keyboard paths complete; screen-reader labels wired
4. Reduced-motion, high-contrast, and reduced-transparency behavior verified
5. JSDoc on every public export it adds; axe-clean `ui-docs` page with a visible-source example
6. Screenshot parity signed off, or the deviation recorded in this ADR
7. Tests at the right layer: class unit tests, mixin DOM tests, component render tests
8. Hydration note present on any mixin it pairs with

### 11. Adoption

- New Remix apps use `@pkg/r3-ui` for shared primitives, keeping route-local composition inline in controllers per existing conventions.
- Existing Remix apps adopt per-component, opportunistically; no big-bang rewrite of `r3-uptime` is implied by this ADR.
- `@pkg/ui` remains the library for React apps and receives no new investment beyond maintenance; design changes land in both packages while both are in use.
- Porting order follows usage: form primitives and Button first, then overlays (Dialog family, Popover, Menu), then data display (Table, Card, Alert, Badge), then the long tail.
- The package is written as if public from day one: no monorepo-internal assumptions beyond `@pkg/lucide-remix`, documentation in the source itself — JSDoc on every public export and a README covering install, the theme contract, layer rules, and import order — with `apps/ui-docs` as the rendered site on top, and API stability treated as a contract. Publishing follows the existing release process ([ADR-007](./ADR-007-publishable-package-releases.md)); shipping `@pkg/r3-ui` publicly implies also publishing `@pkg/lucide-remix` or inlining the icons the library uses.

### 12. Chat/AI elements extension

In June and July 2026, shadcn/ui shipped two additions relevant to the quality bar section 10 holds this catalog to: a "chat components" family (`MessageScroller`, `Message`, `Bubble`, `Attachment`, `Marker`, plus the `scroll-fade` and `shimmer` Tailwind utilities) and, separately, `Typeset`, a CSS-only typography layer for rendered markdown and HTML content. Neither is a wholesale port target the way section 6's inventory is — the goal is the same conversational vocabulary, built the way every other component in this catalog is built: markup and `css()` first, JavaScript only where the interaction genuinely demands it, and real state factored into a behavior class rather than living inside a mixin or a component.

#### Components

**HTML + CSS only — complete without any mixin**

| Components                                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typeset                                                                                 | A typography layer for already-rendered markdown or HTML — headings, lists, code, tables, rules — sized by three custom properties (`--ui-typeset-size`, `--ui-typeset-leading`, `--ui-typeset-flow`). A `data-preset` attribute selects a rhythm (docs, chat, reading) by overriding those three variables, and a `data-not-typeset` attribute on any descendant opts it out of the styling. Its wide-table treatment reuses `ScrollArea.Viewport`'s scrollbar styling and the new `scrollFade()` animation (below) instead of a second scrollbar pattern. |
| Message, Message.Avatar, Message.Header, Message.Content, Message.Footer, Message.Group | A conversational row: an avatar slot anchored to the block-end edge (shifting up when a footer is present), a start-aligned header, a content slot, and a footer for status or action buttons. `Message.Group` collapses the spacing between consecutive rows from the same sender. The avatar slot composes the catalog's `Avatar` component once it lands; footer action buttons compose `Button`.                                                                                                                                                        |
| Bubble, Bubble.Content, Bubble.Group                                                    | The framed message surface itself — seven color/tone variants, start/end alignment, size-to-content up to 80% of the container, and a `ghost` variant that drops the max-width for full-width unframed assistant text. Nests inside `Message.Content`. `Bubble.Content` composes with `Disclosure` for a "show more" long-message pattern and with `Popover` for on-demand expanded metadata.                                                                                                                                                               |
| Marker, Marker.Icon, Marker.Content                                                     | An inline status update, system note, bordered row, or labeled separator between message rows — `default`, `border`, and `separator` variants. `Marker.Content`'s streaming-caption text applies the new `textShimmer()` animation (below); a progress variant composes the catalog's `Spinner`.                                                                                                                                                                                                                                                            |

**Pure UI + opt-in mixin — the component ships no JS; the consumer's island adds the mixin**

| Components                                                                                                                                                              | No-JS baseline                                                                                                                                                                                                                                                                                                                                                                                        | Opt-in mixin(s)       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Attachment, Attachment.Media, Attachment.Content, Attachment.Title, Attachment.Description, Attachment.Actions, Attachment.Action, Attachment.Trigger, Attachment.Group | A static, already-settled file or image card, fully readable. `Attachment.Action` composes `Button`'s sizes and props; `Attachment.Group`'s horizontally scrolling, snapping row is CSS scroll-snap plus the new `scrollFade()` animation                                                                                                                                                             | `attachmentTrigger()` |
| MessageScroller, MessageScroller.Viewport, MessageScroller.Content, MessageScroller.Item, MessageScroller.Button                                                        | Every message row renders in document order inside a scrollable frame and scrolls with native behavior. `MessageScroller.Viewport` reuses `ScrollArea.Viewport`'s scrollbar treatment and layers the new `scrollFade()` animation over it for edge hints; `MessageScroller.Content` carries `role="log"` and `aria-relevant="additions"` as static markup, no mixin needed for the ARIA wiring itself | `messageFollow()`     |

`Bubble.Reactions`, the reaction-emoji row anchored to a bubble edge, is not a new component: it renders as a small row of the existing `ToggleButton`/`pressToggle()` pattern, since a reaction is exactly a no-round-trip pressed toggle scoped to one emoji.

There is no `Provider` component in this family. The role shadcn's `MessageScrollerProvider` plays — sharing scroll state across the widget and exposing an imperative API to the app — is the `ScrollFollowModel` behavior class instance below, constructed in the consumer's island setup scope and shared through `handle.context`, the same pattern `Toaster` already establishes for Toast.

#### Mixins

| Mixin                 | Applied to                   | Why JavaScript is required                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messageFollow()`     | MessageScroller.Viewport     | Detecting that a reader has scrolled away from the live edge — so auto-follow disengages instead of fighting them — and anchoring a new turn near the top with a peek of the previous one instead of snapping the whole thread down both need native scroll/wheel/touch/keyboard listening and `getBoundingClientRect` measurement that no CSS selector expresses |
| `attachmentTrigger()` | Attachment.Trigger           | Making a whole card a link or dialog trigger while its own action buttons stay independently clickable needs script to tell a click on an action apart from a click on the card                                                                                                                                                                                   |
| `copyToClipboard()`   | Message.Footer action button | Writing to the clipboard is a script-only API with no HTML form equivalent                                                                                                                                                                                                                                                                                        |

`messageFollow()` coordinates `MessageScroller.Content`, `MessageScroller.Item`, and `MessageScroller.Button` through the same `data-*` contract every multi-element mixin in this catalog already uses (`otpSlots()`, `resizeHandle()`) rather than needing one mixin per part: it mirrors auto-follow and scrollable-edge state onto `data-autoscrolling`/`data-scrollable` attributes on the viewport, measures `MessageScroller.Item`'s `scrollAnchor` turns for anchor placement, shows or hides `MessageScroller.Button` and removes it from tab order once there is nothing unseen below, and lazily attaches an `IntersectionObserver` only once something — a visibility subscriber on `ScrollFollowModel` — asks for it.

#### Behavior class

| Class               | Backs             | State it owns                                                                                                                                  |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ScrollFollowModel` | `messageFollow()` | Pinned/auto-follow state, the current anchor turn, the set of visible message ids, and which scrollable edges (start, end) are still reachable |

Like `DragSession` and `ResizeSession`, `ScrollFollowModel` never touches the DOM itself: `messageFollow()` performs every measurement (scroll position, resize, intersection) and feeds the results in as plain values, and the model's `scrollToEnd()`/`scrollToStart()`/`scrollToMessage(id, options)` methods record intent and dispatch a `change` the mixin fulfills against the real viewport — the same split that keeps `ResizeSession`'s constraint solving unit-testable without a DOM.

Attachment's upload lifecycle (`idle` → `uploading` → `processing` → `error`/`done`) is not a new behavior class: the state is the consumer's own upload flow, reported to the component as a `state` prop the same way any other component prop is server- or app-owned, matching the non-class precedent already recorded in section 5 for validation state and combobox filtering.

#### Animations

- **`textShimmer()`** (`animations/keyframes.ts`) — a sweeping highlight through a text element's own glyphs via `background-clip: text`, for a streaming response caption ("Generating response…") the way `Marker.Content` and similar streaming captions need it. This is a new factory, not a reuse of the existing `shimmer()`: `shimmer()` sweeps a highlight band across an element's _background_, built for Spinner, Skeleton, and an indeterminate ProgressBar's fill, and stays exactly as it is — `textShimmer()` covers the text-glyph case `shimmer()` was never built for, alongside it rather than in place of it.
- **`scrollFade({ axis })`** (`animations/scroll.ts`) — fades a scroll container's edges through a scroll-linked `mask-image`, sitting beside `scrollShadow()`, `scrollProgress()`, and `viewReveal()` as the same kind of `animation-timeline: scroll()` progressive enhancement, `@supports`-gated with a static two-edge fallback. Applied to `MessageScroller.Viewport` and `Attachment.Group`, and equally usable on `ScrollArea.Viewport` or any other scroll container.

#### Composition summary

Every new piece slots into the existing catalog rather than beside it: `Message` and `Bubble` nest inside a `MessageScroller.Item` row; `Attachment` and `Attachment.Group` render inside a `Message.Content` slot alongside or below `Bubble`; `Marker` sits as a sibling row between `MessageScroller.Item`s; `Typeset` wraps a `Bubble.Content`'s rendered markdown when a message carries formatted text. Reused as-is: `ScrollArea`'s viewport scrollbar treatment, `Button`, the planned `Avatar`, `Disclosure`, `Popover`, `Spinner`, and the existing `pressToggle()` and `shimmer()`. New: four components (plus their compound parts), three custom mixins, one behavior class, and two animation factories — the smallest set that covers the shadcn chat family's behavior without duplicating anything this catalog already has.

### 13. Ambient heading levels

**Problem.** A document's heading levels must run sequentially — `h1`, then `h2`, then `h3` — with no gaps, no matter how deeply the markup that produces them is nested or which component happens to render each one. Every compound component with a title or header slot (`Dialog.Title`, `AlertDialog.Title`, `Card.Title`, `Alert.Title`, `Empty.Title`, `Disclosure.Header`) needs a level, but neither the component author nor the consumer wiring it up in isolation knows what that level should be — it depends entirely on where the surrounding app actually places the component in its own outline. Hardcoding a level per component (a `Card.Title` always at `<h3>`, say, regardless of whether the card sits at the page's top level or three sections deep) reads correctly only by coincidence; hardcoding a _different_ level per component to approximate typical nesting depth is scarcely better, since the guess is still independent of the actual tree the consumer built, and it silently goes wrong the moment a component nests somewhere the guess didn't anticipate. Requiring every consumer to pass an explicit `level` prop on every title solves correctness but reintroduces exactly the prop-drilling the compound pattern exists to avoid — a level computed by hand at every call site, and recomputed the moment a section moves.

**Mechanism.** `HeadingScope` (`src/components/heading-scope.tsx`) is a `remix/ui` context provider: it publishes a semantic depth (`HeadingLevel`, `1`–`6`) through `handle.context`, read by every `Heading` and further-nested `HeadingScope` inside it. Nesting one `HeadingScope` inside another moves the depth one level deeper automatically; an explicit `level` prop fixes a scope's depth outright where the document structure calls for it; and a `HeadingScope` with nothing wrapping it starts the outline at `1`. The provider and every consumer resolve through two small helpers shared by every heading-aware component in the catalog:

- `readAmbientLevel(handle)` calls `handle.context.get(HeadingScope)` and returns the nearest ancestor scope's `level`, or `undefined` where no `HeadingScope` wraps the caller at all. The runtime's context lookup (`findContextFromAncestry`, in `@remix-run/ui`'s `runtime/vnode.js`) walks the component's ancestry and returns `undefined` once it reaches the root without a match — it never throws — which settles the one place this catalog's own type declarations are ambiguous (`Context.get()` is typed as returning `ContextFrom<ComponentType>` with no `| undefined`, matching the common case where a provider is guaranteed to exist). `readAmbientLevel` wraps the call in a `try`/`catch` regardless, so the guarantee holds even if that runtime detail ever changes.
- `resolveHeadingLevel(handle, explicitLevel?)` resolves an explicit level first, falls back to `readAmbientLevel(handle)`, and falls back again to `1` where neither is available, clamping any resolution past `6` back down to `6` — logging a dev-mode warning when it does, since a clamp means the nesting has gone deeper than the native heading elements can express and should be flattened instead.

`HeadingScope` calls `handle.context.set()` and `Heading` calls `handle.context.get()` from inside their render closures rather than once in setup, matching how every other context-providing component in this catalog already does it (`Tabs`, `Slider`, `Resizable`, `RadioGroup`, `ListBox`, `NavigationMenu`, `Form`) — necessary here since the resolved level depends on `handle.props.level`, which can change between renders, not just on state fixed at creation. `HeadingScope` renders a `<div>` styled `display: contents` so composing it never adds a layout box, and both it and `Heading` stamp their resolved depth onto a `data-heading-level` attribute — not for styling, but as the DOM-visible record `headingLevelFallback()` reads back (below). `Heading` itself renders the native `h1`–`h6` element matching the resolved depth, at one fixed visual size regardless of which level it renders, so nesting sections correctly is never a visual trade-off. `Dialog.Title`, `AlertDialog.Title`, `Card.Title`, `Alert.Title`, `Empty.Title`, and `Disclosure.Header` call `resolveHeadingLevel`/`TAG_BY_LEVEL` directly rather than wrapping their content in a `Heading`, so each keeps its own component-specific type and size while sharing one level-resolution algorithm and one fallback-to-`1` behavior — replacing what would otherwise be a hardcoded tag chosen per component with no relationship to actual nesting.

**The hydration boundary.** Context lookup walks a component's own ancestry in its own runtime tree, not the rendered DOM. An independently hydrated island mounts as the root of its own tree: if that root is a `HeadingScope` or a `Heading`, `handle.context.get(HeadingScope)` finds no ancestor there even when the server-rendered page nests the island under a real `HeadingScope` one level up in the actual markup — the island's own component tree simply doesn't include it. Left alone, that island's root would resolve to `1` regardless of where the page actually placed it.

The fix is two-tier, and the tiers are not equivalent — the first is the correct fix, the second is a fallback for when the first isn't practical:

1. **Thread the level down explicitly.** Whoever renders the island already knows the ambient level at render time — it is simply whatever `resolveHeadingLevel`/`readAmbientLevel` returns at that point in the server-rendered tree — so passing it as an explicit `level` prop into the island costs nothing and is exact. This is the path every island should reach for first.
2. **`headingLevelFallback()`** (`src/mixins/heading-level-fallback.ts`) is the safety net for when threading the prop through isn't practical. Applied to the island's root `HeadingScope` or `Heading` through its `mix` prop, it runs once on attach: it walks up from the host with `Element.closest("[data-heading-level]")` — starting from the host's own parent when the host itself already carries the attribute, so the search always lands on the scope wrapping it rather than reading back its own already-resolved value — parses the ancestor's `data-heading-level`, clamps it into `1`–`6`, and reports it through an `onLevel(level)` callback. It no-ops entirely when no ancestor carries the attribute, or its value is missing or unparsable, in which case the server-rendered level (already correct, computed the same way during SSR) is what stays on the page. The mixin never applies the level itself — mirroring how `imageFallback()` and this catalog's other detection mixins hand a value back rather than mutating the host directly — so the consuming island stores the reported level in its own state and calls `handle.update()` to re-render its `HeadingScope`/`Heading` root with the corrected `level` prop.

Why this is a mixin and not logic inside `HeadingScope` or `Heading` themselves: recovering a level this way requires reading the DOM, and `src/components/**` modules are restricted to `css`, `attrs`, and type imports from `remix/ui` — never `ref` — enforced mechanically by the component-purity test suite. `headingLevelFallback()` is `createMixin`-based and imports `ref`, so it lives in `src/mixins/` like every other DOM adapter in the catalog, applied by the consumer rather than built into the pure component.

### 14. Item, Menubar, and an SVG chart module

Three more catalog gaps, closed under the same rules sections 1–13 already established: a freestanding content row that today only exists locked inside composite list components, a persistent desktop-style menu row, and a family of chart primitives that render entirely as computed SVG with no client JavaScript cost beyond producing that markup.

#### Item

`Command.Item`, `GridList.Item`, and `Menu.Item` each already define a compact row grammar — flex layout, a small gap, rounded padding, hover/active/focus tinting, `aria-selected`/`aria-disabled` reads — but only as a sub-part locked inside their owning composite. `Item` (`src/components/item.tsx`) extracts that same grammar into a component usable on its own, for a settings row, a notification list, or a file row that isn't a `Command`, a `GridList`, or a `Menu` at all. It composes naturally as the row content nested inside `GridList.Item`, a `ListBox` option, or a plain `<li>` when one of those does own the surrounding list semantics, without owning any of that context itself.

`Item` renders the row's own host — a `<div>` with the same flex/gap/padding treatment its composite cousins already use — but carries no ARIA row/option/menuitem role of its own, since a generic row makes no assumption about what kind of list, if any, it sits inside. Three compound parts fill it: `Item.Media`, a `flex-shrink: 0` leading slot for an icon, an `Avatar`, or a thumbnail; `Item.Content`, a `min-width: 0` column stack holding `Item.Title` and `Item.Description` so long text truncates instead of pushing the trailing slot off the row's end; and `Item.Actions`, a trailing `flex-shrink: 0` row for buttons, a badge, or a switch. `Item.Title` and `Item.Description` both truncate with `text-overflow: ellipsis` by default, matching a fixed-height row instead of `Card.Title`/`Card.Description`'s free-flowing wrap.

`Item.Title` renders a plain `<div>`, not a heading element — unlike `Card.Title`, `Alert.Title`, and `Empty.Title`, it deliberately does not read the ambient level `HeadingScope` publishes. A settings row, a notification, or a file listed in a `GridList` is a repeated sibling entry, not a section boundary; rendering fifty of them as fifty headings would flood the document outline with fifty near-identical entries, which is exactly the outline pollution `HeadingScope` exists to prevent, not produce. Where one particular `Item` genuinely is a section's heading, a consumer composes `Heading` inside `Item.Title` explicitly rather than `Item.Title` assuming that role for every row it renders.

`Item` carries no mixin of its own. No interactive behavior is common enough across a settings row, a notification, and a file row to standardize into one, and each context already has its own way to make a row interactive: nest an `<a>`/`<button>` inside `Item.Actions`, or wrap the row's content in one the way `Menu.Item` already does depending on `href`.

#### Menubar

`menuKeys()` (section 5) is the nearest precedent for a keyboard-pattern mixin over this catalog's menu markup, and its actual implementation is the model to follow here: a self-contained `ref()`-based adapter that queries `[role^="menuitem"]` descendants of `Menu` directly, assigns roving tabindex, and handles arrow/Home/End/typeahead keys inline against `Menu`'s own `data-*`/`role` contract — not a wrapper around `remix/ui/menu`'s composed primitive, which owns a different, heavier shape (a provider tracking open/registered-item state, nested-submenu anchoring, hover-aim, its own popover surface) built for one trigger and its own tree of submenus, not a horizontal row of independently-triggerable menus. `remix/ui` exposes nothing shaped like a menubar row, so `menubarKeys()` (`src/mixins/menubar-keys.ts`) hand-rolls the ARIA menubar keyboard pattern the same way `menuKeys()` hand-rolls the ARIA menu pattern — a `ref()`-based adapter over plain DOM queries and `data-*`/`role` attributes, not an adapter over any `remix/ui` primitive.

Menubar's own compound shape stays deliberately thin, since `Menu` already supplies everything a top-level item's own dropdown needs. `Menubar` renders the row's host — a `<div role="menubar">` laid out as a horizontal flex row — and `Menubar.Trigger` renders one top-level item as a `role="menuitem"` `<button>`, styled with the same flex/padding/hover treatment `Menu.Item` already uses, so a trigger reads as a peer of the rows inside the menu it opens. A `Menubar.Trigger` opens its own dropdown exactly the way any other `Menu` invoker does — `commandfor` pointed at a `Menu`'s `id`, `command="toggle-popover"` — so `Menu`, `Menu.Item`, and `Menu.Separator` render unchanged as each top-level item's surface; Menubar adds no second menu-surface component of its own.

`menubarKeys()`, applied to the `Menubar` host through `mix`, adapts the row of `Menubar.Trigger`s the way `menuKeys()` adapts a `Menu`'s own rows, with the two differences the WAI-ARIA menubar pattern calls for: the roving axis reads `ArrowLeft`/`ArrowRight` across the row instead of `ArrowUp`/`ArrowDown` down a list, and moving focus to a new trigger while a sibling's dropdown is already open closes that dropdown and opens the newly-focused trigger's own — the "sweep across the bar" behavior a desktop menubar is expected to have. `ArrowDown` (or `Enter`/`Space`) on a focused trigger opens its `Menu` and hands focus into a `menuKeys()`-driven roving tabindex inside it exactly as a standalone `Menu` already would, so the two mixins compose without either needing to know about the other: `menubarKeys()` owns the row, `menuKeys()` owns each opened surface, and the boundary between them is the same `commandfor`/`command="toggle-popover"` invoker relationship every other Popover-API-driven trigger in this catalog already uses.

Why JS: the ARIA menubar pattern's roving tabindex, arrow-key traversal across the row, and open-dropdown-follows-focus behavior have no HTML equivalent. No-JS baseline: every `Menubar.Trigger` is a native `<button>`, independently reachable in Tab order (not yet on a single roving stop), and each opens its own `Menu` through the Popover API precisely like a standalone `Menu` trigger — so the whole menubar is fully operable, just without the single-tab-stop optimization and cross-row arrow keys, matching the same baseline `Menu` itself already offers.

#### An SVG chart module

Every chart type shares two needs no individual chart type owns alone: mapping data values into pixel positions, and turning already-positioned points into an SVG path string. `src/components/chart-scale.ts` and `src/components/chart-path.ts` factor those out as plain, `remix/ui`-free TypeScript — the same sibling-helper-file shape `heading-scope.tsx` already establishes for `resolveHeadingLevel`/`TAG_BY_LEVEL`, just split across two files instead of colocated with one component, since neither file renders anything itself. The split follows what each caller actually needs: `chart-scale.ts` exports `linearScale({ domain, range })` (a numeric value to a pixel coordinate), `bandScale({ domain, range, padding })` (a categorical key to its band's start position and shared bandwidth), `ticks(domain, count)` (evenly spaced values for gridlines and axis labels), and `pieAngles(values, options)` (values allocated proportionally across a total angle sweep) — it never produces a path string, so a bar chart drawing plain `<rect>`s can import only this file. `chart-path.ts` exports `linePath(points)`, `areaPath(points, baselineY)`, and `arcPath({ cx, cy, radius, innerRadius, startAngle, endAngle })` — each takes already-scaled pixel coordinates and produces the `d` attribute string, and none of them compute a scale themselves. `Chart.Area` costs one more path-generator function, not new math: `areaPath` is `linePath`'s own point list closed down to a baseline, built from the exact same `linearScale` calls `Chart.Line` already makes, which is what makes the area variant cheap enough to include alongside bar, line, and pie/donut rather than a fourth chart type that would need its own domain math. Both files are ordinary pure functions over numbers and strings, directly `bun:test`-able with no DOM (`chart-scale.test.ts`, `chart-path.test.ts`), mirroring how `heading-scope.test.ts` already tests `resolveHeadingLevel` without rendering anything.

**Compound shape.** One `Chart` namespace (`src/components/chart.tsx`) holds `Chart.Bar`, `Chart.Line`, `Chart.Area`, and `Chart.Pie` as four independent root `<svg>` elements, plus `Chart.Legend`/`Chart.Legend.Item` and `Chart.Tooltip` as companion parts a consumer renders alongside whichever chart root they compose. This is not the `Table`/`Calendar` shape, where every compound part nests inside one fixed root the way `<thead>` and `<tbody>` nest inside `<table>` — a bar chart and a pie chart are not two views of one structural tree, they're two different geometries built on the same scale math and the same palette, so forcing one of them to be `Chart`'s single root and the others its children would be arbitrary. It is the `Avatar`/`Avatar.Group` shape instead: two independent roots (a single avatar, a row of them) sharing one namespace because they're the same conceptual family, not because either nests inside the other. Separate top-level components (`BarChart`, `LineChart`, `PieChart`) were the other option considered; one namespace wins because `Chart.Legend` and `Chart.Tooltip` are genuinely shared across every chart type, and a separate-components shape would either leave nothing tying a "legend" and a "tooltip" component to the charts they decorate, or duplicate them three or four times. Each chart root takes a fixed logical `width`/`height` — the coordinate space the scale calls above render into — and renders `viewBox="0 0 {width} {height}"` alongside CSS sizing it to `100%` of its own inline size, so the chart stays fluid inside whatever container it renders in without any component reading the viewport or measuring anything at runtime, matching the container-relative rule every other component in this catalog already follows.

**The no-JS baseline: a native `<title>` per point.** Every bar `Chart.Bar` renders, every point `Chart.Line`/`Chart.Area` plots, and every wedge `Chart.Pie` draws carries a native SVG `<title>` as its first child, sourced from a required, consumer-supplied label field on that point's own datum — matching the rule that accessibility strings are a required prop with no built-in default, the same contract `Spinner`'s `aria-label` and `Calendar.PreviousButton`'s accessible name already hold to. Because the label is required by the type, there's no dev-mode `console.warn` to add here — the type system already enforces what those checks exist to catch where it can't. Each point additionally carries `tabIndex={0}`, so the same `<title>` that shows as a hover tooltip also becomes the point's accessible name the moment keyboard focus lands on it. No script is involved, and the entire visual result of every chart renders from computed SVG markup produced at render time, exactly like every other static component in this catalog.

**Theme tokens.** `theme.css` gains a categorical color sequence, `--ui-chart-1` through `--ui-chart-8` — eight slots, the practical ceiling before two series become hard to tell apart at a glance. Unlike the five semantic roles above them, a chart series isn't primary, danger, or any other role carrying meaning — it's an arbitrary position in a legend — so these read from a new, single-shade-per-slot scale (`--color-chart-1` through `--color-chart-8`) rather than the `50`–`950` tint ramps `--color-primary` and its neighbors require: a categorical swatch needs exactly one sufficiently distinct tone per slot, not a ramp to pick a shade from. `theme.css` places them in `:root` only, with no `.dark`/`.system` remapping: every semantic role's dark-mode block exists to re-point which shade of an already-app-defined ramp a variable reads (light reads a `-50`, dark reads a `-950`, say), and a one-shade-per-slot palette has no second shade to re-point to — an app that wants different literal chart hues under `prefers-color-scheme: dark` defines different `--color-chart-*` values inside its own `.dark`/`.system` blocks, the same way it already fully owns every `--color-*` literal per scheme today. The chart components never pick a color themselves: every point/segment element carries `data-series-index="0"`–`"7"` (a series' position modulo eight), and one static `css()` block per chart type maps `[data-series-index="n"]` to `var(--ui-chart-{n+1})` — the same `data-*`-keyed color mechanism `Card`'s and `Badge`'s `data-color` already use, just keyed by position instead of by semantic name, since a series has a position but no semantic role. Axis lines, gridlines, and tick labels read the existing `--ui-neutral-border`/`--ui-neutral-fg-muted` variables rather than a new token, since chart structure is neutral chrome, not a categorical color.

**Series visibility: checkbox-driven CSS, not a mixin.** `Chart.Legend.Item` renders a `<label>` wrapping a visually hidden, `defaultChecked` `<input type="checkbox">` alongside a color swatch (styled from the same `--ui-chart-{n}` variable its series uses) and the series' name. Toggling a series' visibility rides that checkbox's native `:checked` state, following the same checkbox-driven CSS precedent `Checkbox`'s own check-glyph reveal and `Sidebar`'s collapse state already establish in this catalog, combined with `:has()` and structural position instead of a sibling combinator alone: each chart root's own `css()` carries eight static rules, one per legend position — `&:has(~ [data-slot="legend"] input:nth-of-type(n):not(:checked)) [data-series-index="n-1"]` hides that series' points the moment its legend checkbox unchecks. The rules are static and enumerable — the same eight slots the palette already caps at — not generated per dataset, so no mixin computes them; the one DOM contract this asks of a consumer is ordering — `Chart.Legend` renders as a later sibling of the chart root it controls, matching the `~` combinator's direction — documented as a composition note on the component, not enforced by script.

**The opt-in tooltip mixin, no behavior class.** `chartTooltip()` (`src/mixins/chart-tooltip.ts`), applied to a chart root through `mix`, listens for `pointermove`/`pointerleave` on the host, locates the point or segment nearest the pointer, and mirrors that point's already-rendered `data-*` attributes (its label, value, and series index) into a sibling `Chart.Tooltip` element's text content and position, written as CSS custom properties (`--ui-chart-tooltip-x`/`-y`) the tooltip reads for its own `position: absolute` placement — a pointer-following tooltip has no fixed anchor element for CSS anchor positioning, the mechanism `Tooltip`/`Popover` already ride, to target. This stays inside the mixin rather than graduating to a behavior class: the state involved — which point is currently hovered, and where the pointer sits — has exactly one reader, the `Chart.Tooltip` node the same mixin also writes to, needs no imperative method any app code calls, and no second component ever observes it. That is the same "DOM glue below the class threshold" this catalog already draws for `imageFallback()` and `clearField()` (section 5): a class earns its place when multiple components must observe the same state or an app needs to drive it imperatively, and neither applies to one mixin's exclusive relationship with the single tooltip node it positions. Why JS: computing which point the pointer sits nearest to, and writing dynamic position and text content at runtime, has no CSS equivalent — a `:hover` selector reacts per discrete element but cannot interpolate a moving position or generate per-point text. No-JS baseline: every point's native `<title>` (above) still supplies a plain hover tooltip and an accessible name; only the richer, positioned, multi-value tooltip surface is unavailable.

**Composition summary.** Nothing here duplicates an existing part: `Chart.Legend`'s swatch colors and every chart type's point colors read the same eight `--ui-chart-*` variables through the same `data-series-index` attribute, and the tooltip mixin reads the same per-point `data-*` attributes the native-`<title>` baseline already renders rather than recomputing anything the scale module already computed once at render time. New: two pure helper modules, one compound namespace with four chart roots plus a legend and a tooltip part, one custom mixin, eight theme tokens, and zero behavior classes — the same "smallest set that covers the behavior without duplicating anything this catalog already has" bar section 12 already holds itself to.

### 15. A color-editing component family, and a long-press gesture mixin

Two more independent gaps, closed under the same rules the sections above already established: a complete set of components for editing an arbitrary color value the consumer supplies at runtime — a photo's extracted accent color, a brand color a user is customizing, a paint swatch — and a generic touch-and-hold gesture mixin usable on any host element. Neither is part of the semantic color-role layer described in section 3: `theme.css`'s `--ui-*` roles and the `--color-*` scales feeding them stay exactly as they are, since a user-chosen color VALUE and a semantic ROLE (primary, danger, warning) answer completely different questions and share nothing but a common `css()` mixin mechanism.

#### A shared color-math module

Every component below needs the same handful of primitives — parsing a color string a consumer or a native form field hands it, formatting a color value back into a string, converting between color spaces, and clamping/rounding a channel into its valid range — so those primitives factor into one plain, framework-free module, `src/components/color-math.ts`, the same sibling-helper-file shape `heading-scope.tsx` and the chart module already establish: a file that renders nothing itself, sitting next to the components that import it, directly unit-testable with `bun:test` and no DOM (`color-math.test.ts`).

It exports:

- `parseColor(input)` — parses a hex string (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), an `rgb()`/`rgba()` functional string, or an `hsl()`/`hsla()` functional string into one common `{ r, g, b, a }` shape, returning `null` for anything it cannot parse rather than throwing — a native `pattern` attribute is always the first validation gate (below), so this is a second-pass parse for whatever already cleared it.
- `formatHex(rgba)`, `formatRgb(rgba)`, `formatHsl(hsla)` — the inverse direction, producing the string a text field or a form submission carries.
- `rgbToHsl(rgba)`/`hslToRgb(hsla)` and `rgbToHsv(rgba)`/`hsvToRgb(hsva)` — both target spaces stay supported side by side, not just one: a saturation/lightness pair (HSL) and a saturation/value pair (HSV) are numerically different quantities, and `ColorArea`'s two-axis gradient (below) specifically wants the HSV pair, since a saturation-by-value square reads as the conventional white-to-color-to-full-color gradient at a fixed hue, which a saturation-by-lightness square does not produce.
- `clampChannel(value, max)`/`roundChannel(value)` — the same clamp-and-round shape `Slider.Track`'s own `resolveFillPercent` already establishes, generalized to any channel's own max (`255` for an RGB channel, `360` for hue, `100` for a percentage channel).
- `normalizedPointerPosition(rect, x, y)` — clamps a pointer's coordinates into a `[0, 1] × [0, 1]` box relative to a plain `{ left, top, width, height }` rect, the shared geometry `colorAreaDrag()` (below) is built on.
- `angleFromCenter(cx, cy, x, y)` and `angleToHue(angle)`/`hueToAngle(hue)` — the polar equivalent, the shared geometry `colorWheelDrag()` is built on, kept as two separate steps (raw geometry, then hue mapping) so each is independently testable.

No component reimplements any of this math itself — every one of the seven below either reads one of these functions directly, or reads a value some mixin already computed through them.

#### ColorSwatch

`src/components/color-swatch.tsx` — a static preview box, HTML and CSS only, no mixin. It takes a `value` prop (a color string, already resolved) and a `shape` (`"circle" | "square" | "rounded"`) and `size` variant, and renders a `<span>` carrying the value on a local, per-instance custom property (`--ui-color-swatch-value`, set through the inherited `style` prop the way `Slider.Track` sets `--ui-slider-fill`) rather than anything registered in `theme.css` — this property holds an arbitrary literal color, never a semantic role, so it has no place in the theme contract section 3 defines. A `::before` pseudo-element paints a fixed checkerboard through a `repeating-conic-gradient`, and a `::after` layers `background-color: var(--ui-color-swatch-value)` on top, so a translucent value always reads correctly against the checkerboard rather than blending invisibly into whatever sits behind the swatch in the page. Every other component in this family composes `ColorSwatch` for its own preview rather than reimplementing the checkerboard-plus-fill technique.

#### ColorField

`src/components/color-field.tsx` — a labeled text field for typing a color value, following the same `Label` + control + `Description` + `FieldError` composition shape as the catalog's other field wrappers, `parts`-stylable the same way. Its control is a native `<input type="text">` carrying a `pattern` matching whichever `format` prop is set (`"hex"` by default, or `"rgb"`/`"hsl"`), so a browser rejects a malformed value before any script runs — the same "native constraint attributes are the zero-JS first pass" rule section 4 already established for the rest of the field family. A `ColorSwatch` renders beside the control, fed the field's own resolved `value`/`defaultValue` prop — computed at render time exactly the way `Slider.Output` reads its value from context, so the swatch is correct on first paint and after every server round-trip with no script involved at all.

That "correct after every round-trip" baseline is what a plain form re-render already gives for free; what it cannot give is a swatch that tracks what the user is currently typing, between round-trips. `colorPreview()` (`src/mixins/color-preview.ts`) is the small opt-in mixin that closes that gap: applied to the field's wrapping host, it listens for `input` bubbling from the text control, runs it through `parseColor()`, and — only on a successful parse — writes the result onto the swatch's `--ui-color-swatch-value` through a `data-slot="swatch"` lookup, the same descendant-lookup-by-attribute shape `dualRange()` uses to find its thumb pair. An unparsable in-progress value (the user still typing `#3b8`) simply leaves the swatch showing its last valid color rather than erroring. Why JS: reading an arbitrary in-progress string and turning it into a swatch color as it changes has no CSS equivalent — nothing in markup can react to keystrokes. No-JS baseline: the swatch still renders correctly for the field's committed value on every render; only the keystroke-by-keystroke live update is unavailable.

#### ColorSwatchPicker

`src/components/color-swatch-picker.tsx` — choosing one color from a fixed set, built the same way `RadioGroup` is: a `role="radiogroup"` host (`ColorSwatchPicker`) wrapping a run of `ColorSwatchPicker.Swatch` options, each a `<label>` pairing a visually hidden native `<input type="radio">` (sharing a `name` through context exactly like `RadioGroup.Radio`) with a visible indicator — here, the indicator is a `ColorSwatch` rather than a plain dot, reading the same `input:checked ~ &` sibling selector `RadioGroup.Radio` already uses for its own selected-ring treatment. Selection, keyboard navigation, and form submission all ride the native radio group with no script at all — no mixin, matching the same "native form controls over custom widgets wherever the platform models the exact interaction" rule that already governs `RadioGroup`, `Checkbox`, and `Select`.

#### ColorSlider

`src/components/color-slider.tsx` — a single-channel slider, structurally a close cousin of `Slider`: a root establishing `{ channel, min, max, value }` context, `.Track`, `.Thumb` (a native `<input type="range">`, styled exactly like `Slider.Thumb`, overlaying the track's full box), and `.Output`. `channel` (`"hue" | "saturation" | "lightness" | "value" | "alpha"`) drives a `data-channel` attribute the `Track`'s static `css()` keys its gradient formula off, the same way `Slider.Track` keys its own rules off `data-orientation`.

A hue track's gradient is the fixed 0°–360° rainbow — it never depends on anything else, so it is simply a static `css()` rule. Every other channel's gradient depends on at least the current hue (a saturation track looks different at every hue), and an alpha track's gradient depends on the whole current opaque color underneath it. That dependency is cheap enough to solve without a mixin at all: the consumer already holds the sibling channels' current values as props wherever it renders the group of sliders (a hue slider, a saturation slider, an alpha slider, stacked together), so each non-hue `Track` reads its gradient's color stops from a custom property (`--ui-color-slider-hue`, say) set through the inherited `style` prop at render time — computed the same way `Slider.Track` computes `--ui-slider-fill` — rather than any script. That covers every server-rendered paint and every full re-render correctly, with zero JavaScript.

What it does not cover is a live drag: dragging the hue thumb should visibly repaint the saturation and alpha tracks' gradients in real time, not just on the next full re-render, and nothing in HTML relates one range input's live value to another's rendered style. `channelSync()` (`src/mixins/color-channel-sync.ts`) is the mixin that closes exactly that gap, following `dualRange()`'s own precedent to the letter: applied to whichever element wraps a set of sibling `ColorSlider` instances (not a new named compound part — `dualRange()` sets the same precedent of coordinating siblings through a shared host rather than a dedicated wrapper component), it listens for `input` bubbling from any channel's thumb, reads every sibling's current `data-channel`/`valueAsNumber` pair, and writes each other track's gradient custom property directly — then dispatches a namespaced `ui:color-channel-change` event carrying every channel's settled value together, mirroring `DualRangeChangeEvent`'s own shape. Why JS: keeping one channel's rendered gradient in sync with another channel's live-dragged value has no CSS or HTML relationship to express. No-JS baseline: every channel still renders as an independent, fully operable `<input type="range">`, each posting its own value with the form; only the live cross-channel gradient repaint during a drag is unavailable, and a full re-render still paints every track correctly regardless.

#### ColorArea

`src/components/color-area.tsx` — a two-channel picker (a saturation/value square is the canonical use), for which no native HTML input models continuous two-dimensional selection at all. The no-JS baseline follows the same paired-native-inputs idea `Slider`'s own multi-thumb variant already uses for `dualRange()`: the root renders two native `<input type="range">` elements, one per axis, each `data-channel`-marked, absolutely positioned to overlay the same rectangle — one traveling along the inline axis, the other rotated with `writing-mode` exactly the way `Slider.Thumb` already rotates for a vertical orientation, so it travels the block axis instead. There is no separate decorative thumb element: the two native thumbs together, at whatever position each one's own value places it, are the visual 2D indicator, the same way two `Slider` thumbs on a shared track are the visual indicator for a value range with no third element needed. Each input is independently focusable and arrow-key-operable, so both channels are fully reachable — one axis at a time — with zero script; only a single, freeform drag across both axes at once is unavailable, since a pointer drag on one native range input can only ever move that one input's own axis.

`colorAreaDrag()` (`src/mixins/color-area-drag.ts`) is the mixin that adds exactly that. Applied to the `ColorArea` root, it listens for `pointerdown`/`pointermove`/`pointerup` within the rectangle, runs the pointer's coordinates through `normalizedPointerPosition()` from the color-math module, maps the clamped `{ x, y }` into each axis's channel range, and writes both native inputs' `valueAsNumber` together — the one thing neither input can do on its own — then dispatches a namespaced `ui:color-area-change` event with both settled values.

The drag state itself — a 2D position and one active pointer id — stays inside the mixin rather than graduating to a new behavior class. Weighed against the section 4 criteria for when a class earns its place: nothing outside the two inputs and the thumb glyphs the mixin positions ever needs to read this state, no app code calls it imperatively, and the math involved (clamp a point into a box, map two axes independently) has no cascading constraint-solving step the way `ResizeSession`'s multi-panel solver does — it sits at exactly the "DOM glue below the class threshold" `imageFallback()` and `clearField()` already occupy, and `dualRange()`'s own precedent of coordinating a live multi-input gesture as a plain mixin, with no class underneath it, holds here too. Why JS: continuously mapping a pointer's 2D position to two channel values, and moving both native inputs together as one gesture, has no CSS or HTML equivalent. No-JS baseline: both channels remain independently reachable and keyboard-operable through their own native range input; only the unified 2D pointer drag is unavailable.

#### ColorWheel

`src/components/color-wheel.tsx` — a circular hue picker, using polar coordinates (an angle around a center point) rather than `ColorArea`'s rectangular ones. Its no-JS baseline is a single native `<input type="range">` for hue, styled as a plain linear bar — reusing `ColorSlider`'s own hue-channel `Track` styling directly, so the fallback is not a bespoke rendering path but the same hue slider the rest of the family already has.

`colorWheelDrag()` (`src/mixins/color-wheel-drag.ts`), applied to the `ColorWheel` root, is what turns that linear bar into a ring. On attach, it sets a `data-shape="circular"` attribute on the host, which the component's own pre-declared, static `css()` — not the mixin — is what actually repaints the track as a ring (a fully rounded, conic-gradient track in place of the linear one), the same "mixin flips a `data-*` flag, static CSS already declared for both states does the rest" technique `imageFallback()` already establishes for its own fallback reveal. From there it listens for `pointerdown`/`pointermove` around the ring, runs the pointer's coordinates through `angleFromCenter()` and `angleToHue()` from the color-math module, and writes the result onto the one underlying hue input's `valueAsNumber`, positioning the thumb around the ring from that same angle. Arrow-key nudging needs no extra wiring at all: the underlying element is a real `<input type="range">`, so the platform's own step-by-step keyboard behavior already works on it, circular styling or not.

Sharing with `ColorArea`: the underlying problem — track a pointer, compute a value from its position, report it back — is genuinely the same shape, and the two mixins do share it, at the level the color-math module operates at: `angleFromCenter()`/`angleToHue()` sit alongside `normalizedPointerPosition()` as peer pure functions in the same file, callable independently. What they do not share is the pointer-event wiring itself, because the geometry each mixin resolves against differs in a way that would make one merged mixin worse for both call sites: `colorAreaDrag()` clamps a point into a rectangle and drives two independent native inputs, while `colorWheelDrag()` measures an angle around a center and drives exactly one. Forcing both into one generic "pointer-to-value" mixin would mean carrying rectangle-specific parameters into the wheel's call site and angle-specific parameters into the area's, for a shared surface neither actually wants — the same reasoning that already keeps `resizeHandle()` and `dualRange()` as two separate mixins despite both being pointer-driven range coordinators. Sharing the math and separating the DOM wiring is the smaller, more honest cut.

#### ColorPicker

`src/components/color-picker.tsx` — a swatch trigger composed with a Popover-hosted panel, following the exact compound shape `DatePicker` already establishes over `Popover`: `ColorPicker` (the root — rendering `ColorField`'s own plain fallback when no `children` are composed, exactly like `DatePicker` falls back to `DateField`), `ColorPicker.Group` (the trigger row), `ColorPicker.Trigger` (a native `<button>` rendering a `ColorSwatch` sized to fill it, `commandfor`/`command="toggle-popover"` pointed at the panel's id — a swatch showing the current color doubles as the trigger with no separate icon needed), and `ColorPicker.Dialog` (a thin wrapper rendering `Popover` with the panel's own padding, exactly the shape `DatePicker.Dialog` already is over `Popover`).

The panel's own contents are ordinary composition, not new markup `ColorPicker.Dialog` owns: the default, fullest composition nests a `ColorArea` (saturation/value) with `colorAreaDrag()` applied, a `ColorWheel` for hue (in place of a separate hue slider, since the ring reads as the more natural pairing with a saturation/value square), an alpha `ColorSlider`, and a `ColorField` for typing an exact value directly — all sharing state the same way `DatePicker.Dialog`'s composed `Calendar` shares state with its own field: through the consumer's own island, which owns the single current color value and feeds it down as props/context to every composed part, listening for each part's own change event (`ui:color-area-change`, `ui:color-channel-change`, the field's own `input`) to update it. A `ColorSwatchPicker` row of preset swatches composes in the same panel just as easily, alongside rather than instead of the channel controls, for a picker that offers both a curated palette and full manual control.

#### Mixin catalog addition

| Mixin              | Applied to                                           | Why JavaScript is required                                                                                                          |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `colorPreview()`   | ColorField host                                      | Tracking an in-progress typed value and reflecting it on a swatch has no CSS equivalent                                             |
| `channelSync()`    | A wrapping host around sibling ColorSlider instances | Keeping one channel's rendered track gradient in sync with another channel's live-dragged value has no CSS/HTML relationship        |
| `colorAreaDrag()`  | ColorArea root                                       | Mapping a pointer's continuous 2D position into two channel values, moved together as one gesture, has no native two-axis input     |
| `colorWheelDrag()` | ColorWheel root                                      | Mapping a pointer's angle around a center point into a hue value, and reshaping the track into a ring, has no native circular input |

No new behavior class backs any of the four: each owns state simple enough, and read by nothing beyond the DOM it writes to, to sit at the same "DOM glue" level `imageFallback()`, `clearField()`, and `dualRange()` already do — the same criteria section 4 already sets, applied the same way.

#### `longPress()`

`src/mixins/long-press.ts` is a generic touch-and-hold gesture mixin, usable on any host element and unrelated to color editing — a sibling to the catalog's other host-agnostic mixin, `hotkey()`, and the touch/mobile counterpart to `contextMenu()`: where `contextMenu()` answers a right-click with no HTML equivalent, `longPress()` answers a held press with no HTML equivalent, on the input mechanism a touch surface actually has.

Applied to a host element through `mix`, it starts a timer on `pointerdown` and dispatches a namespaced `ui:long-press` event once the pointer has stayed down for a configurable duration (defaulting to 500ms, the conventional cross-platform threshold). The dispatched event carries the pointer's `x`/`y` at the moment it fires, so a consumer can pair it with `remix/ui/anchor`'s point-based positioning to open a surface at the press location — the same technique `contextMenu()` already uses for its own point-anchored open. The pending timer is cleared — and the event never fires — on `pointerup`, `pointercancel`, `pointerleave`, or the pointer moving past a small distance threshold before the duration elapses, so a genuine hold is what's required: a quick tap ends before the timer completes, and a drag or a scroll gesture cancels it rather than firing a press event partway through. It reads plain pointer events rather than anything touch-specific, so it answers a held mouse press exactly the same way it answers a held touch — a superset of "touch-and-hold," not a touch-only implementation.

Why JS: a held pointer contact for a configurable duration has no HTML event and no CSS selector — `:active` fires the instant contact begins and carries no notion of elapsed time, and there is no native `longpress` event. No-JS baseline: none, mirroring `contextMenu()`'s own "none" — a tap or click on the host still behaves normally either way; without the mixin, nothing extra happens on a hold, the same way a right-click falls through to the platform's own menu without `contextMenu()`.

#### Composition summary

Nothing here duplicates a part this catalog already has: `ColorSwatch` is the one preview rendering every other component composes rather than re-drawing its own checkerboard-plus-fill; `ColorField`, `ColorArea`, and `ColorWheel` all read the same color-math module rather than each carrying their own parsing or angle math; `ColorPicker` adds no new floating-surface or trigger mechanism, reusing `Popover` and the `commandfor`/`command="toggle-popover"` invoker relationship exactly as `DatePicker` already does. New: one pure helper module, six components plus `ColorPicker`'s compound parts, four custom mixins, and `longPress()` as a seventh, unrelated to any of them — and, matching the same bar sections 12 and 14 already hold themselves to, zero new behavior classes, since nothing here needs one.

### 16. `src/styles/`: `css()` mixin factories out of `utils/`; easings folded into `animations/tokens.ts`; `SentinelRow` into `src/components/`

Three fixes, uncovered together while auditing every module under `src/utils/` against its own stated purpose — "framework-free helper modules ... kept separate from the components that consume them so neither carries any `remix/ui` dependency of its own."

#### A new `src/styles/` folder for `css()` mixin factories

A recurring number of `utils/` modules export a plain CSS-properties-shaped object, or a record of them, meant only for a caller to spread with `...` into its own inline `css()` call: `FLOATING_SURFACE`, `FOCUS_RING_PRIMARY`/`FOCUS_RING_BY_COLOR`, `GRAPHIC_HOST_STYLE`, `interactiveTransition`, `OUTPUT_CAPTION_TEXT`, `PANEL_CHROME`, `FIELD_STACK_LAYOUT`, `VISUALLY_HIDDEN_INPUT`, `chartPaletteRules()`/`legendToggleRules()`, `semanticColorPanelBranches()`, and `rtlAwareGradientDirection()`/`rangeThumbAppearance()`. Every one of these is the exact shape the animation layer already solved differently: `fade()`, `zoom()`, and `slide()` (section 2) each call `css()` themselves and hand back a ready mixin, composed directly in a `mix` array (`mix={[fade(), css({ ... })]}`) — never a plain object for the caller to spread. The fix is the same conversion applied across every export above: each becomes a factory function that wraps its own `css()` call and returns a mixin, called directly inside a `mix` array (`mix={[floatingSurface(), css({ ...ownStyles })]}`) instead of spread into one shared `css()` call (`css({ ...FLOATING_SURFACE, ...ownStyles })`).

Wrapping any of these in `css()` means importing `css` from `remix/ui` — which is exactly the dependency `utils/`'s own module header rules out. That is why the fix and the relocation are one move, not two: a new sibling folder, `src/styles/`, holds this class of thing — a `css()`-calling mixin factory that is not animation-timed and is not a component — parallel to how `src/animations/` already holds `css()`-calling factories keyed by motion instead of static border/color/spacing recipes. It gets the same wiring every other layer already has: its own barrel (`src/styles/index.ts`) and a `"./styles"` package export alongside `"./animations"`, `"./behaviors"`, `"./mixins"`, and `"./utils"`.

| `utils/` export (before)                                                                      | `styles/` factory (after)                                 | Options                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FLOATING_SURFACE` (`floating-surface.ts`)                                                    | `floatingSurface()`                                       | none                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `FOCUS_RING_PRIMARY` (`focus-ring.ts`)                                                        | `focusRingPrimary({ when? })`                             | `when` defaults to `"&:focus-visible"` — the actual call sites also ring `&:has(:focus-visible)` (a wrapper gaining its ring from a descendant), `&:has(input:focus-visible)` (a host whose native input sits one level deeper), and `&:focus-within`, so the option is real, not speculative                                                                                                                                       |
| `FOCUS_RING_BY_COLOR` (`focus-ring.ts`)                                                       | `focusRingByColor({ when? })`                             | same `when` option for consistency, though every current call site rings the host's own `&:focus-visible`; the value itself needs no per-color argument — it already emits the full `&[data-color="..."]` branch set for all five colors at once, the same "static branches, `data-color` picks the active one at runtime" shape `chartPaletteRules()` and `semanticColorPanelBranches()` use, not a lookup keyed by a single color |
| `GRAPHIC_HOST_STYLE` (`graphic-host.ts`)                                                      | `graphicHostStyle()`                                      | none                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `interactiveTransition` (`interactive-transition.ts`)                                         | `interactiveTransition()`                                 | none                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `OUTPUT_CAPTION_TEXT` (`output-caption.ts`)                                                   | `outputCaptionText()`                                     | none                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PANEL_CHROME` (`panel-chrome.ts`)                                                            | `panelChrome()`                                           | none                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `FIELD_STACK_LAYOUT` (`field-stack-layout.ts`)                                                | `fieldStackLayout()`                                      | none — found during this same audit, spread as the sole argument to `css()` at every one of its six call sites (`DateField`, `TextField`, `TimeField`, `SearchField`, `NumberField`, `ColorField`), same shape as the named candidates                                                                                                                                                                                              |
| `VISUALLY_HIDDEN_INPUT` (`visually-hidden-input.ts`)                                          | `visuallyHiddenInput()`                                   | none — found the same way, spread into the hidden native input's own `css()` call in `RadioGroup` and `ColorSwatchPicker`                                                                                                                                                                                                                                                                                                           |
| `chartPaletteRules(property, combinator?)` / `legendToggleRules()` (`chart-palette-rules.ts`) | `chartPalette(property, combinator?)` / `legendToggle()`  | `chartPalette` keeps its two positional arguments; `legendToggle` stays zero-argument; both move together as `styles/chart-palette.ts`, taking `CHART_COLOR_SLOT_COUNT` with them since the constant is intrinsic to the rule generation both factories do                                                                                                                                                                          |
| `semanticColorPanelBranches()` (`semantic-color-panel.ts`)                                    | `semanticColorPanel()`                                    | zero-argument — only the aggregating, all-five-branches export moves; `semanticColorPanelStyle(color)`, the pure per-color builder it's built from, stays in `utils/`, directly unit-tested on its own and never itself spread into a component's `css()` call                                                                                                                                                                      |
| `rtlAwareGradientDirection(propertyName)` (`rtl-aware-gradient-direction.ts`)                 | `rtlAwareGradientDirection(propertyName)`                 | unchanged signature, now wraps `css()` and returns a mixin instead of a plain object                                                                                                                                                                                                                                                                                                                                                |
| `rangeThumbAppearance(sizeVariable, borderWidthVariable)` (`range-thumb-appearance.ts`)       | `rangeThumbAppearance(sizeVariable, borderWidthVariable)` | unchanged signature, now wraps `css()` and returns a mixin instead of a plain object                                                                                                                                                                                                                                                                                                                                                |

`utils/css-styles.ts`'s `CSSStyles` type — the `Parameters<typeof css>[0]` alias several of the factories above build their intermediate declarations against before their own final `css()` call — stays exactly where it is. It is a type, not a value: erased at compile time, already imported across this same boundary today (`animations/transitions.ts` and `animations/keyframes.ts` both `import type { CSSStyles } from "../utils/css-styles"`), so `src/styles/` reads it the same way the animation layer already does rather than duplicating it.

Every call site's shape changes the same way, whether the old export was spread alongside sibling properties or passed as `css()`'s only argument:

```tsx
// Before
mix={[css({ ...FLOATING_SURFACE, color: "var(--ui-neutral-fg-emphasis)" }), mix]}
// After
mix={[floatingSurface(), css({ color: "var(--ui-neutral-fg-emphasis)" }), mix]}

// Before
css({ /* ...own declarations */, "&:focus-visible": { ...FOCUS_RING_PRIMARY } })
// After
mix={[focusRingPrimary(), css({ /* ...own declarations */ }), mix]}
```

#### easings folded directly into `animations/tokens.ts`

`utils/easings.ts` is a plain object of `transition-timing-function` strings — genuinely framework-free, same as `durations`. `animations/tokens.ts` already defines `durations` directly, but only re-exports `easings` (`export { easings } from "../utils/easings"`), the one motion token routed through a `utils/` indirection instead of living where it's used. The fix folds the actual definition into `animations/tokens.ts` beside `durations` and deletes `utils/easings.ts` (and its test moves to `animations/tokens.test.ts`, a file the build-out hasn't needed until now since `durations` carries no test of its own). Every current import splits cleanly: components already reading the animation layer's re-export (`../animations/tokens`) need no change; three modules that bypass it and import the `utils/` module directly need their path updated — `src/components/drop-zone.tsx` and `src/components/sidebar.tsx` (`import { easings } from "../utils/easings"`, becoming `../animations/tokens`), and `src/animations/keyframes.ts` itself, which imports `../utils/easings` despite sitting next to `tokens.ts` (becoming `./tokens`). `utils/index.ts` loses its `export * from "./easings"` line.

#### `SentinelRow`: a `src/components/` module, not a `src/utils/` one

`utils/sentinel-row.tsx` renders JSX through the Handle pattern and imports `css` from `remix/ui` directly — a genuine `remix/ui` component, not framework-free helper logic, filed under `utils/` from the start. It backs `ListBox.LoadMoreItem`, `GridList.LoadMoreItem`, and `Tree.LoadMoreItem` (each assigns `SomeComponent.LoadMoreItem = SentinelRow` onto its own compound namespace). It moves to `src/components/sentinel-row.tsx`, joins the `src/components/index.ts` barrel, and the three composing modules import it the way they import any other sibling component instead of reaching into `utils/`.

## Consequences

### Positive

- Remix apps get the full design system — variants, states, dark mode, accessibility — instead of re-deriving it per app with inline `css()`.
- Most components lose their JavaScript entirely: overlays, disclosure, selects, and form controls become server-rendered HTML that works before (or without) hydration, which is faster and more robust than the RAC equivalents.
- The library ships zero hydration entries: a page that uses only baseline behavior ships zero library JavaScript, and the app — not the library — decides the hydration boundary, since only the island that applies a mixin or constructs a behavior class gets a `clientEntry(...)`.
- Stateful behavior is unit-testable without the DOM: behavior classes are constructed and asserted directly (methods in, typed events out), a narrower and faster test layer than rendering components.
- The per-mixin why-JS note makes the JavaScript cost of every behavior explicit and reviewable, and keeps "needs hydration" from spreading silently.
- Behavior is independently composable: the same mixin works on a library component or on app-local markup that follows the `data-*` contract, and apps only pay for the behaviors they actually attach.
- Trigger buttons never hydrate: `--ui-*` custom commands make every external control of a widget declarative server HTML wired by `commandfor`, so islands stay as small as the widget root and the wiring is visible in the markup.
- Motion is centralized: overlays share one vocabulary of durations and easings through the animation factories, and `prefers-reduced-motion` support comes from the layer instead of per-component discipline — something the Tailwind port never had.
- Components are container-relative: dropped into a dashboard column, a split pane, or a `<Frame>`, they adapt to the space they actually occupy — the React library's viewport breakpoints misread every such context.
- One theme contract (`--color-*` scales feeding `--ui-*` roles) spans React and Remix apps, so both render the same design during the transition.
- No Tailwind build step, no React runtime, and no third-party UI dependencies in the new package; `remix` is the only framework dependency.

### Negative

- Two component libraries must be maintained while React apps exist; design changes need double implementation until the React apps are ported or retired.
- Expanding `@apply` shorthand into longhand CSS across ~4,550 lines of utilities is mechanical but large, and visual parity must be verified component by component.
- Several platform APIs relied on (anchor positioning, customizable `<select>`, `interpolate-size`, Interest Invokers, scroll-driven animations) are newest-browser features; components need graceful fallbacks where support is missing, which adds CSS complexity.
- Some RAC niceties (multi-thumb slider, drag-and-drop polish) require bespoke implementations that RAC previously provided for free; list virtualization is deliberately not reimplemented — `content-visibility` plus server pagination replaces it.
- The component markup and `data-*` attributes become a behavioral API, not just a styling one: mixins locate widget parts through them, so restructuring a component's internal markup is a breaking change for its mixin.

### Neutral

- The `data-*` attribute contract carries over, so markup snapshots and design tooling that key off `data-color`/`data-variant`/`data-size` keep working.
- Component APIs stay compound (`Card` + `Card.Header` + …) but prop shapes shift where behavior moved to the platform (e.g. `Dialog` no longer takes `isOpen`; it takes an `id` targeted by invokers).
- Interactivity takes slightly more setup than with batteries-included RAC components: the consumer applies the mixin (or constructs a behavior class) and hydrates their island. That extra step is the mechanism that keeps the JS boundary in the app's hands.
- Behavior has two artifact kinds — classes for stateful models, mixins for DOM adapters — and contributors pick using the section 4 criteria. The trade is that no artifact does two jobs: classes stay DOM-free and testable, mixins stay thin.
- Storybook stories do not transfer; `apps/ui-docs` grows as components are ported.

## References

- [ADR-013: Remix UI For Application Interfaces](./ADR-013-remix-ui-for-application-interfaces.md)
- [Remix skill](../../.agents/skills/remix/SKILL.md) — component model, mixins, primitives
- [Vendored Remix UI docs](../vendor/@remix-run/ui/docs/) — `remix/ui` API reference, including `TypedEventTarget`, context, and mixin patterns
- [Apple HIG web app skill](../../.agents/skills/apple-hig-web-app-guidelines/SKILL.md) — normative interaction-quality reference for section 10
- [`@pkg/ui` styles](../../packages/ui/src/styles.css) — the source stylesheet being ported
- [Invoker Commands API](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API)
- [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
- [CSS anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning)
- [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
