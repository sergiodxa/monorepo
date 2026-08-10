# packages/ui AGENTS

## Purpose

Guidance for implementing and updating components, mixins, behaviors, and animations in `packages/ui`, a styled, accessible component catalog for `remix/ui`. This file keeps day-to-day contributions consistent with the architecture described in the sections below.

## Core Principles

- Every component is a `remix/ui` component using the Handle pattern — `function Name(handle: Handle<Props>) { return () => <... /> }` — and is always rendered through JSX (`<Name />`), never called as a plain function.
- The only dependencies are `remix` and `@pkg/lucide-remix`.
- Components style themselves via a `css()` object on the host element, keyed off a `data-*` attribute contract (`data-color`, `data-variant`, `data-size`, `data-placement`, …) and `--ui-*` semantic color variables.
- Components are markup plus styling only — they never carry behavior and the library never hydrates them. Anything that needs JavaScript ships as an opt-in mixin (from `mixins/`) or behavior class (from `behaviors/`) that the consumer applies explicitly, in their own hydrated island.
- The library ships no copy. Every user-facing and accessibility string is a required prop from the consumer — no built-in English defaults.
- Baseline HTML/CSS first: `<dialog>`, the Popover API, Invoker Commands, `<details>`, native form controls, and CSS drive behavior wherever the platform can do the job. JavaScript is the opt-in exception, never the default.

## TypeScript Rules

- Prop types live in a namespace matching the component name (`namespace Badge { export interface Props {...} }`), and the component's handle is typed against it (`Handle<Badge.Props>`).
- Prefer `interface` over `type` unless you need union/mapped-type features.
- Default values for optional props are named `DEFAULT_*` module-level constants (`const DEFAULT_COLOR = "primary"`), applied with `??` in the render function — not inline fallback literals scattered across the JSX.
- Use the compound component pattern (`Component.SubComponent`) for composable, multi-part UI.
- A convenience wrapper that renders more than one host element accepts a `parts` prop for per-part styling (one mixin per named part) rather than a single `mix` applied to the whole tree.

## Compound Component Pattern

Multi-part components stay compound:

```tsx
// Good: compound pattern
<Dialog id="confirm-delete">
	<Dialog.Header>
		<Dialog.Title>Delete project?</Dialog.Title>
	</Dialog.Header>
	<Dialog.Footer>
		<Button commandfor="confirm-delete" command="close">Cancel</Button>
	</Dialog.Footer>
</Dialog>

// Bad: implicit rendering that hides the compound parts
<Dialog title="Delete project?" onCancel={...} />
```

Two escape hatches sit on top of the compound pattern, and every host element supports the first:

- **`mix` passthrough.** Every component accepts a `mix` prop and forwards it onto its host element, so a consumer can compose extra mixins (`css()`, `on()`, a behavior mixin from `mixins/`) alongside the component's own styling without reaching into its internals.
- **`parts` prop.** Convenience wrappers that render several elements under one call (`TextField` and similar composition sugar) accept a `parts` prop keyed by part name (`parts={{ input: css({ ... }) }}`) so each internal element can be styled individually. When `parts` isn't enough, the ultimate escape hatch is always composing the underlying compound components directly instead of the convenience wrapper.

Component APIs favor platform-native state over JavaScript-tracked props: `Dialog` takes an `id` targeted by Invoker Commands (`commandfor` / `command`) rather than an `isOpen` boolean, since open/closed state lives on the `<dialog>` element itself. The compound shape and the `mix`/`parts` passthroughs stay the consistent API surface across every component built this way.

## Ambient Context Pattern

Some structural values are more natural to read from the nearest ancestor than to thread through every intermediate component as a prop. `HeadingScope` establishes one of these: it provides a semantic heading depth through `handle.context`, moving one level deeper than the ambient depth of any `HeadingScope` it is nested inside, or starting the outline at its first level where nothing wraps it at all. `Heading`, and every component with a title or header slot, reads that ambient depth automatically and renders the native heading element it matches, so composing sections keeps a document outline sequential purely by nesting `HeadingScope` around them.

This mechanism keeps every component pure: `HeadingScope` and `Heading` publish and read the ambient depth entirely through `handle.context`, with no ref or DOM access involved. That purity meets its limit at a hydration boundary — an independently hydrated island mounts its own runtime tree, so its root component has no ancestor context to read even when the surrounding server-rendered page nests it under a real scope. Recovering the level there means reading a DOM attribute back off the page, which pure component logic cannot do, so that recovery is a mixin — `headingLevelFallback()` — rather than logic added to `HeadingScope` or `Heading` themselves.

The plain rule for an island's author: thread the ambient level down as an explicit `level` prop whenever the island's heading depends on a scope outside itself — cheap, exact, and the path to reach for first. Apply `headingLevelFallback()` on the island's root `HeadingScope` or `Heading` only where threading that prop through isn't practical; it detects the ambient level from the DOM once, on attach, and reports it back for the island to store and re-render with.

## CSS & Styling Rules

- Every component's styles are inline `css()` mixins applied to the host element (`mix={css({...})}`) — there is no shared stylesheet file to edit. `css()` rules are emitted under the `rmx` cascade layer.
- Styles are keyed off `data-*` attributes (`data-color`, `data-variant`, `data-size`, `data-placement`, …) rather than modifier class names, so a single selector list per component covers every visual state.
- Color comes only from `--ui-*` semantic variables (e.g. `--ui-primary-bg-solid`, `--ui-primary-fg-on-solid`). Never hardcode a color value or reach for a raw `--color-*` scale variable directly from a component.
- Non-color constants (radii, control heights, focus-ring width) are custom properties with sensible default fallbacks (`border-radius: var(--ui-radius-md, 0.375rem)`), not hardcoded literals, so an app can override density/shape without overriding per-component styles.
- Interaction states map to native selectors and pseudo-classes, since components ride native elements and platform state instead of JavaScript-managed state:

  | Interaction state  | Selector                                                                                |
  | ------------------ | --------------------------------------------------------------------------------------- |
  | Hover              | `:hover`                                                                                |
  | Pressed / active   | `:active`                                                                               |
  | Focused            | `:focus`                                                                                |
  | Focus-visible      | `:focus-visible`                                                                        |
  | Disabled           | `:disabled`, `[aria-disabled="true"]`                                                   |
  | Selected           | `:checked`, `[aria-selected="true"]`, `[aria-current]`                                  |
  | Invalid            | `[aria-invalid="true"]`, `:user-invalid`                                                |
  | Entering / exiting | `@starting-style` + `transition-behavior: allow-discrete` on `[open]` / `:popover-open` |

- Write every direction-sensitive declaration with **logical properties**, never physical ones: `padding-inline` not `padding-left`/`padding-right`, `margin-block-start` not `margin-top`, `inset-inline-end` not `right`, `text-align: start` not `text-align: left`. This is what makes the whole library right-to-left-ready through the standard `dir` attribute with no separate RTL pass.

### Responsive styling: container queries, not the viewport

Components never read the viewport — no `@media (min-width: ...)` for layout. Every responsive breakpoint is expressed as a named `@container` query instead:

- A component assumes it renders inside a container — which may be the whole page, but never by assumption. Apps declare `container-type: inline-size` on their layout regions; the page body is simply the outermost container.
- A component that creates a sizing context for its own parts (Dialog's panel, Sheet, Card, the Sidebar inset, the Table wrapper) declares a **named container** (`container: ui-dialog / inline-size`), and that component's part styles query that specific name — so, for example, a Card rendered inside a Dialog responds to the dialog's width, not the page's.
- A container query cannot style the container element itself. Where a root host must adapt to its own width, give it an inner wrapper that carries the adapting styles.

At full-viewport container width, components render at their default, unconstrained layout. Embedded narrower — a dashboard column, a split pane, a `<Frame>` — components adapt to the space they actually occupy.

### ARIA values are tokens, never flags

`aria-*` attributes are not HTML boolean attributes. Their values are text, and the renderer writes a `true` prop the way HTML wants a boolean written — as the bare attribute name — so `aria-hidden={true}` reaches the document as `aria-hidden=""`, which is none of the tokens ARIA defines and resolves to the attribute's default. A `false` is dropped from the markup altogether.

- Write the string: `aria-hidden="true"`, `aria-invalid={invalid ? "true" : undefined}`, `aria-pressed={pressed ? "true" : "false"}`. A `DEFAULT_*` constant standing in for one of these values is declared as a string too.
- Omit rather than write `"false"` where absence already means false (`aria-hidden`, `aria-invalid`, `aria-busy`). Keep the explicit `"false"` where absence means something else — a `<button>` with no `aria-pressed` is not a toggle button at all.
- A component whose styling keys off one of these attributes (`&[aria-pressed="true"]`, `&[aria-invalid="true"]`) has a second reason to care: an empty value matches neither ARIA nor the selector, so the state goes unannounced _and_ undrawn.
- Never author a _static_ ARIA state a native control already owns. A `<input type="checkbox" role="switch">` reports its checkedness from the live control, and an authored `aria-checked` takes precedence over it, so a value fixed at render time goes stale the moment the user clicks — no component in this package renders one, and that default stays. The one supported way to have the attribute at all is the `ariaChecked()` mixin, which a consumer applies to a checkbox, switch, or radio inside a hydrated island: it renders the token from the host's own initial state during the server pass and rewrites it from the live control on every `change` (refreshing the whole radio group, since a sibling radio loses its checkedness with no event of its own), and that upkeep is the only thing that keeps the attribute from becoming the lie a static one would be.

`src/components/aria-tokens.test.tsx` enforces this by scanning every module under `src/`, so a boolean reaching one of these attributes fails the suite. It runs the shared scanner in `test/aria-tokens.ts`, which `test/aria-tokens.test.ts` also runs across every app and package in the repo — most of this mistake turned out to live in app JSX rather than in this library, so the rule is enforced in both scopes from one definition.

### Accessibility media features

Three user preferences get baseline support, not per-component discretion:

- **`prefers-reduced-motion: reduce`** is handled by the animation layer: every factory built there emits an override collapsing movement to opacity-only. A component that reaches for one of those factories gets this for free; a component animating something outside that layer (a bare CSS `transition`/`animation` declaration) must add the same override itself.
- **`prefers-contrast: more`** is handled centrally in the theme: every color's subtle `border` is promoted to its `border-strong` value under this preference, and every component already reads `border` from the semantic variable rather than a hardcoded value, so this requires no per-component work. The one thing to double-check when building a component: never let color alone carry a state distinction (e.g. selected vs. unselected) — pair it with a border, icon, or weight change so the high-contrast border promotion has something to reinforce.
- **`prefers-reduced-transparency: reduce`** applies to any component using `backdrop-filter` (blur/saturate "backdrop material" on Dialog's `::backdrop`, Popover, Sheet, Drawer, Menu surfaces, and Toast). Gate the blur/saturate declaration behind `@media (prefers-reduced-transparency: no-preference)` (or wrap the reduced case in `@media (prefers-reduced-transparency: reduce)` and fall back to a solid/near-opaque background there) so transparency is progressive enhancement, never the only rendering.

## CSS Layer Order

The layer contract is fixed and every component and consumer must respect it:

```
reset.css (@layer base)  →  theme.css  →  app styles
```

- `reset.css` opens with `@layer base, rmx;` and puts the base reset in `base`. `remix/ui` emits every generated `css()` rule under its own `rmx` layer, so component styles automatically beat the reset — no specificity games, no `!important`, no ordering component styles after the reset by hand.
- `theme.css` (the `--ui-*` semantic variable layer) is plain CSS with no layer of its own; import it after the reset and before app styles.
- App styles come last. Apps that add their own element-level globals (a bare `button { ... }` reset, typography defaults) should put them in a layer ordered before `rmx` — unlayered author CSS outranks all layered CSS, so an app's unlayered globals would silently override component styles if left unlayered.

## Behavior: mixins and behavior classes, never inline

Components never hydrate and never carry behavior of their own. When a widget needs JavaScript, the behavior lives in exactly one of two places:

- **Mixins** (`mixins/`), built with `createMixin` from `remix/ui`, applied to a host element through its `mix` prop. Use a mixin for DOM adapters: translating DOM events into calls, wrapping a first-party `remix/ui` behavior primitive (`menu`, `listbox`, `combobox`, `tabs`, `popover`), or coordinating a widget's descendants through the same `data-*` contract the styles use.
- **Behavior classes** (`behaviors/`), plain classes that extend `TypedEventTarget` from `remix/ui`. Use a class for real state: a toast queue, a selection set, a drag session — anything an app calls imperatively, that multiple components observe, or that's complex enough to deserve DOM-free unit tests. Classes never touch the DOM; they own state and dispatch typed events, and mixins or island components are the thin adapters around them.

Rules that apply to both:

- **State lives in the consumer, never in the mixin or the component.** A mixin receives options, callbacks, or a behavior-class instance — it never owns reactive state that would force a library component to call `handle.update()`.
- **Hydration belongs to the consuming app.** The island component that renders the widget and applies the mixin (or constructs the behavior class) is what gets a `clientEntry(...)` — nothing inside this package itself does.
- **Custom events are namespaced.** DOM-dispatched events use the `ui:*` prefix, extend `Event` with a typed payload, and are declared on `HTMLElementEventMap`. Behavior-class events use plain names (`"change"`, `"toast"`) since the `ui:*` namespace is reserved for DOM hosts.
- **Cleanup rides abort signals.** Mixin listeners and behavior-class subscriptions alike pass `{ signal: handle.signal }` so they detach when the island unmounts.
- **Adapt first-party primitives instead of reimplementing.** Where `remix/ui` already ships the behavior (`menu`, `listbox`, `combobox`, `tabs`, `popover`), wrap it and bind it to the library's markup and `data-*` contract rather than rewriting it.

Every mixin module must open with a doc comment stating why JavaScript is required and what the no-JS baseline does without it — this is not optional boilerplate, it is the record that keeps the JavaScript cost of every behavior explicit and reviewable:

```tsx
/**
 * Why JS: the WAI-ARIA menu pattern requires roving tabindex, arrow-key
 * navigation, and typeahead, which HTML does not provide.
 * No-JS baseline: the menu still opens and closes via the Popover API and
 * items remain reachable in Tab order.
 */
```

Because no component carries behavior, every component works with JavaScript disabled by construction. A screen that sticks to baseline behavior renders the same components with zero library JavaScript.

## Component Purity

`src/components/**` modules may import only `css`, `attrs`, and types from `remix/ui` — never `on`, `ref`, or `createMixin`. This is enforced mechanically, not by convention: a `bun:test` suite asserts on the import list of every module under `src/components/`, and an `on`, `ref`, or `createMixin` import in a component module fails the suite. If a component needs behavior, that behavior is a mixin or behavior class the consumer attaches — it is never added to the component module itself.

Non-visual helper logic a component builds on — scale/path math, color parsing, anything with zero `remix/ui` dependency of its own — lives under `src/utils/` instead of alongside the component, so purity checks and framework-free logic never mix in the same module. A component imports what it needs from there the same way it imports a sibling component.

## Style Mixin Factories

A recurring border, focus ring, panel chrome, or gradient recipe shared by several components is a mixin factory under `src/styles/`: it calls `css()` itself and returns a ready mixin, composed directly in a `mix` array (`mix={[floatingSurface(), css({ ...ownStyles })]}`) exactly the way an animation factory already does (`mix={[fade(), css({ ... })]}`) — never a plain CSS-properties object a component spreads with `...` into its own inline `css()` call. A factory that varies by an option (the selector a focus ring gates on, the property and combinator a chart's categorical palette paints) takes that option the same way an animation factory takes `duration`/`easing`/`when`; one with nothing to vary stays a plain zero-argument call.

This is exactly what `src/utils/` cannot hold: calling `css()` means importing it from `remix/ui`, and `src/utils/` modules stay free of that import so purity checks and framework-free logic never mix in the same layer. `src/styles/` is where that `remix/ui` dependency lives instead, wired the same way `src/animations/`, `src/behaviors/`, and `src/mixins/` already are — its own barrel, its own `"./styles"` package export.

## Copy: the library ships no strings

Never hardcode user-facing or accessibility copy. Visible copy arrives as `children` (`Command.Empty`, `Empty.Title`); accessibility strings — icon-only button labels, pagination's "Next", calendar navigation, OTP slot labels — are **required** props, with no built-in English default. A Remix app localizes through the shared i18n middleware, and a built-in default would silently bypass the app's locale, so don't add one, even for what feels like an obviously-safe label.

Date and number rendering uses the platform's `Intl` APIs against a consumer-provided locale (defaulting to the document `lang`), not a hardcoded locale or a bundled date library.

## Dev-Mode Contract Checks

Where the type system can't enforce a required a11y wiring (children shapes, id linkage), the component logs a `console.warn` in dev mode instead: a Dialog without an `id`, an icon-only Button without a label, a `Command.Item` without a `value`. Gate every one of these checks behind a dev-mode guard so they're stripped from production bundles — they're a development-time contract check, not runtime validation the app should ship.

## Implementation Workflow

- Create one module per component under `src/components/`, following the Handle pattern and the compound pattern above.
- Style the component as a `css()` mixin driven by the `data-*` contract and `--ui-*` variables, using logical properties instead of physical ones and named `@container` queries instead of viewport breakpoints.
- If the component needs behavior, add a mixin under `src/mixins/` (or a behavior class under `src/behaviors/` if it owns real state) rather than writing behavior inline in the component module — see Component Purity above, which fails the build if you don't.
- Add or extend the `bun:test` suite alongside the code it covers: behavior-class unit tests (construct, call methods, assert on state/events, no DOM), pure-helper unit tests, and the component-purity import check.
- Write the component's documentation page in `apps/ui-docs`, including rendered variants, usage guidance, and the hydration note of every mixin the component pairs with — writing the docs page is part of building the component, not a follow-up task.
- Verify against `apps/ui-docs` with the `agent-browser` CLI: an axe-core audit, and a screenshot-based visual regression check against the component's previously approved rendering to sign off visual parity (documenting any deliberate deviation directly on the component's own docs page).

## Documentation Style

- Describe every component, mixin, behavior class, and animation factory standalone, purely by what it is and does. Never name another monorepo app or package as a source/counterpart/comparison, never cite a design record (an ADR) by name, and never define something by what it _isn't_ (no "zero React", "no Tailwind needed", "unlike X") — state the affirmative fact instead ("styled through `css()` mixins", "a plain `:root` block is enough").
- This applies to JSDoc, this file, the README, TODO.md, and code comments alike. The one place the package's own npm name (`@pkg/ui`) belongs in prose is the README's H1 — everywhere else, either omit it or refer to "this package"/"the component"/"the mixin" instead. Import paths inside actual code examples and API-reference tables are exempt (they're documenting real values, not descriptive prose).

## Tooling

- The only allowed dependencies are `remix`, `@pkg/lucide-remix`, and `@pkg/u`.
- Reach for a `@pkg/u` utility mixin instead of hand-rolling a recipe it already covers exactly (a parameter-free clipping or layout recipe, for instance). Where a recipe depends on this package's own semantic color or spacing vocabulary — `--ui-primary-ring` rather than `@pkg/u`'s own token names, or a runtime `data-color` switch a build-time utility call can't express — keep it a local `src/styles/` factory instead of forcing a mismatched abstraction.
- Use `remix/ui`'s first-party behavior primitives (`remix/ui/popover`, `menu`, `listbox`, `select`, `combobox`, `accordion`, `tabs`, `checkbox`, `radio`, `toggle`, `input`, `anchor`, `breadcrumbs`, `button`) from inside mixins instead of hand-rolling keyboard/selection behavior that already exists.
- Use `bun:test` for everything under this package, not `remix/test` — it's the repo's runner, and it's also what exercises the component-purity import check.
- Use the `agent-browser` CLI for interaction, accessibility, and visual-parity verification against `apps/ui-docs` — never Playwright.
