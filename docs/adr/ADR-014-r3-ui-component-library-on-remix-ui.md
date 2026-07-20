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
├── package.json        # exports ".", "./animations", "./behaviors", "./mixins", "./reset.css", and "./theme.css"
├── AGENTS.md           # the layer rules below, encoded for contributors and agents
├── README.md           # install, theme contract, layer rules, reset/theme import order
├── src/
│   ├── index.ts
│   ├── reset.css       # Preflight-equivalent base reset, layered before rmx
│   ├── theme.css       # the --ui-* semantic variable layer, copied from @pkg/ui
│   ├── components/     # one module per component, styles inlined via css()
│   ├── animations/     # CSS-only animation mixin factories + motion tokens
│   ├── behaviors/      # headless behavior classes (TypedEventTarget models)
│   └── mixins/         # opt-in behavior mixins, one module per behavior
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

| Mixin              | Applied to   | Why JavaScript is required                                                                     |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------------- |
| `menuKeys()`       | Menu surface | ARIA menu keyboard pattern: roving tabindex, arrow keys, Home/End, typeahead (`remix/ui/menu`) |
| `listboxKeys()`    | ListBox      | ARIA listbox selection model and keyboard interaction (`remix/ui/listbox`)                     |
| `comboboxFilter()` | ComboBox     | As-you-type option filtering and active-option management (`remix/ui/combobox`)                |
| `tabKeys()`        | Tabs list    | ARIA tabs arrow-key activation for in-page panels (`remix/ui/tabs`)                            |

**Custom mixins**

| Mixin                | Applied to                             | Why JavaScript is required                                                                                                                                                                                |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contextMenu(id)`    | ContextMenu trigger area               | `contextmenu` has no HTML equivalent; opens the surface at the pointer position                                                                                                                           |
| `commandFilter()`    | Command root                           | Hides non-matching pre-rendered items as the user types; toggles the empty state                                                                                                                          |
| `calendarKeys()`     | Calendar grid                          | Arrow/PageUp/PageDown/Home/End navigation across rendered month cells                                                                                                                                     |
| `rangePreview()`     | RangeCalendar grid                     | Hover preview of the pending date range                                                                                                                                                                   |
| `stepper()`          | NumberField group                      | `stepUp()`/`stepDown()` are JS-only APIs today; adds press-and-hold repeat. Retires once `step-up`/`step-down` invoker commands ship broadly                                                              |
| `otpSlots()`         | OtpField group                         | Focus advance/retreat between slot inputs; splits pasted codes                                                                                                                                            |
| `validate(schema)`   | Form fields                            | Runs the shared `remix/data-schema` field schema client-side via the Constraint Validation API: `setCustomValidity()`, intercepted `invalid` events rendered into `FieldError` instead of browser bubbles |
| `pressToggle()`      | ToggleButton                           | Flips `aria-pressed` without a server round-trip                                                                                                                                                          |
| `dismiss(options)`   | Toast, Alert                           | Auto-dismiss timers with hover pause; dispatches `ui:dismiss`                                                                                                                                             |
| `dualRange()`        | Slider group                           | Native `<input type="range">` is single-thumb; clamps paired inputs into an ordered pair                                                                                                                  |
| `carouselControls()` | Carousel viewport                      | Handles `--ui-prev`/`--ui-next`/`--ui-goto` commands from static invoker buttons via `scrollBy()`; syncs disabled state at scroll edges                                                                   |
| `clearField()`       | SearchField clear button               | Clears one input without resetting the surrounding form                                                                                                                                                   |
| `dropZone()`         | DropZone                               | Drag-and-drop events are JS-only; toggles `data-drop-target`, dispatches `ui:drop-files`                                                                                                                  |
| `dragReorder()`      | GridList, Tree                         | Pointer-driven reorder; positions the DropIndicator, dispatches `ui:reorder`                                                                                                                              |
| `gridListKeys()`     | GridList                               | ARIA grid keyboard interaction                                                                                                                                                                            |
| `treeKeys()`         | Tree                                   | ARIA tree keyboard interaction                                                                                                                                                                            |
| `resizeHandle(axis)` | Resizable handle                       | Pointer-tracked panel resizing written to a CSS custom property on the group                                                                                                                              |
| `imageFallback()`    | Avatar/Logo image                      | The image `error` event is the only reliable load-failure signal; flags the host so CSS reveals the fallback                                                                                              |
| `viewTransition()`   | SharedElement                          | Same-document transitions require `document.startViewTransition()`                                                                                                                                        |
| `persist(key)`       | Sidebar root                           | Handles the `--ui-toggle` command and mirrors collapse state into a cookie so the server renders the next page already collapsed                                                                          |
| `hotkey(combo)`      | Command dialog, any `<dialog>`/popover | Global shortcuts (`⌘K`) have no declarative HTML wiring; shows or toggles the host                                                                                                                        |
| `themeToggle()`      | Theme switch control                   | Flips `.dark`/`.system` on `<html>` and persists the choice in a cookie so the server renders the next page in the right scheme                                                                           |

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
