# @pkg/u

A utility-first styling layer for `remix/ui`, composed from small, terse mixins.

## Overview

Every export is a `remix/ui` mixin factory: `u.p(4)`, `u.bg("brand.tint")`, `u.hover(u.border("brand"))`. Each one drops directly into a `mix` prop, and wrapper utilities like `u.hover()` and `u.at()` compose with any other utility to build responsive, stateful styles:

```tsx
<div mix={[u.p(4), u.bg(), u.at("md", [u.p(6), u.hover(u.border("brand"))])]} />
```

Not every export is a mixin. A handful are plain string resolvers — `u.var()`, `u.calc()`, `u.env()`, the three gradient builders, and the token resolvers at the `@pkg/u/tokens` subpath — which return a CSS value string to hand to a utility rather than something that goes in a `mix` array. Each entry below says which it is.

The package covers CSS primitives across thirteen families — layout, size, color, typography, effects, overflow, stacking, transform, animation, state, responsive, accessibility, and general escape hatches — plus a set of composed patterns that pick several declarations together: `u.surface()` chooses a background, foreground, and border as a matching set; `u.hstack()`/`u.vstack()`/`u.zstack()` build the three common stacks; `u.circle()`, `u.squircle()`, `u.truncate()`, and `u.translucent()` bundle the multi-declaration recipes worth having a name.

Four CSS properties take a _list_ or a _function stack_ rather than a single value — `transform`, `filter`, `backdrop-filter`, and `box-shadow` — so a naive utility per function would silently overwrite its siblings. Each of those families instead writes its own `--ui-*` custom property plus one byte-identical composite declaration, which is why `u.rotate()` and `u.scaleX()`, or `u.blur()` and `u.grayscale()`, or `u.shadow()` and `u.ringShadow()`, all combine instead of the last call winning. The relevant entries spell out the mechanism.

Three conventions are worth knowing up front. **Logical properties are the default**: `u.is()`/`u.bs()` for sizing, `u.pi()`/`u.pb()` for padding, `u.insIs()` for insets — each has a physical counterpart (`u.width()`, `u.paddingLeft()`, `u.insLeft()`) documented as the deliberate exception for when a value must not flip with writing mode. And **accessibility gating is opt-in per utility**: `u.ring()` only ever shows on `:focus-visible` and `u.translucent()` gates its blur behind `prefers-reduced-transparency`, while the bare primitives they compose (`u.outline()`, `u.backdropBlur()`) apply unconditionally.

## Usage

### Install

```bash
bun add @pkg/u
```

### Import

```tsx
import * as u from "@pkg/u";

<div mix={[u.p(4), u.bg(), u.hover([u.bg("neutral.tint"), u.border("neutral")])]} />;
```

Every utility is also a named export, and every family has its own subpath, so a call site can pick exactly how much it imports:

```tsx
import { bg, p } from "@pkg/u";
import { bg } from "@pkg/u/color";
import { p } from "@pkg/u/size";
import bg from "@pkg/u/color/bg";
import p from "@pkg/u/size/p";
```

The pure token resolvers live at their own `@pkg/u/tokens` subpath rather than the package root, because four of them share a name with a utility mixin (`font`, `text`, `shadow`, `blur`). Importing from `@pkg/u/tokens` always gets the resolver; importing from the root always gets the mixin:

```ts
import { blur, spacing } from "@pkg/u/tokens";

spacing(4); // "calc(var(--ui-spacing, 0.25rem) * 4)"
blur("sm"); // "var(--ui-blur-sm, 4px)"
```

### Import the theme

```css
@import "@pkg/u/theme.css";

/* your app's styles */
```

`theme.css` defines the semantic tone layer (`--ui-{tone}-bg-tint`, `--ui-{tone}-fg`, ...) for `neutral`, `brand`, `success`, `warning`, and `danger`, plus the spacing, container-breakpoint, font, and text-size scale variables. It does **not** define the raw palette scale — an app defines `--ui-color-{name}-{50..950}` itself:

```css
:root {
	--ui-color-neutral-50: oklch(0.985 0 0);
	--ui-color-neutral-100: oklch(0.97 0 0);
	/* ...through 950 */

	--ui-color-brand-50: oklch(0.97 0.02 250);
	--ui-color-brand-600: oklch(0.52 0.18 250);
	/* ...through 950 */
}
```

Add `.dark` to an ancestor (typically `<html>`) for forced dark mode, or `.system` to follow `prefers-color-scheme` instead.

### Extending the token names

Every named token family — color palettes, semantic tones, radii, text sizes, font families, container breakpoints, shadows, blurs — is a TypeScript interface an app extends through declaration merging, backed by nothing but the matching `--ui-*` variable:

```ts
declare module "@pkg/u" {
	interface ColorPalettes {
		info: true;
	}
	interface SemanticTones {
		info: true;
	}
}
```

```css
:root {
	--ui-color-info-50: hsl(...);
	--ui-color-info-600: hsl(...);
	/* ... */

	--ui-info-bg-tint: var(--ui-color-info-50);
	--ui-info-bg-solid: var(--ui-color-info-600);
	--ui-info-fg: var(--ui-color-info-600);
	/* ... */
}
```

No runtime registry backs any of this — a utility resolves a token name straight to `var(--ui-*)` at call time.

## API

Every function below returns a `UtilityMixin`: a real `remix/ui` host-element mixin, valid directly in a `mix` prop, that also carries a hidden style tree wrapper utilities (`u.hover()`, `u.at()`, `u.media()`, ...) can read and re-nest. Anywhere a parameter is typed `UtilityInput`, it accepts a single `UtilityMixin`, a falsy value (dropped), or a (possibly nested) array of the same.

### General

#### `calc(expression: string): string`

Wraps an arithmetic expression in CSS's `calc(...)`. A plain string resolver, not a mixin — use it anywhere a utility accepts a raw CSS value, most often paired with `u.var()` so a custom property can be offset, negated, or scaled at the call site instead of being redefined.

**Parameters:**

- `expression`: The arithmetic expression to wrap, written exactly as CSS expects it. Passed through untouched — nothing is validated or normalized, so CSS's own rule that `+` and `-` must be surrounded by spaces is the call site's responsibility (`"100% - 1rem"` is valid, `"100%-1rem"` is not).

**Returns:**

- The resolved `calc(...)` string

**Example:**

```typescript
let result = u.calc("100% - 1rem");
// "calc(100% - 1rem)"

let negatedResult = u.calc(`${u.var("arrow-offset", "0.5rem")} * -1`);
// "calc(var(--arrow-offset, 0.5rem) * -1)"
```

Since it returns a string rather than a mixin, it goes wherever a raw CSS length is accepted:

```tsx
<div mix={[u.vars({ "arrow-offset": "0.5rem" }), u.maxIs(u.calc("100% - 2rem"))]} />
```

#### `combine(input: UtilityInput): UtilityMixin`

Flattens `input` and merges the flattened utilities' style trees into one, with no wrapping selector or at-rule — the identity case of `u.when()`'s merge-then-nest primitive. This is not the same as listing the same utilities in a `mix` array: a `mix` array keeps each utility separate and leaves conflicts to the cascade, while `combine()` merges them at call time, left to right, into one declaration set. A later declaration overwrites an earlier one, but nested blocks sharing a selector key merge recursively instead of replacing each other. Reach for it when something needs to hand out one mixin rather than a list — every wrapper utility already accepts nested arrays, so `combine()` is about producing a single value, not about satisfying a wrapper.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A `UtilityMixin` carrying the merged declarations of every utility in `input`

**CSS:**

```css
/* u.combine([u.rounded("lg"), u.border({ color: "neutral", width: 1 })]) */
.host {
	border-radius: var(--ui-radius-lg, 0.5rem);
	border-color: var(--ui-neutral-border);
	border-width: 1px;
	border-style: solid;
}
```

**Example:**

```typescript
let result = u.combine([u.rounded("lg"), u.border({ color: "neutral", width: 1 })]);

// Nested branches merge as siblings rather than one replacing the other
let statesResult = u.combine([
	u.when("&:hover", u.bg("brand.tint")),
	u.when("&:focus", u.bg("brand.tint")),
]);
```

#### `counterIncrement(name: string, value?: number): UtilityMixin`

Applies `counter-increment`, advancing the CSS counter identified by `name`. A CSS counter is a document-level integer created by `u.counterReset()` on an ancestor, advanced by this utility on each item, and read back through a `counter(name)` call inside a `content` value — so it pairs with `u.pseudoContent()` to number things CSS has no automatic numbering for. `name` is the counter's own identifier, not a custom property, so it is given bare with no `--` prefix.

**Parameters:**

- `name`: The counter identifier, without a `--` prefix
- `value`: The integer to increment by. Omit it and no value is emitted at all, leaving CSS's own default of `1` in effect. Negative values count down.

**Returns:**

- A `UtilityMixin` that sets `counter-increment`

**CSS:**

```css
/* u.counterIncrement("section") */
.host {
	counter-increment: section;
}

/* u.counterIncrement("section", 2) */
.host {
	counter-increment: section 2;
}
```

**Example:**

```typescript
let result = u.counterIncrement("section");
let stepResult = u.counterIncrement("section", 2);
let countdownResult = u.counterIncrement("remaining", -1);
```

The counter only renders once something reads it back — the full three-utility composition:

```tsx
<ol mix={[u.counterReset("step"), u.listStyle()]}>
	<li
		mix={[
			u.counterIncrement("step"),
			u.relative(),
			u.before([u.pseudoContent('counter(step) "."'), u.absolute(), u.insIs(-4)]),
		]}
	>
		First step
	</li>
</ol>
```

#### `counterReset(name: string, value?: number): UtilityMixin`

Applies `counter-reset`, creating (or resetting) the CSS counter identified by `name` on the host. This is the declaring half of the counter pair — put it on the ancestor that scopes the numbering, and `u.counterIncrement()` on each item inside it. Without it, an incremented counter has no scope to belong to.

**Parameters:**

- `name`: The counter identifier, without a `--` prefix
- `value`: The integer to start the counter at. Omit it and no value is emitted at all, leaving CSS's own default of `0` in effect — so the first `u.counterIncrement()` of `1` produces `1`. Pass a value to start the numbering elsewhere.

**Returns:**

- A `UtilityMixin` that sets `counter-reset`

**CSS:**

```css
/* u.counterReset("section") */
.host {
	counter-reset: section;
}

/* u.counterReset("section", 10) */
.host {
	counter-reset: section 10;
}
```

**Example:**

```typescript
let result = u.counterReset("section");
let offsetResult = u.counterReset("section", 10);
```

#### `cursor(value: CursorValue | (string & {})): UtilityMixin`

Applies `cursor`, the pointer affordance shown over the host. Most useful for the cases the platform guesses wrong: a `<div>` acting as a control needs `"pointer"` spelled out, and a `<button>` styled as disabled needs `"not-allowed"`. The argument is required — there is no default.

**Parameters:**

- `value`: A `CursorValue` keyword, or any other string for a `url(...)` custom-image cursor (with an optional keyword fallback, e.g. `"url(cursor.png), pointer"`). Grouped as the spec does:
  - General — `"auto"` (the browser decides from context), `"default"` (the platform arrow), `"none"` (no cursor rendered at all)
  - Links and status — `"context-menu"`, `"help"`, `"pointer"` (the hand, for anything activatable), `"progress"` (busy but still interactive), `"wait"` (busy and blocked)
  - Selection — `"cell"`, `"crosshair"`, `"text"`, `"vertical-text"`
  - Drag and drop — `"alias"`, `"copy"`, `"move"`, `"no-drop"`, `"not-allowed"`, `"grab"`, `"grabbing"`
  - Resizing and scrolling — `"all-scroll"`, `"col-resize"`, `"row-resize"`, the eight single-edge forms `"n-resize"`, `"e-resize"`, `"s-resize"`, `"w-resize"`, `"ne-resize"`, `"nw-resize"`, `"se-resize"`, `"sw-resize"`, and the four bidirectional forms `"ew-resize"`, `"ns-resize"`, `"nesw-resize"`, `"nwse-resize"`
  - Zooming — `"zoom-in"`, `"zoom-out"`

**Returns:**

- A `UtilityMixin` that sets `cursor`

**CSS:**

```css
/* u.cursor("pointer") */
.host {
	cursor: pointer;
}
```

**Example:**

```typescript
let result = u.cursor("pointer");
let disabledResult = u.cursor("not-allowed");
let customResult = u.cursor("url(/cursors/pen.png), crosshair");
```

A cursor is a hint, not a state — pair it with the state wrapper that actually applies it:

```tsx
<div
	role="button"
	mix={[u.cursor("pointer"), u.disabled([u.cursor("not-allowed"), u.opacity(50)])]}
/>
```

#### `env(name: string, fallback?: string): string`

Resolves a CSS environment variable reference: `env({name})`, or `env({name}, {fallback})` when a fallback is given. A plain string resolver, not a mixin. Environment variables are values the user agent supplies rather than the stylesheet — principally the `safe-area-inset-*` family describing how far a display's rounded corners, notch, or home indicator intrude on the viewport. Always pass a `fallback`: on a browser that doesn't recognize the name, a bare `env()` reference makes the whole declaration invalid.

**Parameters:**

- `name`: The environment variable name, with no `env(` wrapper. The safe-area family is `safe-area-inset-top`, `safe-area-inset-right`, `safe-area-inset-bottom`, `safe-area-inset-left`; a viewport-segment or keyboard-inset name works the same way.
- `fallback`: An optional fallback value, used when the user agent doesn't define `name`. Omit it only when the declaration is already safe to lose entirely.

**Returns:**

- The resolved `env(...)` reference

**Example:**

```typescript
let result = u.env("safe-area-inset-bottom");
// "env(safe-area-inset-bottom)"

let fallbackResult = u.env("safe-area-inset-bottom", "0px");
// "env(safe-area-inset-bottom, 0px)"
```

Like `u.var()` and `u.calc()`, it goes wherever a raw CSS length is accepted — and composes with `u.calc()` to add an inset on top of a design-scale value:

```tsx
<footer
	mix={[u.fixed(), u.insBe(0), u.pbe(u.calc(`1rem + ${u.env("safe-area-inset-bottom", "0px")}`))]}
/>
```

Reach for `u.safeAreaPadding()` instead when the whole job is padding an element past the safe area — it composes this resolver for you.

#### `if(condition: unknown, input: UtilityInput): UtilityInput`

Conditionally returns `input`, or a falsy value when `condition` is falsy. Since `mix` already accepts falsy values directly (`mix={[cond && u.bg()]}`), this exists purely for call sites that prefer a utility-shaped conditional over a bare `&&`. Because `if` is a reserved word, it cannot be imported as a bare named import without an alias — call sites use it through the namespace import instead, as `u.if(...)`.

**Parameters:**

- `condition`: The value to test for truthiness
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped — returned as-is when `condition` is truthy

**Returns:**

- `input` when `condition` is truthy, otherwise `false`

**Example:**

```typescript
let result = u.if(isActive, u.bg("brand.tint"));

// Equivalent to, and interchangeable with:
let bareResult = isActive && u.bg("brand.tint");
```

It returns a `UtilityInput`, not a `UtilityMixin`, so it nests inside other utilities the same way an array does:

```tsx
<div mix={[u.p(4), u.if(isSelected, [u.bg("brand.tint"), u.border("brand")])]} />
```

#### `listStyle(value?: ListStyleValue): UtilityMixin`

Applies the `list-style` shorthand. Defaults to `"none"` — the common case of a `<ul>` or `<ol>` used as a semantic grouping for a layout rather than as a visually bulleted list. Note that removing the marker this way also removes the list semantics some browsers infer from it, so a navigation list that must still be announced as a list needs an explicit `role="list"`.

**Parameters:**

- `value`: A `ListStyleValue`. Defaults to `"none"`.
  - `"none"` — no marker at all
  - `"disc"` — the default filled bullet
  - `"decimal"` — `1.`, `2.`, `3.`
  - any other string — the shorthand's remaining forms: another `<counter-style>` name (`"square"`, `"lower-roman"`, `"upper-alpha"`), a `url(...)` image marker, a position keyword (`"inside"`, `"outside"`), or a space-separated combination (`"decimal outside"`)

**Returns:**

- A `UtilityMixin` that sets `list-style`

**CSS:**

```css
/* u.listStyle() */
.host {
	list-style: none;
}

/* u.listStyle("decimal") */
.host {
	list-style: decimal;
}
```

**Example:**

```typescript
let result = u.listStyle();
let numberedResult = u.listStyle("decimal");
let combinedResult = u.listStyle("lower-roman inside");
```

```tsx
<ul role="list" mix={[u.listStyle(), u.vstack({ gap: 2 })]}>
	{items}
</ul>
```

#### `pointerEvents(value?: PointerEventsValue): UtilityMixin`

Applies `pointer-events`. Defaults to `"none"` — the common case of a decorative overlay, gradient, or icon layered over an interactive element, which would otherwise swallow the clicks and hovers meant for what's underneath it. Note that `"none"` removes pointer interaction only: the element stays focusable and stays in the accessibility tree, so it is not a way to disable a control.

**Parameters:**

- `value`: A `PointerEventsValue`. Defaults to `"none"`.
  - `"none"` — the host is transparent to pointer input, which passes through to whatever is behind it
  - `"auto"` — normal hit-testing, used to opt a descendant back in underneath a `"none"` ancestor

**Returns:**

- A `UtilityMixin` that sets `pointer-events`

**CSS:**

```css
/* u.pointerEvents() */
.host {
	pointer-events: none;
}
```

**Example:**

```typescript
let result = u.pointerEvents();
let interactiveResult = u.pointerEvents("auto");
```

The pattern it exists for — a decorative layer over a control, with one child opted back in:

```tsx
<div mix={[u.zstack()]}>
	<input />
	<span mix={[u.pointerEvents(), u.self("center"), u.pis(2)]} aria-hidden="true">
		⌘K
	</span>
</div>
```

#### `pseudoContent(value: string): UtilityMixin`

Applies the CSS `content` property. A `::before` or `::after` pseudo-element generates no box at all without a `content` declaration, so this is the utility that makes the `u.before()`/`u.after()` wrappers actually render anything. The value is passed through verbatim, so CSS's quoting rules are the call site's job: an empty decorative box is `'""'` — a bare `""` emits nothing and the pseudo-element stays absent. Named `pseudoContent` rather than `content` because `u.content()` already sets `align-content`.

Generated content is not reliably exposed to assistive technology, and browsers differ on whether it appears in the accessibility tree at all, so it must never carry meaning a user would miss without it.

**Parameters:**

- `value`: The raw `content` value, quoted as CSS expects. Common forms:
  - `'""'` — an empty box, for a decorative shape sized and painted by other utilities
  - `'"→"'` — a literal string, quoted inside the string
  - `'counter(step) "."'` — a counter read back from `u.counterReset()`/`u.counterIncrement()`
  - `'attr(data-label)'` — the value of an attribute on the originating element
  - `"none"` — suppresses the pseudo-element, for turning off one inherited from elsewhere

**Returns:**

- A `UtilityMixin` that sets `content`

**CSS:**

```css
/* u.before(u.pseudoContent('""')) */
.host {
	&::before {
		content: "";
	}
}
```

**Example:**

```typescript
let result = u.pseudoContent('""');
let stringResult = u.pseudoContent('"→"');
let counterResult = u.pseudoContent('counter(step) "."');
```

It is only meaningful inside a pseudo-element wrapper, alongside the utilities that give the generated box a size and a paint:

```tsx
<span
	mix={[
		u.relative(),
		u.after([
			u.pseudoContent('""'),
			u.absolute(),
			u.insBe(0),
			u.insIs(0),
			u.is("full"),
			u.bs("1px"),
			u.bg("brand.solid"),
		]),
	]}
>
	Underlined
</span>
```

#### `raw(styles: CSSStyles): UtilityMixin`

Wraps a plain style object as a utility mixin. This is the escape hatch: a property this package has no dedicated utility for, or a value computed from something it doesn't model, still needs to compose inside `u.when()`, `u.combine()`, `u.hover()`, `u.at()` and every other wrapper — and those accept only utility mixins, never the plain `css()` mixins they're built on. Reaching for it means giving up the token layer and the typed value unions, so prefer a named utility wherever one exists, and keep the raw object as small as the gap it's filling.

**Parameters:**

- `styles`: A plain `CSSStyles` object — camelCased property names, nested selector and at-rule keys allowed, exactly as `css()` accepts. Passed through untouched with no token resolution, so any `var(--ui-*)` reference must be written out in full.

**Returns:**

- A `UtilityMixin` carrying `styles` as-is

**CSS:**

```css
/* u.when('&[data-series="1"]', u.raw({ color: "var(--ui-chart-1)" })) */
.host {
	&[data-series="1"] {
		color: var(--ui-chart-1);
	}
}
```

**Example:**

```typescript
let result = u.raw({ mixBlendMode: "multiply" });
let nestedResult = u.when('&[data-series="1"]', u.raw({ color: "var(--ui-chart-1)" }));
```

The case it's really for — a value derived from data this package can't model, still composing with ordinary utilities:

```tsx
{
	series.map((s, index) => (
		<span
			key={s.id}
			mix={[u.circle(), u.is(2), u.raw({ backgroundColor: `var(--ui-chart-${index + 1})` })]}
		/>
	));
}
```

#### `touchAction(value?: TouchActionValue): UtilityMixin`

Applies `touch-action`, which decides how much of a touch gesture the browser handles itself before the element's own handlers see it. Defaults to `"none"` — the case of a custom drag handle, slider, or canvas that must interpret every touch itself rather than losing it to the browser's panning and zooming. Use it sparingly and narrowly: `"none"` on a large region takes away the user's ability to scroll past it, and on a whole page it removes pinch-zoom, which people rely on.

**Parameters:**

- `value`: A `TouchActionValue`. Defaults to `"none"`.
  - `"auto"` — the browser handles every gesture normally
  - `"none"` — the browser handles none of them; every touch goes to the element's handlers
  - `"pan-x"` / `"pan-y"` — the browser keeps single-finger scrolling on one axis only, leaving the other to the element
  - `"pan-left"` / `"pan-right"` / `"pan-up"` / `"pan-down"` — the same, narrowed to one direction
  - `"pinch-zoom"` — the browser keeps multi-finger zoom, leaving panning to the element
  - `"manipulation"` — shorthand for panning and zooming but _not_ double-tap, which removes the ~300ms click delay some browsers add while waiting to see if a tap becomes a double-tap
  - any other string — a space-separated combination, e.g. `"pan-y pinch-zoom"`

**Returns:**

- A `UtilityMixin` that sets `touch-action`

**CSS:**

```css
/* u.touchAction() */
.host {
	touch-action: none;
}

/* u.touchAction("pan-y pinch-zoom") */
.host {
	touch-action: pan-y pinch-zoom;
}
```

**Example:**

```typescript
let result = u.touchAction();
let tapResult = u.touchAction("manipulation");
let scrollableResult = u.touchAction("pan-y pinch-zoom");
```

```tsx
<div role="slider" mix={[u.touchAction("pan-y"), u.hstack({ align: "center" })]} />
```

#### `userSelect(value?: UserSelectValue): UtilityMixin`

Applies `user-select`, controlling whether the host's text can be selected by the user. Defaults to `"none"` — a label, icon, or drag handle that shouldn't accumulate a blue highlight when an incidental click-drag passes over it. Keep it off actual content: unselectable text can't be copied, quoted, or fed to a translation or dictionary tool, so `"none"` belongs on chrome, never on prose.

**Parameters:**

- `value`: A `UserSelectValue`. Defaults to `"none"`.
  - `"none"` — the host's text can't be selected
  - `"auto"` — the browser's normal behavior, which depends on the element and its ancestors
  - `"text"` — the text is selectable, used to opt a descendant back in underneath a `"none"` ancestor
  - `"all"` — one click selects the whole element's content as a unit rather than placing a caret, for a copyable token or code snippet
  - `"contain"` — a selection starting inside the host stays inside it

**Returns:**

- A `UtilityMixin` that sets `user-select`

**CSS:**

```css
/* u.userSelect() */
.host {
	user-select: none;
}
```

**Example:**

```typescript
let result = u.userSelect();
let selectableResult = u.userSelect("text");
let copyableResult = u.userSelect("all");
```

```tsx
<code mix={[u.userSelect("all"), u.font("mono"), u.rounded("sm"), u.pi(1)]}>{token}</code>
```

#### `var(name: string, fallback?: string): string`

Resolves a custom property reference: `var(--{name})`, or `var(--{name}, {fallback})` when a fallback is given. The leading `--` is omitted from `name`, mirroring `u.vars()`'s convention for defining the same custom properties. A plain string resolver, not a mixin — use it anywhere a utility accepts a raw CSS value, such as `u.p(u.var("gap"))`.

**Parameters:**

- `name`: The custom property name, without the leading `--`
- `fallback`: An optional fallback value, used when the property isn't defined on the element or any ancestor

**Returns:**

- The resolved `var(...)` reference

**Example:**

```typescript
let result = u.var("sidebar-width");
// "var(--sidebar-width)"

let fallbackResult = u.var("sidebar-width", "18rem");
// "var(--sidebar-width, 18rem)"
```

Paired with `u.vars()`, the two halves give a component a styling knob a call site can override per instance:

```tsx
<aside mix={[u.vars({ "sidebar-width": "18rem" }), u.is(u.var("sidebar-width", "16rem"))]} />
```

#### `vars(values: Record<string, string | number>): UtilityMixin`

Sets custom properties on the host element. Each key is written with a leading `--` prepended, so call sites read as plain option names. This is the declaring half of the custom-property pair — `u.var()` is the reading half. Because custom properties inherit, a `vars()` call on a container is how a component exposes a knob its own descendants (and a consumer's overrides) can read.

**Parameters:**

- `values`: A map of custom property names — each without the leading `--` — to their string or number values. A number is emitted bare, so any needed unit has to be part of a string value.

**Returns:**

- A `UtilityMixin` that sets each custom property on the host

**CSS:**

```css
/* u.vars({ "sidebar-width": "18rem", "grid-columns": 3 }) */
.host {
	--sidebar-width: 18rem;
	--grid-columns: 3;
}
```

**Example:**

```typescript
let result = u.vars({ "sidebar-width": "18rem" });
let multipleResult = u.vars({ "row-height": "2.5rem", "row-count": 8 });
```

Because the properties inherit, a value set once on a container drives several descendants — and a responsive wrapper can retune the whole subtree by resetting one property:

```tsx
<div
	mix={[
		u.vars({ "sidebar-width": "16rem" }),
		u.at("lg", u.vars({ "sidebar-width": "20rem" })),
		u.hstack({ gap: 4 }),
	]}
>
	<aside mix={[u.is(u.var("sidebar-width"))]} />
	<main mix={[u.spacer()]} />
</div>
```

#### `willChange(value: WillChangeValue): UtilityMixin`

Applies `will-change`, telling the browser ahead of time which property is about to animate so it can promote the element to its own compositing layer before the animation starts rather than during its first frame. It is a hint with a real cost — a promoted layer consumes memory and can disable subpixel text antialiasing — so it should be applied to as few elements as possible and, ideally, only while the animation is imminent rather than left on permanently. An element that already animates smoothly does not need it.

**Parameters:**

- `value`: A `WillChangeValue`. Required — there is no default.
  - Browser-strategy keywords — `"auto"` (no hint; the default state), `"scroll-position"` (content is about to be scrolled into view), `"contents"` (the element's contents are expected to change often)
  - Property names, hinted ahead of animating them — `"transform"`, `"opacity"`, `"filter"`, `"backdrop-filter"`, `"box-shadow"`, `"clip-path"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"width"`, `"height"`, `"background-color"`, `"color"`, `"content"`
  - any other string — another property name, or a comma-separated list of several (`"opacity, transform"`)

**Returns:**

- A `UtilityMixin` that sets `will-change`

**CSS:**

```css
/* u.willChange("transform") */
.host {
	will-change: transform;
}

/* u.willChange("opacity, transform") */
.host {
	will-change: opacity, transform;
}
```

**Example:**

```typescript
let result = u.willChange("transform");
let multipleResult = u.willChange("opacity, transform");
```

Scoping the hint to the moment it's needed — here only while the host is hovered, rather than for the element's whole lifetime:

```tsx
<div
	mix={[
		u.transition("transform", { duration: 150 }),
		u.hover([u.willChange("transform"), u.scale(1.02)]),
	]}
/>
```

### Layout

#### `absolute(): UtilityMixin`

Sets `position: absolute`, taking the host out of normal document flow and positioning it against its nearest positioned ancestor. Because it leaves flow, it reserves no space — siblings lay out as if it weren't there.

It needs a positioned ancestor to anchor to, or it will resolve against the initial containing block (effectively the page). Pair it with `u.relative()` on the intended parent, and with `u.inset()` or the `u.ins*` family to say where it sits. Note that `transform`, `filter`, `backdrop-filter`, an `opacity` below 1, and a non-`none` `mask` all also create containing blocks, so an unexpected anchor is usually one of those.

Reach for `u.zstack()` instead when the goal is simply to overlay children: absolute children collapse their parent to zero size, while a grid overlay keeps it sizing to its largest child.

**Returns:**

- A `UtilityMixin` that sets `position: absolute`

**CSS:**

```css
/* u.absolute() */
.host {
	position: absolute;
}
```

**Example:**

```typescript
let result = u.absolute();
```

The anchor-and-place pair, with a logical inset so it flips under RTL:

```tsx
<div mix={[u.relative(), u.clip(), u.rounded("lg")]}>
	<img mix={[u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
	<span
		mix={[u.absolute(), u.insBs(2), u.insIe(2), u.surface("brand"), u.rounded("full"), u.pi(2)]}
	>
		{badge}
	</span>
</div>
```

It conflicts with every other position utility — `u.relative()`, `u.fixed()`, `u.sticky()` — on the same element.

#### `anchorName(name: string): UtilityMixin`

Applies the CSS Anchor Positioning `anchor-name` property, naming the host as an anchor that other elements can be positioned against. This is the _declaring_ half of anchor positioning, and it goes on the element being anchored **to** — the button, the trigger, the table cell — not on the surface that moves. The querying half is `u.positionAnchor()`, which goes on the positioned element and points back at this name; with only one half in place there is no anchor relationship at all, which is why neither `u.positionArea()` nor `u.positionTryFallbacks()` can resolve a placement until both are written.

The leading `--` is omitted from `name` and added for you, mirroring the convention `u.vars()` and `u.var()` already use: an anchor name is a dashed-ident exactly like a custom property, so `u.anchorName("tooltip")` emits `anchor-name: --tooltip`. Passing `"--tooltip"` would emit `anchor-name: ----tooltip`, so keep the argument bare.

The name has to be visible to the positioned element through the DOM tree, and a second `u.anchorName()` on the same element replaces the first rather than adding a second name.

**Parameters:**

- `name`: The anchor's dashed-ident name, written **without** the leading `--`. Required, emitted verbatim after the prefix — no validation, no defaults.

**Returns:**

- A `UtilityMixin` that sets `anchor-name` to `--{name}`

**CSS:**

```css
/* u.anchorName("tooltip-trigger") */
.host {
	anchor-name: --tooltip-trigger;
}

/* u.anchorName("trigger") */
.host {
	anchor-name: --trigger;
}
```

**Example:**

```typescript
let result = u.anchorName("tooltip-trigger");
let shortResult = u.anchorName("trigger");
```

Both halves of the pair, with the surface taken out of flow so the anchor can position it:

```tsx
<div>
	<button mix={[u.anchorName("tooltip-trigger")]}>{label}</button>
	<div
		role="tooltip"
		mix={[
			u.absolute(),
			u.positionAnchor("tooltip-trigger"),
			u.positionArea("block-start"),
			u.positionTryFallbacks("flip-block"),
		]}
	>
		{description}
	</div>
</div>
```

#### `appearance(value?: AppearanceValue | (string & {}), options?: AppearanceOptions): UtilityMixin`

A primitive form-control reset: it clears (or restores) the platform's native control chrome. By default the value is mirrored onto `-webkit-appearance` and `-moz-appearance` as well as the standard property, because Safari and Firefox both still need their own prefixed property to fully clear a `<meter>`, `<progress>`, or range `<input>`'s native rendering.

It only _removes_ the native look; it supplies no replacement. That is deliberate — the visual recipe belongs to the app or component — but it means a bare `u.appearance()` on a `<select>` or checkbox leaves an unstyled box, so it always needs accompanying background, border, and size utilities. It also strips the native focus ring on some controls, so pair it with `u.ring()`.

**Parameters:**

- `value`: The `appearance` keyword. Defaults to `"none"`.
  - `"none"` — clears the platform's native control chrome. The default.
  - `"auto"` — restores it, for opting a control back in
  - any other string — the legacy "compat" keywords that make one control mimic another's native rendering (`"menulist-button"`, `"textfield"`, `"searchfield"`, `"button"`, …), niche enough not to be enumerated in the type
- `options.webkit`: Also sets `-webkit-appearance` to the same value. Defaults to `true`.
- `options.moz`: Also sets `-moz-appearance` to the same value. Defaults to `true`.

Pass `false` for a prefix only when a separate rule deliberately owns that engine's reset. Omitting `options` (or passing `{}`) keeps all three properties.

**Returns:**

- A `UtilityMixin` that sets `appearance` and, unless opted out, the two vendor-prefixed mirrors

**CSS:**

```css
/* u.appearance() */
.host {
	appearance: none;
	-webkit-appearance: none;
	-moz-appearance: none;
}

/* u.appearance("none", { moz: false }) */
.host {
	appearance: none;
	-webkit-appearance: none;
}
```

**Example:**

```typescript
let result = u.appearance();
let restoreResult = u.appearance("auto");
let webkitOnlyResult = u.appearance("none", { moz: false });
```

A reset is only half the job — the replacement visual and the focus ring have to come with it:

```tsx
<select
	mix={[
		u.appearance(),
		u.font("inherit"),
		u.text("sm"),
		u.bg("color.neutral.50"),
		u.border({ color: "neutral", width: 1 }),
		u.rounded("md"),
		u.pb(2),
		u.pis(3),
		u.pie(8),
		u.ring("brand"),
	]}
>
	{options}
</select>
```

#### `basis(value?: SizeValue): UtilityMixin`

Applies `flex-basis` — the size a flex item is laid out from before any free space is distributed. Together with `u.grow()` and `u.shrink()` it breaks the `flex` shorthand into three separately composable calls, so a call site sets only the part it means. It only does something on a flex item: the host has to be a direct child of a flex container (`u.flex()`, `u.inlineFlex()`, `u.hstack()`, `u.vstack()`), and it is ignored entirely on a grid or block child.

Two things overwrite it. `u.spacer()` sets the whole `flex` shorthand (`1 1 auto`), whose third component _is_ `flex-basis`, so putting both on one element leaves the result to declaration order — pick one. And in a row direction `flex-basis` competes with `u.is()`: `flex-basis` wins over `inline-size` on a flex item, so an unexpected `basis` is the usual reason an explicit width appears to be ignored.

**Parameters:**

- `value`: The basis length. Defaults to `"auto"`, matching `flex-basis`'s own initial value, which sizes the item from its `inline-size`/content instead.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`
  - `"auto"` (the default) — passes through; the item is sized from its own width/content
  - `"full"` — resolved to `100%`
  - any other string — a raw CSS escape hatch, passed through unchanged (`"0%"`, `"13px"`, `"60ch"`, `"100dvh"`, a `var(...)`/`calc(...)` reference)

**Returns:**

- A `UtilityMixin` applying the `flex-basis` property.

**CSS:**

```css
/* u.basis() */
.host {
	flex-basis: auto;
}

/* u.basis(4) */
.host {
	flex-basis: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.basis("0%") */
.host {
	flex-basis: 0%;
}
```

**Example:**

```typescript
let result = u.basis();
let scaleResult = u.basis(4);
let fullResult = u.basis("full");
let rawResult = u.basis("0%");
```

```tsx
<div mix={[u.hstack({ gap: 4 })]}>
	<aside mix={[u.basis("14rem"), u.shrink()]} />
	<main mix={[u.basis("0%"), u.grow()]} />
</div>
```

#### `block(): UtilityMixin`

Sets `display: block`, making the host a block-level box that fills its container's inline axis and stacks with its siblings.

Its most common real use is on a replaced or inline element that should stop sitting on the text baseline — an `<img>` is `inline` by default, which leaves a few pixels of descender space below it inside its container. `u.block()` removes that.

**Returns:**

- A `UtilityMixin` that sets `display: block`

**CSS:**

```css
/* u.block() */
.host {
	display: block;
}
```

**Example:**

```typescript
let result = u.block();
```

```tsx
<img mix={[u.block(), u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
```

It conflicts with every other display utility, and with `u.lineClamp()`, which sets `display: -webkit-box` itself.

#### `borderCollapse(value?: BorderCollapseValue): UtilityMixin`

Controls whether a table's adjacent cell borders merge into single shared lines or each keep their own. Defaults to `"collapse"`, the common case of a table whose borders should read as one grid instead of doubling up along every shared edge. It only applies to a table box (a `<table>`, or an element with a `table` display), and it decides whether `u.borderSpacing()` has any effect at all: under `"collapse"` the spacing between cells is ignored by definition.

**Parameters:**

- `value`: The collapsing model. Defaults to `"collapse"`.
  - `"collapse"` (the default) — adjacent cells share one border; the winning border is picked by CSS's border-conflict rules, so a per-cell border may lose to a neighbour's
  - `"separate"` — every cell draws its own border, and `border-spacing` applies between them

**Returns:**

- A `UtilityMixin` applying the `border-collapse` property.

**CSS:**

```css
/* u.borderCollapse() */
.host {
	border-collapse: collapse;
}

/* u.borderCollapse("separate") */
.host {
	border-collapse: separate;
}
```

**Example:**

```typescript
let result = u.borderCollapse();
let separateResult = u.borderCollapse("separate");
```

```tsx
<table mix={[u.borderCollapse("separate"), u.borderSpacing("0 0.25rem"), u.is("full")]} />
```

#### `borderSpacing(value: string): UtilityMixin`

Sets the gap between adjacent table cell borders. It has no effect unless `border-collapse: separate` is in force, so it is always paired with `u.borderCollapse("separate")` on the same table. It takes a raw CSS string rather than the spacing scale, because the property carries its own one- and two-length grammar (both axes, or horizontal then vertical) that a single scale value can't express — pass a `calc(var(--ui-spacing, 0.25rem) * n)` string, or `u.var("ui-spacing")`, when the value should track the spacing scale.

**Parameters:**

- `value`: A raw `border-spacing` value. Required — there is no default and no scale resolution; whatever string is given is emitted verbatim.
  - one length (`"0.5rem"`) — applies to both the horizontal and vertical gaps
  - two lengths separated by a space (`"0.5rem 1rem"`) — horizontal then vertical
  - any CSS length form works, including `var(...)` and `calc(...)` references

**Returns:**

- A `UtilityMixin` applying the `border-spacing` property.

**CSS:**

```css
/* u.borderSpacing("0.5rem") */
.host {
	border-spacing: 0.5rem;
}

/* u.borderSpacing("0.5rem 1rem") */
.host {
	border-spacing: 0.5rem 1rem;
}
```

**Example:**

```typescript
let result = u.borderSpacing("0.5rem");
let axisResult = u.borderSpacing("0.5rem 1rem");
let scaleResult = u.borderSpacing(u.var("ui-spacing", "0.25rem"));
```

```tsx
<table mix={[u.borderCollapse("separate"), u.borderSpacing("0 0.5rem")]} />
```

#### `boxSizing(value: BoxSizingValue): UtilityMixin`

Controls whether a declared size includes padding and border or excludes them. It governs every sizing utility on the same element — `u.is()`, `u.bs()`, `u.minIs()`, `u.minBs()` and their raw-CSS equivalents — so it is the switch that decides whether `u.is("full")` plus `u.p(4)` stays inside its parent or overflows it by the padding. There is no default: the two keywords are opposite intents, so the call site always names one.

**Parameters:**

- `value`: The box model to size against. Required — no default.
  - `"border-box"` — padding and border are folded into the declared `inline-size`/`block-size`; the content box shrinks to make room
  - `"content-box"` — the declared size covers the content box only, with padding and border added outside it (the CSS default)

**Returns:**

- A `UtilityMixin` applying the `box-sizing` property.

**CSS:**

```css
/* u.boxSizing("border-box") */
.host {
	box-sizing: border-box;
}

/* u.boxSizing("content-box") */
.host {
	box-sizing: content-box;
}
```

**Example:**

```typescript
let result = u.boxSizing("border-box");
let contentResult = u.boxSizing("content-box");
```

```tsx
<div mix={[u.boxSizing("border-box"), u.is("full"), u.p(4)]} />
```

#### `center(): UtilityMixin`

A zero-argument convenience pattern that centres content on both axes. Composes `u.flex()`, `u.items("center")`, and `u.justify("center")`, adding no declarations of its own.

Because it makes the host a flex container, it centres the host's _children_ — it does not centre the host itself within its own parent. For that, reach for `u.mi("auto")` on the host, or `u.self("center")` inside a flex or grid parent.

**Returns:**

- A `UtilityMixin` that sets `display: flex`, `align-items: center`, and `justify-content: center`

**CSS:**

```css
/* u.center() */
.host {
	display: flex;
	align-items: center;
	justify-content: center;
}
```

**Example:**

```typescript
let result = u.center();
```

The classic use — an icon centred in a square button:

```tsx
<button
	mix={[
		u.is(9),
		u.aspect("square"),
		u.center(),
		u.rounded("md"),
		u.surface("muted"),
		u.ring("brand"),
	]}
>
	<svg mix={[u.is(4), u.bs(4), u.fill("currentColor")]} aria-hidden="true">
		<path d="..." />
	</svg>
	<span mix={[u.visuallyHidden()]}>{label}</span>
</button>
```

It conflicts with other display utilities and with any `u.items()`/`u.justify()` on the same element.

#### `container(name: string, type?: ContainerTypeValue): UtilityMixin`

Declares the host as a named container query context, so a descendant's `u.at(size, name, input)` (or `u.atMax()`) can target it by name instead of resolving to whichever container happens to be nearest. This is the declaring half of the container-query pair — `u.at()` is the querying half, comparing its `size` argument against the container's inline size — and a query with no matching container simply never matches, which is the usual reason an `at()` rule appears to do nothing. It writes the `container` shorthand, so `container-name` and `container-type` are always set together rather than one being left behind from an earlier rule; a second `u.container()` on the same element replaces both.

**Parameters:**

- `name`: The container name a descendant's query refers to. Required; emitted verbatim as the shorthand's first segment.
- `type`: The containment type — the shorthand's second segment. Defaults to `"inline-size"`.
  - `"inline-size"` (the default) — the container's inline size is queryable, which is what a width-style breakpoint needs; the block axis stays content-sized
  - `"size"` — both axes are queryable, but the element's block size no longer depends on its content, so it collapses unless a block size is set (via `u.bs()`/`u.minBs()`)
  - `"normal"` — establishes a style container only; size queries such as `u.at()`'s will not match it

**Returns:**

- A `UtilityMixin` applying `container: "{name} / {type}"`.

**CSS:**

```css
/* u.container("sidebar") */
.host {
	container: sidebar / inline-size;
}

/* u.container("sidebar", "size") */
.host {
	container: sidebar / size;
}
```

**Example:**

```typescript
let result = u.container("sidebar");
let sizedResult = u.container("sidebar", "size");
let styleOnlyResult = u.container("sidebar", "normal");
```

```tsx
<aside mix={[u.container("sidebar"), u.vstack({ gap: 4 })]}>
	<article mix={[u.p(2), u.at("md", "sidebar", u.p(6))]} />
</aside>
```

#### `content(value?: JustifyValue): UtilityMixin`

Sets `align-content`, distributing the host's content _lines_ along the cross axis. It accepts the same keywords as `u.justify()`, including the short `between`/`around`/`evenly` forms, which are aliased to their `space-*` CSS equivalents.

It only does anything when there is more than one line to distribute _and_ spare room on the cross axis: in a flex container that means `u.flexWrap()` must be on and the container must be taller than its wrapped lines. In a grid container it applies to the row tracks, where it is more often useful. A single-line flex container ignores it entirely — that is the usual reason it appears to do nothing, and `u.items()` is probably what was wanted.

**Parameters:**

- `value`: The distribution keyword. Defaults to `"start"`.
  - `"start"` — lines packed to the cross-axis start. The default.
  - `"center"` — lines packed to the centre
  - `"end"` — lines packed to the cross-axis end
  - `"between"` — aliased to `space-between`: first line flush to the start, last to the end, equal gaps between
  - `"around"` — aliased to `space-around`: equal space around each line, so edge gaps are half the inner gaps
  - `"evenly"` — aliased to `space-evenly`: every gap equal, including the edges

**Returns:**

- A `UtilityMixin` that sets `align-content`

**CSS:**

```css
/* u.content("between") */
.host {
	align-content: space-between;
}

/* u.content("center") */
.host {
	align-content: center;
}
```

**Example:**

```typescript
let result = u.content();
let betweenResult = u.content("between");
let centerResult = u.content("evenly");
```

A wrapping flex container with room to spare, which is when it actually applies:

```tsx
<div mix={[u.flex(), u.flexWrap(), u.gap(2), u.bs(40), u.content("between")]}>{tags}</div>
```

Reach for `u.place({ content })` to set `align-content` and `justify-content` together.

#### `contents(): UtilityMixin`

Sets `display: contents`, which removes the host's own box from layout so its children are laid out as if they were direct children of the host's parent. It is how a wrapper component can exist in the markup — for grouping, keys, or logic — without adding a layout box that would break the parent's flex or grid.

Use it carefully. Because the box disappears, so does everything that box would have done: backgrounds, borders, padding, and any size on the host render nothing. There are also long-standing accessibility bugs where `display: contents` on an element with semantics (a `<ul>`, a `<button>`) removes those semantics from the accessibility tree, so keep it to semantically neutral wrappers.

**Returns:**

- A `UtilityMixin` that sets `display: contents`

**CSS:**

```css
/* u.contents() */
.host {
	display: contents;
}
```

**Example:**

```typescript
let result = u.contents();
```

A grouping wrapper whose children need to participate in the grandparent's grid directly:

```tsx
<div mix={[u.grid(), u.gridTemplate({ columns: "repeat(3, 1fr)" }), u.gap(3)]}>
	{groups.map((group) => (
		<div key={group.id} mix={[u.contents()]}>
			{group.cells.map((cell) => (
				<span key={cell.id} mix={[u.p(2)]}>
					{cell.label}
				</span>
			))}
		</div>
	))}
</div>
```

#### `contentVisibility(value?: ContentVisibilityValue): UtilityMixin`

Applies `content-visibility`, which lets the browser skip rendering work — style, layout, and paint — for an element's contents. Defaults to `"auto"`, the value that skips that work while the element is off-screen and does it as the element scrolls into view.

This is the bare primitive, and for the long-scrollable-list case it is usually the wrong entry point: prefer `u.virtualize()`, which remains the recommended pattern because it sets `content-visibility: auto` _together with_ a `contain-intrinsic-size` placeholder. Without a reserved size the skipped content measures as zero, so the scroll height — and the scrollbar with it — jumps around as off-screen content mounts and unmounts. Reach for this utility directly only when a placeholder size genuinely does not apply, or when setting one of the other two values.

`"hidden"` always skips the contents, and skipping them takes them out of the accessibility tree and out of find-in-page as well: a screen reader will not announce them and Ctrl/Cmd+F will not match them. That puts it close to `u.hidden()`, with one difference that matters — the element's own box is still generated and laid out, so it keeps occupying space and can be revealed without reflowing everything around it, whereas `display: none` removes the box entirely.

**Parameters:**

- `value`: The `content-visibility` keyword. Defaults to `"auto"`.
  - `"auto"` (the default) — contents are skipped while off-screen and rendered on demand when scrolled to, focused, or found in page; the element stays searchable and stays in the accessibility tree
  - `"visible"` — contents render normally, the CSS initial value; useful to opt a subtree back in
  - `"hidden"` — contents are always skipped and are removed from the accessibility tree and find-in-page, while the element's own box is still laid out
- The utility never emits `contain-intrinsic-size`; that pairing is what `u.virtualize()` is for.

**Returns:**

- A `UtilityMixin` that sets `content-visibility`

**CSS:**

```css
/* u.contentVisibility() */
.host {
	content-visibility: auto;
}

/* u.contentVisibility("hidden") */
.host {
	content-visibility: hidden;
}

/* u.contentVisibility("visible") */
.host {
	content-visibility: visible;
}
```

**Example:**

```typescript
let result = u.contentVisibility();
let hiddenResult = u.contentVisibility("hidden");
let visibleResult = u.contentVisibility("visible");
```

A collapsed panel that keeps its box — and, for the rows of a long list, `u.virtualize()` instead:

```tsx
<section mix={[u.bs("12rem"), u.contentVisibility(expanded ? "visible" : "hidden")]}>
	{panelContent}
</section>
<div mix={[u.scroll("y"), u.bs("30rem")]}>
	{rows.map((row) => (
		<div key={row.id} mix={[u.virtualize("auto 2.5rem")]} />
	))}
</div>
```

#### `fieldSizing(value?: FieldSizingValue): UtilityMixin`

Applies `field-sizing` to an `<input>`, `<textarea>`, or `<select>`. Defaults to `"content"`, which makes the control size itself to the value it currently holds instead of the fixed default the platform picks — the native answer to an auto-growing textarea, or to a select that hugs its chosen option, replacing the resize observer (or mirrored hidden-element trick) that pattern used to require in JavaScript.

Content sizing is unbounded on its own, so pair it with `u.maxBs()` to cap how tall a textarea grows and `u.maxIs()` to cap how wide an input grows, letting the control's own overflow take over past that point. `u.minBs()`/`u.minIs()` are the matching floor when an empty control should not collapse to nothing.

It sits alongside `u.appearance()` as a form-control primitive: that one clears the platform's native chrome, this one hands sizing over to the value. It applies only to form controls — on a plain `<div>` the declaration is inert.

**Parameters:**

- `value`: The `field-sizing` keyword. Defaults to `"content"`.
  - `"content"` (the default) — the control sizes to the value it holds, growing and shrinking as the value changes
  - `"fixed"` — the platform's fixed default size, the CSS initial value; useful to opt one control back out

**Returns:**

- A `UtilityMixin` that sets `field-sizing`

**CSS:**

```css
/* u.fieldSizing() */
.host {
	field-sizing: content;
}

/* u.fieldSizing("fixed") */
.host {
	field-sizing: fixed;
}
```

**Example:**

```typescript
let result = u.fieldSizing();
let fixedResult = u.fieldSizing("fixed");
```

The auto-growing textarea, bounded so it cannot run past a few lines:

```tsx
<textarea
	mix={[
		u.fieldSizing(),
		u.minBs("3lh"),
		u.maxBs("12lh"),
		u.overflow("auto"),
		u.resize("none"),
		u.is("full"),
		u.p(2),
	]}
/>
```

#### `fixed(): UtilityMixin`

Sets `position: fixed`, positioning the host against the viewport so it stays put as the page scrolls. Like `u.absolute()`, it leaves normal flow and reserves no space.

Two things to know. It anchors to the viewport _unless_ an ancestor has a `transform`, `filter`, `backdrop-filter`, `perspective`, `mask`, or `contain` — any of which makes that ancestor the containing block instead, which is the usual reason a fixed element unexpectedly scrolls away. And on mobile browsers, viewport units and fixed positioning interact awkwardly with the dynamic toolbar; `dvh` units and `u.safeAreaPadding()` are the tools for that.

Reach for `u.sticky()` when the element should scroll with content up to a point and only then pin.

**Returns:**

- A `UtilityMixin` that sets `position: fixed`

**CSS:**

```css
/* u.fixed() */
.host {
	position: fixed;
}
```

**Example:**

```typescript
let result = u.fixed();
```

A bottom-docked action bar, clearing the device's home indicator:

```tsx
<div
	mix={[
		u.fixed(),
		u.insBe(0),
		u.insIs(0),
		u.insIe(0),
		u.layer(20),
		u.translucent(),
		u.pi(4),
		u.pb(3),
		u.safeAreaPadding("bottom"),
	]}
>
	{actions}
</div>
```

#### `flex(): UtilityMixin`

Sets `display: flex`, making the host a block-level flex container. Its children become flex items laid out along the main axis, which defaults to the inline axis (a row).

On its own it only establishes the container — reach for `u.hstack()` or `u.vstack()` when you also want a direction and a gap, which is almost always. Note that `u.flexCol()` and `u.flexRow()` set _only_ `flex-direction`, so they need this alongside them; `u.flexColReverse()` and `u.flexRowReverse()` set `display: flex` themselves.

Flex items get `min-inline-size: auto` by default, which refuses to shrink below content — see `u.minIs()`.

**Returns:**

- A `UtilityMixin` that sets `display: flex`

**CSS:**

```css
/* u.flex() */
.host {
	display: flex;
}
```

**Example:**

```typescript
let result = u.flex();
```

```tsx
<div mix={[u.flex(), u.flexCol(), u.gap(2)]}>{children}</div>
```

Prefer the stack helpers for the common cases:

```tsx
<div mix={[u.vstack({ gap: 2 })]}>{children}</div>
```

#### `flexCol(): UtilityMixin`

Sets `flex-direction: column`, stacking flex children along the block axis.

It sets **only** `flex-direction` — not `display` — so it does nothing without `u.flex()` (or a flex container established elsewhere) on the same element. Note the asymmetry with `u.flexColReverse()`, which does set `display: flex` itself. Reach for `u.vstack()` to get the container, the direction, and a gap in one call.

Switching to a column swaps which axis `u.items()` and `u.justify()` control: `justify-content` now works on the block axis and `align-items` on the inline axis.

**Returns:**

- A `UtilityMixin` that sets `flex-direction: column`

**CSS:**

```css
/* u.flexCol() */
.host {
	flex-direction: column;
}

/* u.flex() + u.flexCol() — what a column actually needs */
.host {
	display: flex;
	flex-direction: column;
}
```

**Example:**

```typescript
let result = u.flexCol();
```

Its idiomatic use is switching direction responsively, where the container is already established:

```tsx
<div mix={[u.hstack({ gap: 4 }), u.atMax("sm", u.flexCol())]}>{children}</div>
```

#### `flexColReverse(): UtilityMixin`

Sets the host to a flex column whose children stack from the bottom up — a chat log or activity feed whose newest entry sits at the bottom while the markup stays newest-first. Unlike `u.flexCol()`, which sets `flex-direction` only, this sets `display: flex` itself, so it needs no separate `u.flex()` beside it.

Two consequences worth knowing. Reversing the direction also reverses the main axis, so `u.justify("start")` now packs children at the _bottom_ and `u.gap()`'s row gap is unaffected. And reversing is visual only: keyboard focus order and screen-reader order still follow DOM order, so the DOM sequence has to make sense on its own. Any other display utility (`u.grid()`, `u.block()`, `u.inlineFlex()`) targets the same `display` key and a later `u.flexCol()`/`u.flexRow()` targets the same `flex-direction` key, so the last one in the `mix` wins.

**Returns:**

- A `UtilityMixin` applying `display: flex` and `flex-direction: column-reverse`.

**CSS:**

```css
/* u.flexColReverse() */
.host {
	display: flex;
	flex-direction: column-reverse;
}
```

**Example:**

```typescript
let result = u.flexColReverse();
```

```tsx
<ol mix={[u.flexColReverse(), u.gap(2), u.scroll("y")]} />
```

#### `flexRow(): UtilityMixin`

Sets `flex-direction: row`, laying flex children out along the inline axis. Since `row` is CSS's default direction, this is mainly for overriding a column set elsewhere — often inside a responsive wrapper.

Like `u.flexCol()`, it sets **only** `flex-direction`, so it needs `u.flex()` alongside it. Reach for `u.hstack()` for the container, direction, and gap together.

**Returns:**

- A `UtilityMixin` that sets `flex-direction: row`

**CSS:**

```css
/* u.flexRow() */
.host {
	flex-direction: row;
}
```

**Example:**

```typescript
let result = u.flexRow();
```

Overriding a column back to a row once the container is wide enough:

```tsx
<div mix={[u.vstack({ gap: 3 }), u.at("md", [u.flexRow(), u.items("center")])]}>{children}</div>
```

#### `flexRowReverse(): UtilityMixin`

Sets the host to a flex row whose children lay out from the end edge back toward the start. Unlike `u.flexRow()`, which sets `flex-direction` only, this sets `display: flex` itself, so it needs no separate `u.flex()` beside it.

Because the main axis is reversed, `u.justify("start")` now packs children at the row's end edge, and `u.spacer()` pushes in the mirrored direction. Note that the reversal is relative to the _inline_ direction, so under `rtl` a reversed row runs left-to-right; reach for it when the visual order genuinely differs from DOM order, not as a way to express direction. As with any reversal, focus and screen-reader order still follow DOM order. Other `display` and `flex-direction` utilities target the same keys, so the last one in the `mix` wins.

**Returns:**

- A `UtilityMixin` applying `display: flex` and `flex-direction: row-reverse`.

**CSS:**

```css
/* u.flexRowReverse() */
.host {
	display: flex;
	flex-direction: row-reverse;
}
```

**Example:**

```typescript
let result = u.flexRowReverse();
```

```tsx
<div mix={[u.flexRowReverse(), u.items("center"), u.gap(2)]} />
```

#### `flexWrap(value?: "wrap" | "nowrap" | "wrap-reverse"): UtilityMixin`

Controls whether flex children wrap onto multiple lines. CSS defaults to `nowrap`, which forces every item onto one line and shrinks them past their content — so turning wrapping on is often what fixes a squashed row.

Note that wrapping changes what `u.content()` does: with multiple lines there is finally something for `align-content` to distribute.

**Parameters:**

- `value`: The wrap behavior. Defaults to `"wrap"`.
  - `"wrap"` — items flow onto additional lines as needed. The default here.
  - `"nowrap"` — everything stays on one line, shrinking to fit. CSS's own default.
  - `"wrap-reverse"` — items wrap, but new lines are added in the opposite cross-axis direction

**Returns:**

- A `UtilityMixin` that sets `flex-wrap`

**CSS:**

```css
/* u.flexWrap() */
.host {
	flex-wrap: wrap;
}

/* u.flexWrap("nowrap") */
.host {
	flex-wrap: nowrap;
}
```

**Example:**

```typescript
let result = u.flexWrap();
let noWrapResult = u.flexWrap("nowrap");
let reverseResult = u.flexWrap("wrap-reverse");
```

A tag list that wraps rather than compressing its items:

```tsx
<ul role="list" mix={[u.flex(), u.flexWrap(), u.gap(2)]}>
	{tags.map((tag) => (
		<li key={tag} mix={[u.surface("muted"), u.rounded("full"), u.pi(2), u.text("xs"), u.nowrap()]}>
			{tag}
		</li>
	))}
</ul>
```

#### `gap(...values: SpacingValue[]): UtilityMixin`

Sets the spacing between flex or grid children using the spacing scale or a raw CSS length.

Prefer it over margins on children for layout spacing: a gap applies only _between_ items, so there is no stray edge margin to strip off the first or last one, and gaps never collapse the way adjacent margins do. It has no effect outside a flex, grid, or multi-column container.

**Parameters:**

- `values`: One or two spacing values. Any other count **throws** `@pkg/u: gap() expects 1 or 2 values`.
  - one value — applies to both the row and column gap
  - two values — read as `"{row} {column}"`, so the first is the gap between lines and the second between items within a line

  Each value is a spacing-scale number (`calc(var(--ui-spacing, 0.25rem) * n)`), `"auto"` (accepted by the type but not meaningful for `gap`), or a raw CSS length.

**Returns:**

- A `UtilityMixin` that sets `gap`

**CSS:**

```css
/* u.gap(4) */
.host {
	gap: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.gap(2, 4) */
.host {
	gap: calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.gap(4);
let axesResult = u.gap(2, 4);
let lengthResult = u.gap("1.5rem");
```

The two-value form is most useful on a wrapping layout, where row and column gaps want different values:

```tsx
<div mix={[u.flex(), u.flexWrap(), u.gap(3, 2)]}>{tags}</div>
```

`u.hstack()` and `u.vstack()` take a `gap` option that composes this utility, so you rarely call it directly alongside them.

#### `grid(): UtilityMixin`

Sets `display: grid`, making the host a block-level grid container. Without any track definition it produces a single-column grid, so pair it with `u.gridTemplate()` (or `u.repeat()`) to define columns and rows, and `u.gap()` for spacing.

Grid is the better choice than flex whenever items must align across _both_ axes — a form's labels and fields lining up, a card whose header, body, and footer are placed by name. Reach for `u.zstack()` for the overlay special case, which composes this utility.

**Returns:**

- A `UtilityMixin` that sets `display: grid`

**CSS:**

```css
/* u.grid() */
.host {
	display: grid;
}
```

**Example:**

```typescript
let result = u.grid();
```

The auto-fit idiom — a responsive card grid with no breakpoints at all:

```tsx
<div
	mix={[u.grid(), u.gridTemplate({ columns: "repeat(auto-fit, minmax(16rem, 1fr))" }), u.gap(4)]}
>
	{cards}
</div>
```

#### `gridArea(name: string): UtilityMixin`

Places the host in a named area of its parent's `grid-template-areas`. It requires that parent to be a grid (`u.grid()`/`u.inlineGrid()`) that actually declares the name through `u.gridTemplate({ areas })` — naming an area the parent never defined leaves the item auto-placed instead, with no error. Because `grid-area` is a shorthand, it resets `grid-row-start`/`grid-row-end`/`grid-column-start`/`grid-column-end`; note too that `u.zstack()` puts `grid-area: 1 / 1` on every direct child through a nested `& > *` rule, so a child's own `gridArea()` and its zstack parent's overlay rule are fighting over the same property.

**Parameters:**

- `name`: The area name, matching one declared in the parent's `grid-template-areas`. Required, emitted verbatim, so `grid-area`'s line-based grammar is available as a raw escape hatch too — `"1 / 1"` for a single cell, or `"1 / 1 / 3 / 3"` for a row-start/column-start/row-end/column-end span.

**Returns:**

- A `UtilityMixin` applying the `grid-area` property.

**CSS:**

```css
/* u.gridArea("header") */
.host {
	grid-area: header;
}

/* u.gridArea("1 / 1 / 3 / 3") */
.host {
	grid-area: 1 / 1 / 3 / 3;
}
```

**Example:**

```typescript
let result = u.gridArea("header");
let spanResult = u.gridArea("1 / 1 / 3 / 3");
```

```tsx
<div
	mix={[
		u.grid(),
		u.gridTemplate({ columns: "16rem 1fr", areas: '"sidebar header" "sidebar main"' }),
		u.gap(4),
	]}
>
	<header mix={[u.gridArea("header")]} />
	<aside mix={[u.gridArea("sidebar")]} />
	<main mix={[u.gridArea("main")]} />
</div>
```

#### `gridAutoColumns(value: SizeValue): UtilityMixin`

Applies `grid-auto-columns`, sizing the _implicit_ columns a grid creates for content that runs past the explicit tracks `u.gridTemplate()` declared. It has no effect on those explicit tracks — it only answers "how wide is column four when I only declared three?". It needs `u.grid()` or `u.inlineGrid()` on the same element, and it matters most with `u.gridAutoFlow("column")`, where every track past the first is implicit by construction.

The value goes through the same resolution as `u.is()` and friends: a number resolves against the spacing scale and `"full"` resolves to `100%`. The values implicit tracks most often want — `"auto"`, `"min-content"`, `"max-content"`, or a `minmax(...)` clause — are not lengths on a scale, so they take the raw-string escape and pass straight to CSS.

**Parameters:**

- `value`: The track size for implicit columns. Required — no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`
  - `"full"` — resolved to `100%`
  - `"auto"` — passed through, sizing the track to its content and letting it stretch
  - a raw CSS length (`"10rem"`, `"20ch"`) — passed through unchanged
  - any other string — the raw escape hatch, passed through unchanged: an intrinsic keyword (`"min-content"`, `"max-content"`, `"fit-content(12rem)"`), a `minmax(...)` clause, a flexible `fr` length, or a `var(...)` reference

**Returns:**

- A `UtilityMixin` that sets `grid-auto-columns` to the resolved length

**CSS:**

```css
/* u.gridAutoColumns(40) */
.host {
	grid-auto-columns: calc(var(--ui-spacing, 0.25rem) * 40);
}

/* u.gridAutoColumns("full") */
.host {
	grid-auto-columns: 100%;
}

/* u.gridAutoColumns("minmax(10rem, 1fr)") */
.host {
	grid-auto-columns: minmax(10rem, 1fr);
}

/* u.gridAutoColumns("max-content") */
.host {
	grid-auto-columns: max-content;
}
```

**Example:**

```typescript
let result = u.gridAutoColumns(40);
let fullResult = u.gridAutoColumns("full");
let rangeResult = u.gridAutoColumns("minmax(10rem, 1fr)");
let intrinsicResult = u.gridAutoColumns("max-content");
```

A horizontally scrolling carousel where every card is an implicit column of the same width:

```tsx
<div
	mix={[
		u.grid(),
		u.gridAutoFlow("column"),
		u.gridAutoColumns(64),
		u.gap(4),
		u.scroll("x"),
		u.scrollSnapType("x"),
	]}
>
	{cards}
</div>
```

#### `gridAutoFlow(value?: GridAutoFlowValue): UtilityMixin`

Applies `grid-auto-flow`, choosing the axis auto-placed items fill along and whether the dense packing mode is on. Defaults to `"row"`, the CSS default of filling each row before moving to the next. It needs `u.grid()` or `u.inlineGrid()` on the same element, and it governs only items the grid places automatically — an item positioned by `u.gridArea()`, `u.gridColumn()`, or `u.gridRow()` is placed where it was told regardless. Switching to `"column"` is what makes implicit _columns_ appear, so it usually travels with `u.gridAutoColumns()`; the default row flow pairs with `u.gridAutoRows()`.

`dense` changes packing rather than direction: the default sparse algorithm only ever moves forward, so an explicitly placed item that pushes past a few tracks leaves holes behind it, while `dense` goes back and backfills those earlier holes with any later item small enough to fit.

The real caveat is that backfilling decouples visual order from DOM order — an item rendered late can end up displayed early. Focus still follows the DOM, so for a keyboard user the tab order stops matching what they see on screen. Do not use `dense` where the grid items are interactive (links, buttons, form controls, anything focusable); keep it to purely presentational content such as an image or card mosaic.

**Parameters:**

- `value`: The `grid-auto-flow` value. Defaults to `"row"`.
  - `"row"` (the default) — auto-placed items fill each row before starting a new one, creating implicit rows
  - `"column"` — they fill each column first, creating implicit columns
  - `"dense"` — the packing mode alone, which leaves the axis at its `row` default
  - `"row dense"` — row flow with backfilling of earlier holes
  - `"column dense"` — column flow with backfilling of earlier holes

**Returns:**

- A `UtilityMixin` that sets `grid-auto-flow`

**CSS:**

```css
/* u.gridAutoFlow() */
.host {
	grid-auto-flow: row;
}

/* u.gridAutoFlow("column") */
.host {
	grid-auto-flow: column;
}

/* u.gridAutoFlow("row dense") */
.host {
	grid-auto-flow: row dense;
}

/* u.gridAutoFlow("column dense") */
.host {
	grid-auto-flow: column dense;
}
```

**Example:**

```typescript
let result = u.gridAutoFlow();
let columnResult = u.gridAutoFlow("column");
let denseResult = u.gridAutoFlow("row dense");
let denseColumnResult = u.gridAutoFlow("column dense");
```

A photo mosaic — non-interactive tiles, which is the one place `dense` is safe:

```tsx
<div
	mix={[
		u.grid(),
		u.gridTemplate({ columns: u.repeat("auto-fill", "minmax(8rem, 1fr)") }),
		u.gridAutoRows("8rem"),
		u.gridAutoFlow("row dense"),
		u.gap(2),
	]}
>
	{photos.map((photo) => (
		<img
			key={photo.id}
			mix={[photo.wide && u.gridColumn("span 2"), photo.tall && u.gridRow("span 2"), u.fit()]}
		/>
	))}
</div>
```

#### `gridAutoRows(value: SizeValue): UtilityMixin`

Applies `grid-auto-rows`, sizing the _implicit_ rows a grid creates for content that runs past the explicit tracks `u.gridTemplate()` declared. It has no effect on those explicit tracks — it only answers "how tall is row six when I only declared five?". It needs `u.grid()` or `u.inlineGrid()` on the same element, and it is the companion to the default `u.gridAutoFlow("row")`, where an unknown number of items keeps generating rows.

The value goes through the same resolution as `u.bs()` and friends: a number resolves against the spacing scale and `"full"` resolves to `100%`. The values implicit tracks most often want — `"auto"`, `"min-content"`, `"max-content"`, or a `minmax(...)` clause — are not lengths on a scale, so they take the raw-string escape and pass straight to CSS. `"minmax(6rem, auto)"` is the usual choice for a uniform floor that can still grow with its content.

**Parameters:**

- `value`: The track size for implicit rows. Required — no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`
  - `"full"` — resolved to `100%`
  - `"auto"` — passed through, sizing the track to its content
  - a raw CSS length (`"6rem"`, `"8vh"`) — passed through unchanged
  - any other string — the raw escape hatch, passed through unchanged: an intrinsic keyword (`"min-content"`, `"max-content"`, `"fit-content(20rem)"`), a `minmax(...)` clause, a flexible `fr` length, or a `var(...)` reference

**Returns:**

- A `UtilityMixin` that sets `grid-auto-rows` to the resolved length

**CSS:**

```css
/* u.gridAutoRows(24) */
.host {
	grid-auto-rows: calc(var(--ui-spacing, 0.25rem) * 24);
}

/* u.gridAutoRows("full") */
.host {
	grid-auto-rows: 100%;
}

/* u.gridAutoRows("minmax(6rem, auto)") */
.host {
	grid-auto-rows: minmax(6rem, auto);
}

/* u.gridAutoRows("min-content") */
.host {
	grid-auto-rows: min-content;
}
```

**Example:**

```typescript
let result = u.gridAutoRows(24);
let fullResult = u.gridAutoRows("full");
let rangeResult = u.gridAutoRows("minmax(6rem, auto)");
let intrinsicResult = u.gridAutoRows("min-content");
```

A card grid with one declared header row and however many implicit rows the data needs:

```tsx
<div
	mix={[
		u.grid(),
		u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(14rem, 1fr)"), rows: "auto" }),
		u.gridAutoRows("minmax(6rem, auto)"),
		u.gap(4),
	]}
>
	{cards}
</div>
```

#### `gridColumn(value: GridLineValue): UtilityMixin`

Applies `grid-column`, placing or spanning a grid item along the inline axis. `grid-column` is a shorthand for `grid-column-start` / `grid-column-end`, so a single value sets the start line and lets the end default to spanning one track, while a `"start / end"` string sets both at once. It goes on the item, not the container, and it resolves against the lines `u.gridTemplate({ columns })` declared on the parent (`u.gridArea()` is the named-area alternative when the parent declares `areas` instead).

**A bare number is a grid _line_ number, not a span count** — exactly as CSS reads it, and it is emitted as a bare number rather than a stringified one. `u.gridColumn(2)` starts the item at the second column line and occupies one track; `u.gridColumn("span 2")` leaves the start to auto-placement and occupies two tracks. This is the distinction that most often trips people up, and the utility deliberately does not reinterpret a number as a span. Negative numbers count back from the end, so `-1` is the last line.

Anything else is a raw string covering the full shorthand grammar, which is where the interesting placements live.

**Parameters:**

- `value`: The item's inline-axis placement. Required — no default, no validation.
  - a `number` — a grid **line number**, emitted unchanged (`2` stays the number `2`); negatives count back from the end (`-1` is the last line)
  - `` `span ${number}` `` — an explicit span of that many tracks, with the start left to auto-placement; this template-literal member exists so the span form autocompletes
  - any other string — the full shorthand, passed through unchanged: a start/end pair (`"1 / 3"`), a mixed span/line pair (`"span 2 / -1"`), or named grid lines (`"main-start / main-end"`)

**Returns:**

- A `UtilityMixin` that sets `grid-column`

**CSS:**

```css
/* u.gridColumn(2) */
.host {
	grid-column: 2;
}

/* u.gridColumn(-1) */
.host {
	grid-column: -1;
}

/* u.gridColumn("span 2") */
.host {
	grid-column: span 2;
}

/* u.gridColumn("1 / 3") */
.host {
	grid-column: 1 / 3;
}

/* u.gridColumn("span 2 / -1") */
.host {
	grid-column: span 2 / -1;
}

/* u.gridColumn("main-start / main-end") */
.host {
	grid-column: main-start / main-end;
}
```

**Example:**

```typescript
let result = u.gridColumn(2);
let spanResult = u.gridColumn("span 2");
let pairResult = u.gridColumn("1 / 3");
let namedResult = u.gridColumn("main-start / main-end");
```

A full-width row inside a three-column form grid, spanning every track:

```tsx
<div mix={[u.grid(), u.gridTemplate({ columns: u.repeat(3, 1) }), u.gap(4)]}>
	<label mix={[u.vstack({ gap: 1 })]}>{firstName}</label>
	<label mix={[u.vstack({ gap: 1 })]}>{lastName}</label>
	<label mix={[u.vstack({ gap: 1 })]}>{suffix}</label>
	<label mix={[u.gridColumn("1 / -1"), u.vstack({ gap: 1 })]}>{notes}</label>
</div>
```

#### `gridRow(value: GridLineValue): UtilityMixin`

Applies `grid-row`, placing or spanning a grid item along the block axis — the block-axis counterpart to `u.gridColumn()`, sharing its `GridLineValue` type. `grid-row` is a shorthand for `grid-row-start` / `grid-row-end`, so a single value sets the start line and lets the end default to spanning one track, while a `"start / end"` string sets both. It goes on the item and resolves against the lines the parent's `u.gridTemplate({ rows })` declared, or against the implicit rows sized by `u.gridAutoRows()` when the placement runs past them.

**A bare number is a grid _line_ number, not a span count**, and it is emitted as a bare number rather than a stringified one. `u.gridRow(2)` starts the item at the second row line and occupies one track; `u.gridRow("span 3")` leaves the start to auto-placement and occupies three tracks. The utility deliberately does not reinterpret a number as a span. Negative numbers count back from the end, which makes `"1 / -1"` the idiom for an item that spans every row.

**Parameters:**

- `value`: The item's block-axis placement. Required — no default, no validation.
  - a `number` — a grid **line number**, emitted unchanged (`2` stays the number `2`); negatives count back from the end (`-1` is the last line)
  - `` `span ${number}` `` — an explicit span of that many tracks, with the start left to auto-placement; this template-literal member exists so the span form autocompletes
  - any other string — the full shorthand, passed through unchanged: a start/end pair (`"1 / -1"`), a mixed span/line pair (`"span 2 / -1"`), or named grid lines (`"header-start / header-end"`)

**Returns:**

- A `UtilityMixin` that sets `grid-row`

**CSS:**

```css
/* u.gridRow(2) */
.host {
	grid-row: 2;
}

/* u.gridRow(-1) */
.host {
	grid-row: -1;
}

/* u.gridRow("span 3") */
.host {
	grid-row: span 3;
}

/* u.gridRow("1 / -1") */
.host {
	grid-row: 1 / -1;
}

/* u.gridRow("header-start / header-end") */
.host {
	grid-row: header-start / header-end;
}
```

**Example:**

```typescript
let result = u.gridRow(2);
let spanResult = u.gridRow("span 3");
let fullResult = u.gridRow("1 / -1");
let namedResult = u.gridRow("header-start / header-end");
```

A sidebar that spans both declared rows while the header and main content each take one:

```tsx
<div
	mix={[
		u.grid(),
		u.gridTemplate({ columns: "16rem 1fr", rows: "auto 1fr" }),
		u.gap(4),
		u.minBs("full"),
	]}
>
	<aside mix={[u.gridRow("1 / -1"), u.vstack({ gap: 2 })]}>{nav}</aside>
	<header mix={[u.hstack({ gap: 4, align: "center" })]}>{toolbar}</header>
	<main mix={[u.gridColumn(2), u.overflow("auto")]}>{children}</main>
</div>
```

#### `gridTemplate(options?: GridTemplateOptions): UtilityMixin`

Applies `grid-template-columns`, `-rows`, and/or `-areas` from whichever option keys are given, leaving the others untouched — an omitted key emits no declaration at all, so a no-argument call produces an empty style tree rather than resetting anything. It needs `u.grid()` or `u.inlineGrid()` on the same element to have any effect, pairs with `u.gap()` for track spacing and with `u.gridArea()` on children for named placement, and composes with `u.repeat()` for the very common `repeat(count, track)` shape so a typo in "repeat" or a missing comma can't silently produce a track list the browser drops without complaint.

Every value is a raw CSS string passed straight through: grid tracks and named areas vary too continuously (fractional units, `repeat()`, `minmax()`, quoted area strings) for a named scale to usefully cover.

**Parameters:**

- `options`: Defaults to `{}` — every key is optional, and an omitted key emits nothing.
  - `options.columns`: A raw CSS track-list string for `grid-template-columns` (`"1fr 2fr"`, `"16rem 1fr"`, `u.repeat(3, 1)`). Omitted by default.
  - `options.rows`: A raw CSS track-list string for `grid-template-rows` (`"auto 1fr"`, `"repeat(2, minmax(0, 1fr))"`). Omitted by default.
  - `options.areas`: A raw CSS string for `grid-template-areas`, each row its own quoted string inside the value (`'"header header" "sidebar main"'`). Omitted by default.

**Returns:**

- A `UtilityMixin` applying the grid template properties for whichever keys were given.

**CSS:**

```css
/* u.gridTemplate() */
.host {
}

/* u.gridTemplate({ columns: "1fr 2fr", rows: "auto 1fr" }) */
.host {
	grid-template-columns: 1fr 2fr;
	grid-template-rows: auto 1fr;
}

/* u.gridTemplate({ areas: '"header header" "sidebar main"' }) */
.host {
	grid-template-areas: "header header" "sidebar main";
}

/* u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(140px, 1fr)") }) */
.host {
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
```

**Example:**

```typescript
let result = u.gridTemplate({ columns: "1fr 2fr", rows: "auto 1fr" });
let areasResult = u.gridTemplate({ areas: '"header header" "sidebar main"' });
let repeatedResult = u.gridTemplate({ columns: u.repeat(3, 1) });
let autoFitResult = u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(140px, 1fr)") });
```

```tsx
<ul
	mix={[
		u.grid(),
		u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(14rem, 1fr)") }),
		u.gap(4),
	]}
/>
```

#### `grow(value?: number | (string & {})): UtilityMixin`

Applies `flex-grow` — how much of a flex container's leftover space the host claims, relative to its siblings' growth factors. Defaults to `1`, the common case of a flexible item, such as a content area next to a fixed-size sidebar or icon, that should expand to fill whatever room is left. It only applies to a direct child of a flex container (`u.flex()`, `u.hstack()`, `u.vstack()`), and is ignored on a grid or block child.

It pairs with `u.shrink()` and `u.basis()`, which cover the other two components of the `flex` shorthand. `u.spacer()` sets that shorthand wholesale (`flex: 1 1 auto`), so it already includes a growth factor of `1` — combining the two on one element only invites a declaration-order question. A growing item can still overflow its container unless `u.minIs(0)`/`u.minBs(0)` relaxes the automatic minimum size flex items get.

**Parameters:**

- `value`: The growth factor, stringified straight into the declaration (`1` becomes `"1"`). Defaults to `1`.
  - a `number` — the growth factor; `0` opts the item out of growing entirely
  - any string — a raw CSS escape hatch, passed through unchanged (a `var(...)` reference or other computed value)

**Returns:**

- A `UtilityMixin` applying the `flex-grow` property.

**CSS:**

```css
/* u.grow() */
.host {
	flex-grow: 1;
}

/* u.grow(0) */
.host {
	flex-grow: 0;
}

/* u.grow(2) */
.host {
	flex-grow: 2;
}
```

**Example:**

```typescript
let result = u.grow();
let fixedResult = u.grow(0);
let weightedResult = u.grow(2);
let rawResult = u.grow(u.var("row-grow"));
```

```tsx
<header mix={[u.hstack({ gap: 4, align: "center" })]}>
	<img mix={[u.shrink(), u.circle()]} />
	<div mix={[u.grow(), u.minIs(0), u.truncate()]} />
</header>
```

#### `hidden(): UtilityMixin`

Sets `display: none`, removing the host from layout entirely. It reserves no space, is not rendered, and — importantly — is removed from the accessibility tree, so it is genuinely hidden from everyone rather than only visually.

That makes it the right choice for content that should not exist for the current state, and the _wrong_ choice for content that should be available to screen readers but not shown — use `u.visuallyHidden()` there. It also cannot be transitioned on its own, since `display` is a discrete property: pair it with `u.transitionBehavior("allow-discrete")` and `u.startingStyle()` to animate something in and out of `display: none`.

**Returns:**

- A `UtilityMixin` that sets `display: none`

**CSS:**

```css
/* u.hidden() */
.host {
	display: none;
}
```

**Example:**

```typescript
let result = u.hidden();
```

Responsive show/hide, and a print-only rule:

```tsx
<nav mix={[u.hidden(), u.at("md", u.flex())]}>{desktopNav}</nav>
<div mix={[u.media("print", u.hidden())]}>{interactiveControls}</div>
```

Compare `u.visibility("hidden")`, which keeps the element's box in layout, and `u.opacity(0)`, which keeps it interactive and announced.

#### `hstack(options?: StackOptions): UtilityMixin`

A horizontal flex stack — the most common layout primitive in the package. Composes `u.flex()` and `u.flexRow()` unconditionally, then, from whichever option keys are given, `u.gap()`, `u.items()`, and `u.justify()`.

Only the keys you pass are set, so `u.hstack()` with no options is just a flex row with default alignment. Because items in a row get `min-inline-size: auto`, a long child will refuse to shrink — pair it with `u.minIs(0)` on the child that should truncate.

**Parameters:**

- `options.gap`: Sets `gap` using the spacing scale or a raw CSS length, via `u.gap()`. Omitted keys leave `gap` unset.
- `options.align`: Sets `align-items` via `u.items()` — the cross-axis (block) alignment for a row.
  - `"start"` — children aligned to the block start
  - `"center"` — vertically centred, the usual choice for a toolbar
  - `"end"` — aligned to the block end
  - `"stretch"` — children fill the cross axis. CSS's default.
  - `"baseline"` — children aligned on their first text baseline, which is what keeps differently sized labels sitting on one line
- `options.justify`: Sets `justify-content` via `u.justify()` — the main-axis (inline) distribution. Accepts `"start"`, `"center"`, `"end"`, and the short `"between"`/`"around"`/`"evenly"` forms, aliased to their `space-*` equivalents.

**Returns:**

- A `UtilityMixin` that sets `display: flex`, `flex-direction: row`, and any styles from the given options

**CSS:**

```css
/* u.hstack({ gap: 4, align: "center", justify: "between" }) */
.host {
	display: flex;
	flex-direction: row;
	gap: calc(var(--ui-spacing, 0.25rem) * 4);
	align-items: center;
	justify-content: space-between;
}

/* u.hstack() */
.host {
	display: flex;
	flex-direction: row;
}
```

**Example:**

```typescript
let result = u.hstack({ gap: 4, align: "center", justify: "between" });
let bareResult = u.hstack();
let baselineResult = u.hstack({ gap: 2, align: "baseline" });
```

The row-with-a-truncating-child shape, which needs `minIs(0)` and `shrink(0)` to behave:

```tsx
<div mix={[u.hstack({ gap: 3, align: "center" }), u.p(3)]}>
	<img mix={[u.is(8), u.circle(), u.shrink(0), u.fit("cover")]} src={avatar} alt="" />
	<span mix={[u.spacer(), u.minIs(0), u.truncate()]}>{name}</span>
	<button mix={[u.shrink(0)]}>{action}</button>
</div>
```

#### `inline(): UtilityMixin`

Sets `display: inline`, making the host flow inside a line of text like a `<span>`. An inline box ignores width, height, and block-axis margins, and its padding does not affect line height — so if you need any of those, reach for `u.inlineBlock()`.

Its main use is turning a block element back into inline content.

**Returns:**

- A `UtilityMixin` that sets `display: inline`

**CSS:**

```css
/* u.inline() */
.host {
	display: inline;
}
```

**Example:**

```typescript
let result = u.inline();
```

```tsx
<p>
	Read the{" "}
	<a href={href} mix={[u.inline(), u.fg("brand"), u.textDecoration("underline")]}>
		documentation
	</a>{" "}
	first.
</p>
```

#### `inlineBlock(): UtilityMixin`

Sets `display: inline-block`, which flows with surrounding text like an inline box but respects width, height, and block-axis padding and margins like a block. That combination is what makes it the right choice for a badge, a chip, or an icon sitting inside a sentence.

Two quirks come with it: it sits on the text baseline, so it can leave descender space below its content, and whitespace between two inline-block siblings in the markup renders as a real gap. Reach for `u.inlineFlex()` when the element also needs to lay its own children out.

**Returns:**

- A `UtilityMixin` that sets `display: inline-block`

**CSS:**

```css
/* u.inlineBlock() */
.host {
	display: inline-block;
}
```

**Example:**

```typescript
let result = u.inlineBlock();
```

```tsx
<span
	mix={[
		u.inlineBlock(),
		u.surface("brand.tinted"),
		u.rounded("full"),
		u.pi(2),
		u.text("xs"),
		u.weight("medium"),
	]}
>
	{count}
</span>
```

#### `inlineFlex(): UtilityMixin`

Sets `display: inline-flex`, making the host a flex container that itself flows inline. Use it when an element needs to sit in a line of text _and_ lay its own children out along an axis — the usual case being a button or link with an icon beside its label.

It is the display value most inline controls actually want: `u.flex()` would make the button a block that fills its container's width.

**Returns:**

- A `UtilityMixin` that sets `display: inline-flex`

**CSS:**

```css
/* u.inlineFlex() */
.host {
	display: inline-flex;
}
```

**Example:**

```typescript
let result = u.inlineFlex();
```

An icon-and-label control that stays inline and sized to its content:

```tsx
<a
	href={href}
	mix={[
		u.inlineFlex(),
		u.items("center"),
		u.gap(2),
		u.rounded("md"),
		u.pb(2),
		u.pi(3),
		u.ring("brand"),
	]}
>
	<svg mix={[u.is(4), u.bs(4), u.fill("currentColor"), u.shrink(0)]} aria-hidden="true">
		<path d="..." />
	</svg>
	{label}
</a>
```

#### `inlineGrid(): UtilityMixin`

Sets `display: inline-grid`, making the host a grid container that flows inline rather than as a block. The inline counterpart to `u.grid()`, for a grid-laid-out element that should size to its content and sit within a line.

**Returns:**

- A `UtilityMixin` that sets `display: inline-grid`

**CSS:**

```css
/* u.inlineGrid() */
.host {
	display: inline-grid;
}
```

**Example:**

```typescript
let result = u.inlineGrid();
```

```tsx
<span
	mix={[u.inlineGrid(), u.gridTemplate({ columns: "auto auto" }), u.gap(1), u.items("baseline")]}
>
	<strong mix={[u.tabularNums()]}>{value}</strong>
	<span mix={[u.text("xs"), u.fg("neutral.muted")]}>{unit}</span>
</span>
```

#### `insBe(value: SpacingValue): UtilityMixin`

Applies `inset-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode. This is the logical half of the pair and the default choice, for the same reason `u.m()`/`u.p()` map onto logical directions: a logical inset flips with the writing mode and direction, so one call keeps a positioned overlay pinned to the same _reading_ edge in `ltr`, `rtl`, and vertical writing modes — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values). Reach for the physical `u.insBottom()` only when the offset is genuinely tied to the bottom of the screen.

Like every inset, it needs a positioned host: pair it with `u.absolute()`, `u.fixed()`, or `u.sticky()` (with `u.relative()` it shifts the element from its in-flow spot), and on a `position: static` element it does nothing. `u.inset()` writes the `inset`/`insetBlock`/`insetInline` shorthands that also cover this edge, and `u.insBottom()` maps to the same physical edge in a horizontal writing mode, so combining any of them on one element comes down to declaration order.

**Parameters:**

- `value`: The offset from the block-end edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negative numbers are fine and pull the element past the edge
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"100%"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)
  - unlike the physical `u.insBottom()`, this takes a spacing value rather than a size value, so `"full"` is _not_ resolved to `100%` — it would be emitted verbatim as an invalid length

**Returns:**

- A `UtilityMixin` applying the `inset-block-end` property.

**CSS:**

```css
/* u.insBe(4) */
.host {
	inset-block-end: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insBe("auto") */
.host {
	inset-block-end: auto;
}

/* u.insBe("13px") */
.host {
	inset-block-end: 13px;
}
```

**Example:**

```typescript
let result = u.insBe(4);
let autoResult = u.insBe("auto");
let rawResult = u.insBe("13px");
```

```tsx
<div mix={[u.relative()]}>
	<span mix={[u.absolute(), u.insBe(2), u.insIe(2)]} />
</div>
```

#### `insBottom(value: SizeValue): UtilityMixin`

Applies the physical `bottom` property. The inset family is logical-first (`u.insBs()`, `u.insBe()`, `u.insIs()`, `u.insIe()`) precisely because a logical inset follows the writing mode; this utility is a deliberate, narrow exception for an offset tied to a genuinely physical, fixed side — an anchor-positioned surface such as a popover offsetting itself from whichever physical side of its anchor it popped out on, rather than from a logical reading edge. Prefer `u.insBe()` (`inset-block-end`) otherwise.

It needs a positioned host (`u.absolute()`, `u.fixed()`, `u.sticky()`, or `u.relative()`) and does nothing on a static element. In a horizontal writing mode it targets the same edge as `u.insBe()` and is covered by `u.inset()`'s shorthands, so combining them on one element comes down to declaration order.

**Parameters:**

- `value`: The offset from the physical bottom edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - `"full"` — resolved to `100%`
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)

**Returns:**

- A `UtilityMixin` applying the physical `bottom` property.

**CSS:**

```css
/* u.insBottom(4) */
.host {
	bottom: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insBottom("auto") */
.host {
	bottom: auto;
}

/* u.insBottom("full") */
.host {
	bottom: 100%;
}

/* u.insBottom("13px") */
.host {
	bottom: 13px;
}
```

**Example:**

```typescript
let result = u.insBottom(4);
let autoResult = u.insBottom("auto");
let fullResult = u.insBottom("full");
let rawResult = u.insBottom("13px");
```

```tsx
<div mix={[u.fixed(), u.insBottom(4), u.insRight(4), u.z(1)]} />
```

#### `insBs(value: SpacingValue): UtilityMixin`

Applies `inset-block-start` — the leading block edge, the top edge in a horizontal writing mode. The logical half of the pair, and the default choice for the same reason `u.m()`/`u.p()` map onto logical directions: the offset follows the writing mode instead of being baked to one physical side — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values). Reach for the physical `u.insTop()` only when the offset is genuinely tied to the top of the screen.

It needs a positioned host: with `u.sticky()` it sets the offset the element sticks at (the single most common use), with `u.absolute()`/`u.fixed()` the offset from the containing block's block-start edge, and on a static element it does nothing. `u.inset()` writes shorthands covering the same edge, and `u.insTop()` maps to the same physical edge in a horizontal writing mode, so declaration order decides when they are combined.

**Parameters:**

- `value`: The offset from the block-start edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"100%"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)
  - unlike the physical `u.insTop()`, this takes a spacing value rather than a size value, so `"full"` is _not_ resolved to `100%` — it would be emitted verbatim as an invalid length

**Returns:**

- A `UtilityMixin` applying the `inset-block-start` property.

**CSS:**

```css
/* u.insBs(4) */
.host {
	inset-block-start: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insBs(0) */
.host {
	inset-block-start: calc(var(--ui-spacing, 0.25rem) * 0);
}

/* u.insBs("13px") */
.host {
	inset-block-start: 13px;
}
```

**Example:**

```typescript
let result = u.insBs(4);
let autoResult = u.insBs("auto");
let rawResult = u.insBs("13px");
```

```tsx
<thead mix={[u.sticky(), u.insBs("0px"), u.bg("neutral.tint"), u.z(1)]} />
```

#### `inset(...values: SpacingValue[]): UtilityMixin`

Applies a logical `inset` shorthand using the spacing scale or a raw CSS length, mirroring the 1/2/4-value box shorthand `u.p()` and `u.m()` use. One value applies all four sides; two values map to block then inline; four values map to block-start, inline-end, block-end, and inline-start — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

Insets only apply to a positioned element, so pair it with `u.absolute()`, `u.fixed()`, or `u.sticky()`. Setting opposite insets together (as `u.inset(0)` does) stretches the element to its containing block rather than just placing one edge — which is exactly how a full-cover overlay is built.

Reach for the individual `u.ins*` utilities when only one or two edges are involved.

**Parameters:**

- `values`: One, two, or four spacing values. Any other count **throws** `@pkg/u: expected 1, 2, or 4 values`. Each value is:
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`. Negative values place the edge outside the containing block.
  - `"auto"` — passed through, which leaves that edge to be determined by the element's size and the opposite inset
  - a raw CSS length (`"1rem"`, `"50%"`) — passed through unchanged

**Returns:**

- A `UtilityMixin` that sets the resolved logical inset properties

**CSS:**

```css
/* u.inset(0) */
.host {
	inset: calc(var(--ui-spacing, 0.25rem) * 0);
}

/* u.inset(0, "auto") */
.host {
	inset-block: calc(var(--ui-spacing, 0.25rem) * 0);
	inset-inline: auto;
}

/* u.inset(1, 2, 3, 4) */
.host {
	inset-block-start: calc(var(--ui-spacing, 0.25rem) * 1);
	inset-inline-end: calc(var(--ui-spacing, 0.25rem) * 2);
	inset-block-end: calc(var(--ui-spacing, 0.25rem) * 3);
	inset-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.inset(0);
let axesResult = u.inset(0, "auto");
let sidesResult = u.inset(1, 2, 3, 4);
```

The full-cover overlay, which works because opposite insets stretch the box:

```tsx
<div mix={[u.relative()]}>
	{children}
	<div
		mix={[
			u.absolute(),
			u.inset(0),
			u.center(),
			u.bg(u.colorMix("oklab", { color: "currentcolor", weight: 8 }, "transparent")),
		]}
	>
		{spinner}
	</div>
</div>
```

#### `insIe(value: SpacingValue): UtilityMixin`

Applies `inset-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`. The logical half of the pair, and the default choice: pinning a badge, dismiss button, or dropdown to the trailing edge this way needs no separate `rtl` override, because the property mirrors itself — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values). Reach for the physical `u.insRight()` only when the offset is genuinely tied to the right of the screen.

It needs a positioned host (`u.absolute()`, `u.fixed()`, `u.sticky()`, or `u.relative()`) and does nothing on a static element. `u.inset()`'s shorthands cover the same edge, and `u.insRight()` maps to it in `ltr`, so declaration order decides when they are combined.

**Parameters:**

- `value`: The offset from the inline-end edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"100%"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)
  - unlike the physical `u.insRight()`, this takes a spacing value rather than a size value, so `"full"` is _not_ resolved to `100%` — it would be emitted verbatim as an invalid length

**Returns:**

- A `UtilityMixin` applying the `inset-inline-end` property.

**CSS:**

```css
/* u.insIe(4) */
.host {
	inset-inline-end: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insIe("auto") */
.host {
	inset-inline-end: auto;
}

/* u.insIe("13px") */
.host {
	inset-inline-end: 13px;
}
```

**Example:**

```typescript
let result = u.insIe(4);
let autoResult = u.insIe("auto");
let rawResult = u.insIe("13px");
```

```tsx
<button mix={[u.absolute(), u.insBs(2), u.insIe(2), u.circle()]} />
```

#### `insIs(value: SpacingValue): UtilityMixin`

Applies `inset-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`. The logical half of the pair, and the default choice: the offset mirrors itself under `rtl` instead of needing a direction-specific override — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values). Reach for the physical `u.insLeft()` only when the offset is genuinely tied to the left of the screen.

It needs a positioned host (`u.absolute()`, `u.fixed()`, `u.sticky()`, or `u.relative()`) and does nothing on a static element. Setting it together with `u.insIe()` and no explicit size stretches the element across the inline axis, which is often what a full-width overlay wants. `u.inset()`'s shorthands cover the same edge, and `u.insLeft()` maps to it in `ltr`, so declaration order decides when they are combined.

**Parameters:**

- `value`: The offset from the inline-start edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"100%"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)
  - unlike the physical `u.insLeft()`, this takes a spacing value rather than a size value, so `"full"` is _not_ resolved to `100%` — it would be emitted verbatim as an invalid length

**Returns:**

- A `UtilityMixin` applying the `inset-inline-start` property.

**CSS:**

```css
/* u.insIs(4) */
.host {
	inset-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insIs("auto") */
.host {
	inset-inline-start: auto;
}

/* u.insIs("13px") */
.host {
	inset-inline-start: 13px;
}
```

**Example:**

```typescript
let result = u.insIs(4);
let autoResult = u.insIs("auto");
let rawResult = u.insIs("13px");
```

```tsx
<div mix={[u.relative()]}>
	<div mix={[u.absolute(), u.insBe("0px"), u.insIs("0px"), u.insIe("0px"), u.bs("2px")]} />
</div>
```

#### `insLeft(value: SizeValue): UtilityMixin`

Applies the physical `left` property. The inset family is logical-first (`u.insBs()`, `u.insBe()`, `u.insIs()`, `u.insIe()`) so offsets mirror under `rtl` on their own; this utility is a deliberate, narrow exception for an offset tied to a genuinely physical, fixed side — an anchor-positioned surface such as a popover offsetting itself from whichever physical side of its anchor it popped out on, rather than from a logical reading edge. Prefer `u.insIs()` (`inset-inline-start`) otherwise, since a physical `left` will not flip in `rtl` and has to be overridden by hand there.

It needs a positioned host (`u.absolute()`, `u.fixed()`, `u.sticky()`, or `u.relative()`) and does nothing on a static element. In `ltr` it targets the same edge as `u.insIs()` and is covered by `u.inset()`'s shorthands, so declaration order decides when they are combined.

**Parameters:**

- `value`: The offset from the physical left edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - `"full"` — resolved to `100%`
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)

**Returns:**

- A `UtilityMixin` applying the physical `left` property.

**CSS:**

```css
/* u.insLeft(4) */
.host {
	left: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insLeft("auto") */
.host {
	left: auto;
}

/* u.insLeft("full") */
.host {
	left: 100%;
}

/* u.insLeft("13px") */
.host {
	left: 13px;
}
```

**Example:**

```typescript
let result = u.insLeft(4);
let autoResult = u.insLeft("auto");
let fullResult = u.insLeft("full");
let rawResult = u.insLeft("13px");
```

```tsx
<div mix={[u.absolute(), u.insLeft("full"), u.insTop("0px")]} />
```

#### `insRight(value: SizeValue): UtilityMixin`

Applies the physical `right` property. The inset family is logical-first (`u.insBs()`, `u.insBe()`, `u.insIs()`, `u.insIe()`) so offsets mirror under `rtl` on their own; this utility is a deliberate, narrow exception for an offset tied to a genuinely physical, fixed side — an anchor-positioned surface such as a popover offsetting itself from whichever physical side of its anchor it popped out on, rather than from a logical reading edge. Prefer `u.insIe()` (`inset-inline-end`) otherwise, since a physical `right` will not flip in `rtl` and has to be overridden by hand there.

It needs a positioned host (`u.absolute()`, `u.fixed()`, `u.sticky()`, or `u.relative()`) and does nothing on a static element. In `ltr` it targets the same edge as `u.insIe()` and is covered by `u.inset()`'s shorthands, so declaration order decides when they are combined.

**Parameters:**

- `value`: The offset from the physical right edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - `"full"` — resolved to `100%`
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)

**Returns:**

- A `UtilityMixin` applying the physical `right` property.

**CSS:**

```css
/* u.insRight(4) */
.host {
	right: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insRight("auto") */
.host {
	right: auto;
}

/* u.insRight("full") */
.host {
	right: 100%;
}

/* u.insRight("13px") */
.host {
	right: 13px;
}
```

**Example:**

```typescript
let result = u.insRight(4);
let autoResult = u.insRight("auto");
let fullResult = u.insRight("full");
let rawResult = u.insRight("13px");
```

```tsx
<div mix={[u.fixed(), u.insRight(4), u.insBottom(4), u.shadow("lg")]} />
```

#### `insTop(value: SizeValue): UtilityMixin`

Applies the physical `top` property. The inset family is logical-first (`u.insBs()`, `u.insBe()`, `u.insIs()`, `u.insIe()`) because a logical inset follows the writing mode; this utility is a deliberate, narrow exception for an offset tied to a genuinely physical, fixed side — an anchor-positioned surface such as a popover offsetting itself from whichever physical side of its anchor it popped out on, rather than from a logical reading edge. Prefer `u.insBs()` (`inset-block-start`) otherwise.

It needs a positioned host (`u.absolute()`, `u.fixed()`, `u.sticky()`, or `u.relative()`) and does nothing on a static element. In a horizontal writing mode it targets the same edge as `u.insBs()` and is covered by `u.inset()`'s shorthands, so declaration order decides when they are combined.

**Parameters:**

- `value`: The offset from the physical top edge. Required — there is no default.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; negatives allowed
  - `"auto"` — passes through, letting the edge be resolved from the element's size and the opposite inset
  - `"full"` — resolved to `100%`
  - any other string — a raw CSS escape hatch, passed through unchanged (`"13px"`, `"calc(100% + 2px)"`, an `anchor(...)` reference)

**Returns:**

- A `UtilityMixin` applying the physical `top` property.

**CSS:**

```css
/* u.insTop(4) */
.host {
	top: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.insTop("auto") */
.host {
	top: auto;
}

/* u.insTop("full") */
.host {
	top: 100%;
}

/* u.insTop("13px") */
.host {
	top: 13px;
}
```

**Example:**

```typescript
let result = u.insTop(4);
let autoResult = u.insTop("auto");
let fullResult = u.insTop("full");
let rawResult = u.insTop("13px");
```

```tsx
<div mix={[u.absolute(), u.insTop("full"), u.insLeft("0px"), u.mbs(2)]} />
```

#### `interpolateSize(value?: InterpolateSizeValue): UtilityMixin`

Opts the element into animating to and from _keyword_ sizes — `auto`, `min-content`, `max-content`, `fit-content` — instead of only numeric lengths. Without it, a transition to `height: auto` (or `block-size: auto`) jumps instantly, because there is no interpolatable value on one end.

This is what makes a natural accordion or disclosure animation possible without measuring anything in JavaScript. It is inherited, so setting it once high in the tree opts in the whole subtree; a `<details>` element also needs `u.detailsContent()` to reach the collapsible region, and `u.transitionBehavior("allow-discrete")` for the `content-visibility` change.

**Parameters:**

- `value`: An `InterpolateSizeValue`. Defaults to `"allow-keywords"`.
  - `"allow-keywords"` — keyword sizes become interpolatable, so transitions and animations to `auto` work. The default.
  - `"numeric-only"` — CSS's default behavior, for opting a subtree back out

**Returns:**

- A `UtilityMixin` that sets `interpolate-size`

**CSS:**

```css
/* u.interpolateSize() */
.host {
	interpolate-size: allow-keywords;
}

/* u.interpolateSize("numeric-only") */
.host {
	interpolate-size: numeric-only;
}
```

**Example:**

```typescript
let result = u.interpolateSize();
let optOutResult = u.interpolateSize("numeric-only");
```

The animated disclosure it exists for:

```tsx
<details
	mix={[
		u.interpolateSize(),
		u.detailsContent([
			u.bs(0),
			u.overflow("clip"),
			u.transition("block-size, content-visibility"),
			u.transitionBehavior("allow-discrete"),
		]),
		u.when("&[open]::details-content", u.bs("auto")),
	]}
>
	<summary>{summary}</summary>
	{children}
</details>
```

#### `items(value?: AlignItemsValue): UtilityMixin`

Sets `align-items`, aligning the host's children along the cross axis — the block axis in a row, the inline axis in a column.

It is the single most useful alignment utility, since `"center"` is what vertically centres a row's contents. In a grid container it aligns each item within its row track.

**Parameters:**

- `value`: The alignment keyword. Defaults to `"stretch"`.
  - `"start"` — children aligned to the cross-axis start
  - `"center"` — children centred on the cross axis
  - `"end"` — children aligned to the cross-axis end
  - `"stretch"` — children fill the cross axis. CSS's default, and why an unaligned row's children all match the tallest one's height.
  - `"baseline"` — children aligned on their first text baselines, which keeps text of different sizes sitting on one line rather than centred against each other

**Returns:**

- A `UtilityMixin` that sets `align-items`

**CSS:**

```css
/* u.items("center") */
.host {
	align-items: center;
}

/* u.items("baseline") */
.host {
	align-items: baseline;
}
```

**Example:**

```typescript
let result = u.items();
let centerResult = u.items("center");
let baselineResult = u.items("baseline");
```

`baseline` is the right answer more often than `center` when the children are text of differing sizes:

```tsx
<div mix={[u.hstack({ gap: 2 }), u.items("baseline")]}>
	<span mix={[u.text("3xl"), u.weight("bold"), u.tabularNums()]}>{value}</span>
	<span mix={[u.text("sm"), u.fg("neutral.muted")]}>{unit}</span>
</div>
```

`u.hstack()`/`u.vstack()` take an `align` option that composes this, and `u.self()` overrides it for one child.

#### `justify(value?: JustifyValue): UtilityMixin`

Sets `justify-content`, distributing the host's children along the main axis — the inline axis in a row, the block axis in a column. The short `between`/`around`/`evenly` forms are aliased to their `space-*` CSS equivalents.

The distribution keywords only do something when there is free space to distribute, so a container whose children already fill it will look unchanged. In a column, remember this controls the _block_ axis.

**Parameters:**

- `value`: The distribution keyword. Defaults to `"start"`.
  - `"start"` — children packed to the main-axis start. The default.
  - `"center"` — children packed to the centre
  - `"end"` — children packed to the main-axis end
  - `"between"` — aliased to `space-between`: first child flush to the start, last to the end, equal gaps between. The standard header layout.
  - `"around"` — aliased to `space-around`: equal space around each child, so the edge gaps are half the inner ones
  - `"evenly"` — aliased to `space-evenly`: every gap equal, edges included

**Returns:**

- A `UtilityMixin` that sets `justify-content`

**CSS:**

```css
/* u.justify("between") */
.host {
	justify-content: space-between;
}

/* u.justify("center") */
.host {
	justify-content: center;
}
```

**Example:**

```typescript
let result = u.justify();
let betweenResult = u.justify("between");
let centerResult = u.justify("center");
let evenlyResult = u.justify("evenly");
```

```tsx
<header mix={[u.hstack({ align: "center", justify: "between" }), u.pi(4), u.pb(3)]}>
	<span mix={[u.weight("semibold")]}>{title}</span>
	<nav mix={[u.hstack({ gap: 3 })]}>{links}</nav>
</header>
```

Reach for `u.spacer()` or a `u.mis("auto")` on one child when only _some_ of the children should be pushed apart, rather than distributing all of them.

#### `place(options?: PlaceOptions): UtilityMixin`

Sets item and/or content placement on both axes at once, from whichever option keys are given. It composes `u.items()` for `align-items` and `u.content()`/`u.justify()` for `align-content`/`justify-content`; `justify-items` has no dedicated utility of its own, so it is set directly alongside `u.items()`.

The point is symmetry — `u.place({ items: "center" })` centres on both axes in a grid, which otherwise takes two calls. It is most useful on a grid container; `justify-items` has no effect in flex layout, so on a flex container the `items` key effectively just sets `align-items`.

**Parameters:**

- `options.items`: Sets `align-items` and `justify-items` together, positioning each item within its own grid cell. Accepts `"start"`, `"center"`, `"end"`, `"stretch"`, or `"baseline"`.
- `options.content`: Sets `align-content` and `justify-content` together, distributing the tracks within the container. Accepts `"start"`, `"center"`, `"end"`, and the short `"between"`/`"around"`/`"evenly"` forms, aliased to their `space-*` equivalents.

Omitting a key leaves those properties entirely untouched.

**Returns:**

- A `UtilityMixin` that sets the resolved alignment and content properties

**CSS:**

```css
/* u.place({ items: "center" }) */
.host {
	align-items: center;
	justify-items: center;
}

/* u.place({ items: "center", content: "between" }) */
.host {
	align-items: center;
	justify-items: center;
	align-content: space-between;
	justify-content: space-between;
}
```

**Example:**

```typescript
let result = u.place({ items: "center" });
let bothResult = u.place({ items: "center", content: "between" });
let contentResult = u.place({ content: "evenly" });
```

Centring a single child on both axes in a grid, which needs no flex container at all:

```tsx
<div mix={[u.grid(), u.place({ items: "center" }), u.minBs("100dvh")]}>{children}</div>
```

#### `positionAnchor(name: string): UtilityMixin`

Applies the CSS Anchor Positioning `position-anchor` property, pointing the host at the anchor it should be positioned against. This is the _querying_ half of anchor positioning — it goes on the absolutely positioned element (the tooltip, the popover, the menu), and the name it references is the one `u.anchorName()` declared on the element being anchored to.

The host needs `position: absolute` or `position: fixed` for this to do anything at all, so it always travels with `u.absolute()` or `u.fixed()`. Once both halves are in place, this is the anchor `u.positionArea()` resolves its placement against, and the one `u.positionTryFallbacks()` re-resolves against when the preferred placement would overflow. Without it, a `u.positionArea()` on the same element has no grid to place into and the declaration does nothing — the usual reason an anchored surface appears at the corner of its containing block instead of next to its trigger.

The leading `--` is omitted from `name` and added for you, matching `u.anchorName()` on the other side and the convention `u.vars()`/`u.var()` already use: `u.positionAnchor("tooltip")` emits `position-anchor: --tooltip`.

**Parameters:**

- `name`: The anchor name to reference, written **without** the leading `--`, and matching the name given to `u.anchorName()`. Required, emitted verbatim after the prefix — no validation, no defaults.

**Returns:**

- A `UtilityMixin` that sets `position-anchor` to `--{name}`

**CSS:**

```css
/* u.positionAnchor("tooltip-trigger") */
.host {
	position-anchor: --tooltip-trigger;
}

/* u.positionAnchor("trigger") */
.host {
	position-anchor: --trigger;
}
```

**Example:**

```typescript
let result = u.positionAnchor("tooltip-trigger");
let shortResult = u.positionAnchor("trigger");
```

The complete anchored menu — declaring half on the trigger, querying half plus `u.absolute()` on the surface:

```tsx
<div>
	<button mix={[u.anchorName("menu-button")]}>{label}</button>
	<div
		role="menu"
		mix={[
			u.absolute(),
			u.positionAnchor("menu-button"),
			u.positionArea("block-end span-inline-end"),
			u.positionTryFallbacks("flip-block", "flip-inline"),
			u.vstack({ gap: 1 }),
			u.p(1),
		]}
	>
		{items}
	</div>
</div>
```

#### `positionArea(value: string): UtilityMixin`

Applies the CSS Anchor Positioning `position-area` property, placing an absolutely or anchor-positioned element in a named region of the 3x3 grid around its anchor — the declarative alternative to computing a popover's offsets by hand. It requires the host to be out of flow (`u.absolute()` or `u.fixed()`) and tied to an anchor; with no anchor in effect there is no grid to place against and the declaration does nothing. Once a region is set, any `u.insBs()`/`u.insIs()`/... offsets are resolved inside that region rather than against the whole containing block, and `u.positionTryFallbacks()` is what keeps the surface on screen when the chosen region overflows.

Unlike `u.corner()`, this utility does not gate itself behind `@supports`; wrap it in `u.supports("position-area: top", ...)` when a fallback path matters, since an unsupported browser will drop the declaration and fall back to the element's plain inset positioning.

The parameter is kept as a loose `string` rather than an exhaustive union: the full logical-position-keyword grammar is large and not worth enumerating.

**Parameters:**

- `value`: A raw `position-area` value, emitted verbatim. Required — no default, no validation.
  - one or two region keywords — the physical set (`"top"`, `"bottom"`, `"left"`, `"right"`, `"center"`) or their logical equivalents (`"block-start"`, `"block-end"`, `"inline-start"`, `"inline-end"`, `"self-block-start"`, `"x-start"`, `"y-end"`, ...); two keywords name one row and one column, as in `"top left"`
  - a `span-*` form (`"span-left"`, `"span-inline-end"`, `"span-all"`) — widens the placement across more than one cell of the grid, as in `"bottom span-right"`

**Returns:**

- A `UtilityMixin` applying the `position-area` property.

**CSS:**

```css
/* u.positionArea("top left") */
.host {
	position-area: top left;
}

/* u.positionArea("bottom span-right") */
.host {
	position-area: bottom span-right;
}

/* u.supports("position-area: top", u.positionArea("block-end span-inline-end")) */
@supports (position-area: top) {
	.host {
		position-area: block-end span-inline-end;
	}
}
```

**Example:**

```typescript
let result = u.positionArea("top left");
let spanningResult = u.positionArea("bottom span-right");
let logicalResult = u.positionArea("block-end span-inline-end");
let gatedResult = u.supports("position-area: top", u.positionArea("top"));
```

```tsx
<div
	mix={[
		u.absolute(),
		u.positionArea("block-end span-inline-end"),
		u.positionTryFallbacks("flip-block"),
	]}
/>
```

#### `positionTryFallbacks(...values: string[]): UtilityMixin`

Applies the CSS Anchor Positioning `position-try-fallbacks` property, listing the fallback positions the browser tries in order when the element's preferred position would overflow its containing block — how an anchored surface flips to the other side of its anchor instead of being clipped at the viewport edge. It only does anything on an element that already has a preferred anchored position, so it pairs with `u.positionArea()` (or with insets written against `anchor(...)`); on its own it has nothing to fall back from.

**Parameters:**

- `values`: One or more fallback options, joined with `", "` in the order given — so argument order _is_ the order the browser tries them. Passing no arguments emits an empty value rather than throwing, and passing one emits it with no comma.
  - `"flip-block"` — retries the position mirrored across the anchor's block axis
  - `"flip-inline"` — retries it mirrored across the inline axis
  - `"flip-start"` — retries it with the block and inline axes swapped
  - a `--dashed-ident` (`"--custom-fallback"`) — a named `@position-try` rule's own set of overrides
  - any other string — a raw CSS escape hatch, passed through unchanged (a `position-area(...)` form, for instance)

**Returns:**

- A `UtilityMixin` applying the `position-try-fallbacks` property.

**CSS:**

```css
/* u.positionTryFallbacks("flip-block") */
.host {
	position-try-fallbacks: flip-block;
}

/* u.positionTryFallbacks("flip-block", "flip-inline") */
.host {
	position-try-fallbacks: flip-block, flip-inline;
}

/* u.positionTryFallbacks("--custom-fallback") */
.host {
	position-try-fallbacks: --custom-fallback;
}
```

**Example:**

```typescript
let result = u.positionTryFallbacks("flip-block");
let orderedResult = u.positionTryFallbacks("flip-block", "flip-inline");
let namedResult = u.positionTryFallbacks("--custom-fallback");
```

```tsx
<div
	mix={[
		u.absolute(),
		u.positionArea("block-end"),
		u.positionTryFallbacks("flip-block", "flip-inline"),
	]}
/>
```

#### `relative(): UtilityMixin`

Sets `position: relative`, which establishes a positioning context for absolutely positioned descendants without moving the element itself or taking it out of flow.

That containing-block role is almost always why you reach for it: it is the anchor half of the `u.relative()` + `u.absolute()` pair. It also enables `z-index` on the element, which has no effect on a statically positioned box — see `u.z()` and `u.layer()`.

**Returns:**

- A `UtilityMixin` that sets `position: relative`

**CSS:**

```css
/* u.relative() */
.host {
	position: relative;
}
```

**Example:**

```typescript
let result = u.relative();
```

The anchor for an absolutely placed overlay:

```tsx
<div mix={[u.relative(), u.rounded("lg"), u.clip()]}>
	<img mix={[u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
	<div
		mix={[
			u.absolute(),
			u.insBe(0),
			u.insIs(0),
			u.insIe(0),
			u.p(3),
			u.bg(u.linearGradient("to top", "rgb(0 0 0 / 0.7)", "transparent")),
		]}
	>
		{caption}
	</div>
</div>
```

It conflicts with the other position utilities on the same element.

#### `repeat(count: RepeatCount, track: RepeatTrack): string`

Builds a `repeat(...)` track-list value string for `u.gridTemplate()`'s `columns`/`rows` options, or any other `grid-template-columns`/`-rows` use. A plain string resolver, not a mixin — it exists so a mistyped keyword or a missing comma can't silently produce an invalid track list that CSS then drops without complaint. Because it returns a string, it goes _inside_ a `u.gridTemplate()` option rather than into a `mix` array.

**Parameters:**

- `count`: How many tracks to generate. Required.
  - a `number` — that many explicit tracks
  - `"auto-fill"` — as many tracks as fit, keeping empty ones, so the track pattern stays visible with few items
  - `"auto-fit"` — as many tracks as fit, then collapsing the empty ones so the remaining items stretch to fill the row
- `track`: The repeated track size. Required.
  - a `number` — resolved to that many `fr` units (`1` becomes `1fr`, `0.5` becomes `0.5fr`), the overwhelmingly common even fractional split
  - any string — a raw CSS escape hatch, passed through unchanged: a length (`"140px"`), a nested `minmax(...)` clause (`"minmax(140px, 1fr)"`, `"minmax(min(100%, 12rem), 1fr)"`), or an already-suffixed `"1fr"`; track sizing otherwise varies too continuously for a named scale to usefully cover

**Returns:**

- The resolved `repeat(...)` track-list string.

**CSS:**

```css
/* u.gridTemplate({ columns: u.repeat(3, 1) }) */
.host {
	grid-template-columns: repeat(3, 1fr);
}

/* u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(140px, 1fr)") }) */
.host {
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
```

**Example:**

```typescript
let result = u.repeat(3, 1);
// "repeat(3, 1fr)"
let fractionalResult = u.repeat(2, 0.5);
// "repeat(2, 0.5fr)"
let minmaxResult = u.repeat(2, "minmax(0, 1fr)");
// "repeat(2, minmax(0, 1fr))"
let autoFitResult = u.repeat("auto-fit", "minmax(140px, 1fr)");
// "repeat(auto-fit, minmax(140px, 1fr))"
let autoFillResult = u.repeat("auto-fill", "minmax(min(100%, 12rem), 1fr)");
// "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))"
```

```tsx
<ul
	mix={[
		u.grid(),
		u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(14rem, 1fr)") }),
		u.gap(4),
	]}
/>
```

#### `resize(value?: ResizeValue): UtilityMixin`

Applies `resize`, controlling which axes a user can drag the element's resize handle along. Defaults to `"block"` — the shape a textarea almost always wants (taller when the value outgrows the box, never wider than the form column), expressed logically so it follows the writing mode.

`"block"` and `"inline"` are the logical forms and the default, matching every other logical utility here. `"horizontal"` and `"vertical"` are the physical exception, worth reaching for only when the direction genuinely must not flip with the writing mode — they are also the wider-support pair, so a control that must stay resizable on very old engines needs the physical form spelled out.

`resize` only applies to an element whose `overflow` is something other than `visible`. That is why it works on a `<textarea>` with no extra setup — a textarea is already a scroll container — but needs `u.overflow()` (or one of its axis variants, `u.overflowBlock()`/`u.overflowInline()`) alongside it to do anything on a plain `<div>`.

`"none"` takes away an affordance the platform provided and a user may be relying on: someone with a long answer to type, or a large font size, resizes a textarea because the default box is too small for them. Removing it should be a deliberate decision about a specific control — often because `u.fieldSizing()` now grows the control automatically — not a blanket reset.

**Parameters:**

- `value`: The `resize` keyword. Defaults to `"block"`.
  - `"vertical"` — resizable in the physical vertical direction only, regardless of writing mode
  - `"horizontal"` — resizable in the physical horizontal direction only
  - `"block"` (the default) — the logical form of vertical: resizable along the block axis, following the writing mode
  - `"inline"` — the logical form of horizontal: resizable along the inline axis, following the writing mode
  - `"both"` — resizable on both axes
  - `"none"` — no resize affordance at all; removes a native control the user may depend on, so use it deliberately

**Returns:**

- A `UtilityMixin` that sets `resize`

**CSS:**

```css
/* u.resize() */
.host {
	resize: block;
}

/* u.resize("vertical") */
.host {
	resize: vertical;
}

/* u.resize("both") */
.host {
	resize: both;
}

/* u.resize("none") */
.host {
	resize: none;
}
```

**Example:**

```typescript
let result = u.resize();
let physicalResult = u.resize("vertical");
let bothResult = u.resize("both");
let noneResult = u.resize("none");
```

A comment box that grows along the block axis, and a resizable panel that needs its own overflow before the handle appears:

```tsx
<textarea mix={[u.resize("block"), u.minBs("4lh"), u.is("full"), u.p(2)]} />
<div mix={[u.resize("both"), u.overflow("auto"), u.bs("12rem"), u.is("20rem"), u.p(3)]}>
	{preview}
</div>
```

#### `self(value?: AlignSelfValue): UtilityMixin`

Overrides the host's own cross-axis alignment within its parent flex or grid container, ignoring whatever `align-items` the parent set. Use it for the one child that should sit differently from its siblings.

It only works inside a flex or grid parent; on an ordinary block element it does nothing.

**Parameters:**

- `value`: The alignment keyword — the same set as `u.items()`, plus `"auto"`. Defaults to `"auto"`.
  - `"auto"` — defer to the parent's `align-items`. The default, and how to undo a `self()` set elsewhere.
  - `"start"` — aligned to the cross-axis start
  - `"center"` — centred on the cross axis
  - `"end"` — aligned to the cross-axis end
  - `"stretch"` — fills the cross axis
  - `"baseline"` — aligned on the first text baseline

**Returns:**

- A `UtilityMixin` that sets `align-self`

**CSS:**

```css
/* u.self("center") */
.host {
	align-self: center;
}

/* u.self("end") */
.host {
	align-self: end;
}
```

**Example:**

```typescript
let result = u.self();
let centerResult = u.self("center");
let endResult = u.self("end");
```

One child opting out of the container's `stretch`:

```tsx
<div mix={[u.hstack({ gap: 3 })]}>
	<div mix={[u.spacer()]}>{body}</div>
	<button mix={[u.self("start"), u.shrink(0)]}>{dismiss}</button>
</div>
```

#### `shrink(value?: number | (string & {})): UtilityMixin`

Applies `flex-shrink` — how readily the host gives up size when a flex container's children don't fit. Defaults to `0` rather than CSS's own initial value of `1`, because the reason to reach for this utility at all is almost always the reverse case: a fixed-size flex item, an icon or avatar slot, that shouldn't collapse alongside flexible content next to it. It only applies to a direct child of a flex container (`u.flex()`, `u.hstack()`, `u.vstack()`), and is ignored on a grid or block child.

It pairs with `u.grow()` and `u.basis()`, the other two components of the `flex` shorthand, and `u.spacer()` sets that shorthand wholesale (`flex: 1 1 auto`), so combining the two on one element only invites a declaration-order question. On the flexible sibling _next_ to a `shrink(0)` item, `u.minIs(0)` is usually needed as well: a flex item's automatic minimum size otherwise keeps it from shrinking below its content, which is what makes `u.truncate()` appear not to work inside a row.

**Parameters:**

- `value`: The shrink factor, stringified straight into the declaration (`0` becomes `"0"`). Defaults to `0`.
  - a `number` — the shrink factor; `1` restores CSS's own shrinking behavior, larger numbers shrink faster than siblings
  - any string — a raw CSS escape hatch, passed through unchanged (a `var(...)` reference or other computed value)

**Returns:**

- A `UtilityMixin` applying the `flex-shrink` property.

**CSS:**

```css
/* u.shrink() */
.host {
	flex-shrink: 0;
}

/* u.shrink(1) */
.host {
	flex-shrink: 1;
}
```

**Example:**

```typescript
let result = u.shrink();
let flexibleResult = u.shrink(1);
let rawResult = u.shrink(u.var("row-shrink"));
```

```tsx
<li mix={[u.hstack({ gap: 3, align: "center" })]}>
	<svg mix={[u.shrink(), u.is(4), u.bs(4)]} />
	<span mix={[u.grow(), u.minIs(0), u.truncate()]} />
</li>
```

#### `spacer(): UtilityMixin`

A flexible spacer: it grows and shrinks to fill whatever room is left in a flex container, pushing the siblings on either side of it apart. Use it as an empty element to split a row into groups, or on a real child that should absorb the remaining space.

Two ways to do the same job: `u.spacer()` on an element, or `u.mis("auto")`/`u.mie("auto")` on the sibling that should be pushed. The auto-margin approach needs no extra element; the spacer reads more explicitly when a row splits into two clear groups.

Note that `flex: 1 1 auto` uses the element's content as its flex basis, so a spacer applied to a child with content will grow _from_ that content's size rather than from zero.

**Returns:**

- A `UtilityMixin` that sets `flex: 1 1 auto`

**CSS:**

```css
/* u.spacer() */
.host {
	flex: 1 1 auto;
}
```

**Example:**

```typescript
let result = u.spacer();
```

On a real child, absorbing the leftover space so the trailing action pins to the end:

```tsx
<div mix={[u.hstack({ gap: 2, align: "center" })]}>
	<span mix={[u.spacer(), u.minIs(0), u.truncate()]}>{title}</span>
	<button mix={[u.shrink(0)]}>{action}</button>
</div>
```

Because it sets the `flex` shorthand, it conflicts with `u.grow()`, `u.shrink()`, and `u.basis()` on the same element.

#### `sticky(): UtilityMixin`

Sets `position: sticky`, which leaves the element in normal flow — reserving its space — until it reaches a given scroll offset, at which point it pins like a fixed element within its scroll container.

It does nothing without an inset naming the edge to stick to: `u.insBs(0)` for a header, `u.insBe(0)` for a footer. Two further conditions catch people out. The element sticks only within its _parent_, so it unpins once the parent scrolls out of view — which is the mechanism behind sticky section headers, but a surprise if the parent is smaller than expected. And an `overflow` other than `visible` on any ancestor creates a new scroll container that the element sticks within instead, so a stray `u.overflow("hidden")` up the tree silently breaks it.

**Returns:**

- A `UtilityMixin` that sets `position: sticky`

**CSS:**

```css
/* u.sticky() */
.host {
	position: sticky;
}
```

**Example:**

```typescript
let result = u.sticky();
```

A sticky header needs the inset, a stacking layer so it paints above the content, and an opaque or translucent background so content doesn't show through:

```tsx
<header
	mix={[
		u.sticky(),
		u.insBs(0),
		u.layer(10),
		u.translucent(),
		u.pi(4),
		u.pb(3),
		u.borderEdge("block-end", { color: "neutral", width: 1 }),
	]}
>
	{nav}
</header>
```

#### `virtualize(intrinsicSize: string): UtilityMixin`

Applies the `content-visibility: auto` plus `contain-intrinsic-size` pair that lets the browser skip layout, style, and paint work for off-screen rows in a long scrollable list or table body. The two declarations belong together, which is why this is one utility and not two: `content-visibility: auto` alone leaves a skipped element with no size of its own, so the scroll height — and the scrollbar with it — jumps around as rows come into view; `contain-intrinsic-size` reserves a placeholder size that keeps it stable.

Apply it to the repeated rows, not to the scroll container, and pair it with `u.scroll()`/`u.overflow()` on that container. Unlike `u.hidden()`, skipped content stays in the accessibility tree and in-page search: the browser renders it on demand when it is scrolled to, focused, or found. The trade-off is containment — while a row is skipped it clips paint, so a child that visually escapes the row's box (a popover, a focus ring extending past its edge) gets cut off; keep it off rows whose content overflows on purpose.

**Parameters:**

- `intrinsicSize`: A raw `contain-intrinsic-size` value reserved as the skipped element's placeholder size, emitted verbatim. Required — no default and no scale resolution.
  - one length (`"2.5rem"`) — applies to both axes
  - two lengths (`"100% 2.5rem"`) — inline then block
  - a leading `auto` (`"auto 2.5rem"`) — the browser reuses the element's last actually-rendered size once it has one, falling back to the given length until then; this is the form to prefer for variable-height rows
  - `var(...)`/`calc(...)` references work, so the placeholder height can be a themable custom property with its own fallback

**Returns:**

- A `UtilityMixin` applying `content-visibility: auto` and the given `contain-intrinsic-size`.

**CSS:**

```css
/* u.virtualize("auto var(--ui-table-row-size, 2.5rem)") */
.host {
	content-visibility: auto;
	contain-intrinsic-size: auto var(--ui-table-row-size, 2.5rem);
}

/* u.virtualize("2.5rem") */
.host {
	content-visibility: auto;
	contain-intrinsic-size: 2.5rem;
}
```

**Example:**

```typescript
let result = u.virtualize("auto var(--ui-table-row-size, 2.5rem)");
let fixedResult = u.virtualize("2.5rem");
let axisResult = u.virtualize("100% 2.5rem");
```

```tsx
<div mix={[u.scroll("y"), u.bs("30rem")]}>
	{rows.map((row) => (
		<div key={row.id} mix={[u.virtualize("auto 2.5rem"), u.hstack({ gap: 4 })]} />
	))}
</div>
```

#### `vstack(options?: StackOptions): UtilityMixin`

A vertical flex stack. Composes `u.flex()` and `u.flexCol()` unconditionally, then, from whichever option keys are given, `u.gap()`, `u.items()`, and `u.justify()`.

Only the keys you pass are set. Remember that a column swaps the axes: `align` (`align-items`) now controls the inline axis and `justify` (`justify-content`) the block axis — so `justify: "between"` spreads children top to bottom, and `align: "center"` centres them horizontally.

**Parameters:**

- `options.gap`: Sets `gap` using the spacing scale or a raw CSS length, via `u.gap()`
- `options.align`: Sets `align-items` via `u.items()` — the _inline_-axis alignment in a column.
  - `"start"` — children aligned to the inline start, sizing to their content
  - `"center"` — children centred horizontally
  - `"end"` — children aligned to the inline end
  - `"stretch"` — children fill the inline axis. CSS's default.
  - `"baseline"` — rarely meaningful in a column
- `options.justify`: Sets `justify-content` via `u.justify()` — the _block_-axis distribution. Accepts `"start"`, `"center"`, `"end"`, and the short `"between"`/`"around"`/`"evenly"` forms. Only does something when the column has spare block-axis room.

**Returns:**

- A `UtilityMixin` that sets `display: flex`, `flex-direction: column`, and any styles from the given options

**CSS:**

```css
/* u.vstack({ gap: 4, align: "stretch" }) */
.host {
	display: flex;
	flex-direction: column;
	gap: calc(var(--ui-spacing, 0.25rem) * 4);
	align-items: stretch;
}

/* u.vstack() */
.host {
	display: flex;
	flex-direction: column;
}
```

**Example:**

```typescript
let result = u.vstack({ gap: 4 });
let bareResult = u.vstack();
let centeredResult = u.vstack({ gap: 2, align: "center" });
let spreadResult = u.vstack({ justify: "between" });
```

A full-height column with a scrolling middle — the `minBs(0)` is what lets the middle actually scroll:

```tsx
<div mix={[u.vstack(), u.bs("100dvh")]}>
	<header mix={[u.shrink(0), u.p(3)]}>{nav}</header>
	<main mix={[u.spacer(), u.minBs(0), u.scroll("y"), u.p(4)]}>{children}</main>
	<footer mix={[u.shrink(0), u.p(3)]}>{status}</footer>
</div>
```

#### `zstack(options?: ZStackOptions): UtilityMixin`

A grid-overlay stack for layering children directly on top of each other. Rather than pulling children out of flow with absolute positioning, it places every direct child in the same single grid cell via a nested `& > * { grid-area: 1 / 1 }` rule.

That difference is the whole point: overlapping children this way still participate in the grid's intrinsic sizing, so the host sizes to its largest child exactly as it would with one child present — whereas absolutely positioned children collapse the parent to zero size unless a height is set by hand. Reach for it whenever you'd otherwise write `u.relative()` plus `u.absolute()` and then have to invent a height.

Composes `u.grid()` and, when given, `u.items()` for `align-items`; `justify-items` has no dedicated utility of its own, so it is set directly. Note the nested child rule targets _direct_ children only, and applies to all of them.

**Parameters:**

- `options.align`: Sets `align-items`, positioning each layer within the shared cell on the block axis. Accepts `"start"`, `"center"`, `"end"`, `"stretch"` (the default), or `"baseline"`.
- `options.justify`: Sets `justify-items`, the same on the inline axis. Takes the same self-alignment keywords as `align` — **not** `u.justify()`'s `"between"`/`"around"`/`"evenly"` distribution keywords, which are invalid for `justify-items` since it positions an item within its own cell rather than distributing space along a track.

**Returns:**

- A `UtilityMixin` that sets `display: grid`, any given alignment options, and a nested rule stacking every direct child into the same grid area

**CSS:**

```css
/* u.zstack({ align: "center", justify: "center" }) */
.host {
	display: grid;
	align-items: center;
	justify-items: center;
	& > * {
		grid-area: 1 / 1;
	}
}

/* u.zstack() */
.host {
	display: grid;
	& > * {
		grid-area: 1 / 1;
	}
}
```

**Example:**

```typescript
let result = u.zstack();
let centeredResult = u.zstack({ align: "center", justify: "center" });
let bottomResult = u.zstack({ align: "end" });
```

An image with an overlay caption, where the host takes its height from the image rather than needing one declared:

```tsx
<figure mix={[u.zstack(), u.rounded("lg"), u.clip()]}>
	<img mix={[u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
	<figcaption
		mix={[
			u.self("end"),
			u.p(3),
			u.is("full"),
			u.bg(u.linearGradient("to top", "rgb(0 0 0 / 0.7)", "transparent")),
		]}
	>
		{caption}
	</figcaption>
</figure>
```

Since every direct child is forced into one cell, wrap anything that should flow normally in a single child element.

### Size

#### `aspect(ratio: AspectRatioName): UtilityMixin` (overloaded: `aspect(width: number, height: number): UtilityMixin`)

Applies `aspect-ratio`, either from a width/height pair or one of a handful of common named ratios. Aspect ratios vary too continuously for a full token family to pay for itself, so only these few recurring shapes get names.

It reserves the box's shape before any content loads, which is what stops a page shifting as images arrive. For it to have an effect the element needs one axis unconstrained — an image with both a width and a height set will ignore it.

**Parameters:**

- `ratio`: A named aspect ratio, used when calling with a single argument.
  - `"square"` — `1 / 1`, for avatars, icons, and thumbnails
  - `"video"` — `16 / 9`, standard widescreen video
  - `"widescreen"` — `21 / 9`, ultrawide and cinema
  - `"portrait"` — `3 / 4`, print and photo portrait orientation
  - `"story"` — `9 / 16`, vertical video
  - `"photo"` — `4 / 3`, standard print and photo landscape orientation
- `width`: The width side of the ratio, used together with `height` when calling with two arguments
- `height`: The height side of the ratio, paired with `width`

**Returns:**

- A `UtilityMixin` that sets `aspect-ratio`

**CSS:**

```css
/* u.aspect("video") */
.host {
	aspect-ratio: 16 / 9;
}

/* u.aspect(3, 2) */
.host {
	aspect-ratio: 3 / 2;
}
```

**Example:**

```typescript
let result = u.aspect("video");
let squareResult = u.aspect("square");
let pairResult = u.aspect(3, 2);
```

Paired with `u.fit()` so the image fills the reserved box instead of stretching:

```tsx
<img mix={[u.is("full"), u.aspect("video"), u.fit("cover"), u.rounded("lg")]} src={src} alt="" />
```

Reach for `u.circle()` when you want a circle — it composes `aspect("square")` with `u.rounded("full")`.

#### `bleed(value?: SpacingValue): UtilityMixin`

Pulls the host past its container's inline padding on both sides through a negative inline margin — a full-bleed image, a divider, or a code block that should run edge to edge inside otherwise padded prose. Composes `u.mi()` with a negated length.

The value should match the container's own inline padding to land flush with its edges; a larger value pushes the element outside the container entirely.

**Parameters:**

- `value`: The amount to pull out by on each side. Defaults to `4`.
  - a `number` — resolved against the spacing scale and negated, producing `calc(-1 * calc(var(--ui-spacing, 0.25rem) * n))`
  - `"auto"` — accepted by the type but meaningless here, since it gets wrapped in the negating `calc()`
  - a raw CSS length (`"1rem"`, `"24px"`) — negated the same way

**Returns:**

- A `UtilityMixin` that sets a negative `margin-inline` on the host

**CSS:**

```css
/* u.bleed(4) */
.host {
	margin-inline: calc(-1 * calc(var(--ui-spacing, 0.25rem) * 4));
}
```

**Example:**

```typescript
let result = u.bleed();
let matchedResult = u.bleed(6);
let lengthResult = u.bleed("1.5rem");
```

The bleed value mirrors the container's padding, so the figure reaches the container's edges exactly:

```tsx
<article mix={[u.pi(6), u.vstack({ gap: 4 })]}>
	<p>{intro}</p>
	<figure mix={[u.bleed(6)]}>
		<img mix={[u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
	</figure>
</article>
```

#### `bs(value: SizeValue): UtilityMixin`

Applies `block-size` — the logical height, which is the physical width in a vertical writing mode. This is the logical counterpart to `u.height()` and the one to prefer.

**Parameters:**

- `value`: A `SizeValue`.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`
  - `"full"` — `100%`, filling the containing block's block axis
  - `"auto"` — passed through, sizing to content
  - a raw CSS length (`"3rem"`, `"100dvh"`, `"48px"`) — passed through unchanged. Nothing is validated, so an unrecognized string is emitted as-is.

**Returns:**

- A `UtilityMixin` that sets `block-size`

**CSS:**

```css
/* u.bs("full") */
.host {
	block-size: 100%;
}

/* u.bs(10) */
.host {
	block-size: calc(var(--ui-spacing, 0.25rem) * 10);
}
```

**Example:**

```typescript
let result = u.bs("full");
let scaleResult = u.bs(10);
let viewportResult = u.bs("100dvh");
let autoResult = u.bs("auto");
```

```tsx
<div mix={[u.bs("100dvh"), u.vstack()]}>
	<header mix={[u.shrink(0)]}>{nav}</header>
	<main mix={[u.spacer(), u.minBs(0), u.scroll("y")]}>{children}</main>
</div>
```

A percentage — including `"full"` — resolves against the parent's block size, which is `auto` unless the parent has one, so `u.bs("full")` on a child of an auto-height parent does nothing.

#### `circle(): UtilityMixin`

A shape pattern for circular boxes: a square aspect ratio plus a full radius — an avatar frame, a status dot, an icon badge. Composes `u.aspect("square")` and `u.rounded("full")`.

The square aspect ratio is the part that matters: `u.rounded("full")` alone on a non-square box produces a pill, not a circle. So this only needs one axis sized — give it an inline size and the block size follows.

**Returns:**

- A `UtilityMixin` that sets `aspect-ratio: 1 / 1` and a full `border-radius`

**CSS:**

```css
/* u.circle() */
.host {
	aspect-ratio: 1 / 1;
	border-radius: var(--ui-radius-full, 9999px);
}
```

**Example:**

```typescript
let result = u.circle();
```

One axis sized, the other derived — and `u.clip()` so the image follows the curve:

```tsx
<img mix={[u.is(10), u.circle(), u.clip(), u.fit("cover")]} src={avatarUrl} alt="" />
```

A status dot is the same pattern at a smaller size:

```tsx
<span mix={[u.is(2), u.circle(), u.bg("success.solid")]} aria-hidden="true" />
```

#### `corner(shape: CornerShape): UtilityMixin`

The primitive `corner-shape` utility, which changes the _geometry_ of a corner rather than its radius. Composes `u.supports()` so the declaration only applies behind `@supports (corner-shape: ...)`, keeping an unsupported browser on its normal `border-radius` shape instead of getting no corner treatment at all.

It has no effect without a radius to shape — `corner-shape` describes how the corner curve is drawn, so pair it with `u.rounded()`. For the common squircle case, reach for `u.squircle()` instead, which bundles both.

Since it self-gates, there is no need to wrap it in `u.supports()` again.

**Parameters:**

- `shape`: The corner treatment.
  - `"squircle"` — a continuous, superelliptical curve; visually softer than a circular radius at the same size
  - `"bevel"` — a straight diagonal cut across the corner
  - `"notch"` — a rectangular notch cut into the corner

**Returns:**

- A `UtilityMixin` that sets `corner-shape` inside an `@supports (corner-shape: ...)` block

**CSS:**

```css
/* u.corner("squircle") */
.host {
	@supports (corner-shape: squircle) {
		corner-shape: squircle;
	}
}
```

**Example:**

```typescript
let result = u.corner("squircle");
let bevelResult = u.corner("bevel");
let notchResult = u.corner("notch");
```

The radius supplies the size, `corner()` supplies the geometry, and unsupported browsers keep the plain rounded shape:

```tsx
<div mix={[u.rounded("xl"), u.corner("bevel"), u.surface("muted"), u.p(4)]}>{children}</div>
```

#### `fit(value?: FitValue): UtilityMixin`

Applies `object-fit`, which decides how a replaced element's content — an `<img>`, `<video>`, or `<canvas>` — fills a box whose size comes from layout rather than from the media's intrinsic dimensions.

It only affects replaced elements; on an ordinary `<div>` it does nothing. Pair it with `u.aspect()` (or an explicit size) to establish the box in the first place, and reach for `u.objectPosition()` when the crop needs to favour a particular part of the image.

**Parameters:**

- `value`: A `FitValue`. Defaults to `"cover"`.
  - `"cover"` — scaled to fill the box entirely, preserving the aspect ratio and cropping whatever overflows. The default, and the right choice for a thumbnail or hero.
  - `"contain"` — scaled to fit entirely inside the box, preserving the aspect ratio and letterboxing the remainder. The right choice for a logo or product shot that must not be cropped.
  - `"fill"` — stretched to the box on both axes, ignoring the aspect ratio. CSS's own default, and almost never what you want.
  - `"none"` — rendered at its intrinsic size, cropped by the box
  - `"scale-down"` — the smaller of `"none"` and `"contain"`, so it never scales up past its intrinsic size

**Returns:**

- A `UtilityMixin` that sets `object-fit`

**CSS:**

```css
/* u.fit() */
.host {
	object-fit: cover;
}

/* u.fit("contain") */
.host {
	object-fit: contain;
}
```

**Example:**

```typescript
let result = u.fit();
let containResult = u.fit("contain");
let scaleDownResult = u.fit("scale-down");
```

```tsx
<img mix={[u.is("full"), u.aspect("square"), u.fit("cover"), u.rounded("md")]} src={src} alt={alt} />
<img mix={[u.maxIs(32), u.maxBs(12), u.fit("contain")]} src={logoUrl} alt={brand} />
```

#### `height(value: SizeValue): UtilityMixin`

Applies the physical `height` property. `u.bs()` (`block-size`) is the default choice for sizing the block axis — reach for this one only when the measurement is genuinely physical and must not flip with writing mode: a box whose proportions are described against the screen rather than the block progression direction, a `canvas`/`img`/`video` whose intrinsic pixel dimension is being mirrored in CSS, or a value paired with a physical viewport unit (`dvh`, `svh`) that would read wrong on its logical axis.

`height("full")` emits `100%`, which only resolves to something useful when an ancestor has a definite height — inside an `auto`-height parent it computes back to `auto` and the utility appears to do nothing; `"100dvh"` or a flex/grid track is the fix. Pairs with `u.minHeight()` and `u.maxHeight()`, which clamp the same axis and win over it: CSS resolves `min-height` over `max-height` over `height`. Pairs with `u.width()` for the other physical axis and with `u.aspect()` — set one axis and let the ratio derive the other rather than fixing both, since two explicit sizes make the ratio moot. Conflicts with `u.bs()`: in a horizontal writing mode `height` and `block-size` target the same axis, and because they're different property names nothing merges or dedupes them — both declarations reach the browser and the cascade picks the winner, which is not worth relying on. Pick one vocabulary per element.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`; negative numbers resolve the same way and are not rejected, even though `height` has no valid negative value
  - `"full"` — resolved to `100%`, the "fill my parent's height" keyword shared by every `SizeValue` utility
  - `"auto"` — passed straight through as `auto`, letting content determine the height
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"13px"`, `"40dvh"`), an intrinsic keyword (`"fit-content"`, `"min-content"`, `"max-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `height` on the host

**CSS:**

```css
/* u.height(4) */
.host {
	height: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.height("full") */
.host {
	height: 100%;
}

/* u.height("fit-content") */
.host {
	height: fit-content;
}
```

**Example:**

```typescript
let result = u.height("full");
let scaleResult = u.height(4);
let autoResult = u.height("auto");
let intrinsicResult = u.height("fit-content");
let rawResult = u.height("40dvh");
```

```tsx
<img mix={[u.width("full"), u.height("240px"), u.fit("cover")]} />
```

#### `is(value: SizeValue): UtilityMixin`

Applies `inline-size` — the logical width, which is the physical height in a vertical writing mode. This is the logical counterpart to `u.width()` and the one to prefer.

**Parameters:**

- `value`: A `SizeValue`.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`
  - `"full"` — `100%`, filling the containing block's inline axis
  - `"auto"` — passed through, sizing to content
  - a raw CSS length (`"20rem"`, `"65ch"`, `"50%"`) — passed through unchanged. Nothing is validated.

**Returns:**

- A `UtilityMixin` that sets `inline-size`

**CSS:**

```css
/* u.is("full") */
.host {
	inline-size: 100%;
}

/* u.is(10) */
.host {
	inline-size: calc(var(--ui-spacing, 0.25rem) * 10);
}
```

**Example:**

```typescript
let result = u.is("full");
let scaleResult = u.is(10);
let measureResult = u.is("65ch");
let autoResult = u.is("auto");
```

```tsx
<aside mix={[u.is(u.var("sidebar-width", "16rem")), u.shrink(0), u.p(4)]}>{nav}</aside>
```

Prefer `u.maxIs()` for a readable measure on prose — a fixed `is()` stops the element shrinking on narrow screens, while a max lets it adapt.

#### `m(...values: SpacingValue[]): UtilityMixin`

Applies logical margin using the spacing scale, `"auto"`, or a raw CSS length. Follows the same 1/2/4-value logical mapping as `u.p()`: one value applies uniformly; two values map to block then inline; four values map to block-start, inline-end, block-end, and inline-start — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

Note the four-value order matches CSS's physical `top right bottom left` rotation, translated to logical directions — it is _not_ start/end grouped.

Prefer `gap` on the parent over margins on children for spacing within a layout: `u.vstack({ gap: 4 })` doesn't leave a stray margin on the last item and doesn't collapse.

**Parameters:**

- `values`: One, two, or four spacing values. Any other count **throws** `@pkg/u: expected 1, 2, or 4 values`. Each value is:
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`. Negative values are allowed and pull the element outward.
  - `"auto"` — passed through, which is how a block element centres itself on the inline axis
  - a raw CSS length — passed through unchanged

**Returns:**

- A `UtilityMixin` that sets the resolved logical `margin` properties

**CSS:**

```css
/* u.m(4) */
.host {
	margin: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.m(4, "auto") */
.host {
	margin-block: calc(var(--ui-spacing, 0.25rem) * 4);
	margin-inline: auto;
}

/* u.m(1, 2, 3, 4) */
.host {
	margin-block-start: calc(var(--ui-spacing, 0.25rem) * 1);
	margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 2);
	margin-block-end: calc(var(--ui-spacing, 0.25rem) * 3);
	margin-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.m(4);
let centerResult = u.m(4, "auto");
let sidesResult = u.m(1, 2, 3, 4);
let negativeResult = u.m(-2);
```

The centring idiom, which needs a bounded inline size to centre against:

```tsx
<main mix={[u.maxIs("65ch"), u.m(0, "auto"), u.pi(4)]}>{children}</main>
```

Adjacent block margins collapse into one, which is a common source of surprising gaps — `gap` does not collapse, which is another reason to prefer it.

#### `marginLeft(value: SpacingValue): UtilityMixin`

Applies the physical `margin-left` property. `u.mi()`, `u.mis()`, and `u.mie()` are the default choice for inline margins — reach for this one only when the offset is tied to the physical left side rather than the leading or trailing inline edge: an anchor-positioned surface such as a popover nudged away from whichever physical side of its anchor it popped out on, or a hardcoded offset that has to line up with fixed left-hand chrome regardless of text direction.

Takes exactly one value; there is no 1/2/4-value shorthand form as on `u.m()`/`u.mi()`, so there is no argument-count error to hit. `marginLeft("auto")` needs a container with free space to absorb before it does anything — a definite-width block box, or a flex row, where it becomes the idiomatic "push everything after me to the end" spacer. Pairs with `u.marginRight()` (both `"auto"` centers a definite-width block) and with `u.paddingLeft()` on the same physical side. Conflicts with `u.m()`, which emits the `margin` shorthand and resets all four sides including this one, and with `u.mis()`/`u.mie()`, one of which resolves to `margin-left` depending on text direction; in both cases the emitted declarations coexist in the stylesheet and the cascade decides, so don't mix physical and logical margins on the same element.

**Parameters:**

- `value`: One spacing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`; negative numbers are meaningful here and resolve the same way, pulling the host leftward
  - `"auto"` — passed straight through as `auto`, absorbing the container's free space on this side
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"13px"`, `"2ch"`), a `calc()`, or a `var()` reference
  - `"full"` is _not_ special-cased here the way it is on the `SizeValue` utilities — it would pass through as the literal, invalid `full`

**Returns:**

- A `UtilityMixin` that sets `margin-left` on the host

**CSS:**

```css
/* u.marginLeft(4) */
.host {
	margin-left: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.marginLeft("auto") */
.host {
	margin-left: auto;
}

/* u.marginLeft(-2) */
.host {
	margin-left: calc(var(--ui-spacing, 0.25rem) * -2);
}
```

**Example:**

```typescript
let result = u.marginLeft(4);
let autoResult = u.marginLeft("auto");
let negativeResult = u.marginLeft(-2);
let rawResult = u.marginLeft("13px");
```

```tsx
<div mix={[u.width("640px"), u.marginLeft("auto"), u.marginRight("auto"), u.p(4)]} />
```

#### `marginRight(value: SpacingValue): UtilityMixin`

Applies the physical `margin-right` property. `u.mi()`, `u.mis()`, and `u.mie()` are the default choice for inline margins — reach for this one only when the offset is tied to the physical right side rather than the leading or trailing inline edge: an anchor-positioned surface such as a popover nudged away from whichever physical side of its anchor it popped out on, or a hardcoded offset that has to line up with fixed right-hand chrome regardless of text direction.

Takes exactly one value; there is no 1/2/4-value shorthand form as on `u.m()`/`u.mi()`, so there is no argument-count error to hit. `marginRight("auto")` needs a container with free space to absorb before it does anything — a definite-width block box, or a flex row, where it becomes the idiomatic "push everything after me to the end" spacer. Pairs with `u.marginLeft()` (both `"auto"` centers a definite-width block) and with `u.paddingRight()` on the same physical side. Conflicts with `u.m()`, which emits the `margin` shorthand and resets all four sides including this one, and with `u.mis()`/`u.mie()`, one of which resolves to `margin-right` depending on text direction; in both cases the emitted declarations coexist in the stylesheet and the cascade decides, so don't mix physical and logical margins on the same element.

**Parameters:**

- `value`: One spacing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`; negative numbers are meaningful here and resolve the same way, pulling the host rightward
  - `"auto"` — passed straight through as `auto`, absorbing the container's free space on this side
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"13px"`, `"2ch"`), a `calc()`, or a `var()` reference
  - `"full"` is _not_ special-cased here the way it is on the `SizeValue` utilities — it would pass through as the literal, invalid `full`

**Returns:**

- A `UtilityMixin` that sets `margin-right` on the host

**CSS:**

```css
/* u.marginRight(4) */
.host {
	margin-right: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.marginRight("auto") */
.host {
	margin-right: auto;
}

/* u.marginRight(-2) */
.host {
	margin-right: calc(var(--ui-spacing, 0.25rem) * -2);
}
```

**Example:**

```typescript
let result = u.marginRight(4);
let autoResult = u.marginRight("auto");
let negativeResult = u.marginRight(-2);
let rawResult = u.marginRight("13px");
```

```tsx
<div mix={[u.hstack(), u.p(2)]}>
	<span mix={[u.marginRight("auto")]}>Title</span>
	<button type="button">Close</button>
</div>
```

#### `maxBs(value: SizeValue): UtilityMixin`

Applies `max-block-size` — the logical ceiling on the block axis, which is the maximum height in a horizontal writing mode and the maximum width in a vertical one. This is the default choice for capping the block axis; `u.maxHeight()` exists only for the genuinely physical cases.

Capping the block size alone doesn't create a scrollable region — content simply overflows visibly until an overflow utility turns the box into a scroll container. Pairs with `u.minBs()` and `u.bs()` on the same axis, which CSS resolves as `min-block-size` over `max-block-size` over `block-size`, so a `minBs` above this cap silently wins. `"full"` resolves to `100%` and therefore needs an ancestor with a definite block size to mean anything.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`
  - `"full"` — resolved to `100%`
  - `"auto"` — passed straight through as `auto`
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"60ch"`, `"80dvh"`), an intrinsic keyword (`"fit-content"`, `"max-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `max-block-size` on the host

**CSS:**

```css
/* u.maxBs(4) */
.host {
	max-block-size: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.maxBs("full") */
.host {
	max-block-size: 100%;
}

/* u.maxBs("60ch") */
.host {
	max-block-size: 60ch;
}
```

**Example:**

```typescript
let result = u.maxBs("full");
let scaleResult = u.maxBs(4);
let rawResult = u.maxBs("60ch");
```

```tsx
<div mix={[u.maxBs("70dvh"), u.p(4), u.rounded("lg")]}>{children}</div>
```

#### `maxHeight(value: SizeValue): UtilityMixin`

Applies the physical `max-height` property. `u.maxBs()` (`max-block-size`) is the default choice for capping the block axis — reach for this one only when the cap is genuinely physical and must not flip with writing mode: a surface clamped against the physical viewport height (`"80dvh"`), a media element held inside its intrinsic pixel dimensions, or a box whose maximum proportions are described relative to the screen rather than the block progression direction.

A cap on its own doesn't create a scroll container — pair it with an overflow utility, or the content overflows visibly. Pairs with `u.minHeight()` and `u.height()` on the same axis; CSS resolves the three as `min-height` over `max-height` over `height`, so a `minHeight` larger than this cap silently wins. Conflicts with `u.maxBs()`: in a horizontal writing mode both cap the same axis under different property names, so nothing merges them and the cascade decides — pick one vocabulary per element.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`
  - `"full"` — resolved to `100%`, a cap relative to the parent's height
  - `"auto"` — passed straight through as `auto`
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"80dvh"`, `"480px"`), an intrinsic keyword (`"fit-content"`, `"max-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `max-height` on the host

**CSS:**

```css
/* u.maxHeight(4) */
.host {
	max-height: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.maxHeight("full") */
.host {
	max-height: 100%;
}

/* u.maxHeight("fit-content") */
.host {
	max-height: fit-content;
}
```

**Example:**

```typescript
let result = u.maxHeight("full");
let scaleResult = u.maxHeight(4);
let viewportResult = u.maxHeight("80dvh");
let intrinsicResult = u.maxHeight("fit-content");
```

```tsx
<div mix={[u.maxHeight("80dvh"), u.width("full"), u.p(4)]}>{children}</div>
```

#### `maxIs(value: SizeValue): UtilityMixin`

Applies `max-inline-size` — the logical ceiling on the inline axis, which is the maximum width in a horizontal writing mode and the maximum height in a vertical one. The natural home for a measure cap on running text, since `ch` tracks the inline axis; `u.maxWidth()` exists only for the genuinely physical cases.

Pairs with `u.minIs()` and `u.is()` on the same axis, which CSS resolves as `min-inline-size` over `max-inline-size` over `inline-size`, and with `u.mi("auto")` to center the capped box in a wider container. `"full"` resolves to `100%`, the standard guard that keeps a replaced element from overflowing its parent.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`
  - `"full"` — resolved to `100%`
  - `"auto"` — passed straight through as `auto`
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"60ch"`, `"40rem"`), an intrinsic keyword (`"fit-content"`, `"max-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `max-inline-size` on the host

**CSS:**

```css
/* u.maxIs(4) */
.host {
	max-inline-size: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.maxIs("full") */
.host {
	max-inline-size: 100%;
}

/* u.maxIs("60ch") */
.host {
	max-inline-size: 60ch;
}
```

**Example:**

```typescript
let result = u.maxIs("60ch");
let scaleResult = u.maxIs(4);
let fullResult = u.maxIs("full");
```

```tsx
<article mix={[u.maxIs("65ch"), u.mi("auto"), u.p(4)]}>{children}</article>
```

#### `maxWidth(value: SizeValue): UtilityMixin`

Applies the physical `max-width` property. `u.maxIs()` (`max-inline-size`) is the default choice for capping the inline axis — reach for this one only when the cap is genuinely physical and must not flip with writing mode: a box clamped against the physical viewport width (`"100dvw"`), a `canvas`/`img`/`video` held inside its intrinsic pixel dimensions, or a bubble whose maximum proportions are described relative to the screen rather than the inline reading direction.

Pairs with `u.minWidth()` and `u.width()` on the same axis; CSS resolves the three as `min-width` over `max-width` over `width`, so a `minWidth` larger than this cap silently wins. Pairs with `u.marginLeft("auto")`/`u.marginRight("auto")` to center the capped box. Conflicts with `u.maxIs()`: in a horizontal writing mode both cap the same axis under different property names, so nothing merges them and the cascade decides — pick one vocabulary per element.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`
  - `"full"` — resolved to `100%`, the usual guard against overflowing the parent
  - `"auto"` — passed straight through as `auto`
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"100dvw"`, `"420px"`), an intrinsic keyword (`"fit-content"`, `"max-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `max-width` on the host

**CSS:**

```css
/* u.maxWidth(4) */
.host {
	max-width: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.maxWidth("full") */
.host {
	max-width: 100%;
}

/* u.maxWidth("fit-content") */
.host {
	max-width: fit-content;
}
```

**Example:**

```typescript
let result = u.maxWidth("full");
let scaleResult = u.maxWidth(4);
let viewportResult = u.maxWidth("100dvw");
let intrinsicResult = u.maxWidth("fit-content");
```

```tsx
<video mix={[u.maxWidth("full"), u.height("auto"), u.aspect("video")]} />
```

#### `mb(...values: SpacingValue[]): UtilityMixin`

Applies `margin-block`. One value applies both block edges; two values map to block-start then block-end.

**Parameters:**

- `values`: One or two spacing values, joined with a space. Unlike `u.m()`, no count is rejected — three or more values are simply concatenated into an invalid declaration. Each value is a spacing-scale number, `"auto"`, or a raw CSS length.

**Returns:**

- A `UtilityMixin` that sets `margin-block`

**CSS:**

```css
/* u.mb(4) */
.host {
	margin-block: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.mb(2, 4) */
.host {
	margin-block: calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.mb(4);
let asymmetricResult = u.mb(2, 4);
let autoResult = u.mb("auto");
```

```tsx
<h2 mix={[u.text("2xl"), u.weight("semibold"), u.mb(6, 2)]}>{heading}</h2>
```

#### `mbe(value: SpacingValue): UtilityMixin`

Applies `margin-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length. Negative values pull the following content upward.

**Returns:**

- A `UtilityMixin` that sets `margin-block-end`

**CSS:**

```css
/* u.mbe(4) */
.host {
	margin-block-end: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.mbe(4);
let lengthResult = u.mbe("1.5rem");
let negativeResult = u.mbe(-1);
```

Combined with `u.not()` so the last item doesn't carry a trailing margin — though a `gap` on the parent is usually the better answer:

```tsx
<ul role="list">
	{items.map((item) => (
		<li key={item.id} mix={[u.not(":last-child", u.mbe(2))]}>
			{item.label}
		</li>
	))}
</ul>
```

#### `mbs(value: SpacingValue): UtilityMixin`

Applies `margin-block-start` — the leading block edge, the top edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length. `"auto"` is what pushes a flex item to the end of a column, absorbing all the free space before it.

**Returns:**

- A `UtilityMixin` that sets `margin-block-start`

**CSS:**

```css
/* u.mbs(4) */
.host {
	margin-block-start: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.mbs("auto") */
.host {
	margin-block-start: auto;
}
```

**Example:**

```typescript
let result = u.mbs(4);
let pushResult = u.mbs("auto");
```

The `auto` trick — a footer pinned to the bottom of a column without a spacer element:

```tsx
<article mix={[u.vstack({ gap: 2 }), u.bs("full"), u.p(4)]}>
	<h3>{title}</h3>
	<p>{body}</p>
	<footer mix={[u.mbs("auto"), u.hstack({ gap: 2 })]}>{actions}</footer>
</article>
```

#### `mi(...values: SpacingValue[]): UtilityMixin`

Applies `margin-inline`. One value applies both inline edges; two values map to inline-start then inline-end.

**Parameters:**

- `values`: One or two spacing values, joined with a space. Each is a spacing-scale number, `"auto"`, or a raw CSS length. `u.mi("auto")` is the inline-axis centring idiom.

**Returns:**

- A `UtilityMixin` that sets `margin-inline`

**CSS:**

```css
/* u.mi(4) */
.host {
	margin-inline: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.mi(4, "auto") */
.host {
	margin-inline: calc(var(--ui-spacing, 0.25rem) * 4) auto;
}
```

**Example:**

```typescript
let result = u.mi(4);
let centerResult = u.mi("auto");
let asymmetricResult = u.mi(4, "auto");
```

```tsx
<div mix={[u.maxIs("65ch"), u.mi("auto")]}>{children}</div>
```

Reach for `u.bleed()` when the intent is specifically a negative inline margin pulling past a container's padding — it composes this utility with a negated length.

#### `mie(value: SpacingValue): UtilityMixin`

Applies `margin-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length. `"auto"` pushes the element to the inline start of a flex row by absorbing the free space after it.

**Returns:**

- A `UtilityMixin` that sets `margin-inline-end`

**CSS:**

```css
/* u.mie(4) */
.host {
	margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.mie("auto") */
.host {
	margin-inline-end: auto;
}
```

**Example:**

```typescript
let result = u.mie(4);
let pushResult = u.mie("auto");
```

`auto` on one item splits a row into two groups without a spacer element:

```tsx
<nav mix={[u.hstack({ gap: 3, align: "center" })]}>
	<a href="/" mix={[u.mie("auto")]}>
		{logo}
	</a>
	{links}
</nav>
```

Reach for `u.spacer()` instead when the split should come from a dedicated flexible element.

#### `minBs(value: SizeValue): UtilityMixin`

Applies `min-block-size`, a floor on the logical height. The logical counterpart to `u.minHeight()`.

Its most important use is the opposite of a floor: `u.minBs(0)` overrides a flex item's default `min-block-size: auto`, which otherwise refuses to shrink below its content and is why a scroll container inside a column often refuses to scroll.

**Parameters:**

- `value`: A `SizeValue`.
  - `0` — resolved as `calc(var(--ui-spacing, 0.25rem) * 0)`, the flex-shrink unlock
  - a `number` — resolved against the spacing scale
  - `"full"` — `100%`
  - `"auto"` — the default behavior, sizing to content
  - a raw CSS length (`"100dvh"`, `"3rem"`) — passed through unchanged

**Returns:**

- A `UtilityMixin` that sets `min-block-size`

**CSS:**

```css
/* u.minBs(0) */
.host {
	min-block-size: calc(var(--ui-spacing, 0.25rem) * 0);
}

/* u.minBs("100dvh") */
.host {
	min-block-size: 100dvh;
}
```

**Example:**

```typescript
let result = u.minBs(0);
let viewportResult = u.minBs("100dvh");
let scaleResult = u.minBs(12);
```

The `minBs(0)` unlock, without which the inner scroll region grows instead of scrolling:

```tsx
<div mix={[u.vstack(), u.bs("100dvh")]}>
	<header mix={[u.shrink(0)]}>{nav}</header>
	<main mix={[u.spacer(), u.minBs(0), u.scroll("y")]}>{children}</main>
</div>
```

#### `minHeight(value: SizeValue): UtilityMixin`

Applies the physical `min-height` property. `u.minBs()` (`min-block-size`) is the default choice for a floor on the block axis — reach for this one only when the floor is genuinely physical and must not flip with writing mode: a layout shell that has to fill the physical viewport height (`"100dvh"`), a media element floored at its intrinsic pixel dimension, or a box whose minimum proportions are described relative to the screen rather than the block progression direction.

`minHeight("100dvh")` is the reliable "at least one screen tall" floor — unlike `u.height("full")` it needs no definite-height ancestor. `minHeight("full")` does need one, since it emits `100%` and resolves against the parent's height. Pairs with `u.height()` and `u.maxHeight()` on the same axis and wins over both: a `min-height` above the `max-height` clamps the box open. `minHeight(0)` is the standard unlock for a flex or grid item that refuses to shrink below its content. Conflicts with `u.minBs()`: in a horizontal writing mode both floor the same axis under different property names, so nothing merges them and the cascade decides — pick one vocabulary per element.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing` and `0` is the flex/grid shrink unlock
  - `"full"` — resolved to `100%`, a floor relative to the parent's height
  - `"auto"` — passed straight through as `auto`, the initial value for a flex or grid item
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"100dvh"`, `"44px"`), an intrinsic keyword (`"fit-content"`, `"min-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `min-height` on the host

**CSS:**

```css
/* u.minHeight(4) */
.host {
	min-height: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.minHeight("full") */
.host {
	min-height: 100%;
}

/* u.minHeight("fit-content") */
.host {
	min-height: fit-content;
}
```

**Example:**

```typescript
let result = u.minHeight("full");
let scaleResult = u.minHeight(4);
let viewportResult = u.minHeight("100dvh");
let shrinkResult = u.minHeight(0);
```

```tsx
<div mix={[u.vstack(), u.minHeight("100dvh"), u.safeAreaPadding("bottom")]}>{children}</div>
```

#### `minIs(value: SizeValue): UtilityMixin`

Applies `min-inline-size`, a floor on the logical width. The logical counterpart to `u.minWidth()`.

As with `u.minBs()`, the common call is `u.minIs(0)` — it overrides a flex item's default `min-inline-size: auto`, which refuses to shrink below its content width. That single declaration is what makes `u.truncate()` work inside a flex row.

**Parameters:**

- `value`: A `SizeValue`.
  - `0` — the flex-shrink unlock that lets a flex item narrow past its content
  - a `number` — resolved against the spacing scale
  - `"full"` — `100%`
  - `"auto"` — the default behavior
  - a raw CSS length (`"12rem"`, `"20ch"`) — passed through unchanged

**Returns:**

- A `UtilityMixin` that sets `min-inline-size`

**CSS:**

```css
/* u.minIs(0) */
.host {
	min-inline-size: calc(var(--ui-spacing, 0.25rem) * 0);
}
```

**Example:**

```typescript
let result = u.minIs(0);
let floorResult = u.minIs(32);
```

Truncation inside a flex row only works with the `minIs(0)`:

```tsx
<div mix={[u.hstack({ gap: 2, align: "center" })]}>
	<span mix={[u.spacer(), u.minIs(0), u.truncate()]}>{longFileName}</span>
	<button mix={[u.shrink(0)]}>{action}</button>
</div>
```

#### `minWidth(value: SizeValue): UtilityMixin`

Applies the physical `min-width` property. `u.minIs()` (`min-inline-size`) is the default choice for a floor on the inline axis — reach for this one only when the floor is genuinely physical and must not flip with writing mode: a box floored against the physical viewport width, a `canvas`/`img`/`video` floored at its intrinsic pixel dimension, or a hit target whose minimum proportions are described relative to the screen rather than the inline reading direction.

Pairs with `u.width()` and `u.maxWidth()` on the same axis and wins over both: a `min-width` above the `max-width` clamps the box open. `minWidth(0)` is the standard unlock for a flex or grid item whose long text refuses to shrink below its content width — it only matters inside a flex or grid container, where the automatic minimum size applies. Conflicts with `u.minIs()`: in a horizontal writing mode both floor the same axis under different property names, so nothing merges them and the cascade decides — pick one vocabulary per element.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing` and `0` is the flex/grid shrink unlock
  - `"full"` — resolved to `100%`, a floor relative to the parent's width
  - `"auto"` — passed straight through as `auto`, the initial value for a flex or grid item
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"44px"`, `"20rem"`), an intrinsic keyword (`"fit-content"`, `"min-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `min-width` on the host

**CSS:**

```css
/* u.minWidth(4) */
.host {
	min-width: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.minWidth("full") */
.host {
	min-width: 100%;
}

/* u.minWidth("fit-content") */
.host {
	min-width: fit-content;
}
```

**Example:**

```typescript
let result = u.minWidth("full");
let scaleResult = u.minWidth(4);
let shrinkResult = u.minWidth(0);
let intrinsicResult = u.minWidth("fit-content");
```

```tsx
<div mix={[u.hstack(), u.minWidth(0)]}>
	<span mix={[u.minWidth(0)]}>{longLabel}</span>
</div>
```

#### `mis(value: SpacingValue): UtilityMixin`

Applies `margin-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length. `"auto"` pushes the element to the inline end of a flex row by absorbing the free space before it.

**Returns:**

- A `UtilityMixin` that sets `margin-inline-start`

**CSS:**

```css
/* u.mis(4) */
.host {
	margin-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.mis("auto") */
.host {
	margin-inline-start: auto;
}
```

**Example:**

```typescript
let result = u.mis(4);
let pushResult = u.mis("auto");
let indentResult = u.mis("2ch");
```

`auto` pushes a trailing action to the end of a row:

```tsx
<div mix={[u.hstack({ gap: 2, align: "center" })]}>
	<span>{label}</span>
	<button mix={[u.mis("auto")]}>{action}</button>
</div>
```

#### `objectPosition(value?: ObjectPositionValue): UtilityMixin`

Applies `object-position`, which decides which part of a replaced element's content survives the crop `u.fit("cover")` performs. That makes it the utility that keeps a subject in frame: a portrait photo squeezed into a wide thumbnail is cropped from its centre by default, which reliably cuts off the head, and moving the position to `"top"` is the fix.

It does nothing on its own. Without `u.fit()` establishing a crop there is no overflow to position, and it has no effect at all on non-replaced elements — an `<img>`, `<video>`, or `<canvas>` honours it, an ordinary `<div>` ignores it. Pair it with `u.aspect()` or an explicit `u.is()`/`u.bs()` for the box, the same as `u.fit()` needs. It is unrelated to `u.bg({ position })`, which positions a `background-image` rather than a replaced element's own content.

The keywords are physical, not logical: `left` and `right` stay put under a right-to-left writing mode.

**Parameters:**

- `value`: An `ObjectPositionValue`. Defaults to `"center"`.
  - `"center"` — the middle of the content is kept, cropping evenly on all sides. CSS's own default.
  - `"top"` / `"bottom"` / `"left"` / `"right"` — a single edge keyword: that edge is held against the box and the crop is taken from the opposite side. `"top"` is the usual choice for a photo of a person.
  - `"top left"` / `"top right"` / `"bottom left"` / `"bottom right"` — a corner
  - any other `string` — the raw escape, passed through unchanged: a percentage pair (`"50% 20%"`, useful for aiming slightly above centre), explicit lengths, or a `var(...)`/`calc(...)` reference — which is how a per-image focal point stored with the asset can drive the crop

**Returns:**

- A `UtilityMixin` that sets `object-position`

**CSS:**

```css
/* u.objectPosition() */
.host {
	object-position: center;
}

/* u.objectPosition("top") */
.host {
	object-position: top;
}

/* u.objectPosition("50% 20%") */
.host {
	object-position: 50% 20%;
}
```

**Example:**

```typescript
let result = u.objectPosition();
let faceResult = u.objectPosition("top");
let cornerResult = u.objectPosition("bottom right");
let focalResult = u.objectPosition("50% 20%");
```

A wide card header cropped from a tall source image, aimed a little above centre so faces stay in frame, and a focal point handed in per image:

```tsx
<img
	mix={[u.is("full"), u.aspect(16, 9), u.fit("cover"), u.objectPosition("50% 20%"), u.rounded("md")]}
	src={coverUrl}
	alt=""
/>

<img
	mix={[
		u.circle(),
		u.is(12),
		u.fit("cover"),
		u.objectPosition(u.var("focal", "center")),
		u.vars({ focal: person.focalPoint }),
	]}
	src={person.avatarUrl}
	alt={person.name}
/>
```

#### `p(...values: SpacingValue[]): UtilityMixin`

Applies logical padding using the spacing scale or a raw CSS length. One value applies all sides; two values map to block then inline; four values map to block-start, inline-end, block-end, and inline-start — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

The four-value order follows CSS's physical `top right bottom left` rotation translated into logical directions, so it alternates block and inline rather than grouping them.

Note padding is added _outside_ the content box by default, so a fixed size plus padding grows the element — reach for `u.boxSizing("border-box")` when the declared size should include the padding.

**Parameters:**

- `values`: One, two, or four spacing values. Any other count **throws** `@pkg/u: expected 1, 2, or 4 values`. Each value is:
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default scale
  - a raw CSS length (`"1.5rem"`, `"12px"`) — passed through unchanged
  - `"auto"` — accepted by the type since it shares `SpacingValue` with the margin family, but `padding: auto` is not valid CSS and is emitted unchallenged

**Returns:**

- A `UtilityMixin` that sets the resolved logical `padding` properties

**CSS:**

```css
/* u.p(4) */
.host {
	padding: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.p(2, 4) */
.host {
	padding-block: calc(var(--ui-spacing, 0.25rem) * 2);
	padding-inline: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.p(1, 2, 3, 4) */
.host {
	padding-block-start: calc(var(--ui-spacing, 0.25rem) * 1);
	padding-inline-end: calc(var(--ui-spacing, 0.25rem) * 2);
	padding-block-end: calc(var(--ui-spacing, 0.25rem) * 3);
	padding-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.p(4);
let axesResult = u.p(2, 4);
let sidesResult = u.p(1, 2, 3, 4);
let lengthResult = u.p("1.5rem");
```

The two-value form is the common shape for a control — tighter on the block axis than the inline:

```tsx
<button mix={[u.p(2, 4), u.surface("brand"), u.rounded("md"), u.type("sm"), u.weight("medium")]}>
	{label}
</button>
```

#### `paddingLeft(value: SpacingValue): UtilityMixin`

Applies the physical `padding-left` property. `u.pis()` and `u.pi()` are the default choice for inline padding — reach for this one only when the padding is tied to the physical left side rather than the leading or trailing inline edge: a panel docked to a fixed screen edge, or padding that has to absorb a physical `env(safe-area-inset-left)` offset, which the platform defines in physical terms and which never flips.

Takes exactly one value; there is no 1/2/4-value shorthand form as on `u.p()`/`u.pi()`, so there is no argument-count error to hit. Because the value is passed through untouched, this is the utility that lets a base padding and a safe-area inset be _added_ rather than one replacing the other — build the value with `u.calc()` and `u.env()` and hand it over. Conflicts with `u.p()`, which emits the `padding` shorthand and resets all four sides including this one, and with `u.pis()`/`u.pie()`, one of which resolves to `padding-left` depending on text direction. It also writes the same property as `u.safeAreaPadding("left")`, so use one or the other, never both.

**Parameters:**

- `value`: One spacing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"13px"`), an `env()` reference, or a `calc()` composite such as `"calc(1.5rem + env(safe-area-inset-left, 0px))"`
  - the type also permits `"auto"`, which would emit `padding-left: auto` — not a valid padding value, so ignore it here

**Returns:**

- A `UtilityMixin` that sets `padding-left` on the host

**CSS:**

```css
/* u.paddingLeft(4) */
.host {
	padding-left: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.paddingLeft("13px") */
.host {
	padding-left: 13px;
}

/* u.paddingLeft(u.calc(`1.5rem + ${u.env("safe-area-inset-left", "0px")}`)) */
.host {
	padding-left: calc(1.5rem + env(safe-area-inset-left, 0px));
}
```

**Example:**

```typescript
let result = u.paddingLeft(4);
let rawResult = u.paddingLeft("13px");
let insetResult = u.paddingLeft(u.calc(`1.5rem + ${u.env("safe-area-inset-left", "0px")}`));
```

```tsx
<aside
	mix={[
		u.vstack(),
		u.pb(4),
		u.paddingLeft(u.calc(`1rem + ${u.env("safe-area-inset-left", "0px")}`)),
	]}
>
	{children}
</aside>
```

#### `paddingRight(value: SpacingValue): UtilityMixin`

Applies the physical `padding-right` property. `u.pie()` and `u.pi()` are the default choice for inline padding — reach for this one only when the padding is tied to the physical right side rather than the leading or trailing inline edge: a panel docked to a fixed screen edge, or padding that has to absorb a physical `env(safe-area-inset-right)` offset, which the platform defines in physical terms and which never flips.

Takes exactly one value; there is no 1/2/4-value shorthand form as on `u.p()`/`u.pi()`, so there is no argument-count error to hit. Because the value is passed through untouched, this is the utility that lets a base padding and a safe-area inset be _added_ rather than one replacing the other — build the value with `u.calc()` and `u.env()` and hand it over. Conflicts with `u.p()`, which emits the `padding` shorthand and resets all four sides including this one, and with `u.pis()`/`u.pie()`, one of which resolves to `padding-right` depending on text direction. It also writes the same property as `u.safeAreaPadding("right")`, so use one or the other, never both.

**Parameters:**

- `value`: One spacing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"13px"`), an `env()` reference, or a `calc()` composite such as `"calc(1.5rem + env(safe-area-inset-right, 0px))"`
  - the type also permits `"auto"`, which would emit `padding-right: auto` — not a valid padding value, so ignore it here

**Returns:**

- A `UtilityMixin` that sets `padding-right` on the host

**CSS:**

```css
/* u.paddingRight(4) */
.host {
	padding-right: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.paddingRight("13px") */
.host {
	padding-right: 13px;
}

/* u.paddingRight(u.calc(`1.5rem + ${u.env("safe-area-inset-right", "0px")}`)) */
.host {
	padding-right: calc(1.5rem + env(safe-area-inset-right, 0px));
}
```

**Example:**

```typescript
let result = u.paddingRight(4);
let rawResult = u.paddingRight("13px");
let insetResult = u.paddingRight(u.calc(`1.5rem + ${u.env("safe-area-inset-right", "0px")}`));
```

```tsx
<aside
	mix={[
		u.vstack(),
		u.pb(4),
		u.paddingRight(u.calc(`1rem + ${u.env("safe-area-inset-right", "0px")}`)),
	]}
>
	{children}
</aside>
```

#### `pb(...values: SpacingValue[]): UtilityMixin`

Applies `padding-block`. One value applies both block edges; two values map to block-start then block-end.

**Parameters:**

- `values`: One or two spacing values, joined with a space. Unlike `u.p()`, no count is rejected — three or more are concatenated into an invalid declaration. Each is a spacing-scale number or a raw CSS length.

**Returns:**

- A `UtilityMixin` that sets `padding-block`

**CSS:**

```css
/* u.pb(4) */
.host {
	padding-block: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.pb(2, 4) */
.host {
	padding-block: calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.pb(4);
let asymmetricResult = u.pb(2, 4);
```

Splitting the axes lets each be tuned independently:

```tsx
<section mix={[u.pb(8), u.pi(4)]}>{children}</section>
```

#### `pbe(value: SpacingValue): UtilityMixin`

Applies `padding-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-block-end`

**CSS:**

```css
/* u.pbe(4) */
.host {
	padding-block-end: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.pbe(4);
let lengthResult = u.pbe("2rem");
```

Composed with `u.env()` so a bottom-docked bar clears the device's home indicator:

```tsx
<footer
	mix={[
		u.fixed(),
		u.insBe(0),
		u.is("full"),
		u.pbe(u.calc(`1rem + ${u.env("safe-area-inset-bottom", "0px")}`)),
	]}
>
	{actions}
</footer>
```

#### `pbs(value: SpacingValue): UtilityMixin`

Applies `padding-block-start` — the leading block edge, the top edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-block-start`

**CSS:**

```css
/* u.pbs(4) */
.host {
	padding-block-start: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.pbs(4);
let lengthResult = u.pbs("2rem");
```

Padding on the parent, rather than a margin on the first child, avoids margin collapse:

```tsx
<section mix={[u.pbs(8), u.pbe(6), u.pi(4)]}>{children}</section>
```

#### `pi(...values: SpacingValue[]): UtilityMixin`

Applies `padding-inline`. One value applies both inline edges; two values map to inline-start then inline-end.

**Parameters:**

- `values`: One or two spacing values, joined with a space. Unlike `u.p()`, no count is rejected. Each is a spacing-scale number or a raw CSS length.

**Returns:**

- A `UtilityMixin` that sets `padding-inline`

**CSS:**

```css
/* u.pi(4) */
.host {
	padding-inline: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.pi(2, 4) */
.host {
	padding-inline: calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.pi(4);
let asymmetricResult = u.pi(2, 4);
```

The page-gutter idiom, growing at wider container widths:

```tsx
<div mix={[u.pi(4), u.at("md", u.pi(6)), u.at("lg", u.pi(8)), u.maxIs("80rem"), u.mi("auto")]}>
	{children}
</div>
```

#### `pie(value: SpacingValue): UtilityMixin`

Applies `padding-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-inline-end`

**CSS:**

```css
/* u.pie(4) */
.host {
	padding-inline-end: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.pie(4);
let lengthResult = u.pie("2.5rem");
```

Asymmetric inline padding is what makes room for a trailing icon inside a field:

```tsx
<div mix={[u.relative()]}>
	<input mix={[u.is("full"), u.pb(2), u.pis(3), u.pie(8), u.border("neutral"), u.rounded("md")]} />
	<span mix={[u.absolute(), u.insIe(2), u.insBs(0), u.insBe(0), u.center(), u.pointerEvents()]}>
		{icon}
	</span>
</div>
```

#### `pis(value: SpacingValue): UtilityMixin`

Applies `padding-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-inline-start`

**CSS:**

```css
/* u.pis(4) */
.host {
	padding-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let result = u.pis(4);
let indentResult = u.pis("2ch");
```

Because it is logical, an indent set this way flips correctly in a right-to-left context, where `padding-left` would not:

```tsx
<blockquote
	mix={[
		u.pis(4),
		u.borderEdge("inline-start", { color: "neutral", width: 2 }),
		u.fg("neutral.muted"),
	]}
>
	{quote}
</blockquote>
```

#### `safeAreaPadding(side: SafeAreaSide, fallback?: string): UtilityMixin`

Pads one physical side by the platform's safe-area inset for that side, so content clears a notch, a rounded display corner, or a home-bar gesture area instead of sliding underneath it. The inset is read from the `env(safe-area-inset-{side})` environment variable the platform exposes: on a device with an obstruction on that edge the variable reports how much clearance the edge needs, and on a device with none it reports `0`. These insets are the one part of the `size/` family with no logical counterpart at all — the geometry they describe is fixed to the hardware, so it never flips with writing mode or text direction. Composes `u.env()` and sets the single physical padding property matching `side`.

Two things gate whether it does anything visible. The document has to opt into laying out under the insets in the first place (`viewport-fit=cover` on the viewport meta tag); without that the page already sits inside the safe area and every inset reports `0`. And `fallback` is an `env()` fallback, not a floor: it applies only where the _variable itself_ is unknown to the browser, so a modern device with no notch resolves to the reported `0`, not to the fallback — never use it to smuggle in a base padding. When the intent is "this much padding, plus whatever the inset is", reach for `u.paddingLeft()`/`u.paddingRight()` with a `u.calc()`/`u.env()` composite on the inline sides, or `u.pbs()`/`u.pbe()` alongside this one on the block sides. Pairs naturally with a fixed or sticky bar and with `u.minHeight("100dvh")` on the layout shell. Conflicts with `u.p()` and with the matching single-side padding utility (`u.paddingLeft()`, `u.paddingRight()`, `u.pbs()`, `u.pbe()`), all of which write the same physical property and would simply replace this one's value.

**Parameters:**

- `side`: Which physical side to pad — this picks both the environment variable and the property written; required, there is no default. The four accepted values map as:
  - `"left"` — sets `padding-left` from `env(safe-area-inset-left)`
  - `"right"` — sets `padding-right` from `env(safe-area-inset-right)`
  - `"top"` — sets `padding-top` from `env(safe-area-inset-top)`
  - `"bottom"` — sets `padding-bottom` from `env(safe-area-inset-bottom)`
- `fallback`: The raw CSS length substituted when the browser doesn't know the variable at all; defaults to `"0px"`. Emitted verbatim and never resolved against the spacing scale, so `"1rem"` works and a bare number is not accepted

**Returns:**

- A `UtilityMixin` that sets the one physical padding property for `side` to `env(safe-area-inset-{side}, fallback)` on the host

**CSS:**

```css
/* u.safeAreaPadding("bottom") */
.host {
	padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* u.safeAreaPadding("top", "1rem") */
.host {
	padding-top: env(safe-area-inset-top, 1rem);
}

/* u.safeAreaPadding("left") */
.host {
	padding-left: env(safe-area-inset-left, 0px);
}

/* u.safeAreaPadding("right") */
.host {
	padding-right: env(safe-area-inset-right, 0px);
}
```

**Example:**

```typescript
let result = u.safeAreaPadding("bottom");
let topResult = u.safeAreaPadding("top");
let fallbackResult = u.safeAreaPadding("top", "1rem");
```

```tsx
<nav mix={[u.hstack(), u.pb(3), u.safeAreaPadding("bottom"), u.bg("neutral.tint")]}>{children}</nav>
```

#### `squircle(name?: RadiusName | (string & {})): UtilityMixin`

A shape pattern for continuous rounded corners: sets a radius and applies `corner-shape: squircle` as progressive enhancement where supported, falling back to the plain circular radius everywhere else. Composes `u.rounded()` and `u.corner("squircle")`.

This is the utility to reach for over pairing the two by hand, since it gets the `@supports` gating right for free. A squircle reads noticeably softer than a circular radius at the same nominal size, so it often wants a larger radius than you'd otherwise pick.

**Parameters:**

- `name`: A radius scale step or a raw CSS length, passed through to `u.rounded()`. Defaults to `"md"`.
  - `"none"` — `var(--ui-radius-none, 0px)`, which leaves nothing for the corner shape to act on
  - `"sm"` — `var(--ui-radius-sm, 0.25rem)`
  - `"md"` — `var(--ui-radius-md, 0.375rem)`, the default
  - `"lg"` — `var(--ui-radius-lg, 0.5rem)`
  - `"xl"` — `var(--ui-radius-xl, 0.75rem)`
  - `"full"` — `var(--ui-radius-full, 9999px)`
  - a raw CSS length (`"10px"`) — passed through literally
  - an app-extended name declared through module augmentation of `Radii`

**Returns:**

- A `UtilityMixin` that sets `border-radius` and, where supported, `corner-shape: squircle` behind `@supports`

**CSS:**

```css
/* u.squircle("lg") */
.host {
	border-radius: var(--ui-radius-lg, 0.5rem);
	@supports (corner-shape: squircle) {
		corner-shape: squircle;
	}
}
```

**Example:**

```typescript
let result = u.squircle();
let largeResult = u.squircle("xl");
let literalResult = u.squircle("10px");
```

```tsx
<div mix={[u.squircle("xl"), u.clip(), u.surface("muted"), u.p(4)]}>{children}</div>
```

Since it sets `border-radius`, it conflicts with `u.rounded()` and `u.roundedCorner()` on the same element.

#### `width(value: SizeValue): UtilityMixin`

Applies the physical `width` property. `u.is()` (`inline-size`) is the default choice for sizing the inline axis — reach for this one only when the measurement is genuinely physical and must not flip with writing mode: a box sized against the physical viewport width (`dvw`, `svw`), a `canvas`/`img`/`video` whose intrinsic pixel dimension is being mirrored in CSS, or chrome pinned to a fixed left/right offset that has to hold its dimension in both text directions.

`width("full")` emits `100%` and resolves against the parent's content width, so an ancestor with no definite width gives it nothing to fill. Pairs with `u.minWidth()` and `u.maxWidth()`, which clamp the same axis and win over it: CSS resolves `min-width` over `max-width` over `width`. Pairs with `u.height()` for the other physical axis and with `u.aspect()` — set one axis and let the ratio derive the other. Conflicts with `u.is()`: in a horizontal writing mode `width` and `inline-size` target the same axis, and because they're different property names nothing merges or dedupes them — both declarations reach the browser and the cascade picks the winner, which is not worth relying on. Pick one vocabulary per element.

**Parameters:**

- `value`: One sizing value; required, there is no default
  - a `number` — a step on the spacing scale, resolved as `calc(var(--ui-spacing, 0.25rem) * n)`, so `4` is `1rem` at the default `--ui-spacing`; negative numbers resolve the same way and are not rejected, even though `width` has no valid negative value
  - `"full"` — resolved to `100%`, the "fill my parent's width" keyword shared by every `SizeValue` utility
  - `"auto"` — passed straight through as `auto`, letting the layout mode determine the width
  - any other string — a raw CSS escape hatch, passed through untouched and unvalidated: a length (`"13px"`, `"100dvw"`), an intrinsic keyword (`"fit-content"`, `"min-content"`, `"max-content"`), a `calc()`, or a `var()` reference

**Returns:**

- A `UtilityMixin` that sets `width` on the host

**CSS:**

```css
/* u.width(4) */
.host {
	width: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.width("full") */
.host {
	width: 100%;
}

/* u.width("fit-content") */
.host {
	width: fit-content;
}
```

**Example:**

```typescript
let result = u.width("full");
let scaleResult = u.width(4);
let autoResult = u.width("auto");
let intrinsicResult = u.width("fit-content");
let rawResult = u.width("100dvw");
```

```tsx
<canvas mix={[u.width("320px"), u.height("320px"), u.rounded("lg")]} />
```

### Color

#### `accent(value?: ColorValue): UtilityMixin`

Sets `accent-color`, the single property native form controls read to paint their own chrome — a checkbox's fill, a radio's dot, a range slider's track, a progress bar's bar. It is the one way to brand those controls without replacing them: they otherwise ignore `background-color` entirely.

Defaults to `"brand"` so a bare `u.accent()` resolves to the brand's solid color rather than the browser default. Because `accent-color` is inherited, setting it once on a form covers every control inside.

Note it does not affect a control you have hidden with `u.visuallyHidden()` and repainted with a sibling — there the sibling's own `u.bg()` does the work.

**Parameters:**

- `value`: A `ColorValue` naming the tone to paint the control with, resolved with a default property of `bg-solid`. Defaults to `"brand"`.
  - a bare semantic tone (`"brand"`, `"danger"`, `"success"`) — always resolves to that tone's `bg-solid` shade, e.g. `var(--ui-brand-bg-solid)`
  - a tone with an explicit suffix (`"danger.solid"`, `"neutral.tint"`) — the suffix is resolved through the friendly-name alias table: `tint`→`bg-tint`, `solid`→`bg-solid`, `muted`→`fg-muted`, `emphasis`→`fg-emphasis`, `onSolid`→`fg-on-solid`, `strong`→`border-strong`
  - a raw palette reference (`"color.neutral.50"`) — resolves to `var(--ui-color-neutral-50)`
  - `"transparent"`, `"inherit"`, or `"currentColor"` — passed through as CSS keywords
  - any value containing `(` — a `u.colorMix()` result, a `var(...)` reference, a raw `oklch(...)` — handed through untouched instead of being parsed as a token

**Returns:**

- A `UtilityMixin` that sets `accent-color`

**CSS:**

```css
/* u.accent() */
.host {
	accent-color: var(--ui-brand-bg-solid);
}

/* u.accent("danger") */
.host {
	accent-color: var(--ui-danger-bg-solid);
}
```

**Example:**

```typescript
let result = u.accent();
let dangerResult = u.accent("danger");
let paletteResult = u.accent("color.brand.600");
```

Set once on the form, inherited by every native control inside:

```tsx
<form mix={[u.accent("brand"), u.vstack({ gap: 3 })]}>
	<label mix={[u.hstack({ gap: 2, align: "center" })]}>
		<input type="checkbox" />
		Subscribe
	</label>
	<input type="range" mix={[u.is("full")]} />
</form>
```

#### `autofill(background?: ColorValue, foreground?: ColorValue): UtilityMixin`

Overrides the background and text color a browser paints into an autofilled input, so a saved-credential field keeps looking like every other input instead of turning a bright yellow.

The implementation is deliberately blunt because nothing subtler works: browsers paint the autofill background from their own user-agent styles and ignore the input's `background-color`, so the only reliable cover is an inset `box-shadow` with a spread large enough to fill the whole field (`0 0 0 1000px ... inset`), and `!important` is required to beat the user-agent rule. The text color needs `-webkit-text-fill-color` for the same reason — plain `color` is ignored too.

Defaults to the system background and foreground tokens, which is what a plain input already looks like. Because it sets `box-shadow`, it conflicts with `u.shadow()` and `u.ringShadow()` while the field is autofilled.

**Parameters:**

- `background`: A `ColorValue` for the autofill background, resolved with no default property — so a bare tone without a suffix throws, and a suffix like `"neutral.tint"` is required. Defaults to `var(--ui-bg, Canvas)`.
- `foreground`: A `ColorValue` for the autofill text color, resolved with a default property of `fg`, so a bare tone like `"neutral"` works. Defaults to `var(--ui-fg, CanvasText)`.

**Returns:**

- A `UtilityMixin` applying an inset `box-shadow`/`-webkit-box-shadow` and `-webkit-text-fill-color` — each with `!important` — nested under `&:-webkit-autofill`

**CSS:**

```css
/* u.autofill() */
.host {
	&:-webkit-autofill {
		box-shadow: 0 0 0 1000px var(--ui-bg, Canvas) inset !important;
		-webkit-box-shadow: 0 0 0 1000px var(--ui-bg, Canvas) inset !important;
		-webkit-text-fill-color: var(--ui-fg, CanvasText) !important;
	}
}
```

**Example:**

```typescript
let result = u.autofill();
let themedResult = u.autofill("neutral.tint", "neutral");
```

It belongs alongside the input's own resting styles, so both states match:

```tsx
<input
	mix={[
		u.appearance(),
		u.font("inherit"),
		u.bg("color.neutral.50"),
		u.border("neutral"),
		u.rounded("md"),
		u.p(2),
		u.autofill("color.neutral.50", "neutral"),
		u.ring("brand"),
	]}
/>
```

#### `bg(value?: ColorValue): UtilityMixin` (overloaded: `bg(options: BgOptions): UtilityMixin`)

Sets `background-color`, or a full set of background properties when given an options object instead of a bare color.

Called with a semantic tone it **requires** an explicit `tint`/`solid` suffix, unlike `u.fg()` and `u.border()` which default to a sensible weight. That is deliberate: a background has no obvious default weight — a tinted panel and a solid filled block are entirely different treatments — so the call site has to say which it means. A bare `u.bg("brand")` will throw rather than guess.

Reach for `u.surface()` instead when the background needs a matching foreground and border, which is most of the time — it picks all three as a set so contrast holds by construction.

**Parameters:**

- `value`: A `ColorValue` describing the background. Omit it for the system default `var(--ui-bg, Canvas)`.
  - a tone with an explicit weight suffix (`"brand.tint"`, `"brand.solid"`) — required for tones; the suffix resolves through the alias table (`tint`→`bg-tint`, `solid`→`bg-solid`)
  - a raw palette reference (`"color.neutral.50"`) — resolves to `var(--ui-color-neutral-50)`
  - `"transparent"`, `"inherit"`, `"currentColor"` — passed through as CSS keywords
  - any value containing `(` — a `u.colorMix()` result, a `var(...)` reference, a gradient — handed through untouched
  - a bare tone with no suffix (`"brand"`) — **throws**, since no default property is supplied
- `options.color`: Sets `background-color`. Same accepted shapes as the bare `value` form, including the required suffix for tones.
- `options.image`: Sets `background-image` — a `url(...)` reference, or a gradient string from `u.linearGradient()`, `u.radialGradient()`, or `u.conicGradient()`
- `options.size`: Sets `background-size`.
  - `"auto"` — the image's intrinsic size
  - `"cover"` — scaled to fill the box, cropping overflow
  - `"contain"` — scaled to fit entirely inside the box, letterboxing
  - any other string — an explicit size such as `"100% auto"` or `"24px 24px"`
- `options.position`: Sets `background-position` — `"center"`, `"top left"`, `"50% 50%"`, or any raw position
- `options.repeat`: Sets `background-repeat`.
  - `"repeat"` — tiled on both axes, CSS's default
  - `"no-repeat"` — drawn once
  - `"repeat-x"` / `"repeat-y"` — tiled on one axis only
  - `"round"` — tiled, scaling the image so a whole number of tiles fits
  - `"space"` — tiled, distributing whitespace so no tile is clipped
- `options.attachment`: Sets `background-attachment`.
  - `"scroll"` — the image is fixed to the element and scrolls with it, CSS's default
  - `"fixed"` — fixed to the viewport, producing a parallax effect. Known to be janky on mobile browsers.
  - `"local"` — fixed to the element's _contents_, so it scrolls when the element scrolls internally
- `options.clip`: Sets `background-clip`, the area the background is actually painted in. A `BackgroundClipValue`.
  - `"border-box"` — out to the outer edge of the border. CSS's initial value, so a translucent or dashed border shows the background through its gaps.
  - `"padding-box"` — stops at the outer edge of the padding, so the border sits over the page rather than over the background
  - `"content-box"` — stops at the content edge, leaving the padding unpainted
  - `"text"` — clips the background to the shape of the element's glyphs

Only the keys given are set; omitted keys are left entirely alone rather than reset.

Two of the `clip` values carry real weight. `"content-box"` is how a background is kept from painting under the padding, which is what draws an inset scrollbar thumb: a thumb with padding and a content-box background reads as a narrow pill floating inside its track rather than filling it. `"text"` is how a gradient fills text — it needs a transparent text color (`u.fg("transparent")`) for the clipped background to show at all, and the text underneath must stay real, selectable text rather than being replaced by an image, so it remains readable to assistive technology, searchable, and translatable. Only the unprefixed property is emitted; an engine that still wants `-webkit-background-clip` needs `u.raw()` alongside.

**Returns:**

- A `UtilityMixin` that sets `background-color`, or whichever background properties the options object specifies

**CSS:**

```css
/* u.bg() */
.host {
	background-color: var(--ui-bg, Canvas);
}

/* u.bg("brand.tint") */
.host {
	background-color: var(--ui-brand-bg-tint);
}

/* u.bg({ image: "url(/hero.jpg)", size: "cover", position: "center", repeat: "no-repeat" }) */
.host {
	background-image: url(/hero.jpg);
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}

/* u.bg({ color: "brand.solid", clip: "content-box" }) */
.host {
	background-color: var(--ui-brand-bg-solid);
	background-clip: content-box;
}

/* u.bg({
     image: u.linearGradient("to right", "var(--ui-brand-fg)", "var(--ui-brand-fg-emphasis)"),
     clip: "text",
   }) */
.host {
	background-image: linear-gradient(to right, var(--ui-brand-fg), var(--ui-brand-fg-emphasis));
	background-clip: text;
}
```

**Example:**

```typescript
let result = u.bg();
let toneResult = u.bg("brand.tint");
let paletteResult = u.bg("color.neutral.50");
let heroResult = u.bg({ image: "url(/hero.jpg)", size: "cover", position: "center" });
let gradientResult = u.bg({ image: u.linearGradient("to right", "transparent", "currentColor") });
let mixedResult = u.bg(u.colorMix("oklab", { color: "currentcolor", weight: 8 }, "transparent"));
let insetResult = u.bg({ color: "neutral.solid", clip: "content-box" });
let textResult = u.bg({
	image: u.linearGradient(90, "var(--ui-brand-fg)", "var(--ui-brand-fg-emphasis)"),
	clip: "text",
});
```

An image background needs a color underneath it as a fallback for while the image loads or if it fails:

```tsx
<section
	mix={[
		u.bg({
			color: "color.neutral.900",
			image: "url(/hero.jpg)",
			size: "cover",
			position: "center",
		}),
		u.fg("color.neutral.50"),
		u.p(8),
	]}
>
	{children}
</section>
```

A gradient filling the glyphs of a heading: the background is clipped to the text and the text itself is made transparent, while the heading stays ordinary selectable markup.

```tsx
<h1
	mix={[
		u.text("4xl"),
		u.weight("bold"),
		u.bg({
			image: u.linearGradient("to right", "var(--ui-brand-fg)", "var(--ui-brand-fg-emphasis)"),
			clip: "text",
		}),
		u.fg("transparent"),
	]}
>
	{title}
</h1>
```

#### `border(value?: ColorValue): UtilityMixin` (overloaded: `border(options: BorderOptions): UtilityMixin`)

Sets `border-color`, or a full set of border properties when given an options object.

Called with a bare tone it defaults to that tone's plain `border` weight, which the theme layer promotes to `border-strong` under `prefers-contrast: more` — so a bare `u.border("brand")` is already contrast-aware. Called with no argument it falls back to a translucent mix over `CanvasText`.

The important trap: `border-color` and `border-width` alone render nothing, because CSS's initial `border-style` is `none`. The options form therefore defaults `style` to `"solid"` whenever `width` is given, and the bare-color form sets only the color — so a color-only call on an element with no border width shows nothing at all. Reach for `u.borderEdge()` to style a single edge.

**Parameters:**

- `value`: A `ColorValue` describing the border color, or the literal `"none"`. Omit it for the system default.
  - a bare semantic tone (`"brand"`, `"neutral"`) — resolves to that tone's default `border` weight, e.g. `var(--ui-brand-border)`
  - a tone with an explicit suffix (`"brand.strong"`) — resolved through the alias table, where `strong`→`border-strong`
  - a raw palette reference (`"color.neutral.200"`)
  - `"transparent"`, `"inherit"`, `"currentColor"` — passed through as CSS keywords. `"transparent"` is useful to reserve a border's space without showing it, so a hover state can colour it in without shifting layout.
  - any value containing `(` — handed through untouched
  - `"none"` — special-cased and emitted as the `border: none` **shorthand**, which resets color, width, and style together
  - omitted — `var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))`
- `options.color`: Same accepted shapes as the bare `value` form
- `options.width`: Sets `border-width`. A bare number is treated as pixels (`2` → `2px`); a string passes through unchanged, so `"thin"`, `"medium"`, `"thick"`, or `"0.125rem"` all work.
- `options.style`: Sets `border-style` — `"solid"`, `"dashed"`, `"dotted"`, `"double"`, `"groove"`, `"ridge"`, `"inset"`, `"outset"`, `"none"`, or `"hidden"`. Defaults to `"solid"` when `width` is given and `style` isn't.
- `options.noStyleDefault`: Suppresses that automatic `"solid"` default, so the call sets only `border-width`. Use it when a separate rule supplies the style and color and this call must not fight it. Has no effect when `style` is given explicitly.

Only the keys given are set.

**Returns:**

- A `UtilityMixin` that sets `border-color`, or whichever border properties the options object specifies

**CSS:**

```css
/* u.border() */
.host {
	border-color: var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent));
}

/* u.border("brand.strong") */
.host {
	border-color: var(--ui-brand-border-strong);
}

/* u.border({ color: "brand", width: 2 }) — style defaults to solid */
.host {
	border-color: var(--ui-brand-border);
	border-width: 2px;
	border-style: solid;
}

/* u.border({ width: 2, noStyleDefault: true }) */
.host {
	border-width: 2px;
}

/* u.border("none") — the shorthand, not a longhand */
.host {
	border: none;
}
```

**Example:**

```typescript
let result = u.border();
let toneResult = u.border("brand");
let strongResult = u.border("brand.strong");
let thickResult = u.border({ color: "brand", width: 2 });
let dashedResult = u.border({ color: "neutral", width: 1, style: "dashed" });
let widthOnlyResult = u.border({ width: 2, noStyleDefault: true });
let noneResult = u.border("none");
```

The transparent-border trick — space reserved up front so the hover state doesn't shift the layout:

```tsx
<button
	mix={[
		u.border({ color: "transparent", width: 2 }),
		u.rounded("md"),
		u.p(2),
		u.hover(u.border("brand")),
	]}
>
	{label}
</button>
```

#### `borderEdge(edge: BorderEdge, options?: BorderEdgeOptions): UtilityMixin`

Applies border longhands to a single edge instead of all four, so one side can be styled — a divider between two adjacent elements, say two stepper buttons sharing a frame — without reaching for `u.border()`'s all-sides form. `edge` names either a logical edge (preferred, so the divider follows writing mode) or a physical edge, for the rare case where it must stay pinned to a physical side. Only the given keys are set, same as `u.border()`'s options form, and `style` defaults to `"solid"` when `width` is given, since a `border-color`/`border-width` pair alone renders nothing (CSS's initial `border-style` is `none`).

It targets per-edge longhands (`border-inline-start-color` and friends), while `u.border()` targets the all-sides `border-color`/`border-width`/`border-style`. Those all-sides properties are themselves shorthands over every edge, so a `u.border()` listed after `u.borderEdge()` in the same `mix` array wins on that edge and erases the single-sided divider — put `u.borderEdge()` last when both are present. Two `borderEdge` calls naming different edges never conflict. Pairs with `u.rounded()` for a segmented control's outer corners, and with `u.hstack()`/`u.vstack()` for the row or column the divider sits inside.

**Parameters:**

- `edge`: A `BorderEdge` naming the side to style. Each maps to that side's three longhands, so `"inline-start"` writes `border-inline-start-color`/`-width`/`-style`. Required — there is no default.
  - `"block-start"`: the logical top edge — follows writing mode, becoming a side edge in a vertical writing mode.
  - `"block-end"`: the logical bottom edge — the usual choice for a row divider in a stacked list.
  - `"inline-start"`: the logical leading edge — the left edge in a left-to-right document, the right edge in a right-to-left one.
  - `"inline-end"`: the logical trailing edge — mirrors `"inline-start"` under right-to-left.
  - `"top"`, `"bottom"`, `"left"`, `"right"`: the physical edges, fixed regardless of writing mode or text direction. Reach for these only when the border must stay pinned to a physical side.
- `options`: Defaults to `{}`, which emits no declarations at all — an empty options object is a legal no-op, not an error.
- `options.color`: Sets the edge's border color. A `ColorValue`, resolved exactly as `u.border()`'s color is, defaulting to the tone's plain `border` property when the tone is bare. Accepts three shapes:
  - a bare semantic tone — `"brand"` resolves to `var(--ui-brand-border)`, which the theme layer promotes to that tone's `border-strong` value under `prefers-contrast: more`;
  - a tone with an explicit property suffix — `"brand.strong"` resolves to `var(--ui-brand-border-strong)`, through the friendly-suffix alias table: `tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`. A suffix outside that table is used as the property segment verbatim, so `"brand.ring"` resolves to `var(--ui-brand-ring)`;
  - a raw palette reference — `"color.neutral.200"` resolves to `var(--ui-color-neutral-200)`, bypassing the semantic layer entirely.
  - `"transparent"`, `"inherit"`, and `"currentColor"` pass straight through as CSS keywords, and any value containing `(` — a `u.colorMix()` result, a `var(...)` reference, a raw `oklch(...)` — is handed through untouched instead of being parsed as a `tone.property` token.
- `options.width`: Sets the edge's border width. A bare number is treated as pixels (`1` becomes `"1px"`); a string passes through unchanged (`"0.0625rem"`, `"thin"`). No default — omit it and no width declaration is emitted.
- `options.style`: Sets the edge's border style. A `BorderStyleValue`: `"solid"`, `"dashed"`, `"dotted"`, `"double"`, `"groove"`, `"ridge"`, `"inset"`, `"outset"`, `"none"`, or `"hidden"`. Defaults to `"solid"` when `width` is given and `style` isn't; emits nothing when neither is given.
- `options.noStyleDefault`: Suppresses that `"solid"` default, so a `width`-only call emits only the width — for when a separate rule supplies the edge's style and color. Has no effect when `style` is also given. Defaults to `false`.

**Returns:**

- A `UtilityMixin` that applies whichever of the edge's `-color`/`-width`/`-style` longhands the options object specifies, in that order.

**CSS:**

```css
/* u.borderEdge("inline-start", { width: 1 }) */
.host {
	border-inline-start-width: 1px;
	border-inline-start-style: solid;
}

/* u.borderEdge("block-end", { color: "brand", width: 2 }) */
.host {
	border-block-end-color: var(--ui-brand-border);
	border-block-end-width: 2px;
	border-block-end-style: solid;
}

/* u.borderEdge("block-start", { width: 1, style: "dashed" }) */
.host {
	border-block-start-width: 1px;
	border-block-start-style: dashed;
}

/* u.borderEdge("inline-start", { width: 2, noStyleDefault: true }) */
.host {
	border-inline-start-width: 2px;
}

/* u.borderEdge("right", { color: "neutral", width: 1, style: "solid" }) */
.host {
	border-right-color: var(--ui-neutral-border);
	border-right-width: 1px;
	border-right-style: solid;
}

/* u.borderEdge("inline-start", {}) — emits nothing at all */
```

**Example:**

```typescript
let result = u.borderEdge("inline-start", { width: 1 });
let dividerResult = u.borderEdge("block-end", { color: "brand", width: 2 });
let dashedResult = u.borderEdge("block-start", { width: 1, style: "dashed" });
let widthOnlyResult = u.borderEdge("inline-start", { width: 2, noStyleDefault: true });
let physicalResult = u.borderEdge("right", { color: "neutral", width: 1 });
let paletteResult = u.borderEdge("block-end", { color: "color.neutral.200", width: 1 });
```

```tsx
import * as u from "@pkg/u";

<div mix={[u.hstack(), u.border({ color: "neutral", width: 1 }), u.rounded("md")]}>
	<button mix={[u.p(2)]}>Decrement</button>
	<button mix={[u.p(2), u.borderEdge("inline-start", { color: "neutral", width: 1 })]}>
		Increment
	</button>
</div>;
```

#### `colorMix(colorSpace: string, ...stops: ColorMixStop[]): string`

Builds a `color-mix(...)` value string — a translucent tint of the current text color, a blend of two tones — for any property that takes a color. A plain string resolver, not a mixin. Its output passes back through the color token layer unchanged: that layer hands any value containing `(` straight through instead of parsing it as a `tone.property` token, so a mixed color is valid anywhere a `ColorValue` is accepted. That pass-through is the reason it composes at all, and the result drops directly into `u.fg()`, `u.bg()`, `u.border()`, `u.outlineColor()`, `u.fill()`, `u.stroke()`, or any options object's `color` key.

Because it returns a string rather than a mixin, it cannot go into a `mix` array on its own — it is always an argument to something else. It touches no CSS property itself, so it never conflicts with or overwrites another utility.

**Parameters:**

- `colorSpace`: The raw interpolation space CSS expects, written out as `in {colorSpace}`. Typed as a plain `string` and not validated, so any space CSS accepts works: `"oklab"` (perceptually even, the usual choice), `"oklch"`, `"srgb"`, `"srgb-linear"`, `"hsl"`, `"hwb"`, `"lab"`, `"lch"`, `"xyz"`. Required — there is no default.
- `stops`: Zero or more `ColorMixStop`s, joined with `", "`. Each is one of two shapes:
  - a raw color string — passed through verbatim. Anything CSS accepts as a color: `"transparent"`, `"currentcolor"`, `"red"`, `"#0f172a"`, `"oklch(0.52 0.18 250)"`, or an already-resolved token reference such as `u.var("ui-brand-bg-solid")`. Note this parameter is a raw CSS color, _not_ a `ColorValue` — a bare tone name like `"brand"` is not resolved here, so reach for `u.var()` (or the exported `color()` resolver) to bring a token in.
  - a `{ color, weight }` pair — emits `{color} {weight}`. A numeric `weight` is treated as a percentage and suffixed with `%` (`70` becomes `"70%"`); a string `weight` passes through unchanged, so a `calc()` expression or a `var(...)` reference works. `weight` is optional: a pair without one emits just its color, identical to passing the bare string.

**Returns:**

- The resolved `color-mix(...)` string. A plain string resolver, not a mixin.

**CSS:**

```css
/* u.fg(u.colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")) */
.host {
	color: color-mix(in oklab, currentcolor 70%, transparent);
}

/* u.border({ color: u.colorMix("srgb", { color: "red", weight: 30 }, "blue"), width: 1 }) */
.host {
	border-color: color-mix(in srgb, red 30%, blue);
	border-width: 1px;
	border-style: solid;
}
```

**Example:**

```typescript
let result = u.colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent");
// "color-mix(in oklab, currentcolor 70%, transparent)"
let unweightedResult = u.colorMix("oklab", "red", "blue");
// "color-mix(in oklab, red, blue)"
let weightedResult = u.colorMix("srgb", { color: "red", weight: 30 }, "blue");
// "color-mix(in srgb, red 30%, blue)"
let calcResult = u.colorMix(
	"oklab",
	{ color: "currentcolor", weight: "calc(100% - 20%)" },
	"transparent",
);
// "color-mix(in oklab, currentcolor calc(100% - 20%), transparent)"
let tokenResult = u.colorMix(
	"oklab",
	{ color: u.var("ui-brand-bg-solid"), weight: 15 },
	"transparent",
);
// "color-mix(in oklab, var(--ui-brand-bg-solid) 15%, transparent)"
```

```tsx
import * as u from "@pkg/u";

<blockquote
	mix={[
		u.p(4),
		u.fg(u.colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")),
		u.borderEdge("inline-start", {
			color: u.colorMix("oklab", { color: "currentcolor", weight: 25 }, "transparent"),
			width: 2,
		}),
	]}
>
	{children}
</blockquote>;
```

#### ``conicGradient(angle: number | `from ${number}deg` | `from ${number}deg at ${GradientPosition}` | (string & {}), ...stops: GradientStop[]): string``

Builds a `conic-gradient(...)` value string for `u.bg({ image })` or any other `background-image` use. A plain string resolver, not a mixin.

A conic gradient sweeps colors _around_ a centre point rather than along a line, which makes it the tool for pie and donut charts, hue wheels, and progress rings. Note that colors band sharply unless stops are placed deliberately — a two-stop conic gradient produces a hard edge, which is exactly what a pie slice wants.

**Parameters:**

- `angle`: Where the sweep starts, and optionally where its centre sits.
  - a `number` — treated as degrees and wrapped in the `from` keyword CSS requires, so `45` becomes `from 45deg`. `0deg` starts at the top and sweeps clockwise.
  - a `` `from ${number}deg` `` template string — passed through unchanged
  - a `` `from ${number}deg at ${GradientPosition}` `` template string — typed against the named positions, so `"from 0deg at center"` gets real autocomplete. The positions are `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top left"`, `"top right"`, `"bottom left"`, `"bottom right"`.
  - any other string — passed through unchanged, for a clause the template types don't cover such as a percentage position (`"from 0deg at 30% 70%"`)
- `stops`: Each stop is either:
  - a `GradientColor` — `"transparent"`, `"currentColor"`, or any other raw CSS color (a hex code, `rgb(...)`, `oklch(...)`, or a resolved token via the `tokens` subpath's `color()`)
  - a `{ color, position }` object — `position` is the raw angle or percentage at which the stop sits, e.g. `"25%"` or `"90deg"`

**Returns:**

- The resolved `conic-gradient(...)` string

**Example:**

```typescript
let result = u.conicGradient(45, "red", "blue");
// "conic-gradient(from 45deg, red, blue)"

let positionedResult = u.conicGradient("from 0deg at center", "transparent", "currentColor");
// "conic-gradient(from 0deg at center, transparent, currentColor)"

// Hard stops make discrete segments rather than a blend
let pieResult = u.conicGradient(
	0,
	{ color: "var(--ui-brand-bg-solid)", position: "0%" },
	{ color: "var(--ui-brand-bg-solid)", position: "60%" },
	{ color: "var(--ui-neutral-bg-tint)", position: "60%" },
	{ color: "var(--ui-neutral-bg-tint)", position: "100%" },
);
```

A progress ring, driven from a custom property so the value can change without rebuilding the gradient:

```tsx
<div
	role="img"
	aria-label={`${percent}% complete`}
	mix={[
		u.is(16),
		u.circle(),
		u.vars({ progress: `${percent}%` }),
		u.bg({
			image: u.conicGradient(
				0,
				{ color: "var(--ui-brand-bg-solid)", position: "var(--progress)" },
				{ color: "var(--ui-neutral-bg-tint)", position: "var(--progress)" },
			),
		}),
	]}
/>
```

#### `fg(value?: ColorValue): UtilityMixin`

Sets `color`, the foreground text color. Called with a bare tone it defaults to that tone's plain `fg` weight, so `u.fg("brand")` resolves without a suffix — unlike `u.bg()`, which requires one.

Since `color` is inherited, setting it on a container establishes the text color for the whole subtree. It also sets what `currentColor` resolves to, which is how an inline SVG icon picks up the surrounding text color — see `u.fill()` and `u.stroke()`.

Reach for `u.surface()` when the foreground should be chosen together with a matching background and border.

**Parameters:**

- `value`: A `ColorValue` describing the text color. Omit it for the system default `var(--ui-fg, CanvasText)`.
  - a bare semantic tone (`"brand"`, `"danger"`) — resolves to that tone's default `fg` weight, e.g. `var(--ui-brand-fg)`
  - a tone with an explicit suffix — resolved through the alias table: `muted`→`fg-muted` for de-emphasized text, `emphasis`→`fg-emphasis` for a stronger reading on a tinted background, `onSolid`→`fg-on-solid` for text sitting on that tone's solid fill
  - a raw palette reference (`"color.neutral.500"`)
  - `"transparent"`, `"inherit"`, `"currentColor"` — passed through as CSS keywords
  - any value containing `(` — handed through untouched

**Returns:**

- A `UtilityMixin` that sets `color`

**CSS:**

```css
/* u.fg() */
.host {
	color: var(--ui-fg, CanvasText);
}

/* u.fg("brand.muted") */
.host {
	color: var(--ui-brand-fg-muted);
}
```

**Example:**

```typescript
let result = u.fg();
let toneResult = u.fg("brand");
let mutedResult = u.fg("neutral.muted");
let onSolidResult = u.fg("brand.onSolid");
let paletteResult = u.fg("color.neutral.500");
```

The three tone weights doing the work they're named for — body, de-emphasized label, and text on a solid fill:

```tsx
<div mix={[u.vstack({ gap: 1 })]}>
	<span mix={[u.text("sm"), u.fg("neutral.muted")]}>{label}</span>
	<span mix={[u.text("lg"), u.fg()]}>{value}</span>
	<span mix={[u.surface("brand"), u.rounded("full"), u.pi(2), u.text("xs")]}>{badge}</span>
</div>
```

#### `fill(value?: ColorValue): UtilityMixin`

Sets `fill`, the SVG paint property a shape reads its interior color from. It targets SVG geometry — an inline icon's `<path>`, a chart's `<circle>` marks — rather than an HTML box, so it does nothing on a `<div>`; the box equivalent is `u.bg()`. It reads the same `ColorValue` token layer as `u.bg()`/`u.fg()`, so an icon can be painted from a semantic tone instead of a hardcoded color, and a `fill` set on the `<svg>` element inherits down to descendant shapes that don't set their own.

Pairs with `u.stroke()` on the same shape for a filled-and-outlined mark, and with `u.fillOpacity()` to make the interior translucent without touching the stroke. Nothing else in the package writes `fill`, so the only conflicts are a later `fill()` call in the same `mix` array and the `fill` presentation attribute in markup — a presentation attribute loses to any CSS declaration, so this utility wins over `<path fill="red">`.

**Parameters:**

- `value`: A `ColorValue` describing the paint. Accepts four shapes:
  - a bare semantic tone — `"brand"` resolves to `var(--ui-brand-fg)`, defaulting to the tone's plain `fg` property, matching `u.fg()`;
  - a tone with an explicit property suffix — `"neutral.tint"` resolves to `var(--ui-neutral-bg-tint)`, through the friendly-suffix alias table: `tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`. A suffix outside that table is used as the property segment verbatim, so `"brand.border"` resolves to `var(--ui-brand-border)`;
  - a raw palette reference — `"color.neutral.50"` resolves to `var(--ui-color-neutral-50)`;
  - `"none"`, special-cased before token resolution so it emits the CSS keyword `fill: none` — disabling the fill — rather than being read as a tone named `none`. `"transparent"`, `"inherit"`, and `"currentColor"` likewise pass through as keywords, and any value containing `(` (a `u.colorMix()` result, a `var(...)` reference) is handed through untouched.
  - Omit it entirely for the tiny system default, `var(--ui-fg, CanvasText)` — the same default `u.fg()` uses, so a bare `u.fill()` matches surrounding text.
- The bare-tone default (`fg`) is always supplied internally, so the token resolver's "has no property and no default was given" error is unreachable from this utility.

**Returns:**

- A `UtilityMixin` that applies `fill`.

**CSS:**

```css
/* u.fill() */
.host {
	fill: var(--ui-fg, CanvasText);
}

/* u.fill("brand") */
.host {
	fill: var(--ui-brand-fg);
}

/* u.fill("neutral.tint") */
.host {
	fill: var(--ui-neutral-bg-tint);
}

/* u.fill("color.neutral.50") */
.host {
	fill: var(--ui-color-neutral-50);
}

/* u.fill("none") */
.host {
	fill: none;
}
```

**Example:**

```typescript
let result = u.fill();
let toneResult = u.fill("brand");
let suffixResult = u.fill("neutral.tint");
let paletteResult = u.fill("color.neutral.50");
let unfilledResult = u.fill("none");
let currentColorResult = u.fill("currentColor");
```

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 24 24" mix={[u.is(4), u.bs(4)]}>
	<circle cx="12" cy="12" r="10" mix={[u.fill("brand.tint")]} />
	<path d="M8 12l3 3 5-6" mix={[u.fill("none"), u.stroke("brand"), u.strokeWidth(2)]} />
</svg>;
```

#### `fillOpacity(value: number | (string & {})): UtilityMixin`

Sets `fill-opacity`, the SVG paint property controlling a shape's fill transparency independently of `stroke-opacity` and the whole-element `opacity`. Reach for it when SVG geometry needs a translucent interior while its outline stays fully opaque — a chart's area band under a solid trend line — which `u.opacity()` cannot express, since that fades a shape's fill and stroke together.

A bare number is read as a 0-100 integer, matching `u.opacity()`'s convention rather than the CSS property's own 0-1 range. It requires a fill to be visible at all: on a shape with `u.fill("none")` there is nothing to make translucent. Pairs with `u.fill()` on the same shape, and composes under state wrappers such as `u.hover()` for a mark that solidifies on pointer-over. It writes only `fill-opacity`, so it stacks with `u.opacity()` rather than replacing it — both apply, and their effects multiply.

**Parameters:**

- `value`: Required — there is no default. Two accepted shapes:
  - a number — an integer from 0 to 100, divided by 100 before being written out, so `50` emits `0.5`, `100` emits `1`, and `0` emits `0`. Mind the consequence of the 0-100 scale: `fillOpacity(1)` is 1% opaque, all but invisible, not opaque.
  - a string — passed through unchanged, for a `var(...)` reference, a `calc()` expression, or a raw 0-1 CSS value written out directly.

**Returns:**

- A `UtilityMixin` that sets `fill-opacity` to `value / 100`, or to the string as given.

**CSS:**

```css
/* u.fillOpacity(50) */
.host {
	fill-opacity: 0.5;
}

/* u.fillOpacity(100) */
.host {
	fill-opacity: 1;
}

/* u.fillOpacity("var(--chart-fill-opacity)") */
.host {
	fill-opacity: var(--chart-fill-opacity);
}
```

**Example:**

```typescript
let result = u.fillOpacity(50);
let opaqueResult = u.fillOpacity(100);
let transparentResult = u.fillOpacity(0);
let variableResult = u.fillOpacity("var(--chart-fill-opacity)");
```

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 120 40" mix={[u.is("full"), u.bs(10)]}>
	<path
		d="M0 40L20 22L40 28L60 12L80 18L100 6L120 10L120 40Z"
		mix={[u.fill("brand"), u.fillOpacity(20), u.hover(u.fillOpacity(40))]}
	/>
	<path
		d="M0 40L20 22L40 28L60 12L80 18L100 6L120 10"
		mix={[u.fill("none"), u.stroke("brand"), u.strokeWidth(2)]}
	/>
</svg>;
```

#### `linearGradient(angle: number | GradientDirection, ...stops: GradientStop[]): string`

Builds a `linear-gradient(...)` value string for `u.bg({ image })` or any other `background-image` use. A plain string resolver, not a mixin — pass its result to `u.bg()`'s `image` option rather than putting it in a `mix` array.

The most common real use is a scrim: a gradient from a solid color to `transparent` laid over an image so overlaid text stays legible against an unpredictable photo.

**Parameters:**

- `angle`: The gradient's direction. A numeric value is treated as degrees; a string passes through unchanged, so CSS's side and corner keywords work and get autocomplete via `GradientDirection`.
  - a `number` — degrees, so `45` becomes `45deg`. `0deg` points up, and angles increase clockwise.
  - `"to top"`, `"to top right"`, `"to right"`, `"to bottom right"`, `"to bottom"`, `"to bottom left"`, `"to left"`, `"to top left"` — the named side and corner keywords
  - any other string — passed through unchanged, so raw angle units work: `"45deg"`, `"0.25turn"`, `"100grad"`
- `stops`: Each stop is either:
  - a `GradientColor` — `"transparent"`, `"currentColor"`, or any other raw CSS color
  - a `{ color, position }` object — `position` is the raw stop position, e.g. `"20%"` or `"2rem"`

Note that interpolating to `"transparent"` passes through transparent black in some color spaces, which can grey out the middle of a fade. Fading to an explicit fully transparent version of the same color avoids it.

**Returns:**

- The resolved `linear-gradient(...)` string

**Example:**

```typescript
let result = u.linearGradient(45, "red", { color: "blue", position: "80%" });
// "linear-gradient(45deg, red, blue 80%)"

let directionResult = u.linearGradient("to right", "transparent", "currentColor");
// "linear-gradient(to right, transparent, currentColor)"

let bgResult = u.bg({
	image: u.linearGradient("to right", "var(--ui-brand-bg-tint)", "var(--ui-brand-bg-solid)"),
});
```

The scrim pattern — a gradient over an image so the caption stays readable:

```tsx
<figure mix={[u.zstack(), u.rounded("lg"), u.clip()]}>
	<img mix={[u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
	<figcaption
		mix={[
			u.self("end"),
			u.is("full"),
			u.p(3),
			u.fg("color.neutral.50"),
			u.bg({ image: u.linearGradient("to top", "rgb(0 0 0 / 0.75)", "transparent") }),
		]}
	>
		{caption}
	</figcaption>
</figure>
```

#### `outline(color?: ColorValue, width?: number): UtilityMixin` (overloaded: `outline(width: number): UtilityMixin`, `outline(options: OutlineOptions): UtilityMixin`)

Applies an outline: `outline-color`, `outline-width`, and `outline-style` together, plus `outline-offset` — a property CSS's `outline` shorthand never includes, so setting it always takes a separate declaration.

Unlike `u.ring()`, this is unconditional: it does not nest under `&:focus-visible`. Use it for a persistent or decorative outline and reach for `u.ring()` for a focus indicator. An outline is drawn outside the border box and, unlike a border, takes up no layout space and does not affect the element's size — which makes it the right tool for anything that must not shift the page. It follows `border-radius` in modern browsers.

**Parameters:**

- `color`: A `ColorValue` describing the outline color, resolved with a default property of `ring`. Defaults to the system ring color `var(--ui-ring, Highlight)`. Accepts the same shapes as `u.border()`'s color.
- `width`: A width in pixels. Defaults to `2`.
- `options.color`: Same as the bare `color` form
- `options.width`: Sets `outline-width`. A bare number is treated as pixels; a string passes through unchanged. Defaults to `2`.
- `options.style`: Sets `outline-style`. Defaults to `"solid"`. Note `"auto"` here means "the platform's own focus ring", which is worth preserving rather than replacing when you have nothing better.
- `options.offset`: Sets `outline-offset`, the gap between the outline and the border edge. A bare number is treated as pixels; a string passes through unchanged. A negative value draws the outline inside the element, which is how `u.debug()` avoids shifting anything.

The four call shapes: no arguments (system color, 2px), a bare number (a width), a bare string (a color), a string plus a number (both), or an options object for everything including `style` and `offset`.

**Returns:**

- A `UtilityMixin` that sets `outline-color`, `outline-width`, `outline-style`, and — when given — `outline-offset`

**CSS:**

```css
/* u.outline() */
.host {
	outline-color: var(--ui-ring, Highlight);
	outline-width: 2px;
	outline-style: solid;
}

/* u.outline({ color: "danger", width: 2, offset: 4 }) */
.host {
	outline-color: var(--ui-danger-ring);
	outline-width: 2px;
	outline-style: solid;
	outline-offset: 4px;
}
```

**Example:**

```typescript
let result = u.outline();
let dangerResult = u.outline("danger");
let thickResult = u.outline(4);
let dangerThickResult = u.outline("danger", 4);
let offsetResult = u.outline({ color: "danger", offset: 4 });
let insetResult = u.outline({ color: "brand", offset: -2 });
```

```tsx
<div
	mix={[
		u.rounded("lg"),
		u.p(4),
		u.outline({ color: "brand", width: 2, style: "dashed", offset: 4 }),
	]}
>
	{dropZoneLabel}
</div>
```

It writes the same properties as `u.outlineColor()`, `u.outlineWidth()`, `u.outlineStyle()`, `u.ring()` (inside `:focus-visible`), and `u.debug()`, so those conflict with it on the same element.

#### `outlineColor(value?: ColorValue): UtilityMixin`

Sets only `outline-color`, leaving `outline-width` and `outline-style` untouched. `u.outline()` is the composite — it always writes `outline-color`, `outline-width`, and `outline-style` together, plus `outline-offset` when given — and `u.ring()` writes those same properties nested under `&:focus-visible`, so a ring only ever appears for keyboard and assistive-tech focus. This single-property utility is what a state override wants: an invalid or error rule can re-tint an outline another rule already established, without restating a width and style the element never asked for.

Because it targets the same property `u.outline()` and `u.ring()` do, whichever comes later in a `mix` array wins on the color — place `u.outlineColor()` after the composite when the point is to override it. On its own it renders nothing visible, since CSS's initial `outline-style` is `none`; something must supply a style and width, whether `u.outline()`, `u.ring()`, `u.outlineStyle()` plus `u.outlineWidth()`, or the browser's own focus outline.

**Parameters:**

- `value`: A `ColorValue` describing the outline color, resolved exactly as `u.outline()`'s `color` option is. Accepts three shapes:
  - a bare semantic tone — `"danger"` resolves to `var(--ui-danger-ring)`, defaulting to the tone's `ring` property;
  - a tone with an explicit property suffix — `"danger.strong"` resolves to `var(--ui-danger-border-strong)`, through the friendly-suffix alias table: `tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`. A suffix outside that table is the property segment verbatim, so `"danger.border"` resolves to `var(--ui-danger-border)`;
  - a raw palette reference — `"color.neutral.50"` resolves to `var(--ui-color-neutral-50)`.
  - `"transparent"`, `"inherit"`, and `"currentColor"` pass through as CSS keywords, and any value containing `(` — a `u.colorMix()` result, a `var(...)` reference — is handed through untouched rather than parsed as a `tone.property` token.
  - Omit it for the system default ring color, `var(--ui-ring, Highlight)`.
- The bare-tone default (`ring`) is always supplied internally, so the token resolver's "has no property and no default was given" error is unreachable from this utility.

**Returns:**

- A `UtilityMixin` that applies `outline-color` and nothing else — no width, no style.

**CSS:**

```css
/* u.outlineColor() */
.host {
	outline-color: var(--ui-ring, Highlight);
}

/* u.outlineColor("danger") */
.host {
	outline-color: var(--ui-danger-ring);
}

/* u.outlineColor("color.neutral.50") */
.host {
	outline-color: var(--ui-color-neutral-50);
}

/* u.invalid(u.outlineColor("danger")) */
.host:user-invalid,
.host[aria-invalid="true"] {
	outline-color: var(--ui-danger-ring);
}
```

**Example:**

```typescript
let result = u.outlineColor();
let toneResult = u.outlineColor("danger");
let suffixResult = u.outlineColor("danger.border");
let paletteResult = u.outlineColor("color.neutral.50");
let mixedResult = u.outlineColor(
	u.colorMix("oklab", { color: "currentcolor", weight: 40 }, "transparent"),
);
```

```tsx
import * as u from "@pkg/u";

<input
	mix={[
		u.p(2),
		u.border({ color: "neutral", width: 1 }),
		u.ring(),
		u.invalid(u.outlineColor("danger")),
	]}
/>;
```

#### `outlineStyle(value: OutlineStyleValue): UtilityMixin`

Sets only `outline-style`, leaving `outline-color` and `outline-width` untouched. Use it over the composite `u.outline()` when a state should swap just the stroke pattern of an outline that already exists — turning a solid outline dashed for a drop target, say — instead of restating a color and width. Unlike `u.outline()`, which defaults `style` to `"solid"`, the value here is required.

It writes the same property `u.outline()` and `u.ring()` write, so the later utility in a `mix` array wins; place this after the composite to override it. An `outline-style` is also what makes an outline render at all — a lone `u.outlineColor()` or `u.outlineWidth()` is invisible without one, because CSS's initial `outline-style` is `none`. Pairs with `u.outlineColor()` and `u.outlineWidth()` to assemble an outline property by property, and with `u.outline({ offset })` when a gap from the border edge is also wanted, since `outline-offset` is never part of the `outline` shorthand.

**Parameters:**

- `value`: An `OutlineStyleValue`. Required — there is no default; the CSS initial value `none` applies only when the property is never set at all.
  - `"solid"`: a single continuous line — the usual choice, and what `u.outline()` defaults to.
  - `"dashed"`: a line of short dashes, conventional for a pending or drop-target state.
  - `"dotted"`: a line of dots.
  - `"double"`: two parallel lines, whose combined thickness plus the gap between them equals `outline-width`.
  - `"groove"`: a line that appears carved into the page.
  - `"ridge"`: the inverse of `"groove"`, appearing to come out of the page.
  - `"inset"`: makes the outline appear embedded.
  - `"outset"`: the inverse of `"inset"`.
  - `"none"`: removes the outline, and its `outline-width` computes to `0`. Removing a focus outline without replacing it visibly is an accessibility regression — reach for `u.ring()` to supply a replacement indicator.
  - `"auto"`: hands the drawing to the browser, which may use a platform-specific focus style; unlike `"none"` it always renders something.

**Returns:**

- A `UtilityMixin` that applies `outline-style` and nothing else — no color, no width.

**CSS:**

```css
/* u.outlineStyle("dashed") */
.host {
	outline-style: dashed;
}

/* u.outlineStyle("none") */
.host {
	outline-style: none;
}
```

**Example:**

```typescript
let result = u.outlineStyle("dashed");
let dottedResult = u.outlineStyle("dotted");
let autoResult = u.outlineStyle("auto");
let noneResult = u.outlineStyle("none");
```

```tsx
import * as u from "@pkg/u";

<div
	mix={[
		u.p(6),
		u.outlineColor("neutral"),
		u.outlineWidth(2),
		u.outlineStyle("dashed"),
		u.data("dragging", [u.outlineColor("brand"), u.outlineStyle("solid")]),
	]}
>
	Drop files here
</div>;
```

#### `outlineWidth(value: number | (string & {})): UtilityMixin`

Sets only `outline-width`, leaving `outline-color` and `outline-style` untouched. Reach for it over `u.outline()` when a state should thicken or thin an outline another rule already colored and styled — the composite would re-emit its own `"solid"` style and the system ring color alongside the width, which a state override rarely means to do.

It writes the same property `u.outline()` and `u.ring()` write, so the later utility in a `mix` array wins on the width. On its own it renders nothing, since CSS's initial `outline-style` is `none` — pair it with `u.outlineStyle()` and `u.outlineColor()` to build an outline property by property, or let `u.outline()`/`u.ring()` supply the style and color and override just the width here. Distinct from `u.strokeWidth()`, which measures SVG stroke thickness in unitless user units rather than pixels.

**Parameters:**

- `value`: Required — there is no default, unlike `u.outline()`'s `width` option, which defaults to `2`. Two accepted shapes:
  - a number — treated as pixels, so `4` emits `"4px"`.
  - a string — passed through unchanged, for a value needing another unit (`"0.25rem"`), a CSS keyword (`"thin"`, `"medium"`, `"thick"`), a `var(...)` reference, or a `calc()` expression.

**Returns:**

- A `UtilityMixin` that applies `outline-width` and nothing else — no color, no style.

**CSS:**

```css
/* u.outlineWidth(4) */
.host {
	outline-width: 4px;
}

/* u.outlineWidth("0.25rem") */
.host {
	outline-width: 0.25rem;
}
```

**Example:**

```typescript
let result = u.outlineWidth(4);
let remResult = u.outlineWidth("0.25rem");
let keywordResult = u.outlineWidth("thick");
let variableResult = u.outlineWidth("var(--focus-width)");
```

```tsx
import * as u from "@pkg/u";

<button
	mix={[u.surface("brand"), u.p(2), u.rounded("md"), u.ring("brand"), u.active(u.outlineWidth(4))]}
>
	Save
</button>;
```

#### `radialGradient(shape: GradientShape, ...stops: GradientStop[]): string`

Builds a `radial-gradient(...)` value string for `u.bg({ image })` or any other `background-image` use. A plain string resolver, not a mixin.

A radial gradient radiates outward from a point, which suits a spotlight or glow effect behind content, or a soft vignette.

**Parameters:**

- `shape`: The raw shape, extent, and position clause CSS expects. `GradientShape` is a template literal type covering the bare keywords and their compound combinations, each checked against `GradientPosition`'s named positions; any other clause still passes through unchanged.
  - `"circle"` / `"ellipse"` — the gradient's shape. `ellipse` is CSS's default and stretches with the box; `circle` stays round.
  - `"closest-side"`, `"closest-corner"`, `"farthest-side"`, `"farthest-corner"` — the extent, i.e. where the final stop lands. `farthest-corner` is CSS's default.
  - `` `${"circle" | "ellipse"} at ${GradientPosition}` `` — shape plus centre, e.g. `"circle at top left"`
  - `` `${"circle" | "ellipse"} ${GradientExtent}` `` — shape plus extent, e.g. `"circle closest-side"`
  - `` `${"circle" | "ellipse"} ${GradientExtent} at ${GradientPosition}` `` — all three, e.g. `"circle closest-side at top left"`
  - any other string — passed through unchanged, for a clause the templates don't cover such as an explicit size or a percentage position (`"circle 8rem at 30% 20%"`)

  The named positions are `"center"`, `"top"`, `"bottom"`, `"left"`, `"right"`, `"top left"`, `"top right"`, `"bottom left"`, `"bottom right"`.

- `stops`: Each stop is either a `GradientColor` (`"transparent"`, `"currentColor"`, or any other raw CSS color) or a `{ color, position }` object adding a stop position.

**Returns:**

- The resolved `radial-gradient(...)` string

**Example:**

```typescript
let result = u.radialGradient("circle at top left", "red", "blue");
// "radial-gradient(circle at top left, red, blue)"

let extentResult = u.radialGradient("circle closest-side", "currentColor", "transparent");
// "radial-gradient(circle closest-side, currentColor, transparent)"

let literalResult = u.radialGradient(
	"circle 8rem at 30% 20%",
	"var(--ui-brand-bg-tint)",
	"transparent",
);
```

A soft glow behind a hero, kept out of the accessibility tree and out of pointer hit-testing:

```tsx
<section mix={[u.relative(), u.clip(), u.p(8)]}>
	<div
		aria-hidden="true"
		mix={[
			u.absolute(),
			u.inset(0),
			u.pointerEvents(),
			u.bg({ image: u.radialGradient("ellipse at top", "var(--ui-brand-bg-tint)", "transparent") }),
		]}
	/>
	<div mix={[u.relative(), u.vstack({ gap: 4 })]}>{children}</div>
</section>
```

#### `ring(value?: ColorValue): UtilityMixin`

Applies a focus ring. It composes `u.focusVisible()` internally, so the outline it draws only appears on `:focus-visible` — keyboard and assistive-technology focus — and never on a plain mouse click. That is the whole reason to reach for it rather than `u.outline()`: it makes the correct focus behavior the default, so a component doesn't have to remember the state wrapper.

It emits a `2px solid` outline with a `2px` offset, so the ring sits just outside the element and, since an outline takes no layout space, appearing never shifts the page.

Every interactive element needs a visible focus indicator. If you remove or override the platform default, this is the replacement.

**Parameters:**

- `value`: A `ColorValue` describing the ring color, resolved with a default property of `ring`. Omit it for the system default `var(--ui-ring, Highlight)` — the platform's own highlight color, which is a reasonable default and respects forced-colors modes.
  - a bare semantic tone (`"brand"`, `"danger"`) — resolves to that tone's `ring` weight, e.g. `var(--ui-danger-ring)`
  - a tone with an explicit suffix — resolved through the alias table
  - a raw palette reference (`"color.brand.500"`)
  - `"transparent"`, `"inherit"`, `"currentColor"` — passed through as CSS keywords
  - any value containing `(` — handed through untouched

**Returns:**

- A `UtilityMixin` that applies the outline declarations nested under `&:focus-visible`

**CSS:**

```css
/* u.ring() */
.host {
	&:focus-visible {
		outline-width: 2px;
		outline-style: solid;
		outline-offset: 2px;
		outline-color: var(--ui-ring, Highlight);
	}
}

/* u.ring("danger") */
.host {
	&:focus-visible {
		outline-width: 2px;
		outline-style: solid;
		outline-offset: 2px;
		outline-color: var(--ui-danger-ring);
	}
}
```

**Example:**

```typescript
let result = u.ring();
let brandResult = u.ring("brand");
let dangerResult = u.ring("danger");
```

The ring tone usually follows the control's own tone, so an invalid field focuses in danger rather than brand:

```tsx
<input
	aria-invalid={hasError ? "true" : undefined}
	mix={[
		u.border("neutral"),
		u.rounded("md"),
		u.p(2),
		u.ring("brand"),
		u.invalid([u.border("danger"), u.ring("danger")]),
	]}
/>
```

Because it already wraps `:focus-visible`, don't nest it inside `u.focusVisible()` again — and note it writes the same outline properties as `u.outline()`, so the two conflict.

#### `stroke(value?: ColorValue): UtilityMixin`

Sets `stroke`, the SVG paint property a shape reads its outline color from. Like `u.fill()`, it targets SVG geometry — an inline icon's `<path>`, a chart's `<line>` — rather than an HTML box, so it does nothing on a `<div>`; the box equivalent is `u.border()`. It reads the same `ColorValue` token layer as `u.bg()`/`u.fg()`, so a stroked icon can be painted from a semantic tone, and a `stroke` set on the `<svg>` element inherits down to descendant shapes that don't set their own.

It is the prerequisite for the rest of the stroke family: `u.strokeWidth()`, `u.strokeLinecap()`, and `u.strokeLinejoin()` only describe a stroke's geometry, and none of them render anything on a shape whose stroke is absent or `"none"`. Commonly paired with `u.fill("none")` on line-art icons, where the path should be outlined but not filled. Nothing else in the package writes `stroke`, so the only conflicts are a later `stroke()` call in the same `mix` array and the `stroke` presentation attribute in markup — which loses to any CSS declaration, so this utility wins over `<path stroke="red">`.

**Parameters:**

- `value`: A `ColorValue` describing the stroke paint, resolved exactly as `u.fill()`'s value is. Accepts four shapes:
  - a bare semantic tone — `"brand"` resolves to `var(--ui-brand-fg)`, defaulting to the tone's plain `fg` property;
  - a tone with an explicit property suffix — `"neutral.tint"` resolves to `var(--ui-neutral-bg-tint)`, through the friendly-suffix alias table: `tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`. A suffix outside that table is the property segment verbatim, so `"neutral.border"` resolves to `var(--ui-neutral-border)`;
  - a raw palette reference — `"color.neutral.50"` resolves to `var(--ui-color-neutral-50)`;
  - `"none"`, special-cased before token resolution so it emits the CSS keyword `stroke: none` — disabling the stroke — rather than being read as a tone named `none`. `"transparent"`, `"inherit"`, and `"currentColor"` likewise pass through as keywords, and any value containing `(` is handed through untouched.
  - Omit it entirely for the tiny system default, `var(--ui-fg, CanvasText)`, so a bare `u.stroke()` matches surrounding text.
- The bare-tone default (`fg`) is always supplied internally, so the token resolver's "has no property and no default was given" error is unreachable from this utility.

**Returns:**

- A `UtilityMixin` that applies `stroke`.

**CSS:**

```css
/* u.stroke() */
.host {
	stroke: var(--ui-fg, CanvasText);
}

/* u.stroke("brand") */
.host {
	stroke: var(--ui-brand-fg);
}

/* u.stroke("neutral.tint") */
.host {
	stroke: var(--ui-neutral-bg-tint);
}

/* u.stroke("color.neutral.50") */
.host {
	stroke: var(--ui-color-neutral-50);
}

/* u.stroke("none") */
.host {
	stroke: none;
}
```

**Example:**

```typescript
let result = u.stroke();
let toneResult = u.stroke("brand");
let suffixResult = u.stroke("neutral.tint");
let paletteResult = u.stroke("color.neutral.50");
let unstrokedResult = u.stroke("none");
let currentColorResult = u.stroke("currentColor");
```

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 24 24" mix={[u.is(5), u.bs(5)]}>
	<path
		d="M4 12h16M12 4v16"
		mix={[u.fill("none"), u.stroke("brand"), u.strokeWidth(2), u.strokeLinecap("round")]}
	/>
</svg>;
```

#### `strokeLinecap(value: "butt" | "round" | "square"): UtilityMixin`

Sets `stroke-linecap`, the SVG paint property controlling how a stroke renders at the two open ends of an unclosed subpath. It applies to SVG geometry only — an icon's line segments, a chart's plotted line — and has nothing to do with an HTML box's borders or `u.rounded()`.

It requires a visible stroke to have any effect: on a shape with no `u.stroke()`, or with `u.stroke("none")`, there are no caps to draw, and on a fully closed subpath there are no open ends. It has no say over corners _within_ a path either — that is `u.strokeLinejoin()`, the natural companion for keeping an icon set's endpoints and corners consistent. Worth knowing that `"round"` and `"square"` both extend the stroke half its width past each endpoint, so a path drawn flush to the `viewBox` edge can clip; leave a margin, or pick `"butt"`.

**Parameters:**

- `value`: Required — there is no default; the CSS initial value `butt` applies only when the property is never set at all.
  - `"butt"`: the CSS initial value — the stroke stops flat exactly at the endpoint, adding no length.
  - `"round"`: a half-circle of the stroke's own width caps each end, extending half a stroke width past the endpoint. The usual choice for line-art icon sets.
  - `"square"`: a half-square caps each end, extending half a stroke width past the endpoint — the same added length as `"round"`, squared off.

**Returns:**

- A `UtilityMixin` that applies `stroke-linecap`.

**CSS:**

```css
/* u.strokeLinecap("round") */
.host {
	stroke-linecap: round;
}

/* u.strokeLinecap("butt") */
.host {
	stroke-linecap: butt;
}

/* u.strokeLinecap("square") */
.host {
	stroke-linecap: square;
}
```

**Example:**

```typescript
let result = u.strokeLinecap("round");
let flatResult = u.strokeLinecap("butt");
let squareResult = u.strokeLinecap("square");
```

```tsx
import * as u from "@pkg/u";

<svg
	viewBox="0 0 24 24"
	mix={[
		u.is(5),
		u.bs(5),
		u.fill("none"),
		u.stroke("currentColor"),
		u.strokeWidth(2),
		u.strokeLinecap("round"),
		u.strokeLinejoin("round"),
	]}
>
	<path d="M6 6l12 12M18 6L6 18" />
</svg>;
```

#### `strokeLinejoin(value: "miter" | "round" | "bevel"): UtilityMixin`

Sets `stroke-linejoin`, the SVG paint property controlling how a stroke renders at a corner between two segments. It applies to SVG geometry — a `<polyline>` icon, a `<polygon>`, a chart's plotted path — rather than an HTML box, and is unrelated to `u.rounded()`, which rounds a box's corners.

It requires a visible stroke to have any effect: with no `u.stroke()`, or with `u.stroke("none")`, there are no joins to draw. It governs interior corners only; the two open ends of a subpath are `u.strokeLinecap()`'s job, and the two are almost always set together so an icon set's corners and endpoints agree. Note that the default `"miter"` produces a spike on very sharp angles, which is why `"round"` is the common choice for softer icon sets.

**Parameters:**

- `value`: Required — there is no default; the CSS initial value `miter` applies only when the property is never set at all.
  - `"miter"`: the CSS initial value — the two outer edges are extended until they meet in a sharp point. On a very acute angle this produces a long spike.
  - `"round"`: the corner is rounded off with an arc of the stroke's own width. The usual choice for line-art icon sets.
  - `"bevel"`: the corner is cut off flat, filling the notch between the two segments with a triangle.

**Returns:**

- A `UtilityMixin` that applies `stroke-linejoin`.

**CSS:**

```css
/* u.strokeLinejoin("round") */
.host {
	stroke-linejoin: round;
}

/* u.strokeLinejoin("miter") */
.host {
	stroke-linejoin: miter;
}

/* u.strokeLinejoin("bevel") */
.host {
	stroke-linejoin: bevel;
}
```

**Example:**

```typescript
let result = u.strokeLinejoin("round");
let sharpResult = u.strokeLinejoin("miter");
let cutResult = u.strokeLinejoin("bevel");
```

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 24 24" mix={[u.is(5), u.bs(5)]}>
	<path
		d="M12 3l8 6v9H4V9z"
		mix={[u.fill("brand.tint"), u.stroke("brand"), u.strokeWidth(2), u.strokeLinejoin("round")]}
	/>
</svg>;
```

#### `strokeWidth(value: number | (string & {})): UtilityMixin`

Sets `stroke-width`, the SVG paint property controlling how thick a shape's stroke renders. Unlike `u.outlineWidth()`, a bare number stays unitless: SVG's `stroke-width` is measured in the SVG's own user units, and stamping a `px` suffix on it would tie the thickness to the viewport instead of the shape's coordinate system.

It requires a visible stroke to show anything — with no `u.stroke()`, or with `u.stroke("none")`, there is nothing to thicken. Because user units scale with the `viewBox`-to-rendered-box ratio, a stroke drawn at `1` in a `0 0 24 24` icon rendered at 96px comes out four times thicker than the same icon at 24px; pair with `u.vectorEffect("non-scaling-stroke")` to hold the rendered thickness constant instead. Also pairs with `u.strokeLinecap()` and `u.strokeLinejoin()`, whose caps and joins are both sized from this width. Nothing else in the package writes `stroke-width`, and the `stroke-width` presentation attribute in markup loses to this declaration.

**Parameters:**

- `value`: Required — there is no default; the CSS initial value `1` applies only when the property is never set at all. Two accepted shapes:
  - a number — emitted as a unitless SVG user-unit value, so `2` becomes `"2"`. Deliberately _not_ suffixed with `px`, the opposite of `u.outlineWidth()`'s convention.
  - a string — passed through unchanged for a value that does need an explicit unit or another form: `"0.5%"` (resolved against the viewport's diagonal), `"1px"`, a `var(...)` reference, or a `calc()` expression.

**Returns:**

- A `UtilityMixin` that applies `stroke-width`.

**CSS:**

```css
/* u.strokeWidth(2) */
.host {
	stroke-width: 2;
}

/* u.strokeWidth("0.5%") */
.host {
	stroke-width: 0.5%;
}
```

**Example:**

```typescript
let result = u.strokeWidth(2);
let hairlineResult = u.strokeWidth(1);
let percentResult = u.strokeWidth("0.5%");
let pixelResult = u.strokeWidth("1px");
```

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 24 24" mix={[u.is(6), u.bs(6), u.fill("none"), u.stroke("neutral")]}>
	<path
		d="M4 18l6-8 4 4 6-9"
		mix={[u.stroke("brand"), u.strokeWidth(2), u.strokeLinecap("round")]}
	/>
	<path d="M4 20h16" mix={[u.strokeWidth(1)]} />
</svg>;
```

#### `surface(recipe?: SurfaceRecipe): UtilityMixin`

A surface recipe, not a single-property utility: it composes `u.bg()`, `u.fg()`, and `u.border()` so a surface's background, text, and border are chosen as a matching set rather than one channel at a time. This is the utility to reach for whenever an element is a _surface_ — a card, a panel, a badge, a filled button — because it makes contrast a property of the recipe instead of something each call site has to get right.

It accepts only the four recipe shapes below, never a raw palette value like `"color.brand.500"`. That restriction is the point: a background picked in isolation has no guaranteed readable foreground.

**Parameters:**

- `recipe`: A `SurfaceRecipe` naming which surface to build. Defaults to `"default"`.
  - `"default"` — the tiny system defaults: `u.bg()`, `u.fg()`, and `u.border()` with no arguments, resolving to `Canvas`/`CanvasText`/a translucent border. Use it for a plain page-level surface.
  - `"muted"` — a neutral, low-emphasis surface: `neutral.tint` background, `neutral` foreground, `neutral` border. Use it for a recessed panel or a secondary card.
  - a bare tone (`"brand"`, `"danger"`, `"success"`, `"warning"`, `"neutral"`) — a solid, high-emphasis surface: that tone's `bg-solid` background, `fg-on-solid` foreground, and `bg-solid` border. Background and border match deliberately, so the surface reads as one filled block. Use it for a primary button or a strong status badge.
  - `${tone}.tinted` (`"brand.tinted"`, `"danger.tinted"`) — a soft, tinted surface: that tone's `bg-tint` background, `fg-emphasis` foreground, and `border` border. Use it for an inline callout or an alert where a solid fill would shout.

**Returns:**

- A `UtilityMixin` composing the background, foreground, and border declarations for the chosen recipe

**CSS:**

```css
/* u.surface() */
.host {
	background-color: var(--ui-bg, Canvas);
	color: var(--ui-fg, CanvasText);
	border-color: var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent));
}

/* u.surface("muted") */
.host {
	background-color: var(--ui-neutral-bg-tint);
	color: var(--ui-neutral-fg);
	border-color: var(--ui-neutral-border);
}

/* u.surface("brand") — solid, background and border matching */
.host {
	background-color: var(--ui-brand-bg-solid);
	color: var(--ui-brand-fg-on-solid);
	border-color: var(--ui-brand-bg-solid);
}

/* u.surface("brand.tinted") */
.host {
	background-color: var(--ui-brand-bg-tint);
	color: var(--ui-brand-fg-emphasis);
	border-color: var(--ui-brand-border);
}
```

**Example:**

```typescript
let result = u.surface();
let mutedResult = u.surface("muted");
let solidResult = u.surface("brand");
let tintedResult = u.surface("danger.tinted");
```

Note it sets `border-color` but no `border-width`, so the border only shows once a width exists:

```tsx
<aside
	mix={[
		u.surface("warning.tinted"),
		u.border({ width: 1 }),
		u.rounded("lg"),
		u.p(4),
		u.hstack({ gap: 3 }),
	]}
>
	<span aria-hidden="true">⚠</span>
	<p mix={[u.pretty()]}>{message}</p>
</aside>
```

Because the tone variables are redefined for dark mode by the theme layer, a `surface()` call adapts on its own — you rarely need `u.dark()` alongside it.

#### `translucent(name?: BlurName | (string & {})): UtilityMixin`

An accessible translucent-surface pattern: a solid background plus a backdrop blur, with the blur gated behind `@media (prefers-reduced-transparency: no-preference)`. A user who has asked for reduced transparency keeps the plain solid background instead of getting a half-applied blur that hurts legibility.

That gating is the reason to reach for this rather than composing `u.bg()` and `u.backdropBlur()` by hand. It composes `u.bg()`'s system default, `u.backdropBlur()`'s declaration, and `u.media()`'s gate, with no hand-built media query of its own.

Note the background it sets is the _opaque_ system default `var(--ui-bg, Canvas)`, which leaves nothing for the blur to show through. To get an actual frosted effect, override the background with a translucent color after this call — a `u.colorMix()` against `transparent` is the usual way.

**Parameters:**

- `name`: A `BlurName` or raw CSS length selecting the blur strength. Defaults to `"md"`.
  - `"sm"` — `var(--ui-blur-sm, 4px)`
  - `"md"` — `var(--ui-blur-md, 12px)`, the default
  - `"lg"` — `var(--ui-blur-lg, 24px)`
  - a raw CSS length (`"8px"`) — passed through literally
  - an app-extended name declared through module augmentation of `Blurs`

**Returns:**

- A `UtilityMixin` applying the system default background plus a gated backdrop-filter blur

**CSS:**

```css
/* u.translucent("sm") */
.host {
	background-color: var(--ui-bg, Canvas);
	@media (prefers-reduced-transparency: no-preference) {
		--ui-backdrop-blur: var(--ui-blur-sm, 4px);
		backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
			contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
			hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
			opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
			sepia(var(--ui-backdrop-sepia, 0))
			drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
		-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
			brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
			grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
			invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
			saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
			drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	}
}
```

**Example:**

```typescript
let result = u.translucent();
let subtleResult = u.translucent("sm");
let strongResult = u.translucent("lg");
```

The complete frosted bar — `translucent()` for the gated blur and the opaque fallback, then a translucent background layered over it so the blur has something to act on:

```tsx
<header
	mix={[
		u.sticky(),
		u.insBs(0),
		u.layer(10),
		u.translucent("md"),
		u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 80 }, "transparent")),
		u.borderEdge("block-end", { color: "neutral", width: 1 }),
		u.pi(4),
		u.pb(3),
	]}
>
	{nav}
</header>
```

If you also apply `u.backdropSaturate()`, note that it is _not_ gated the way this blur is, so a reduced-transparency user would keep the saturation — wrap it in the same `u.media()` condition when that matters.

#### `vectorEffect(value: "none" | "non-scaling-stroke" | "non-scaling-size" | "non-rotation" | "fixed-position"): UtilityMixin`

Sets `vector-effect`, the SVG property that exempts a shape from some or all of the transforms its ancestors apply. The one worth knowing is `"non-scaling-stroke"`. Inside an SVG whose `viewBox` is fitted to a larger or smaller rendered box — or one being zoomed, or sitting under a CSS `transform` — the thickness set by `u.strokeWidth()` scales along with the geometry, so a line drawn at 1 user unit renders as a heavy band in a blown-up chart and all but vanishes in a shrunken one. `"non-scaling-stroke"` resolves the stroke's width _after_ that scaling, against the rendered coordinate system, keeping a chart's gridlines or an icon's outline visually constant while the shape itself still scales and stays responsive.

It applies to SVG geometry only, and does nothing on an HTML box. It only matters when a stroke exists and an ancestor scale is in play — on an unscaled SVG rendered at its `viewBox` size it changes nothing visible. Pairs directly with `u.strokeWidth()`, which supplies the width being held constant, and with `u.stroke()`, without which there is no stroke to preserve. Nothing else in the package writes `vector-effect`.

**Parameters:**

- `value`: Required — there is no default; the CSS initial value `none` applies only when the property is never set at all.
  - `"none"`: the CSS initial value — the shape and its stroke scale entirely with their ancestor transforms.
  - `"non-scaling-stroke"`: the stroke's width ignores the ancestor scale, so its rendered thickness stays constant while the geometry scales. The widely implemented option, and the reason to reach for this utility.
  - `"non-scaling-size"`: the shape's own geometry ignores the ancestor scale, only its position being transformed.
  - `"non-rotation"`: the shape ignores rotation from its ancestor transforms while still scaling and translating.
  - `"fixed-position"`: the shape ignores translation from its ancestor transforms, holding its position. Browser support for this and the two above it is far thinner than for `"non-scaling-stroke"`.

**Returns:**

- A `UtilityMixin` that applies `vector-effect`.

**CSS:**

```css
/* u.vectorEffect("non-scaling-stroke") */
.host {
	vector-effect: non-scaling-stroke;
}

/* u.vectorEffect("none") */
.host {
	vector-effect: none;
}
```

**Example:**

```typescript
let result = u.vectorEffect("non-scaling-stroke");
let noneResult = u.vectorEffect("none");
let sizeResult = u.vectorEffect("non-scaling-size");
let rotationResult = u.vectorEffect("non-rotation");
let positionResult = u.vectorEffect("fixed-position");
```

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 100 40" preserveAspectRatio="none" mix={[u.is("full"), u.bs(20)]}>
	<path
		d="M0 36h100M0 20h100M0 4h100"
		mix={[u.stroke("neutral"), u.strokeWidth(1), u.vectorEffect("non-scaling-stroke")]}
	/>
	<path
		d="M0 32L20 18L40 24L60 10L80 16L100 6"
		mix={[
			u.fill("none"),
			u.stroke("brand"),
			u.strokeWidth(2),
			u.vectorEffect("non-scaling-stroke"),
		]}
	/>
</svg>;
```

### Typography

#### `balance(): UtilityMixin`

Balances line lengths across a wrapped block so each line ends up closer to the same width, instead of leaving a short last line dangling. Browsers cap balancing to a small number of lines — six or so — which makes it a headline tool: on long-form body copy it simply does nothing. Reach for `u.pretty()` there.

Because balancing requires the browser to lay the block out more than once, keep it off text that could be arbitrarily long.

**Returns:**

- A `UtilityMixin` that sets `text-wrap: balance`

**CSS:**

```css
/* u.balance() */
.host {
	text-wrap: balance;
}
```

**Example:**

```typescript
let result = u.balance();
```

```tsx
<h1 mix={[u.type("4xl"), u.weight("bold"), u.balance(), u.maxIs("30ch")]}>{title}</h1>
```

It sets the same `text-wrap` property as `u.pretty()`, so applying both leaves the winner to the cascade — pick one per element.

#### `font(name: FontFamilyName | (string & {})): UtilityMixin`

Applies `font-family` from the named font-family scale. Resolves through `var(--ui-font-{name}, fallback)`, so the family renders correctly even before an app defines the corresponding CSS variable.

`u.text()` deliberately does not set a family, so it composes under whatever `font()` a call site already applied. Reach for `u.type()` instead when you want the base sans family and a size in one call.

**Parameters:**

- `name`: A named font family, an app-extended name declared through module augmentation of `FontFamilies`, or one of two literal keywords.
  - `"sans"` — `var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)`
  - `"serif"` — `var(--ui-font-serif, ui-serif, Georgia, serif)`
  - `"mono"` — `var(--ui-font-mono, ui-monospace, SFMono-Regular, monospace)`
  - `"inherit"` / `"unset"` — passed through literally rather than `var()`-wrapped, so an element can defer to its ancestor's family. Any _other_ unrecognized name is treated as an app-extended token and resolves to `var(--ui-font-{name}, sans-serif)`.

**Returns:**

- A `UtilityMixin` that sets `font-family`

**CSS:**

```css
/* u.font("serif") */
.host {
	font-family: var(--ui-font-serif, ui-serif, Georgia, serif);
}

/* u.font("inherit") */
.host {
	font-family: inherit;
}
```

**Example:**

```typescript
let result = u.font("serif");
let monoResult = u.font("mono");
let inheritResult = u.font("inherit");
```

`font-family` is inherited, so setting it on a container covers the subtree — and `inherit` is how a form control opts back in, since browsers give inputs their own default family:

```tsx
<input
	mix={[
		u.font("inherit"),
		u.text("base"),
		u.appearance(),
		u.border("neutral"),
		u.rounded("md"),
		u.p(2),
	]}
/>
```

#### `fontSize(name: TextSizeName | (string & {})): UtilityMixin`

Applies `font-size` from the named text scale and nothing else, resolving through the same `var(--ui-text-{name}, fallback)` token as `text()`'s font-size half but without its paired `line-height`. Reach for it when a call site wants a size without inheriting the scale's paired leading — which means the leading becomes yours to choose, either by pairing it with `leading()` or by deliberately letting the element keep whatever it inherits; `text()` at that call site would silently add a `line-height` declaration that was never there. `fontSize()`, `text()`, and `type()` all write the same `font-size` property, so combining any two of them is a conflict resolved purely by order — the later utility in the `mix` array wins, and `text()` or `type()` after `fontSize()` also drags its `line-height` back in.

**Parameters:**

- `name`: A named text size, an app-extended name declared through module augmentation, or a raw CSS length. Required — there is no default size.
  - `xs`: `var(--ui-text-xs, 0.75rem)`
  - `sm`: `var(--ui-text-sm, 0.875rem)`
  - `base`: `var(--ui-text-base, 1rem)`
  - `lg`: `var(--ui-text-lg, 1.125rem)`
  - `xl`: `var(--ui-text-xl, 1.25rem)`
  - `2xl`: `var(--ui-text-2xl, 1.5rem)`
  - `3xl`: `var(--ui-text-3xl, 1.875rem)`
  - `4xl`: `var(--ui-text-4xl, 2.25rem)`
  - `5xl`: `var(--ui-text-5xl, 3rem)`
  - `6xl`: `var(--ui-text-6xl, 3.75rem)`
  - `7xl`: `var(--ui-text-7xl, 4.5rem)`
  - `8xl`: `var(--ui-text-8xl, 6rem)`
  - `9xl`: `var(--ui-text-9xl, 8rem)`
  - An app-extended name (say `hero`): resolves to `var(--ui-text-hero, 1rem)`, the `1rem` fallback standing in until the app defines `--ui-text-hero`
  - A raw CSS length (`"0.9375rem"`, `"3ch"`, `"5cqw"`): used verbatim, never wrapped in a `var(...)` reference. Only a plain number-plus-unit length is recognized as literal — a computed value such as `"clamp(1rem, 2vw, 2rem)"` is not, and would be treated as a token name and resolve to `var(--ui-text-clamp(1rem, 2vw, 2rem), 1rem)`. Compose a computed size through `u.raw({ fontSize: ... })` instead.

**Returns:**

- A `UtilityMixin` that sets `font-size`.

**CSS:**

```css
/* u.fontSize("lg") */
.host {
	font-size: var(--ui-text-lg, 1.125rem);
}

/* u.fontSize("0.9375rem") */
.host {
	font-size: 0.9375rem;
}
```

**Example:**

```typescript
let result = u.fontSize("lg");
let literalResult = u.fontSize("0.9375rem");
let withExplicitLeading = [u.fontSize("lg"), u.leading("tight")];
```

```tsx
<p mix={[u.fontSize("lg"), u.leading("tight"), u.font("serif")]}>
	A pull quote sized from the scale, but leaded tighter than the scale pairs it.
</p>
```

#### `fontVariantNumeric(value?: FontVariantNumericValue): UtilityMixin`

Applies `font-variant-numeric`, the property that selects which OpenType numeral features the font should use — how digits are shaped and sized, and how fractions and ordinals are composed. `u.tabularNums()` already sets this property to `tabular-nums` and stays the right call for that common case; this is the primitive for every other value, and the two conflict on the same element because both write the same declaration. The default here is `"tabular-nums"` too, so a bare `u.fontVariantNumeric()` is just the long way to say `u.tabularNums()`.

Every one of these values is a _request_ for a feature the font must actually ship. A font with no `onum` table silently ignores `"oldstyle-nums"` and renders its ordinary digits — no error, no fallback — so check the typeface before relying on one. That makes this a font-feature hint rather than a layout guarantee.

The values that genuinely earn their place: `"slashed-zero"` to tell 0 apart from O in an identifier, key, or code sample; `"diagonal-fractions"` for a measurement or a recipe quantity; `"oldstyle-nums"` for numerals set inside running prose, where lining figures read as too loud. Because the property accepts a space-separated combination, the raw-string escape is how you ask for more than one feature at once.

**Parameters:**

- `value`: A `FontVariantNumericValue` naming the numeral feature to request. Defaults to `"tabular-nums"`.
  - `"normal"` — disables every one of these features
  - `"ordinal"` — shapes ordinal markers (`1st`, `2ª`) as proper superscript glyphs
  - `"slashed-zero"` — draws zero with a slash through it, so it can't be misread as a capital O
  - `"lining-nums"` — digits that all sit on the baseline at cap height
  - `"oldstyle-nums"` — text figures, with ascenders and descenders like lowercase letters
  - `"proportional-nums"` — each digit gets its own natural width
  - `"tabular-nums"` — every digit gets the same width, so columns line up. The default.
  - `"diagonal-fractions"` — shapes `1/2` as a slanted fraction
  - `"stacked-fractions"` — shapes `1/2` as a stacked, horizontal-bar fraction
  - any other string — the raw escape, which is how a space-separated combination of the above is passed through

**Returns:**

- A `UtilityMixin` that sets `font-variant-numeric`

**CSS:**

```css
/* u.fontVariantNumeric() */
.host {
	font-variant-numeric: tabular-nums;
}

/* u.fontVariantNumeric("slashed-zero") */
.host {
	font-variant-numeric: slashed-zero;
}

/* u.fontVariantNumeric("tabular-nums slashed-zero") */
.host {
	font-variant-numeric: tabular-nums slashed-zero;
}
```

**Example:**

```typescript
let result = u.fontVariantNumeric();
let slashedResult = u.fontVariantNumeric("slashed-zero");
let fractionResult = u.fontVariantNumeric("diagonal-fractions");
let oldstyleResult = u.fontVariantNumeric("oldstyle-nums");
let combinedResult = u.fontVariantNumeric("tabular-nums slashed-zero");
```

An identifier that will be read aloud or retyped, where a slashed zero is the difference between a working key and a support ticket — and the combination form for a monospaced value that must also line up in a column:

```tsx
<code mix={[u.font("mono"), u.fontVariantNumeric("slashed-zero"), u.fontSize("sm")]}>
	{deploymentId}
</code>

<td
	mix={[
		u.font("mono"),
		u.fontVariantNumeric("tabular-nums slashed-zero"),
		u.textAlign("end"),
		u.pi(3),
	]}
>
	{checksum}
</td>
```

#### `hyphens(value?: HyphensValue): UtilityMixin`

Applies `hyphens`, letting a long word break with a hyphen at the end of a line instead of forcing the line to stay short. It is the typographic answer to a narrow measure — a sidebar, a card, a table cell — where a single long word would otherwise leave a visible gap at the end of every other line.

`"auto"` only works when the element's language is known: the browser picks a hyphenation dictionary from a `lang` attribute on the element or on one of its ancestors, and with no `lang` anywhere it has no dictionary to consult and hyphenates nothing at all. That missing attribute is by far the most common reason this utility looks broken.

It pairs naturally with `u.textAlign("justify")`. Justifying text without hyphenation stretches the word spacing of each line to fill the measure, which opens uneven rivers of whitespace down the column; hyphenation is the standard fix, giving the justification more break points to work with. For a string with no dictionary entry at all — a URL, a hash, a generated identifier — hyphenation can't help, and `u.overflowWrap()` is the tool that breaks it.

**Parameters:**

- `value`: A `HyphensValue` deciding how the browser may hyphenate. Defaults to `"auto"`.
  - `"none"` — never hyphenates, not even at an explicit soft hyphen in the markup
  - `"manual"` — CSS's own default: breaks only where the markup already marks an opportunity with `&shy;` or `<wbr>`
  - `"auto"` — the browser hyphenates on its own, using its hyphenation dictionary for the element's language. The default, and the value that needs `lang`.

**Returns:**

- A `UtilityMixin` that sets `hyphens`

**CSS:**

```css
/* u.hyphens() */
.host {
	hyphens: auto;
}

/* u.hyphens("manual") */
.host {
	hyphens: manual;
}

/* u.hyphens("none") */
.host {
	hyphens: none;
}
```

**Example:**

```typescript
let result = u.hyphens();
let manualResult = u.hyphens("manual");
let noneResult = u.hyphens("none");
```

Justified prose in a narrow column, with the `lang` attribute that makes `"auto"` do anything at all:

```tsx
<p lang="en" mix={[u.hyphens(), u.textAlign("justify"), u.maxIs("34ch"), u.leading("relaxed")]}>
	{body}
</p>
```

#### `leading(value?: LeadingValue): UtilityMixin`

Applies `line-height`. Named values resolve through `var(--ui-leading-{name}, fallback)`, so an app can override the scale without losing the default; a raw number passes through as a unitless multiplier, and any other string passes through as a literal length.

Prefer unitless values — a unitless line-height is inherited as a _ratio_, so a child at a different font size gets proportional leading, while an inherited length stays fixed and crowds larger text. Note that `u.text()` and `u.type()` already set a paired line-height, so a `leading()` on the same element is an override; put it after them.

**Parameters:**

- `value`: A named scale step, a raw number, or a raw CSS length. Defaults to `"normal"`.
  - `"none"` — `var(--ui-leading-none, 1)`, leading equal to the font size
  - `"tight"` — `var(--ui-leading-tight, 1.25)`
  - `"snug"` — `var(--ui-leading-snug, 1.375)`
  - `"normal"` — `var(--ui-leading-normal, 1.5)`, the default
  - `"relaxed"` — `var(--ui-leading-relaxed, 1.625)`
  - `"loose"` — `var(--ui-leading-loose, 2)`
  - a `number` — emitted bare as a unitless multiplier, e.g. `1.8`
  - any other string — emitted literally, so `"2rem"` or `"24px"` works. Note a fixed length does not scale with font size.

**Returns:**

- A `UtilityMixin` that sets `line-height`

**CSS:**

```css
/* u.leading("relaxed") */
.host {
	line-height: var(--ui-leading-relaxed, 1.625);
}

/* u.leading(1.8) */
.host {
	line-height: 1.8;
}

/* u.leading("2rem") */
.host {
	line-height: 2rem;
}
```

**Example:**

```typescript
let result = u.leading("relaxed");
let numberResult = u.leading(1.8);
let lengthResult = u.leading("2rem");
```

Overriding the size scale's paired leading — the order matters, since both set `line-height`:

```tsx
<p mix={[u.text("lg"), u.leading("relaxed"), u.pretty(), u.maxIs("65ch")]}>{body}</p>
```

#### `lineClamp(lines: number): UtilityMixin`

Truncates text to a fixed number of lines and ends it with an ellipsis, using the standard `-webkit-line-clamp` trick: a `-webkit-box` with vertical box orientation. Widely supported despite the vendor prefix — there is still no unprefixed equivalent with comparable support.

Note it sets `display`, so the element becomes a `-webkit-box` and stops being a block, flex, or grid container. Apply it to a leaf text element rather than to something whose layout you also need. Because it clips visually but leaves the full text in the DOM, the clipped remainder is still read by assistive technology, which is usually what you want — but it also means the ellipsis is not a substitute for actually shortening the content.

**Parameters:**

- `lines`: The number of lines to show before truncating. A value of `1` works but `u.truncate()` is the better single-line tool, since it doesn't hijack `display`.

**Returns:**

- A `UtilityMixin` that sets `display: -webkit-box`, `-webkit-box-orient: vertical`, `-webkit-line-clamp`, and `overflow: hidden`

**CSS:**

```css
/* u.lineClamp(3) */
.host {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	overflow: hidden;
}
```

**Example:**

```typescript
let result = u.lineClamp(3);
let twoLineResult = u.lineClamp(2);
```

```tsx
<article mix={[u.vstack({ gap: 1 })]}>
	<h3 mix={[u.text("lg"), u.weight("semibold"), u.truncate()]}>{title}</h3>
	<p mix={[u.text("sm"), u.fg("neutral.muted"), u.lineClamp(3)]}>{excerpt}</p>
</article>
```

It conflicts with every display utility (`u.flex()`, `u.grid()`, `u.block()`) and with `u.overflow()`, since it sets both properties itself.

#### `nowrap(): UtilityMixin`

Prevents text from wrapping onto multiple lines, letting it overflow its box instead. On its own that means the text spills out visibly, so it is normally a building block rather than a finished treatment: pair it with `u.truncate()` for an ellipsis, or with `u.scroll("x")` to let the overflow be scrolled.

Its honest uses are short strings that read wrong when broken — a button label, a table header, a numeric value with its unit, a keyboard shortcut. Keep it off body copy, where it prevents reflow at narrow widths and forces horizontal scrolling.

**Returns:**

- A `UtilityMixin` that sets `white-space: nowrap`

**CSS:**

```css
/* u.nowrap() */
.host {
	white-space: nowrap;
}
```

**Example:**

```typescript
let result = u.nowrap();
```

```tsx
<th mix={[u.nowrap(), u.textAlign("start"), u.pi(3), u.weight("medium")]}>{label}</th>
```

`u.truncate()` already includes it, so the two together are redundant. It also conflicts with `u.wordBreak()`'s effect: `nowrap` suppresses the wrapping opportunities `wordBreak` exists to create.

#### `overflowWrap(value?: OverflowWrapValue): UtilityMixin`

Applies `overflow-wrap`, which lets the browser break inside a word _only_ when that word would otherwise overflow its line. Ordinary text keeps breaking at its normal opportunities and stays intact. This is the right tool for a long URL, hash, or generated identifier sitting in a narrow column.

The distinction from `u.wordBreak()` is the whole point, and picking wrong is the common mistake. `overflow-wrap` breaks a word only as a last resort, so prose around the offending token is untouched; `word-break: break-all` breaks at any character on every line, which fixes the overflow but mangles the surrounding prose along with it. Reach for this utility first — `word-break` is for CJK line-breaking rules (`"keep-all"`) and for the deliberate all-characters case. `u.wordBreak("break-word")` is a deprecated legacy alias that browsers treat as `overflow-wrap: break-word` under a different property name; prefer this utility and say what you mean.

Two conditions govern whether it does anything. There must be a bounded inline size for a line to overflow in the first place — a `u.maxIs()`, a grid column, or a flex item given `u.minIs(0)`; an auto-width element just grows instead. And `u.nowrap()` removes the very wrapping opportunities this creates, so applying both cancels out; use `u.truncate()` or `u.lineClamp()` instead when the overflow should be cut off rather than wrapped.

**Parameters:**

- `value`: An `OverflowWrapValue`. Defaults to `"break-word"`.
  - `"normal"` — the initial behavior: breaks only at spaces and other ordinary opportunities, so a long unbroken token overflows
  - `"break-word"` — the overflowing word is broken, but the element's intrinsic `min-content` size is still computed from the unbroken word, so a flex or grid item sized from its content still refuses to shrink below that width. The default.
  - `"anywhere"` — the same last-resort breaking, except the break counts toward `min-content` too, which is what actually lets such an item shrink. Reach for it when the box itself is the thing that will not get smaller.

**Returns:**

- A `UtilityMixin` that sets `overflow-wrap`

**CSS:**

```css
/* u.overflowWrap() */
.host {
	overflow-wrap: break-word;
}

/* u.overflowWrap("anywhere") */
.host {
	overflow-wrap: anywhere;
}
```

**Example:**

```typescript
let result = u.overflowWrap();
let anywhereResult = u.overflowWrap("anywhere");
let normalResult = u.overflowWrap("normal");
```

A definition list whose values are URLs: the prose label wraps normally, the URL breaks only where it has to, and the `"anywhere"` variant is what lets the flex row's own column stop growing.

```tsx
<dd mix={[u.maxIs("32ch"), u.overflowWrap(), u.font("mono"), u.fontSize("sm")]}>
	https://example.com/very/long/path/that/has/no/spaces/to/wrap/at
</dd>

<div mix={[u.hstack({ gap: 2 })]}>
	<span mix={[u.nowrap(), u.fg("neutral.muted")]}>Endpoint</span>
	<span mix={[u.minIs(0), u.overflowWrap("anywhere"), u.font("mono")]}>{endpoint}</span>
</div>
```

#### `pretty(): UtilityMixin`

Avoids leaving a short orphan word alone on the last line of a wrapped block. Unlike `u.balance()`, it scales to long-form body copy — browsers don't cap how many lines it applies to — so it is the safe default for prose, with `balance()` reserved for headings.

**Returns:**

- A `UtilityMixin` that sets `text-wrap: pretty`

**CSS:**

```css
/* u.pretty() */
.host {
	text-wrap: pretty;
}
```

**Example:**

```typescript
let result = u.pretty();
```

Because `text-wrap` is inherited, setting it once on a prose container covers every paragraph inside:

```tsx
<div mix={[u.vstack({ gap: 4 }), u.pretty(), u.maxIs("65ch"), u.leading("relaxed")]}>
	{children}
</div>
```

It sets the same property as `u.balance()`, so pick one per element.

#### `tabSize(value?: number | (string & {})): UtilityMixin`

Applies `tab-size`, the width a literal tab character renders at. A bare number is a count of space characters and is emitted unitless, which is what the property expects; a string passes through unchanged so a CSS length works too.

It only has any effect where tab characters actually survive into the rendered text, which means alongside `u.whiteSpace("pre")` or `u.whiteSpace("pre-wrap")`. Under collapsed whitespace every tab has already become a single space, so there is nothing left to size and this declaration does nothing.

The real use is a code block: the browser's default of 8 is far wider than any modern source file is indented, and 2 or 4 matches what the code was written against.

**Parameters:**

- `value`: The tab width, as a count of space characters or as a CSS length. Defaults to `2`.
  - a `number` (`2`, `4`, `0`) — a count of space characters, emitted unitless
  - a `string` (`"4ch"`, `"2rem"`) — passed through unchanged, so a CSS length works

**Returns:**

- A `UtilityMixin` that sets `tab-size`

**CSS:**

```css
/* u.tabSize() */
.host {
	tab-size: 2;
}

/* u.tabSize(4) */
.host {
	tab-size: 4;
}

/* u.tabSize("4ch") */
.host {
	tab-size: 4ch;
}
```

**Example:**

```typescript
let result = u.tabSize();
let fourResult = u.tabSize(4);
let lengthResult = u.tabSize("4ch");
```

A code block, which is where the pairing with a preserving `white-space` value is the whole point — without it the tabs have already collapsed and `tab-size` is inert:

```tsx
<pre mix={[u.whiteSpace("pre-wrap"), u.tabSize(2), u.font("mono"), u.fontSize("sm")]}>{source}</pre>
```

#### `tabularNums(): UtilityMixin`

Switches digits to fixed-advance glyphs, so every numeral occupies the same width. Proportional figures are the default in most families, which makes a column of numbers shift sideways from row to row and a live-updating counter or countdown jitter on every tick — a table of figures, a running total, or a one-time-code field wants this. Pair it with `textAlign("end")` in a numeric table column so the digits also line up on their least significant place. It is a font-feature request rather than a layout override, so it only takes effect in families that actually ship tabular figures; it takes no argument and there is no "off" call, so revert by composing `u.raw({ fontVariantNumeric: "normal" })`.

**Returns:**

- A `UtilityMixin` that sets `font-variant-numeric: tabular-nums`.

**CSS:**

```css
/* u.tabularNums() */
.host {
	font-variant-numeric: tabular-nums;
}
```

**Example:**

```typescript
let result = u.tabularNums();
```

```tsx
<td mix={[u.tabularNums(), u.textAlign("end"), u.pi(3), u.fontSize("sm")]}>1,284.05</td>
```

#### `text(name: TextSizeName | (string & {})): UtilityMixin`

Applies `font-size` from the named text scale together with its paired `line-height`. Font size resolves through `var(--ui-text-{name}, fallback)`; line height resolves through the companion `var(--ui-leading-{name}, fallback)`, so an app extending the scale with its own name gets a sensible default the moment it defines `--ui-text-{name}`, before ever defining the matching leading.

It deliberately does not set `font-family`, so it composes under whatever `u.font()` a call site already applied. Reach for `u.type()` when you want the base sans family in the same call, and add an explicit `u.leading()` after it to override the paired leading.

**Parameters:**

- `name`: A named text size, or an app-extended name declared through module augmentation of `TextSizes`. Each step resolves to a font size and a paired line-height fallback:
  - `"xs"` — `0.75rem`, leading `calc(1 / 0.75)`
  - `"sm"` — `0.875rem`, leading `calc(1.25 / 0.875)`
  - `"base"` — `1rem`, leading `1.5`
  - `"lg"` — `1.125rem`, leading `calc(1.75 / 1.125)`
  - `"xl"` — `1.25rem`, leading `1.4`
  - `"2xl"` — `1.5rem`, leading `calc(2 / 1.5)`
  - `"3xl"` — `1.875rem`, leading `1.2`
  - `"4xl"` — `2.25rem`, leading `calc(2.5 / 2.25)`
  - `"5xl"` — `3rem`, leading `1`
  - `"6xl"` — `3.75rem`, leading `1`
  - `"7xl"` — `4.5rem`, leading `1`
  - `"8xl"` — `6rem`, leading `1`
  - `"9xl"` — `8rem`, leading `1`
  - a raw CSS length (`"0.9375rem"`) — passed through literally as the font size. Only an atomic number-plus-unit is detected as a length, so a `clamp(...)` or `calc(...)` expression is _not_ passed through and would be treated as a token name.

The leading fallbacks are ratios rather than lengths so they scale with the font size, and the display sizes from `5xl` up collapse to `1`, which is how large type reads best.

**Returns:**

- A `UtilityMixin` that sets `font-size` and `line-height`

**CSS:**

```css
/* u.text("lg") */
.host {
	font-size: var(--ui-text-lg, 1.125rem);
	line-height: var(--ui-leading-lg, calc(1.75 / 1.125));
}
```

**Example:**

```typescript
let result = u.text("lg");
let displayResult = u.text("5xl");
let literalResult = u.text("0.9375rem");
```

Composed under a family the container already set, so the size stays family-agnostic:

```tsx
<div mix={[u.font("serif")]}>
	<h2 mix={[u.text("3xl"), u.weight("semibold"), u.balance()]}>{heading}</h2>
	<p mix={[u.text("base"), u.pretty()]}>{body}</p>
</div>
```

Reach for `u.fontSize()` when you want a size _without_ the paired leading.

#### `textAlign(value?: TextAlignValue): UtilityMixin`

Applies `text-align`, with the logical `start`/`end` keywords as the typed, autocompleted values so alignment flips automatically in right-to-left writing modes through the standard `dir` attribute. The physical `left`/`right` keywords are still accepted through the raw-string escape, for the rare case where alignment is genuinely meant to stay physical regardless of direction — a numeric column that should stay right-aligned in every locale, say.

**Parameters:**

- `value`: A `TextAlignValue`. Defaults to `"start"`.
  - `"start"` — the leading edge: left in `ltr`, right in `rtl`. The default.
  - `"center"` — centered
  - `"end"` — the trailing edge: right in `ltr`, left in `rtl`
  - `"justify"` — stretched to both edges by adjusting word spacing. Use sparingly: without hyphenation it opens uneven rivers of whitespace, which is harder to read.
  - any other string — a raw escape, including the physical `"left"` and `"right"`, plus `"match-parent"` and `"justify-all"`

**Returns:**

- A `UtilityMixin` that sets `text-align`

**CSS:**

```css
/* u.textAlign("end") */
.host {
	text-align: end;
}

/* u.textAlign("left") */
.host {
	text-align: left;
}
```

**Example:**

```typescript
let result = u.textAlign();
let endResult = u.textAlign("end");
let centerResult = u.textAlign("center");
let physicalResult = u.textAlign("left");
```

`text-align` is inherited, so a numeric column can be set once on the cell and align its contents:

```tsx
<td mix={[u.textAlign("end"), u.tabularNums(), u.pi(3)]}>{amount}</td>
```

Note it aligns _inline content_ inside the box, not the box itself — to move the element, reach for `u.justify()`, `u.self()`, or `u.mi("auto")`.

#### `textDecoration(value?: TextDecorationLineValue): UtilityMixin` (overloaded: `textDecoration(options: TextDecorationOptions): UtilityMixin`)

Applies `text-decoration-line`, or a full set of text-decoration properties when given an options object instead of a bare line value. The bare form emits the longhand only — never the `text-decoration` shorthand — so it adds or removes the line without resetting the style, color, or thickness set elsewhere on the same element. The options form is equally surgical: only the keys given are set, and omitted keys are left entirely alone rather than reset.

Removing a link's default underline with `"none"` takes away the only non-color cue that the text is a link, so leave another affordance in place — commonly restoring the underline under `hover()` and `focusVisible()`.

`offset` is worth reaching for on any underlined text. At the default offset an underline runs straight through the descenders of letters like `g`, `j`, and `p`, which both looks wrong and costs legibility; `text-underline-offset` is the standard fix, pushing the line down far enough to clear them. It and `thickness` are the two properties the `text-decoration` shorthand does _not_ include, which is why they are separate keys here rather than folded into one declaration: a shorthand set elsewhere will not reset them, and they cannot be set through it either.

**Parameters:**

- `value`: Which decoration line to draw. A `TextDecorationLineValue`, defaulting to `"underline"`.
  - `"none"` — draws no line, and removes a line inherited from an ancestor or a UA default such as a link's underline
  - `"underline"` — a line below the text. The default.
  - `"overline"` — a line above the text
  - `"line-through"` — a line through the middle of the text, for struck-out or superseded values
- `options.line`: Sets `text-decoration-line`. Same four values as the bare form. No default in this form — omit it and no line is set, so a call can restyle a decoration the element already has.
- `options.color`: Sets `text-decoration-color`, resolved through the token layer with a default property of `fg` — so a bare tone works and the decoration can be tinted away from the text's own color. No default; omitted, the line takes the text's `currentColor`.
  - a bare semantic tone (`"brand"`, `"danger"`) — resolves to that tone's `fg` weight, e.g. `var(--ui-brand-fg)`
  - a tone with an explicit suffix (`"danger.muted"`, `"brand.emphasis"`) — resolved through the alias table, where `muted`→`fg-muted`, `emphasis`→`fg-emphasis`
  - a raw palette reference (`"color.neutral.400"`) — resolves to `var(--ui-color-neutral-400)`
  - `"transparent"`, `"inherit"`, `"currentColor"` — passed through as CSS keywords
  - any value containing `(` — a `u.colorMix()` result or a `var(...)` reference — handed through untouched
- `options.style`: Sets `text-decoration-style`. A `TextDecorationStyleValue`, no default.
  - `"solid"` — an unbroken line, CSS's own default
  - `"double"` — two parallel lines
  - `"dotted"` / `"dashed"` — a broken line, quieter than solid at the same thickness
  - `"wavy"` — the squiggle spell-checkers use, so it reads as "this text is wrong" and belongs with an error tone
- `options.thickness`: Sets `text-decoration-thickness`. A bare number is treated as pixels (`2` → `2px`); a string passes through unchanged, which is how `"auto"` and `"from-font"` — the font's own metric, the best choice when it has one — are expressed. No default.
- `options.offset`: Sets `text-underline-offset`, the distance between the text's baseline and its underline. A bare number is treated as pixels (`3` → `3px`); a string passes through unchanged, including `"auto"`. No default.

**Returns:**

- A `UtilityMixin` that sets `text-decoration-line`, or whichever of the five text-decoration properties the options object specifies

**CSS:**

```css
/* u.textDecoration() */
.host {
	text-decoration-line: underline;
}

/* u.textDecoration("none") */
.host {
	text-decoration-line: none;
}

/* u.textDecoration({ line: "underline", color: "brand", offset: 3 }) */
.host {
	text-decoration-line: underline;
	text-decoration-color: var(--ui-brand-fg);
	text-underline-offset: 3px;
}

/* u.textDecoration({ style: "wavy", color: "danger", thickness: "from-font" }) */
.host {
	text-decoration-style: wavy;
	text-decoration-color: var(--ui-danger-fg);
	text-decoration-thickness: from-font;
}
```

**Example:**

```typescript
let result = u.textDecoration();
let removed = u.textDecoration("none");
let struck = u.textDecoration("line-through");
let tonedResult = u.textDecoration({ line: "underline", color: "brand", offset: 3 });
let mutedResult = u.textDecoration({ color: "danger.muted" });
let spellingResult = u.textDecoration({ style: "wavy", color: "danger", thickness: "from-font" });
let thickResult = u.textDecoration({ line: "underline", thickness: 2, offset: "auto" });
```

```tsx
<a
	href="/pricing"
	mix={[
		u.textDecoration("none"),
		u.fg("brand"),
		u.hover(u.textDecoration("underline")),
		u.focusVisible(u.textDecoration("underline")),
	]}
>
	Pricing
</a>
```

A tone-coloured underline pushed clear of the descenders, so the line stays visible without cutting through the `g` and `p`:

```tsx
<p mix={[u.text("base"), u.leading("relaxed")]}>
	Upgrading changes your{" "}
	<a
		href="/billing"
		mix={[
			u.fg("brand"),
			u.textDecoration({
				line: "underline",
				color: "brand.muted",
				thickness: "from-font",
				offset: 3,
			}),
			u.hover(u.textDecoration({ color: "brand" })),
		]}
	>
		billing group
	</a>{" "}
	immediately.
</p>
```

#### `textTransform(value: TextTransformValue): UtilityMixin`

Applies `text-transform`. The change is visual only: the DOM text is untouched, so the element's accessible name keeps its original casing and a screen reader announces the source spelling rather than what is rendered. That means casing here must never be the thing carrying a distinction — a status pill reading `ACTIVE` only because of `uppercase` conveys nothing extra to a reader who hears `Active`. `capitalize` is also naive, uppercasing the first letter of every whitespace-separated word with no notion of which words a title should leave lowercase and no effect on a word already typed in caps, so pre-cased source text usually beats transforming it here.

**Parameters:**

- `value`: Which case transformation to apply. Required — there is no default.
  - `none`: No transformation, and cancels one inherited from an ancestor
  - `capitalize`: Uppercases the first letter of every word, per-word and naive
  - `uppercase`: Uppercases every letter
  - `lowercase`: Lowercases every letter
  - `full-width`: Fits characters into the fixed-width square used by CJK typography, where a matching full-width form exists
  - `full-size-kana`: Renders small kana at full size, for ruby annotation legibility at small sizes

**Returns:**

- A `UtilityMixin` that sets `text-transform`.

**CSS:**

```css
/* u.textTransform("uppercase") */
.host {
	text-transform: uppercase;
}

/* u.textTransform("none") */
.host {
	text-transform: none;
}
```

**Example:**

```typescript
let result = u.textTransform("uppercase");
let cancelled = u.textTransform("none");
```

```tsx
<span
	mix={[u.textTransform("uppercase"), u.fontSize("xs"), u.tracking("wide"), u.weight("semibold")]}
>
	Active
</span>
```

#### `tracking(value?: TrackingValue): UtilityMixin`

Applies `letter-spacing` from the named tracking scale, resolving through `var(--ui-tracking-{name}, fallback)` so the scale works before an app defines the variable. Values are in `em`, so they scale with the font size.

The usual reasons to reach for it: tightening large display type, which is set too loose at scale by most families, and opening up all-caps text, which needs extra space to stay legible. Avoid loosening lowercase body copy — it slows reading by breaking up word shapes.

**Parameters:**

- `value`: A named scale step or a raw CSS value. Defaults to `"normal"`.
  - `"tighter"` — `var(--ui-tracking-tighter, -0.05em)`
  - `"tight"` — `var(--ui-tracking-tight, -0.025em)`
  - `"normal"` — `var(--ui-tracking-normal, 0em)`, the default
  - `"wide"` — `var(--ui-tracking-wide, 0.025em)`
  - `"wider"` — `var(--ui-tracking-wider, 0.05em)`
  - `"widest"` — `var(--ui-tracking-widest, 0.1em)`
  - any other string — emitted literally, so `"0.18em"`, `"-0.04em"`, or `"1px"` works

**Returns:**

- A `UtilityMixin` that sets `letter-spacing`

**CSS:**

```css
/* u.tracking("wide") */
.host {
	letter-spacing: var(--ui-tracking-wide, 0.025em);
}

/* u.tracking("0.18em") */
.host {
	letter-spacing: 0.18em;
}
```

**Example:**

```typescript
let result = u.tracking("wide");
let tightResult = u.tracking("tighter");
let literalResult = u.tracking("0.18em");
```

The two idiomatic cases — tightened display type, and opened-up small caps:

```tsx
<h1 mix={[u.text("6xl"), u.weight("bold"), u.tracking("tighter"), u.balance()]}>{title}</h1>
<span mix={[u.text("xs"), u.weight("medium"), u.tracking("widest"), u.textTransform("uppercase")]}>
	{eyebrow}
</span>
```

#### `truncate(): UtilityMixin`

Truncates single-line text with an ellipsis once it overflows its box. Composes `u.overflow("hidden")` and `u.nowrap()`, adding only `text-overflow: ellipsis` of its own.

It only works against a bounded inline size — there has to be something for the text to overflow. In a flex or grid layout that usually means the item also needs `u.minIs(0)`, because a flex item's default `min-inline-size: auto` refuses to shrink below its content and the text never overflows in the first place. That single missing declaration is the most common reason truncation appears to do nothing.

Reach for `u.lineClamp()` when truncation should happen after several lines rather than one.

**Returns:**

- A `UtilityMixin` that sets `overflow: hidden`, `white-space: nowrap`, and `text-overflow: ellipsis`

**CSS:**

```css
/* u.truncate() */
.host {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
```

**Example:**

```typescript
let result = u.truncate();
```

The flex case, with the `minIs(0)` that actually makes it truncate:

```tsx
<div mix={[u.hstack({ gap: 2, align: "center" })]}>
	<span mix={[u.spacer(), u.minIs(0), u.truncate()]}>{longFileName}</span>
	<button mix={[u.shrink(0)]}>{action}</button>
</div>
```

Since it sets `overflow`, it conflicts with `u.scroll()`, `u.clip()`, and `u.overflow()` on the same element.

#### `type(name: TextSizeName | (string & {})): UtilityMixin`

Combines `u.text()`'s `font-size`/`line-height` pair with the base sans font family, for the common case of setting a full text style in one call instead of pairing `u.font("sans")` and `u.text()` separately. Composes those two utilities directly.

The distinction from bare `u.text()` is opinionation: `text()` is family-agnostic, so it composes under whatever family an ancestor or a sibling `u.font()` established, while `type()` always forces `sans`. Reach for `text()` plus an explicit `font()` when a non-sans family is needed alongside a size — inside a serif container, a `type()` call will silently override the serif.

**Parameters:**

- `name`: A named text size (`"xs"` through `"9xl"`), or an app-extended name declared through module augmentation of `TextSizes`. See `u.text()` for each step's font size and paired leading, and for the raw-length passthrough.

**Returns:**

- A `UtilityMixin` that sets `font-family`, `font-size`, and `line-height`

**CSS:**

```css
/* u.type("lg") */
.host {
	font-family: var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif);
	font-size: var(--ui-text-lg, 1.125rem);
	line-height: var(--ui-leading-lg, calc(1.75 / 1.125));
}
```

**Example:**

```typescript
let result = u.type("lg");
let smallResult = u.type("sm");
```

```tsx
<button
	mix={[u.type("sm"), u.weight("medium"), u.surface("brand"), u.rounded("md"), u.pb(2), u.pi(3)]}
>
	{label}
</button>
```

Because it sets `font-family`, it conflicts with `u.font()` on the same element — whichever comes later wins.

#### `verticalAlign(value: VerticalAlignValue): UtilityMixin`

Applies `vertical-align`, most often to line up an inline-block icon against the text beside it. The property only affects inline-level boxes and table cells, which is the usual reason it appears to do nothing: on a block, on a flex item, or on a grid item it is ignored outright, and the alignment wanted there comes from `items()`/`self()` instead. So an icon being aligned with this needs `inlineBlock()` (or `inlineFlex()`) alongside it, and a table cell needs no extra display change.

**Parameters:**

- `value`: Where the box sits relative to its line box or table row. Required — there is no default.
  - `baseline`: Aligns the box's baseline with the parent's baseline, the initial value
  - `top`: Aligns the top of the box with the top of the whole line box (in a table cell, the top of the row)
  - `middle`: Centers the box against the parent's baseline plus half its x-height — the usual choice for an icon beside text
  - `bottom`: Aligns the bottom of the box with the bottom of the line box (in a table cell, the bottom of the row)
  - `text-top`: Aligns the top of the box with the top of the parent's font, ignoring taller inline siblings
  - `text-bottom`: Aligns the bottom of the box with the bottom of the parent's font
  - `sub`: Lowers the box to the parent's subscript baseline, without changing font size
  - `super`: Raises the box to the parent's superscript baseline, without changing font size
  - A raw CSS value: any length or percentage (`"15%"`, `"0.2em"`, `"-2px"`) passes through unchanged, raising the box by that amount above its baseline — a percentage resolving against the element's own `line-height`

**Returns:**

- A `UtilityMixin` that sets `vertical-align`.

**CSS:**

```css
/* u.verticalAlign("middle") */
.host {
	vertical-align: middle;
}

/* u.verticalAlign("15%") */
.host {
	vertical-align: 15%;
}
```

**Example:**

```typescript
let result = u.verticalAlign("middle");
let raisedResult = u.verticalAlign("15%");
```

```tsx
<span>
	<svg mix={[u.inlineBlock(), u.verticalAlign("middle"), u.is(4), u.bs(4)]} aria-hidden="true" />
	Verified account
</span>
```

#### `weight(value?: FontWeightValue): UtilityMixin`

Applies `font-weight`. Named values alias the standard numeric scale; a raw number passes through unchanged for the intermediate weights a variable font exposes but the named scale doesn't cover.

A weight only renders if the family actually ships it. With a static font, an unavailable weight gets synthesized by the browser — a smeared faux-bold — so check the family's real weight axis before reaching past `normal` and `bold`.

**Parameters:**

- `value`: A named weight or a raw number. Defaults to `"normal"`.
  - `"thin"` — `100`
  - `"extralight"` — `200`
  - `"light"` — `300`
  - `"normal"` — `400`, the default
  - `"medium"` — `500`
  - `"semibold"` — `600`
  - `"bold"` — `700`
  - `"extrabold"` — `800`
  - `"black"` — `900`
  - a `number` — emitted as-is, for a variable font's intermediate weights such as `550`

**Returns:**

- A `UtilityMixin` that sets `font-weight`

**CSS:**

```css
/* u.weight("semibold") */
.host {
	font-weight: 600;
}

/* u.weight(550) */
.host {
	font-weight: 550;
}
```

**Example:**

```typescript
let result = u.weight("semibold");
let boldResult = u.weight("bold");
let variableResult = u.weight(550);
```

Weight is the load-bearing part of a hierarchy — prefer it over size alone for emphasis within a line:

```tsx
<div mix={[u.hstack({ gap: 2, justify: "between" })]}>
	<span mix={[u.text("sm"), u.fg("neutral.muted")]}>{label}</span>
	<span mix={[u.text("sm"), u.weight("semibold"), u.tabularNums()]}>{value}</span>
</div>
```

Note `font-weight` is inherited, so setting it on a container affects the whole subtree — and using it for emphasis on a `<span>` conveys nothing to a screen reader; use `<strong>` where the emphasis is semantic.

#### `whiteSpace(value?: WhiteSpaceValue): UtilityMixin`

Applies `white-space`, whose keywords each answer two separate questions at once: whether runs of whitespace and newlines in the source are preserved, and whether lines are allowed to wrap.

This is the general primitive behind three narrower utilities that already set the same property: `u.nowrap()` (`nowrap`), `u.truncate()` (which composes `u.nowrap()`), and `u.visuallyHidden()` (`nowrap`, to keep its clip rect stable regardless of surrounding text wrapping). All four write the same declaration, so this utility conflicts with each of them on the same element — pick one, and reach for the dedicated utilities for the cases they name.

The default is `"pre-wrap"` because it is the one case with no other path today: preformatted text or a code block that must keep its own indentation and line breaks _and_ still wrap inside a narrow container rather than overflowing it. Note that `white-space` is inherited, so setting it on a container applies to the text of its descendants until one of them sets it again.

**Parameters:**

- `value`: A `WhiteSpaceValue`. Defaults to `"pre-wrap"`.
  - `"normal"` — collapses whitespace and wraps; the browser's ordinary text behavior
  - `"nowrap"` — collapses whitespace but never wraps, so the line overflows instead
  - `"pre"` — preserves whitespace and newlines and never wraps
  - `"pre-wrap"` — preserves whitespace and newlines and still wraps. The default.
  - `"pre-line"` — collapses runs of spaces but honours newlines
  - `"break-spaces"` — `pre-wrap` plus a wrapping opportunity after every preserved space, so a long run of trailing spaces can break instead of overflowing

**Returns:**

- A `UtilityMixin` that sets `white-space`

**CSS:**

```css
/* u.whiteSpace() */
.host {
	white-space: pre-wrap;
}

/* u.whiteSpace("pre") */
.host {
	white-space: pre;
}

/* u.whiteSpace("pre-line") */
.host {
	white-space: pre-line;
}
```

**Example:**

```typescript
let result = u.whiteSpace();
let preResult = u.whiteSpace("pre");
let preLineResult = u.whiteSpace("pre-line");
let breakSpacesResult = u.whiteSpace("break-spaces");
```

The case the `"pre-wrap"` default exists for, with the rest of the code-block treatment around it: indentation preserved, tabs sized to what the source was written against, a monospaced family, and slashed zeros so digits can't be misread.

```tsx
<pre
	mix={[
		u.whiteSpace("pre-wrap"),
		u.tabSize(2),
		u.font("mono"),
		u.fontVariantNumeric("slashed-zero"),
		u.fontSize("sm"),
		u.p(4),
		u.rounded("md"),
		u.surface("neutral"),
	]}
>
	{source}
</pre>
```

Because it is inherited, `"pre-line"` on a container is also the cheap way to honour newlines in user-entered text without preserving the indentation of the surrounding markup:

```tsx
<div mix={[u.whiteSpace("pre-line"), u.maxIs("60ch"), u.leading("relaxed")]}>{comment}</div>
```

#### `wordBreak(value?: WordBreakValue): UtilityMixin`

Applies `word-break`, deciding whether the browser may break a line inside a word rather than only at ordinary break opportunities. The case that drives it is a long unbroken string — a URL, a hash, a generated identifier — overflowing a narrow container, because there is no space in it to wrap at. It only matters on an element whose inline size is actually bounded (a `maxIs()`, a grid column, or a flex item given `minIs(0)`); with an unbounded box the line simply grows and nothing has to break. Only `word-break` is emitted — this utility never touches `overflow-wrap`, so a rule wanting that property reaches for `u.overflowWrap()` instead — and that is usually the better tool for the long-URL case, since it breaks a word only when it would otherwise overflow. Pair with `truncate()` or `lineClamp()` instead when the overflow should be cut off rather than wrapped.

**Parameters:**

- `value`: How the browser may break inside words. Defaults to `"normal"`.
  - `normal`: The initial behavior — breaks only at spaces and other ordinary break opportunities, so a long URL overflows rather than wrapping
  - `break-all`: Allows a break between any two characters. Fixes the overflow, but applies to every word in the element, so prose in the same box breaks mid-word too — scope it to the element holding the unbreakable string
  - `keep-all`: The opposite restriction: forbids breaks inside CJK text, so those lines break only at spaces and explicit break opportunities. No effect on non-CJK text
  - `break-word`: A deprecated legacy alias browsers treat as `word-break: normal` plus `overflow-wrap: break-word` — a word breaks only when it would otherwise overflow, which leaves surrounding prose alone and makes it the gentler fix for the URL case

**Returns:**

- A `UtilityMixin` that sets `word-break`.

**CSS:**

```css
/* u.wordBreak() */
.host {
	word-break: normal;
}

/* u.wordBreak("break-all") */
.host {
	word-break: break-all;
}
```

**Example:**

```typescript
let result = u.wordBreak("break-all");
let defaultResult = u.wordBreak();
let gentleResult = u.wordBreak("break-word");
let cjkResult = u.wordBreak("keep-all");
```

```tsx
<dd mix={[u.maxIs("32ch"), u.wordBreak("break-all"), u.font("mono"), u.fontSize("sm")]}>
	https://example.com/very/long/path/that/has/no/spaces/to/wrap/at
</dd>
```

### Effects

#### `backdropBlur(name?: BlurName | (string & {})): UtilityMixin`

Applies a `backdrop-filter: blur(...)` from the blur scale, blurring whatever shows _through_ the element rather than the element itself — the frosted-glass treatment behind a sticky header, a sheet, or an overlay.

It is an ungated primitive: it always applies the blur, even for a user who has asked for reduced transparency. `u.translucent()` is the accessible pattern that gates the same blur behind `prefers-reduced-transparency` with a solid-background fallback, and is what most call sites should reach for. Use this directly when you need the blur without the gating, or alongside `u.backdropSaturate()`.

Because `backdrop-filter` is a single CSS property, this sets its own `--ui-backdrop-blur` custom property plus one fixed composite declaration referencing every backdrop-filter variable with an identity fallback. That is what lets it combine with `u.backdropSaturate()` instead of one overwriting the other. The composite value is mirrored onto `-webkit-backdrop-filter`, which Safari still needs.

A backdrop filter only does anything if there is something translucent to see through, so pair it with a partially transparent background — over an opaque background it has no visible effect.

**Parameters:**

- `name`: A blur scale step or a raw CSS length. Defaults to `"md"`.
  - `"sm"` — `var(--ui-blur-sm, 4px)`
  - `"md"` — `var(--ui-blur-md, 12px)`, the default
  - `"lg"` — `var(--ui-blur-lg, 24px)`
  - a raw CSS length (`"8px"`, `"0.5rem"`) — passed through literally. Only an atomic number-plus-unit is detected as a length; any other unrecognized string is treated as an app-extended token name and resolves to `var(--ui-blur-{name}, 12px)`.
  - an app-extended name declared through module augmentation of `Blurs`

**Returns:**

- A `UtilityMixin` that sets `--ui-backdrop-blur` plus the composite `backdrop-filter` and `-webkit-backdrop-filter`

**CSS:**

```css
/* u.backdropBlur("lg") */
.host {
	--ui-backdrop-blur: var(--ui-blur-lg, 24px);
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropBlur();
let strongResult = u.backdropBlur("lg");
let literalResult = u.backdropBlur("8px");
```

The full frosted-bar composition — a translucent background for the blur to act on, plus saturation, which the two utilities combine to produce:

```tsx
<header
	mix={[
		u.sticky(),
		u.insBs(0),
		u.layer(10),
		u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 80 }, "transparent")),
		u.backdropBlur("md"),
		u.backdropSaturate(1.8),
	]}
>
	{nav}
</header>
```

Note that `u.translucent()` gates its blur behind `prefers-reduced-transparency` while this and `u.backdropSaturate()` do not, so mixing them can leave a reduced-transparency user with saturation but no blur. Wrap the ungated ones in the same `u.media()` gate when that matters.

#### `backdropBrightness(value?: number | (string & {})): UtilityMixin`

Applies a `backdrop-filter: brightness(...)`, scaling the lightness of whatever shows _through_ the element rather than the element's own pixels. Values below `1` darken and values above `1` brighten; `0` is solid black. Reach for it to knock back a busy backdrop behind a translucent sheet so the text sitting on the sheet stays readable, or to lift a backdrop that is too dark for a light panel to read against.

`backdrop-filter` is a single CSS property, so two utilities that each set it outright would silently overwrite each other instead of combining. Every backdrop-filter utility therefore sets its own CSS custom property — `--ui-backdrop-brightness` here, `--ui-backdrop-blur` for `u.backdropBlur()`, `--ui-backdrop-saturate` for `u.backdropSaturate()`, and so on — plus one fixed, byte-identical composite `backdrop-filter` declaration that references every backdrop-filter function's variable with an identity fallback (`0px` for blur, `1` for brightness, contrast, opacity, and saturate, `0` for grayscale, invert, and sepia, `0deg` for hue-rotate, `0 0 0 transparent` for drop-shadow — all no-ops). Custom properties from separate classes on the same element all apply at once, and because the composite declaration's value text is identical in every backdrop utility it doesn't matter whose copy wins the cascade: the resolved `backdrop-filter` always reads every variable any applied utility set, and identity defaults for every variable none of them touched. So `u.backdropBrightness(0.8)` and `u.backdropBlur("md")` on one element compose into a darkened _and_ blurred backdrop rather than one erasing the other. The whole value is mirrored onto `-webkit-backdrop-filter`, which Safari still needs. This is the same mechanism `u.brightness()` and the rest of the `filter` family use, one property over.

The function order inside the composite is fixed, and it deliberately matches `filter`'s — blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, sepia, drop-shadow. Backdrop-filter functions are no more commutative than filter functions, so a `u.backdropGrayscale()` always applies _after_ a `u.backdropBrightness()` no matter which one a call site listed first.

Two things it shares with every other backdrop utility. It is an **ungated primitive**: it applies even for a user who has asked for reduced transparency, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()` and supply a solid fallback (`u.translucent()` is the ready-made accessible pattern for the blur case). And it has no visible effect unless the host's own background is at least partly transparent — over an opaque background there is nothing showing through to filter, and the filtered backdrop is simply painted over.

**Parameters:**

- `value`: The brightness factor. Defaults to `1.1`, a barely-perceptible lift.
  - a `number` — stringified as-is into an unitless multiplier: `1` is unchanged, `0` is solid black, `0.8` darkens, values above `1` brighten. `1.1` is the default.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropBrightness("80%")` emits `--ui-backdrop-brightness: 80%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-brightness` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropBrightness() */
.host {
	--ui-backdrop-brightness: 1.1;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}

/* [u.backdropBrightness(0.8), u.backdropBlur("md")] — both variables set, one composite declaration */
.host {
	--ui-backdrop-brightness: 0.8;
	--ui-backdrop-blur: var(--ui-blur-md, 12px);
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropBrightness();
let darkened = u.backdropBrightness(0.8);
let percentageEscapeHatch = u.backdropBrightness("80%");
let gated = u.transparencySafe(u.backdropBrightness(0.8));
```

A translucent sheet over arbitrary page content, with the backdrop darkened and blurred behind it — both ungated, so both sit inside one `u.transparencySafe()` and the sheet keeps a solid background for the reduced-transparency case:

```tsx
<div
	mix={[
		u.fixed(),
		u.inset(0),
		u.layer(50),
		u.surface("default"),
		u.transparencySafe([
			u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 70 }, "transparent")),
			u.backdropBlur("md"),
			u.backdropBrightness(0.8),
		]),
	]}
>
	{sheet}
</div>
```

#### `backdropContrast(value?: number | (string & {})): UtilityMixin`

Applies a `backdrop-filter: contrast(...)`, pushing whatever shows through the element away from mid-grey (values above `1`) or toward it (values below `1`). `0` flattens the backdrop to a uniform grey and `1` leaves it untouched.

Pulling contrast _down_ is the useful direction for an overlay: it flattens a detailed backdrop into something closer to a single tone, which is what makes text sitting on top of a translucent panel legible without hiding the backdrop entirely. Pair it with `u.backdropBlur()` for the full frosted treatment, and reach for `u.contrast()` instead when it is the element's own rendering that needs firming up — the two are separate properties and apply together.

Like every backdrop-filter utility it writes only its own `--ui-backdrop-contrast` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations, so it stacks with `u.backdropBrightness()`, `u.backdropBlur()`, `u.backdropSaturate()`, and the rest instead of overwriting them — see `u.backdropBrightness()` for the full account of that mechanism and its fixed function order.

It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`. And it has no visible effect unless the host's own background is at least partly transparent.

Do not use it to _fix_ a contrast failure on the text above it. A filter changes rendered pixels, not the computed colors an automated checker reads, so it moves nothing measurable; fix the tones, and gate genuine high-contrast affordances on `u.contrastMore()`.

**Parameters:**

- `value`: The contrast factor. Defaults to `1.25`.
  - a `number` — stringified as-is into an unitless multiplier: `1` is unchanged, `0` is uniform grey, values below `1` flatten, values above `1` intensify. `1.25` is the default.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropContrast("125%")` emits `--ui-backdrop-contrast: 125%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-contrast` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropContrast() */
.host {
	--ui-backdrop-contrast: 1.25;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropContrast();
let flattened = u.backdropContrast(0.75);
let percentageEscapeHatch = u.backdropContrast("125%");
let gated = u.transparencySafe(u.backdropContrast(0.75));
```

A translucent toolbar whose backdrop is blurred and flattened so the controls on it read as the only detail in the strip:

```tsx
<div
	mix={[
		u.sticky(),
		u.insBs(0),
		u.layer(10),
		u.hstack({ gap: 2, align: "center" }),
		u.p(2),
		u.border("neutral"),
		u.transparencySafe([
			u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 75 }, "transparent")),
			u.backdropBlur("sm"),
			u.backdropContrast(0.75),
		]),
	]}
>
	{controls}
</div>
```

#### `backdropDropShadow(options?: BackdropDropShadowOptions): UtilityMixin`

Applies a `backdrop-filter: drop-shadow(...)`, shadowing the _rendered shape of whatever shows through_ the element rather than the element's own box. That distinction is the whole point, and it makes this the narrowest utility in the backdrop family: the shadow is cast by the backdrop's silhouette as seen through a translucent host, so it reads as a subtle depth cue _behind_ a panel, not as elevation for the panel. For an elevation shadow on the element itself, reach for `u.shadow()`; for one that traces the element's own rendered shape, `u.dropShadow()`.

Two limits come from the CSS function rather than from this utility: `drop-shadow()` accepts no spread radius and no `inset`, so a spread ring or an inner shadow has to come from `u.ringShadow()` or `u.shadow()` instead.

It composes through the shared composite `backdrop-filter` declaration, writing only `--ui-backdrop-drop-shadow`, so it stacks with `u.backdropBlur()`, `u.backdropSaturate()`, and the rest — see `u.backdropBrightness()` for how that works. It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`, and it has no visible effect unless the host's own background is at least partly transparent: there is nothing showing through an opaque element to shadow.

**Parameters:**

- `options`: A `BackdropDropShadowOptions` object. Defaults to `{}`, which resolves to a small translucent-black shadow one spacing step down with a two-step blur.
  - `x`: The shadow's inline offset. Defaults to `0`.
    - a `number` — resolves against the spacing scale: `2` becomes `calc(var(--ui-spacing, 0.25rem) * 2)`.
    - a `string` — a raw CSS length, passed through unchanged: `"1px"`, `"0.125rem"`, or a `var(...)` reference.
  - `y`: The shadow's block offset. Defaults to `1`, one spacing step down. Same `number`-through-the-spacing-scale / `string`-passthrough handling as `x`.
  - `blur`: The shadow's blur radius. Defaults to `2`. Same handling as `x` and `y`; `0` gives a hard-edged shadow.
  - `color`: The shadow color, a `ColorValue` resolved with `border` as its default property. Defaults to the literal `rgb(0 0 0 / 0.15)` — the default is _not_ a token, so `border` only comes into play once a color is actually passed. Accepted forms:
    - a bare semantic tone — `"neutral"`, `"brand"`, `"success"`, `"warning"`, `"danger"` — which takes the `border` default, so `"brand"` resolves to `var(--ui-brand-border)`.
    - a tone with an explicit property suffix — `"brand.solid"`, `"neutral.strong"`, and so on, resolving to `var(--ui-{tone}-{suffix})`, with the usual friendly aliases (`tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`).
    - a raw palette reference — `"color.neutral.400"` resolves to `var(--ui-color-neutral-400)`.
    - `"transparent"`, `"inherit"`, or `"currentColor"` — passed through as-is.
    - the raw CSS escape hatch — any string containing `(` is treated as an already-formed CSS color and passed through untouched, so `u.backdropDropShadow({ color: "rgb(0 0 0 / 0.4)" })` works.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-drop-shadow` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropDropShadow() */
.host {
	--ui-backdrop-drop-shadow: calc(var(--ui-spacing, 0.25rem) * 0)
		calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15);
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}

/* u.backdropDropShadow({ x: "1px", y: "2px", blur: "4px", color: "brand" }) */
.host {
	--ui-backdrop-drop-shadow: 1px 2px 4px var(--ui-brand-border);
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropDropShadow();
let rawLengths = u.backdropDropShadow({ x: "1px", y: "2px", blur: "4px" });
let tonedShadow = u.backdropDropShadow({ y: "0", blur: "6px", color: "brand.solid" });
let gated = u.transparencySafe(u.backdropDropShadow({ y: "2px", blur: "4px" }));
```

A translucent panel with a depth cue on the backdrop showing through it, and a real elevation shadow on the panel itself — two different shadows, from two different utilities:

```tsx
<aside
	mix={[
		u.rounded("lg"),
		u.p(4),
		u.shadow("lg"),
		u.transparencySafe([
			u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 70 }, "transparent")),
			u.backdropBlur("md"),
			u.backdropDropShadow({ y: "2px", blur: "4px" }),
		]),
	]}
>
	{children}
</aside>
```

#### `backdropGrayscale(value?: number | (string & {})): UtilityMixin`

Applies a `backdrop-filter: grayscale(...)`, desaturating whatever shows through the element toward grey. `1` is fully grey and `0` leaves it untouched. The use is stripping color out of a busy backdrop so a colored overlay on top of it reads as the only hue in the area — a brand-tinted sheet over a photo wall, a status banner over a colorful dashboard.

Like every backdrop-filter utility it writes only its own `--ui-backdrop-grayscale` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations, so it stacks with `u.backdropBlur()`, `u.backdropBrightness()`, and the rest rather than overwriting them — see `u.backdropBrightness()` for the mechanism and the fixed function order. That order matters here: grayscale sits after brightness and contrast in the composite, so it greys whatever those already produced. Reach for `u.grayscale()` when it's the element's own rendering that should go grey.

It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`. And it has no visible effect unless the host's own background is at least partly transparent.

**Parameters:**

- `value`: The amount of desaturation. Defaults to `1`, a full conversion.
  - a `number` — stringified as-is: `0` leaves the backdrop untouched, `0.5` is halfway, `1` is fully grey. Values above `1` are clamped by CSS.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropGrayscale("60%")` emits `--ui-backdrop-grayscale: 60%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-grayscale` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropGrayscale() */
.host {
	--ui-backdrop-grayscale: 1;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropGrayscale();
let halfway = u.backdropGrayscale(0.5);
let percentageEscapeHatch = u.backdropGrayscale("60%");
let gated = u.transparencySafe(u.backdropGrayscale(0.5));
```

A brand-tinted overlay whose backdrop is greyed out, so the only color left in the region comes from the overlay:

```tsx
<div
	mix={[
		u.absolute(),
		u.inset(0),
		u.center(),
		u.bg(u.colorMix("oklab", { color: u.var("ui-brand-bg-solid"), weight: 25 }, "transparent")),
		u.transparencySafe([u.backdropGrayscale(), u.backdropBlur("sm")]),
	]}
>
	<p mix={[u.fg("brand.onSolid"), u.text("lg")]}>{t("gallery.locked")}</p>
</div>
```

#### `backdropHueRotate(value?: AngleValue): UtilityMixin`

Applies a `backdrop-filter: hue-rotate(...)`, rotating the hue of whatever shows through the element around the color wheel by the given angle while leaving its lightness and saturation alone. Because rotation keeps the backdrop's original light/dark structure intact, it is the way to pull an arbitrary backdrop toward a single brand hue under a translucent panel without flattening the depth out of it.

Like every backdrop-filter utility it writes only its own `--ui-backdrop-hue-rotate` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations, so it stacks with `u.backdropBlur()`, `u.backdropSaturate()`, and the rest — see `u.backdropBrightness()` for the mechanism and the fixed function order. `u.hueRotate()` is the same rotation applied to the element's own pixels; the two are independent properties and can be used together.

It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`. And it has no visible effect unless the host's own background is at least partly transparent.

**Parameters:**

- `value`: An `AngleValue`. Defaults to `90`, a quarter-turn.
  - a `number` — treated as degrees and suffixed with `deg`: `180` becomes `180deg`, and a negative number rotates the other way (`-45` becomes `-45deg`).
  - a `string` — passed through unchanged, for other angle units or a computed value: `"0.5turn"`, `"3.14rad"`, `"calc(var(--shift) * 1deg)"`.
- No value throws; there is no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-hue-rotate` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropHueRotate() */
.host {
	--ui-backdrop-hue-rotate: 90deg;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}

/* u.backdropHueRotate("0.5turn") */
.host {
	--ui-backdrop-hue-rotate: 0.5turn;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropHueRotate();
let halfTurn = u.backdropHueRotate(180);
let counterClockwise = u.backdropHueRotate(-45);
let rawAngleUnit = u.backdropHueRotate("0.5turn");
```

A translucent hero panel that pulls whatever image is behind it toward the brand hue while keeping the photo's light and shade:

```tsx
<section
	mix={[
		u.relative(),
		u.p(6),
		u.rounded("xl"),
		u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 60 }, "transparent")),
		u.transparencySafe([u.backdropHueRotate(30), u.backdropSaturate(1.2), u.backdropBlur("sm")]),
	]}
>
	{hero}
</section>
```

#### `backdropInvert(value?: number | (string & {})): UtilityMixin`

Applies a `backdrop-filter: invert(...)`, inverting the colors of whatever shows through the element. `1` is a full inversion and `0` leaves it untouched.

It is a heavy, deliberately graphic effect, so the honest uses are narrow: a partial amount for a stylized overlay, or a full inversion on a small cutout — a custom cursor, a magnifier, a scrub handle — that must stay visible over any backdrop, light or dark. Reach for `u.invert()` when it's the element's own pixels that need flipping, and note that a full inversion of a mid-grey backdrop lands back on roughly the same grey.

Like every backdrop-filter utility it writes only its own `--ui-backdrop-invert` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations, so it stacks with the other backdrop utilities instead of overwriting them — see `u.backdropBrightness()` for the mechanism and the fixed function order.

It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`. And it has no visible effect unless the host's own background is at least partly transparent.

**Parameters:**

- `value`: The amount of inversion. Defaults to `1`, a full inversion.
  - a `number` — stringified as-is: `0` leaves the backdrop untouched, `0.15` is a light stylization, `1` is full. `0.5` collapses the backdrop to mid-grey.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropInvert("15%")` emits `--ui-backdrop-invert: 15%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-invert` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropInvert() */
.host {
	--ui-backdrop-invert: 1;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropInvert();
let subtle = u.backdropInvert(0.15);
let percentageEscapeHatch = u.backdropInvert("15%");
let gated = u.transparencySafe(u.backdropInvert(0.15));
```

A thin scrub handle that inverts its own backdrop, so it stays visible wherever it lands on the waveform behind it:

```tsx
<div
	mix={[
		u.absolute(),
		u.insBs(0),
		u.is("2px"),
		u.bs("full"),
		u.bg("transparent"),
		u.transparencySafe(u.backdropInvert()),
	]}
	aria-hidden="true"
/>
```

#### `backdropOpacity(value?: number | (string & {})): UtilityMixin`

Applies a `backdrop-filter: opacity(...)`, fading whatever shows through the element toward whatever is painted further back. It's the way to soften a backdrop without blurring it — the backdrop keeps its shapes and edges, it just loses presence.

Two contrasts are worth stating plainly. It takes CSS's native `0`–`1` range (or a percentage string), **not** the `0`–`100` integer convention `u.opacity()` uses. And unlike `u.opacity()`, it never touches the element's own contents: only its backdrop. For the filter-function form applied to the element itself, see `u.filterOpacity()`.

Like every backdrop-filter utility it writes only its own `--ui-backdrop-opacity` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations, so it stacks with the other backdrop utilities instead of overwriting them — see `u.backdropBrightness()` for the mechanism and the fixed function order.

It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`. And it has no visible effect unless the host's own background is at least partly transparent.

**Parameters:**

- `value`: The backdrop's opacity, in CSS's native range. Defaults to `0.5`.
  - a `number` — stringified as-is: `1` leaves the backdrop untouched, `0.5` is the default half-fade, `0` fades it out entirely. Values above `1` are clamped by CSS, so `50` is fully opaque rather than half.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropOpacity("25%")` emits `--ui-backdrop-opacity: 25%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-opacity` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropOpacity() */
.host {
	--ui-backdrop-opacity: 0.5;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropOpacity();
let quarter = u.backdropOpacity(0.25);
let percentageEscapeHatch = u.backdropOpacity("25%");
let gated = u.transparencySafe(u.backdropOpacity(0.25));
```

A dialog scrim that fades the page behind it without blurring it, so the layout underneath stays recognizable:

```tsx
<div
	mix={[
		u.fixed(),
		u.inset(0),
		u.layer(40),
		u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 40 }, "transparent")),
		u.transparencySafe(u.backdropOpacity(0.25)),
	]}
	aria-hidden="true"
/>
```

#### `backdropSaturate(value?: number | string): UtilityMixin`

Saturates (or mutes) whatever shows through the element via `backdrop-filter: saturate(...)` — the extra color punch a frosted panel needs so the content behind it doesn't read as washed out once it's blurred. Reach for `u.saturate()` instead to saturate the element's own rendering rather than its backdrop; the two are independent properties and can be applied together.

Like `u.backdropBlur()`, it's an ungated primitive: it applies no matter what the user's transparency preference says, unlike `u.translucent()`, which gates its blur behind `prefers-reduced-transparency: no-preference`. Wrap it in `u.transparencySafe()` to put it behind the same gate.

`backdrop-filter` is a single CSS property, so two utilities that each set it outright would silently overwrite each other instead of combining. Every backdrop-filter utility therefore sets its own CSS custom property — `--ui-backdrop-saturate` here, `--ui-backdrop-blur` for `u.backdropBlur()` — plus one fixed, byte-identical composite `backdrop-filter` declaration that references every backdrop-filter function's variable with an identity fallback (`0px` for blur, `1` for saturate, both no-ops). Custom properties from separate classes on the same element all apply at once, and because the composite declaration's value text is identical in every utility it doesn't matter whose copy wins the cascade: the resolved `backdrop-filter` always reads every variable any applied utility set, and identity defaults for every variable none of them touched. So `u.backdropBlur()` and `u.backdropSaturate()` on one element compose into a blurred _and_ saturated backdrop. The same value is mirrored onto `-webkit-backdrop-filter`, since Safari doesn't yet resolve the unprefixed property.

It has no visible effect unless something is actually visible behind the element: pair it with a translucent or transparent background (`u.bg()` with an alpha color, or `u.translucent()`), because a fully opaque background hides the very pixels being filtered. One interaction to watch — `u.translucent()` nests its blur _inside_ the `prefers-reduced-transparency` media query, while `u.backdropSaturate()` emits at the top level, so composing the two leaves the saturation ungated even when the blur is suppressed. Wrap it in the same `u.media()` query when the gating should cover both.

**Parameters:**

- `value`: The saturation factor. Defaults to `1.4`.
  - a `number` — stringified as-is into an unitless multiplier: `1` is unchanged, `0` is fully desaturated (grayscale), values above `1` intensify. `1.4` is the default.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropSaturate("200%")` emits `--ui-backdrop-saturate: 200%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-saturate` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropSaturate() */
.host {
	--ui-backdrop-saturate: 1.4;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}

/* [u.backdropBlur("lg"), u.backdropSaturate(1.4)] — both variables set, one composite declaration */
.host {
	--ui-backdrop-blur: var(--ui-blur-lg, 24px);
	--ui-backdrop-saturate: 1.4;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropSaturate();
let explicitFactor = u.backdropSaturate(2);
let percentageEscapeHatch = u.backdropSaturate("200%");
let desaturatedBackdrop = u.backdropSaturate(0);
```

```tsx
<header
	mix={[
		u.sticky(),
		u.backdropBlur("md"),
		u.backdropSaturate(1.4),
		u.p(4),
		u.media("(prefers-reduced-transparency: reduce)", u.backdropSaturate(1)),
	]}
/>
```

#### `backdropSepia(value?: number | (string & {})): UtilityMixin`

Applies a `backdrop-filter: sepia(...)`, shifting whatever shows through the element toward a warm brown monochrome. `1` is a full conversion and `0` leaves it untouched. It is the warm sibling of `u.backdropGrayscale()`: both drop the backdrop to a single hue, this one to a tone that sits closer to a cream or parchment surface than to neutral grey.

Like every backdrop-filter utility it writes only its own `--ui-backdrop-sepia` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations, so it stacks with the other backdrop utilities instead of overwriting them — see `u.backdropBrightness()` for the mechanism and the fixed function order. Reach for `u.sepia()` to warm the element's own rendering instead.

It is an ungated primitive, so a call site that respects `prefers-reduced-transparency` should wrap it in `u.transparencySafe()`. And it has no visible effect unless the host's own background is at least partly transparent.

**Parameters:**

- `value`: The amount of conversion. Defaults to `1`, a full conversion.
  - a `number` — stringified as-is: `0` leaves the backdrop untouched, `0.6` is a partial warming, `1` is full. Values above `1` are clamped by CSS.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.backdropSepia("60%")` emits `--ui-backdrop-sepia: 60%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-backdrop-sepia` custom property plus the shared composite `backdrop-filter` and `-webkit-backdrop-filter` declarations.

**CSS:**

```css
/* u.backdropSepia() */
.host {
	--ui-backdrop-sepia: 1;
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.backdropSepia();
let partial = u.backdropSepia(0.6);
let percentageEscapeHatch = u.backdropSepia("60%");
let gated = u.transparencySafe(u.backdropSepia(0.6));
```

A reading overlay that warms the page behind it, matched with a slight blur so the two effects land in one `backdrop-filter`:

```tsx
<div
	mix={[
		u.absolute(),
		u.inset(0),
		u.p(6),
		u.bg(u.colorMix("oklab", { color: u.var("ui-bg", "Canvas"), weight: 65 }, "transparent")),
		u.transparencySafe([u.backdropSepia(0.6), u.backdropBlur("sm")]),
	]}
>
	{excerpt}
</div>
```

#### `backfaceVisibility(value?: BackfaceVisibilityValue): UtilityMixin`

Controls whether the back face of a 3D-transformed element is painted once it has rotated to face away from the viewer. It only matters for elements that actually rotate in 3D — `u.rotateX()` and `u.rotateY()` — and is what stops the reversed, mirror-image face of a flip card showing through halfway through the turn.

For it to work, the rotating faces must share a `transform-style: preserve-3d` ancestor; without that the browser flattens the subtree and there is no back face to hide. Reach for `u.transformStyle()` on that ancestor, and `u.perspective()` alongside it so the rotation reads as depth rather than a flat squash.

**Parameters:**

- `value`: A `BackfaceVisibilityValue`. Defaults to `"hidden"`.
  - `"hidden"` — the back face is not painted, so a face rotated away from the viewer disappears. The default, and what a flip effect needs.
  - `"visible"` — the back face is painted, showing a mirrored version of the element. Rarely wanted deliberately; useful to opt an element back out.

**Returns:**

- A `UtilityMixin` that sets `backface-visibility`

**CSS:**

```css
/* u.backfaceVisibility() */
.host {
	backface-visibility: hidden;
}

/* u.backfaceVisibility("visible") */
.host {
	backface-visibility: visible;
}
```

**Example:**

```typescript
let result = u.backfaceVisibility();
let visibleResult = u.backfaceVisibility("visible");
```

Both faces stacked and hidden from behind, with the back one pre-rotated:

```tsx
<div mix={[u.zstack(), u.transformStyle(), u.perspective(800)]}>
	<div mix={[u.backfaceVisibility(), u.transition("transform", { duration: 400 })]}>{front}</div>
	<div mix={[u.backfaceVisibility(), u.rotateY(180)]}>{back}</div>
</div>
```

#### `blur(name?: BlurName | (string & {})): UtilityMixin`

Applies a `filter: blur(...)` from the blur scale to the host element itself — as opposed to `u.backdropBlur()`, which blurs what shows through it. Reach for it to soften a decorative image, or to obscure content behind a loading or unauthenticated state.

`filter` is a single CSS property, so two utilities that each set it outright would silently overwrite each other instead of combining. This one therefore writes only its own `--ui-filter-blur` custom property plus one fixed, byte-identical composite `filter` declaration that references every filter function's variable with an identity fallback (`0px` for blur, `1` for brightness, contrast, and saturate, `0` for grayscale, invert, and sepia, `0 0 0 transparent` for drop-shadow — all no-ops). Custom properties from separate classes on the same element all apply at once, and because the composite declaration's value text is identical in every filter utility it doesn't matter whose copy wins the cascade: the resolved `filter` always reads every variable any applied utility set, and identity defaults for every variable none of them touched. So `u.blur("lg")` and `u.grayscale()` on one element compose into a blurred _and_ greyed element rather than one erasing the other — see `u.brightness()` for the full account of the mechanism, including why the composite's fixed function order makes composition independent of call order.

It blurs the element's _entire_ rendering, text and borders included, and any blur other than `0` makes the element a stacking context and a containing block for fixed-position descendants.

Blurring text to hide it is not a privacy measure — the content is still fully present in the DOM and in the accessibility tree.

**Parameters:**

- `name`: A blur scale step or a raw CSS length. Defaults to `"md"`.
  - `"sm"` — `var(--ui-blur-sm, 4px)`
  - `"md"` — `var(--ui-blur-md, 12px)`, the default
  - `"lg"` — `var(--ui-blur-lg, 24px)`
  - a raw CSS length (`"2px"`, `"0.25rem"`) — passed through literally. Only an atomic number-plus-unit is detected as a length; any other unrecognized string resolves as `var(--ui-blur-{name}, 12px)`.
  - an app-extended name declared through module augmentation of `Blurs`

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-blur` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.blur("lg") */
.host {
	--ui-filter-blur: var(--ui-blur-lg, 24px);
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* [u.blur("lg"), u.grayscale()] — both variables set, one composite declaration */
.host {
	--ui-filter-blur: var(--ui-blur-lg, 24px);
	--ui-filter-grayscale: 1;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.blur();
let strongResult = u.blur("lg");
let subtleResult = u.blur("2px");
```

A locked preview blurred, greyed, and dimmed all at once — the blur and the grayscale land in the same `filter`, so neither cancels the other:

```tsx
<div mix={[u.relative()]}>
	<div mix={[u.blur("sm"), u.grayscale(0.8), u.pointerEvents(), u.userSelect()]} aria-hidden="true">
		{preview}
	</div>
	<div mix={[u.absolute(), u.inset(0), u.center()]}>{unlockPrompt}</div>
</div>
```

#### `brightness(value?: number | (string & {})): UtilityMixin`

Applies a `filter: brightness(...)`, scaling every pixel's lightness. Values below `1` darken and values above `1` brighten; `0` is solid black. Reach for it to knock back a cover image so overlaid text stays legible, or to lift a thumbnail a notch under `u.hover()`.

`filter` is a single CSS property, so two utilities that each set it outright would silently overwrite each other instead of combining. Every filter utility therefore sets its own CSS custom property — `--ui-filter-brightness` here, `--ui-filter-blur` for `u.blur()`, `--ui-filter-grayscale` for `u.grayscale()`, and so on — plus one fixed, byte-identical composite `filter` declaration that references every filter function's variable with an identity fallback (`0px` for blur, `1` for brightness, contrast, and saturate, `0` for grayscale, invert, and sepia, `0 0 0 transparent` for drop-shadow — all no-ops). Custom properties from separate classes on the same element all apply at once, and because the composite declaration's value text is identical in every filter utility it doesn't matter whose copy wins the cascade: the resolved `filter` always reads every variable any applied utility set, and identity defaults for every variable none of them touched. So `u.brightness(0.6)` and `u.saturate(1.2)` on one element compose into a darkened _and_ saturated element rather than one erasing the other. This is the same mechanism `u.backdropSaturate()` and `u.backdropBlur()` use for `backdrop-filter`, one property over.

The function order inside the composite is fixed, and it is the order CSS applies them in — blur, brightness, contrast, grayscale, invert, saturate, sepia, drop-shadow. Filter functions are not commutative, so a `u.grayscale()` always applies _after_ a `u.brightness()` no matter which one a call site listed first; brightening a grey element and greying a brightened one differ, and the composite always does the latter. Finally, any brightness other than `1` makes the element a stacking context and a containing block for fixed-position descendants, so a `position: fixed` child inside it anchors to that element rather than the viewport.

**Parameters:**

- `value`: The brightness factor. Defaults to `1.1`, a barely-perceptible lift.
  - a `number` — stringified as-is into an unitless multiplier: `1` is unchanged, `0` is solid black, `0.6` darkens, values above `1` brighten. `1.1` is the default.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.brightness("110%")` emits `--ui-filter-brightness: 110%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-brightness` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.brightness() */
.host {
	--ui-filter-brightness: 1.1;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* [u.brightness(0.6), u.saturate(1.2)] — both variables set, one composite declaration */
.host {
	--ui-filter-brightness: 0.6;
	--ui-filter-saturate: 1.2;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.brightness();
let darkened = u.brightness(0.6);
let percentageEscapeHatch = u.brightness("110%");
let solidBlack = u.brightness(0);
```

A cover image darkened and slightly saturated so the headline sitting on top of it stays readable — two filter utilities composing into one `filter`:

```tsx
<figure mix={[u.relative(), u.rounded("lg"), u.overflow("hidden")]}>
	<img
		src={post.cover}
		alt=""
		mix={[u.is("full"), u.bs("full"), u.fit("cover"), u.brightness(0.6), u.saturate(1.2)]}
	/>
	<figcaption mix={[u.absolute(), u.insBe(0), u.p(4), u.fg("neutral.onSolid"), u.text("xl")]}>
		{post.title}
	</figcaption>
</figure>
```

#### `contrast(value?: number | (string & {})): UtilityMixin`

Applies a `filter: contrast(...)`, pushing pixels away from mid-grey (values above `1`) or toward it (values below `1`). `0` flattens the element to a uniform grey and `1` leaves it untouched. Reach for it to firm up a washed-out photograph, or to flatten a decorative background so foreground text wins.

Like every filter utility, it writes only its own `--ui-filter-contrast` custom property plus the shared composite `filter` declaration, so it stacks with `u.brightness()`, `u.saturate()`, `u.blur()`, and the rest instead of overwriting them — see `u.brightness()` for the full explanation of that mechanism and its fixed function order. Any contrast other than `1` makes the element a stacking context and a containing block for fixed-position descendants.

Do not use it to _fix_ an accessibility contrast failure. A filter changes rendered pixels, not the computed colors an automated checker reads, and it hits the element's entire subtree — text, borders, icons, and background together — which usually moves the text-to-background ratio less than expected. Fix the tones instead, and gate genuine high-contrast affordances on `u.contrastMore()`.

**Parameters:**

- `value`: The contrast factor. Defaults to `1.25`.
  - a `number` — stringified as-is into an unitless multiplier: `1` is unchanged, `0` is uniform grey, values below `1` flatten, values above `1` intensify. `1.25` is the default.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.contrast("125%")` emits `--ui-filter-contrast: 125%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-contrast` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.contrast() */
.host {
	--ui-filter-contrast: 1.25;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.contrast();
let punchier = u.contrast(1.5);
let flattened = u.contrast(0.75);
let percentageEscapeHatch = u.contrast("125%");
```

A user-uploaded screenshot given a little more definition, and returned to its untouched rendering when the platform is already forcing its own colors:

```tsx
<img
	src={attachment.url}
	alt={attachment.name}
	mix={[
		u.is("full"),
		u.rounded("md"),
		u.border("neutral"),
		u.contrast(1.15),
		u.forcedColors(u.contrast(1)),
	]}
/>
```

#### `dropShadow(options?: DropShadowOptions): UtilityMixin`

Applies a `filter: drop-shadow(...)`, casting a shadow from the element's _rendered shape_ rather than from its box. That is the whole reason it exists next to `u.shadow()`: `drop-shadow()` follows the alpha channel of a transparent PNG, the outline of an inline SVG icon, or the silhouette left by a clip or a `u.mask()`, where `u.shadow()`'s `box-shadow` always draws a rectangle around the full element box — visibly wrong under a logo with transparent corners or a non-rectangular icon.

Two limits come from the CSS function rather than from this utility. `drop-shadow()` accepts no spread radius and no `inset`, so a spread ring or an inner shadow has to come from `u.ringShadow()` or `u.shadow()` instead. And it is a filter, so it composes through the shared composite `filter` declaration — it writes only `--ui-filter-drop-shadow` and stacks with `u.blur()`, `u.grayscale()`, and the rest; see `u.brightness()` for how that works. A drop shadow also makes the element a stacking context and a containing block for fixed-position descendants.

**Parameters:**

- `options`: A `DropShadowOptions` object. Defaults to `{}`, which resolves to a small translucent-black shadow one spacing step down with a two-step blur.
  - `x`: The shadow's inline offset. Defaults to `0`.
    - a `number` — resolves against the spacing scale: `2` becomes `calc(var(--ui-spacing, 0.25rem) * 2)`.
    - a `string` — a raw CSS length, passed through unchanged: `"1px"`, `"0.125rem"`, or a `var(...)` reference.
  - `y`: The shadow's block offset. Defaults to `1`, one spacing step down. Same `number`-through-the-spacing-scale / `string`-passthrough handling as `x`.
  - `blur`: The shadow's blur radius. Defaults to `2`. Same handling as `x` and `y`; `0` gives a hard-edged shadow.
  - `color`: The shadow color, a `ColorValue` resolved with `border` as its default property. Defaults to the literal `rgb(0 0 0 / 0.15)` — the default is _not_ a token, so `border` only comes into play once a color is actually passed. Accepted forms:
    - a bare semantic tone — `"neutral"`, `"brand"`, `"success"`, `"warning"`, `"danger"` — which takes the `border` default, so `"brand"` resolves to `var(--ui-brand-border)`.
    - a tone with an explicit property suffix — `"brand.solid"`, `"neutral.strong"`, and so on, resolving to `var(--ui-{tone}-{suffix})`, with the usual friendly aliases (`tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`).
    - a raw palette reference — `"color.neutral.400"` resolves to `var(--ui-color-neutral-400)`.
    - `"transparent"`, `"inherit"`, or `"currentColor"` — passed through as-is.
    - the raw CSS escape hatch — any string containing `(` is treated as an already-formed CSS color and passed through untouched, so `u.dropShadow({ color: "rgb(0 0 0 / 0.4)" })` works.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-drop-shadow` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.dropShadow() */
.host {
	--ui-filter-drop-shadow: calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1)
		calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15);
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* u.dropShadow({ x: "0", y: "2px", blur: "4px", color: "brand" }) */
.host {
	--ui-filter-drop-shadow: 0 2px 4px var(--ui-brand-border);
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.dropShadow();
let rawLengths = u.dropShadow({ x: "1px", y: "2px", blur: "4px" });
let tonedShadow = u.dropShadow({ y: "0", blur: "6px", color: "brand.solid" });
let hardEdged = u.dropShadow({ x: 1, y: 1, blur: 0, color: "color.neutral.400" });
```

A transparent-PNG logo whose shadow traces the mark instead of boxing it, and an inline SVG icon lifted the same way:

```tsx
<header mix={[u.hstack({ gap: 3, align: "center" }), u.p(4)]}>
	<img src="/logo.png" alt="Acme" mix={[u.is(10), u.dropShadow({ y: 1, blur: 2 })]} />
	<svg
		viewBox="0 0 24 24"
		mix={[
			u.is(6),
			u.fill("brand.solid"),
			u.dropShadow({ y: "1px", blur: "2px", color: "brand.strong" }),
		]}
	>
		<path d={icon} />
	</svg>
</header>
```

#### `filterOpacity(value?: number | (string & {})): UtilityMixin`

Applies a `filter: opacity(...)`, the filter-function form of transparency. It is named `filterOpacity` rather than `opacity` because `u.opacity()` already exists in this family and sets the plain `opacity` _property_ — two different things that happen to share a name in CSS.

The distinction is subtle and it matters. `u.opacity()` sets the `opacity` property, which flattens the element **and all of its descendants** into one group and fades that group as a whole (and creates a stacking context). `u.filterOpacity()` adds an `opacity()` function to the element's `filter` list, so the fade runs inside the filter pipeline and composes with the other filter functions in the same declaration — a `u.blur()` or `u.grayscale()` applied by another utility. Because it is applied at a different stage of rendering than the property, the two can produce visibly different results on the same element; a filter chain plus a fade in one pass is the case this utility exists for.

**Footgun: it takes CSS's native `0`–`1` range (or a percentage string), not the `0`–`100` integer convention `u.opacity()` uses.** `u.opacity(50)` and `u.filterOpacity(0.5)` are the same amount of fade. `u.filterOpacity(50)` is **not** — CSS clamps it, so it renders fully opaque.

It composes through the shared composite `filter` declaration, writing only `--ui-filter-opacity`, so it stacks with every other filter utility instead of overwriting them; see `u.brightness()` for the mechanism and the fixed function order. Its own slot sits after grayscale, hue-rotate, and invert and before saturate.

**Parameters:**

- `value`: The opacity, in CSS's native range. Defaults to `0.5`.
  - a `number` — stringified as-is: `1` leaves the element untouched, `0.5` is the default half-fade, `0` is fully transparent. Values above `1` are clamped by CSS, which is the footgun above — `50` is fully opaque, not half.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.filterOpacity("25%")` emits `--ui-filter-opacity: 25%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation. It never sets the `opacity` property — only `--ui-filter-opacity` and the composite.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-opacity` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.filterOpacity() */
.host {
	--ui-filter-opacity: 0.5;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* [u.filterOpacity(0.5), u.blur("lg")] — both variables set, one composite declaration */
.host {
	--ui-filter-opacity: 0.5;
	--ui-filter-blur: var(--ui-blur-lg, 24px);
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.filterOpacity();
let quarter = u.filterOpacity(0.25);
let percentageEscapeHatch = u.filterOpacity("25%");
let sameFadeAsOpacity50 = u.filterOpacity(0.5);
```

A locked preview blurred, greyed, and faded in a single `filter` pass — three filter utilities, one declaration, so none of them cancels the others:

```tsx
<div mix={[u.relative()]}>
	<div
		mix={[u.blur("sm"), u.grayscale(0.8), u.filterOpacity(0.6), u.pointerEvents(), u.userSelect()]}
		aria-hidden="true"
	>
		{preview}
	</div>
	<div mix={[u.absolute(), u.inset(0), u.center()]}>{unlockPrompt}</div>
</div>
```

#### `grayscale(value?: number | (string & {})): UtilityMixin`

Applies a `filter: grayscale(...)`, desaturating the element toward grey. `1` is fully grey and `0` leaves it untouched. It is the cheapest way to dim an inactive, disabled, or unavailable thing without touching its layout or rewriting its colors — a locked integration logo, a sold-out product image, a paused chart.

It composes through the shared composite `filter` declaration, writing only `--ui-filter-grayscale`, so it stacks with `u.opacity()`-style dimming and with every other filter utility; see `u.brightness()` for the mechanism and the fixed function order. That order matters here: grayscale sits after brightness and contrast in the composite, so it greys whatever those already produced rather than the other way round.

It is purely visual and conveys nothing to assistive technology. A greyed-out element reads exactly the same to a screen reader as a full-color one, and it is invisible to a user who cannot distinguish the difference, so grayscale must never be the _only_ signal that something is unavailable — pair it with real text, `aria-disabled`, or a `disabled` attribute (`u.disabled()` styles the latter). Note also that any grayscale other than `0` makes the element a stacking context and a containing block for fixed-position descendants.

**Parameters:**

- `value`: The amount of desaturation. Defaults to `1`, a full conversion.
  - a `number` — stringified as-is: `0` leaves the element untouched, `0.5` is halfway, `1` is fully grey. Values above `1` are clamped by CSS.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.grayscale("60%")` emits `--ui-filter-grayscale: 60%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-grayscale` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.grayscale() */
.host {
	--ui-filter-grayscale: 1;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* u.grayscale(0.6) */
.host {
	--ui-filter-grayscale: 0.6;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.grayscale();
let halfway = u.grayscale(0.5);
let percentageEscapeHatch = u.grayscale("60%");
let cancelled = u.grayscale(0);
```

An unavailable integration, greyed _and_ labelled — the grey is decoration, the text is the actual signal:

```tsx
<li
	mix={[u.hstack({ gap: 3, align: "center" }), u.p(3), u.rounded("lg"), u.surface("default")]}
	aria-disabled="true"
>
	<img src={integration.icon} alt="" mix={[u.is(8), u.grayscale(), u.opacity(60)]} />
	<span mix={[u.fg("neutral.muted")]}>{integration.name}</span>
	<span mix={[u.text("sm"), u.fg("neutral.muted")]}>{t("integrations.unavailable")}</span>
</li>
```

#### `hueRotate(value?: AngleValue): UtilityMixin`

Applies a `filter: hue-rotate(...)`, rotating every pixel's hue around the color wheel by the given angle while leaving lightness and saturation alone. The real use is recoloring a whole image or icon in one declaration — tinting a single source asset per theme, or shifting a decorative illustration to match a brand hue — without shipping a second copy of the file.

Because it rotates rather than negates, `u.hueRotate(180)` lands on the opposite hue but keeps the original lightness, so a light image stays light. That is precisely the difference from `u.invert()`, which flips lightness too and turns a light image dark. When you want a one-color raster asset to read on a dark background, `u.invert()` is the tool; when you want the same asset in a different color at the same lightness, this is.

It composes through the shared composite `filter` declaration, writing only `--ui-filter-hue-rotate`, so it stacks with `u.saturate()`, `u.brightness()`, `u.blur()`, and the rest — see `u.brightness()` for the mechanism and the fixed function order. Any hue rotation other than `0deg` makes the element a stacking context and a containing block for fixed-position descendants. `u.backdropHueRotate()` is the same rotation applied to the element's backdrop instead.

**Parameters:**

- `value`: An `AngleValue`. Defaults to `90`, a quarter-turn.
  - a `number` — treated as degrees and suffixed with `deg`: `180` becomes `180deg`, and a negative number rotates the other way (`-45` becomes `-45deg`).
  - a `string` — passed through unchanged, for other angle units or a computed value: `"0.5turn"`, `"3.14rad"`, `"calc(var(--shift) * 1deg)"`.
- No value throws; there is no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-hue-rotate` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.hueRotate() */
.host {
	--ui-filter-hue-rotate: 90deg;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* u.hueRotate("0.5turn") */
.host {
	--ui-filter-hue-rotate: 0.5turn;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.hueRotate();
let oppositeHue = u.hueRotate(180);
let counterClockwise = u.hueRotate(-45);
let rawAngleUnit = u.hueRotate("0.5turn");
```

One decorative raster illustration recolored per surface — the rotation keeps its lightness, so it doesn't turn into a negative the way `u.invert()` would:

```tsx
<figure mix={[u.vstack({ gap: 2, align: "center" }), u.p(4)]}>
	<img
		src="/illustrations/empty-inbox.png"
		alt=""
		mix={[u.is(40), u.hueRotate(35), u.saturate(1.1)]}
	/>
	<figcaption mix={[u.text("sm"), u.fg("neutral.muted")]}>{t("inbox.empty")}</figcaption>
</figure>
```

#### `invert(value?: number | (string & {})): UtilityMixin`

Applies a `filter: invert(...)`, inverting the element's colors. `1` is a full inversion and `0` leaves it untouched.

The real-world use is narrow and worth stating plainly: flipping a single-color raster asset — a black PNG logo, an icon sprite, a bitmap diagram — so it reads on a dark background under `u.dark()`. An inline SVG never needs this, because its shapes can be painted directly with `u.fill()` (and its strokes with `u.stroke()`), which is both sharper and controllable per shape. Inverting anything with more than one meaningful color, or anything containing text, produces a negative rather than a dark-mode variant.

It composes through the shared composite `filter` declaration, writing only `--ui-filter-invert`, so it stacks with the other filter utilities — see `u.brightness()` for the mechanism and the fixed function order. Any inversion other than `0` makes the element a stacking context and a containing block for fixed-position descendants.

**Parameters:**

- `value`: The amount of inversion. Defaults to `1`, a full inversion.
  - a `number` — stringified as-is: `0` leaves the element untouched, `0.25` is a partial inversion, `1` is full. `0.5` collapses everything to mid-grey.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.invert("100%")` emits `--ui-filter-invert: 100%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-invert` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.invert() */
.host {
	--ui-filter-invert: 1;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.invert();
let partial = u.invert(0.25);
let percentageEscapeHatch = u.invert("100%");
let cancelled = u.invert(0);
```

A one-color raster logo flipped for dark mode, alongside the SVG case that does not need inverting at all:

```tsx
<>
	<img src="/logo-black.png" alt="Acme" mix={[u.is(24), u.dark(u.invert())]} />
	<svg viewBox="0 0 24 24" mix={[u.is(6), u.fill("neutral.emphasis")]}>
		<path d={mark} />
	</svg>
</>
```

#### `mask(image: string): UtilityMixin` (overloaded: `mask(options: MaskOptions): UtilityMixin`)

Applies a CSS mask, using the mask image's alpha channel to decide which parts of the element paint: fully opaque mask pixels show the element, fully transparent ones cut it away, and everything between fades it proportionally. Reach for it to fade a scroll container's edge into its background so overflowing content trails off instead of stopping at a hard line, or to cut an arbitrary shape out of an image with a `url(...)` reference to an SVG mask.

It is overloaded. Passed a bare string it sets `mask-image` only — the short form for the gradient-fade case, where the initial `mask-size`, `mask-position`, `mask-repeat`, and `mask-mode` are already right. Passed a `MaskOptions` object it sets exactly the keys given and nothing else, which is what lets a raster or `url(...)` mask be sized, positioned, un-repeated, and switched to luminance without dropping to `u.raw()`. Every property is mirrored onto its `-webkit-` prefixed twin, since Safari still requires its own prefixed properties to render an element mask — the same vendor-prefix mirroring `u.appearance()` does for form-control resets.

Two things to know about how it interacts with the rest of the tree. It masks the element _and everything it paints_, descendants included, which is exactly what makes the scroll-fade work — the fade applies to whatever content happens to be scrolled under it — but also means it can't be scoped to the element's own background. And per CSS masking, a computed `mask` other than `none` makes the element a stacking context and a containing block for absolutely and fixed-positioned descendants, so a `position: fixed` child inside a masked element anchors to that element instead of the viewport.

**Parameters:**

- `imageOrOptions`: Either a mask image string or a `MaskOptions` object. Required — there is no default. In the string form:
  - a gradient — `"linear-gradient(to bottom, black 80%, transparent)"` for an edge fade; the color stops only matter for their alpha, so `black` means "show" and `transparent` means "hide".
  - a `url(...)` reference — either an external image whose alpha channel is the mask, or a same-document fragment pointing at an SVG `<mask>` element (`"url(#ring-mask)"`).
  - `"none"` — the initial value, for cancelling a mask set by a composed utility or a state wrapper.
  - a comma-separated list of any of the above, layered the way `mask-image` layers them.
- `MaskOptions` keys, all optional, all passed through verbatim with no token resolution or validation. Only the keys present are emitted, so an empty object sets nothing:
  - `image`: Sets `mask-image` and `-webkit-mask-image`. Same accepted shapes as the bare-string form above; `u.mask({ image: x })` and `u.mask(x)` emit identically.
  - `size`: Sets `mask-size` and `-webkit-mask-size` — anything valid there, such as `"cover"`, `"contain"`, `"24px 24px"`, or `"100% 2rem"`.
  - `position`: Sets `mask-position` and `-webkit-mask-position` — `"center"`, `"top left"`, `"50% 50%"`, and so on.
  - `repeat`: Sets `mask-repeat` and `-webkit-mask-repeat`. A `MaskRepeatValue`; CSS's own initial value is `repeat`, so a single-instance mask must pass `"no-repeat"` explicitly.
    - `"repeat"` — tiles in both axes, the CSS initial value
    - `"no-repeat"` — a single instance, what a `url(...)` badge or shape mask almost always wants
    - `"repeat-x"` — tiles horizontally only
    - `"repeat-y"` — tiles vertically only
    - `"round"` — tiles a whole number of times, stretching or squashing the mask so tiles fit exactly
    - `"space"` — tiles a whole number of times at their natural size, distributing the leftover as gaps between tiles
  - `mode`: Sets `mask-mode` and `-webkit-mask-mode`, choosing which channel of the mask image drives the masking. A `MaskModeValue`:
    - `"alpha"` — the mask image's alpha channel is the mask; transparent hides, opaque shows
    - `"luminance"` — the mask image's lightness is the mask; black hides, white shows. What an SVG `<mask>` authored for luminance needs.
    - `"match-source"` — defer to the source: SVG `<mask>` references use luminance, everything else uses alpha. The CSS initial value.

**Returns:**

- A `UtilityMixin` that sets `mask-image` and `-webkit-mask-image` in the string form, or each given option's property and its `-webkit-` twin in the options form.

**CSS:**

```css
/* u.mask("linear-gradient(to bottom, black 80%, transparent)") */
.host {
	mask-image: linear-gradient(to bottom, black 80%, transparent);
	-webkit-mask-image: linear-gradient(to bottom, black 80%, transparent);
}

/* u.mask({ image: "url(/badge.png)", size: "contain", position: "center", repeat: "no-repeat", mode: "luminance" }) */
.host {
	mask-image: url(/badge.png);
	-webkit-mask-image: url(/badge.png);
	mask-size: contain;
	-webkit-mask-size: contain;
	mask-position: center;
	-webkit-mask-position: center;
	mask-repeat: no-repeat;
	-webkit-mask-repeat: no-repeat;
	mask-mode: luminance;
	-webkit-mask-mode: luminance;
}

/* u.mask({ size: "24px 24px", repeat: "space" }) — only the given keys are set */
.host {
	mask-size: 24px 24px;
	-webkit-mask-size: 24px 24px;
	mask-repeat: space;
	-webkit-mask-repeat: space;
}
```

**Example:**

```typescript
let result = u.mask("linear-gradient(to bottom, black 80%, transparent)");
let shapeCutout = u.mask("url(#ring-mask)");
let bothEdges = u.mask(
	"linear-gradient(to bottom, transparent, black 2rem, black calc(100% - 2rem), transparent)",
);
let sizedRasterMask = u.mask({
	image: "url(/badge.png)",
	size: "contain",
	position: "center",
	repeat: "no-repeat",
});
let luminanceMask = u.mask({ image: "url(#ring-mask)", mode: "luminance" });
let cancelled = u.mask("none");
```

The short form for a scroll fade, and the options form for a raster mask that has to be sized and stopped from tiling:

```tsx
<>
	<div
		mix={[
			u.overflowY("auto"),
			u.maxBs("20rem"),
			u.mask("linear-gradient(to bottom, black 80%, transparent)"),
		]}
	>
		{rows}
	</div>
	<div
		mix={[
			u.is(16),
			u.bs(16),
			u.bg("brand.solid"),
			u.mask({
				image: "url(/badge.png)",
				size: "contain",
				position: "center",
				repeat: "no-repeat",
			}),
		]}
	/>
</>
```

#### `mixBlendMode(value?: MixBlendModeValue): UtilityMixin`

Applies `mix-blend-mode`, blending the element with the content painted behind it instead of simply covering it — a `multiply` caption that darkens into its background, a `plus-lighter` glow, a `luminosity` treatment that keeps the backdrop's hue but takes the overlay's lightness.

Three things are worth knowing before reaching for it. Any value other than `normal` makes the element create a **stacking context** of its own, so its `z-index` starts being interpreted and its descendants can no longer be layered against elements outside it. Blending is confined to the nearest stacking context, which is exactly how the effect gets contained: the element blends with its siblings and its ancestors' painting up to that boundary and no further, so putting `u.isolate()` on the ancestor that should be the outer limit stops the blend there instead of letting it reach the page background. And it blends against _whatever_ happens to be painted behind it — predictable over a fixed design, unpredictable over user-supplied imagery, where a mode that reads well on a dark photo can make the same text vanish on a light one. Text over uncontrolled images wants an opaque background or a scrim, not a blend mode.

**Parameters:**

- `value`: A `MixBlendModeValue`. Defaults to `"multiply"`. Closed union, no raw-string escape hatch.
  - `"normal"` — no blending; the element simply paints over what is behind it. The CSS initial value, and the way to opt one element back out.
  - `"multiply"` — multiplies the two colors, so the result is never lighter than either. Darkens; white leaves the backdrop untouched. The default.
  - `"screen"` — the inverse of multiply, so the result is never darker than either. Lightens; black leaves the backdrop untouched.
  - `"overlay"` — multiply on the dark parts of the backdrop, screen on the light parts, so it boosts existing contrast.
  - `"darken"` — keeps the darker of the two colors, channel by channel.
  - `"lighten"` — keeps the lighter of the two colors, channel by channel.
  - `"color-dodge"` — brightens the backdrop in proportion to the element; a hard, blown-out lift.
  - `"color-burn"` — darkens the backdrop in proportion to the element; the mirror of color-dodge.
  - `"hard-light"` — overlay with the two layers swapped, so the element's lightness drives the result. Harsh.
  - `"soft-light"` — a gentler hard-light, closer to a diffuse spotlight over the backdrop.
  - `"difference"` — the absolute difference between the two, so identical colors go black; a strong graphic effect.
  - `"exclusion"` — like difference but with lower contrast in the midtones.
  - `"hue"` — takes the element's hue with the backdrop's saturation and luminosity.
  - `"saturation"` — takes the element's saturation with the backdrop's hue and luminosity.
  - `"color"` — takes the element's hue and saturation with the backdrop's luminosity, the classic colorize.
  - `"luminosity"` — the inverse: the element's luminosity over the backdrop's hue and saturation.
  - `"plus-darker"` — a compositing mode rather than a separable blend: sums the darkness of both layers, clamped.
  - `"plus-lighter"` — sums both layers additively, clamped to white; the mode behind additive glows and the standard trick for cross-fading two stacked layers without a dip in the middle.

**Returns:**

- A `UtilityMixin` that sets `mix-blend-mode`.

**CSS:**

```css
/* u.mixBlendMode() */
.host {
	mix-blend-mode: multiply;
}

/* u.mixBlendMode("plus-lighter") */
.host {
	mix-blend-mode: plus-lighter;
}
```

**Example:**

```typescript
let result = u.mixBlendMode();
let lightening = u.mixBlendMode("screen");
let nonSeparable = u.mixBlendMode("luminosity");
let additiveGlow = u.mixBlendMode("plus-lighter");
let optedOut = u.mixBlendMode("normal");
```

A brand-tinted wash blended into a header image, with `u.isolate()` on the wrapper so the blend stops at the card instead of reaching the page background:

```tsx
<div mix={[u.zstack(), u.isolate(), u.rounded("lg"), u.overflow("hidden")]}>
	<img src={post.cover} alt="" mix={[u.is("full"), u.bs("full"), u.fit("cover")]} />
	<div mix={[u.absolute(), u.inset(0), u.bg("brand.solid"), u.mixBlendMode("luminosity")]} />
</div>
```

#### `opacity(value: number): UtilityMixin`

Applies opacity from a 0-100 integer, following the same convention as a utility-CSS scale rather than the CSS `opacity` property's native 0-1 range. The value is divided by 100 before being written out, so `opacity(50)` produces `opacity: 0.5`.

Watch the scale: `u.opacity(1)` is 1% opaque — very nearly invisible — not fully opaque. Fully opaque is `u.opacity(100)`.

Two things it does beyond fading. Any value below 1 creates a stacking context and a containing block for fixed-position descendants, so it can change how absolutely positioned children anchor. And it fades the element without removing it: an `opacity(0)` element still occupies space, still catches clicks, and is still announced by screen readers. Pair it with `u.visibility("hidden")` or `u.pointerEvents()` to actually take it out of play, or reach for `u.visuallyHidden()` when the goal is screen-reader-only content.

**Parameters:**

- `value`: An integer from 0 to 100, divided by 100 to produce the CSS value. Nothing clamps the input, so a value above 100 or below 0 is emitted as-is and left to the browser to clamp.

**Returns:**

- A `UtilityMixin` that sets `opacity` to `value / 100`

**CSS:**

```css
/* u.opacity(50) */
.host {
	opacity: 0.5;
}

/* u.opacity(100) */
.host {
	opacity: 1;
}
```

**Example:**

```typescript
let result = u.opacity(50);
let fullResult = u.opacity(100);
let invisibleResult = u.opacity(0);
```

The reveal-on-interaction pattern, with the fade paired to a transition so it animates:

```tsx
<li mix={[u.relative(), u.hover(u.when("& [data-slot='actions']", u.opacity(100)))]}>
	<span>{label}</span>
	<span
		data-slot="actions"
		mix={[u.opacity(0), u.transition("opacity"), u.focusWithin(u.opacity(100))]}
	>
		{actions}
	</span>
</li>
```

Because opacity fades the element _and all its descendants_ as one group, a child cannot be more opaque than its parent — to fade only a background, use a translucent color via `u.colorMix()` instead.

#### `ringShadow(value: ColorValue, width?: number | (string & {})): UtilityMixin`

Draws a persistent ring as `0 0 0 {width} {color}` — a solid, zero-blur, zero-offset box shadow — for the always-on selection state of a swatch, chip, or thumbnail. It's deliberately named apart from `u.ring()`, which composes `u.focusVisible()` and draws an `outline` that appears only under keyboard or assistive-tech focus and vanishes when focus moves on. This one has no gate at all: it stays visible for as long as a component applies it, which is what a `u.checked()` or `input:checked ~ &` selection style needs. It also differs from `u.shadow()`, which pulls a soft depth shadow off the shadow scale rather than a hard ring in a semantic color.

A box-shadow ring beats an outline when the ring must hug a rounded element: `box-shadow` follows `border-radius` exactly, so it traces a pill or circle cleanly. The tradeoff is real — a box shadow paints outside the element's box without reserving any space, so in a tight grid the ring can overlap neighbors where an `outline` plus `outline-offset` would behave more predictably; leave room with `u.gap()` or `u.m()`.

`box-shadow` is a single property whose value is a comma-separated _list_, so two utilities that each set it outright cannot stack the way the list syntax suggests — the later declaration replaces the earlier one wholesale. Both shadow utilities therefore write into a fixed two-slot composite instead: this one claims the `ring` slot via `--ui-box-shadow-ring`, `u.shadow()` claims the `elevation` slot via `--ui-box-shadow-elevation`, and each emits the exact same `box-shadow` declaration listing both slots with a paints-nothing identity fallback (`0 0 #0000`). Because that value text is byte-identical in both utilities it doesn't matter whose copy wins the cascade — the resolved `box-shadow` always reads whichever slots were set. **So `u.ringShadow()` and `u.shadow()` stack**: applying both to one element renders two layers. The slot order is fixed and meaningful — the ring is listed first, so it paints on top of and inside the elevation shadow, hugging the element's edge while the depth shadow falls outside it.

Note it resolves its color with a default property of `bg-solid`, not `ring` — a bare `"brand"` gives the tone's solid background color, which is the saturated, high-contrast one a selection ring wants. That differs from `u.ring()`, which defaults to the tone's `ring` property.

**Parameters:**

- `value`: The ring color, a `ColorValue` resolved with `bg-solid` as its default property. Required, with no default. Accepted forms:
  - a bare semantic tone — `"neutral"`, `"brand"`, `"success"`, `"warning"`, `"danger"` — which takes the `bg-solid` default, so `"brand"` resolves to `var(--ui-brand-bg-solid)`.
  - a tone with an explicit property suffix — `"brand.border"`, `"brand.ring"`, and so on, resolving to `var(--ui-{tone}-{suffix})`. Six friendly suffixes are aliased to longer variable segments: `tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`. Any other suffix is used verbatim.
  - a raw palette reference — `"color.{palette}.{shade}"` over the `neutral`, `brand`, `success`, `warning`, and `danger` palettes with shades `50`, `100`–`900` in steps of `100`, and `950`; `"color.neutral.400"` resolves to `var(--ui-color-neutral-400)`.
  - `"transparent"`, `"inherit"`, or `"currentColor"` — passed through as-is (`currentcolor` in any casing is normalized to `currentColor`).
  - the raw CSS escape hatch — any string containing `(` is treated as an already-formed CSS color and passed through untouched, so `u.ringShadow("oklch(0.7 0.2 250)")` and `u.ringShadow(u.var("accent"))` both work rather than being misread as a `tone.property` token.
  - Because this utility always supplies `bg-solid` as the default property, the underlying resolver's "no property and no default" error is unreachable here — `u.ringShadow()` cannot throw on a bare tone name.
- `width`: The ring's thickness. Defaults to `2`.
  - a `number` — treated as pixels: `3` becomes `3px`.
  - a `string` — the raw CSS escape hatch, passed through unchanged: `"0.25rem"`, `"1px"`, or a `var(...)` reference.

**Returns:**

- A `UtilityMixin` that sets the `--ui-box-shadow-ring` custom property to `0 0 0 {width} {color}` plus the shared composite `box-shadow` declaration.

**CSS:**

```css
/* u.ringShadow("brand") */
.host {
	--ui-box-shadow-ring: 0 0 0 2px var(--ui-brand-bg-solid);
	box-shadow: var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000);
}

/* u.ringShadow("danger", 3) */
.host {
	--ui-box-shadow-ring: 0 0 0 3px var(--ui-danger-bg-solid);
	box-shadow: var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000);
}

/* [u.ringShadow("brand", 3), u.shadow("md")] — both slots set, one composite declaration */
.host {
	--ui-box-shadow-ring: 0 0 0 3px var(--ui-brand-bg-solid);
	--ui-box-shadow-elevation: var(
		--ui-shadow-md,
		0 4px 6px -1px rgb(0 0 0 / 0.1),
		0 2px 4px -2px rgb(0 0 0 / 0.1)
	);
	box-shadow: var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000);
}
```

**Example:**

```typescript
let result = u.ringShadow("brand");
let thickDangerRing = u.ringShadow("danger", 3);
let paletteRing = u.ringShadow("color.neutral.400");
let remWidth = u.ringShadow("neutral", "0.25rem");
let rawColorEscapeHatch = u.ringShadow("oklch(0.7 0.2 250)");
```

A selectable thumbnail carrying a depth shadow at all times and gaining a selection ring when its radio is checked — both live on the same element, in different slots of the same declaration, so the ring hugs the tile and the elevation still falls outside it:

```tsx
<label
	mix={[
		u.relative(),
		u.block(),
		u.rounded("lg"),
		u.shadow("md"),
		u.transition("box-shadow"),
		u.has("input:checked", u.ringShadow("brand", 3)),
	]}
>
	<img src={photo.thumb} alt={photo.alt} mix={[u.is("full"), u.fit("cover"), u.rounded("lg")]} />
	<input type="radio" name="cover" value={photo.id} mix={[u.visuallyHidden()]} />
</label>
```

#### `rounded(name?: RadiusName | (string & {})): UtilityMixin`

Applies a corner radius to all four corners from the radius scale or a raw CSS length. Reach for `u.roundedCorner()` to round a single corner, and `u.squircle()` for continuous corners where the browser supports them.

A radius clips nothing by itself — a child that overflows the rounded box still paints over the corner. Pair it with `u.clip()` (or `u.overflow("hidden")`) on the same element when a child image or background needs to follow the curve.

**Parameters:**

- `name`: A radius scale step, a raw CSS length, or `"inherit"`. Defaults to `"md"`.
  - `"none"` — `var(--ui-radius-none, 0px)`
  - `"sm"` — `var(--ui-radius-sm, 0.25rem)`
  - `"md"` — `var(--ui-radius-md, 0.375rem)`, the default
  - `"lg"` — `var(--ui-radius-lg, 0.5rem)`
  - `"xl"` — `var(--ui-radius-xl, 0.75rem)`
  - `"full"` — `var(--ui-radius-full, 9999px)`, a pill or, on a square box, a circle
  - `"inherit"` — special-cased and emitted literally as `border-radius: inherit`, which is how a child matches whatever radius its parent has
  - a raw CSS length (`"3px"`, `"0.125rem"`) — passed through literally. Only an atomic number-plus-unit is detected as a length, so a `calc(...)` expression is _not_ passed through and would resolve as `var(--ui-radius-calc(...), 0px)` — reach for `u.raw()` there.
  - an app-extended name declared through module augmentation of `Radii`

**Returns:**

- A `UtilityMixin` that sets `border-radius`

**CSS:**

```css
/* u.rounded("lg") */
.host {
	border-radius: var(--ui-radius-lg, 0.5rem);
}

/* u.rounded("inherit") */
.host {
	border-radius: inherit;
}
```

**Example:**

```typescript
let result = u.rounded();
let largeResult = u.rounded("lg");
let pillResult = u.rounded("full");
let inheritResult = u.rounded("inherit");
let literalResult = u.rounded("3px");
```

The clipping pair, plus `inherit` so the child follows the parent's curve:

```tsx
<article mix={[u.rounded("lg"), u.clip(), u.border("neutral")]}>
	<img
		mix={[u.is("full"), u.aspect("video"), u.fit("cover"), u.rounded("inherit")]}
		src={src}
		alt=""
	/>
</article>
```

Reach for `u.circle()` when you want a circle — it composes `u.aspect("square")` with `u.rounded("full")` so the box is actually square first.

#### `roundedCorner(corner: LogicalCorner, name?: RadiusName | string): UtilityMixin`

Rounds a single corner from the radius scale, instead of all four at once like `u.rounded()`. Useful for shapes that round three corners uniformly and differentiate the fourth — a chat bubble's tail corner, a segmented control's end caps, or a tab that joins its panel on one edge. Compose it after `u.rounded()` to set the baseline and then override the one corner that differs; the two touch different properties (`border-radius` versus a single logical longhand), so the longhand must come second in the `mix` array to win.

Corners are named logically, as a block-then-inline start/end pair — `"start-start"` is block-start plus inline-start — and map onto the `border-start-start-radius` family rather than the physical `border-top-left-radius` longhands. That's what makes the shape survive RTL: a chat bubble whose tail sits on the inline-start side keeps that tail on the reading-start side when the writing mode flips, and a vertical writing mode reorients it too, with no direction-specific overrides at the call site. It's the same reason the logical box-model utilities are preferred over their physical counterparts throughout this package.

**Parameters:**

- `corner`: A `LogicalCorner` naming which corner to round. Required, with no default.
  - `"start-start"` → `border-start-start-radius`, block-start + inline-start (top-left in a horizontal LTR context).
  - `"start-end"` → `border-start-end-radius`, block-start + inline-end (top-right in horizontal LTR).
  - `"end-start"` → `border-end-start-radius`, block-end + inline-start (bottom-left in horizontal LTR).
  - `"end-end"` → `border-end-end-radius`, block-end + inline-end (bottom-right in horizontal LTR).
- `name`: The radius to apply. Defaults to `"md"`. A named scale step resolves to `var(--ui-radius-{name}, fallback)`, with the fallback baked in so the scale works before an app defines the variable:
  - `"none"` → `var(--ui-radius-none, 0px)`
  - `"sm"` → `var(--ui-radius-sm, 0.25rem)`
  - `"md"` → `var(--ui-radius-md, 0.375rem)` — the default
  - `"lg"` → `var(--ui-radius-lg, 0.5rem)`
  - `"xl"` → `var(--ui-radius-xl, 0.75rem)`
  - `"full"` → `var(--ui-radius-full, 9999px)`
  - a raw CSS length — the escape hatch: `u.roundedCorner("start-end", "3px")` emits `3px` literally, with no `var(...)` indirection. Recognized units are `px`, `ch`, `em`, `rem`, `%`, `vw`, `vh`, `dvw`, `dvh`, `vi`, `vb`, `svw`, `svh`, `lvw`, `lvh`, `cqw`, `cqh`, `cqmin`, and `cqmax`.
  - any other bare-word name — an app's own declaration-merged scale step, resolving through `var(--ui-radius-{name}, 0px)`. Note the sharp edge: a value that _looks_ like a length but isn't in the recognized unit list (`"2pt"`) or isn't a plain length at all (`"calc(1rem - 2px)"`) falls into this branch and becomes `var(--ui-radius-calc(1rem - 2px), 0px)` rather than passing through. Reach for `u.raw()` for a computed radius.
- Neither parameter throws; an unrecognized name silently becomes a `var(...)` reference with a `0px` fallback.

**Returns:**

- A `UtilityMixin` that sets exactly one logical radius longhand — `border-start-start-radius`, `border-start-end-radius`, `border-end-start-radius`, or `border-end-end-radius` — to the resolved value.

**CSS:**

```css
/* u.roundedCorner("end-start") */
.host {
	border-end-start-radius: var(--ui-radius-md, 0.375rem);
}

/* u.roundedCorner("start-start", "sm") */
.host {
	border-start-start-radius: var(--ui-radius-sm, 0.25rem);
}

/* u.roundedCorner("start-end", "3px") — raw length, no var() indirection */
.host {
	border-start-end-radius: 3px;
}
```

**Example:**

```typescript
let result = u.roundedCorner("end-start");
let namedRadius = u.roundedCorner("start-start", "sm");
let fullPill = u.roundedCorner("end-end", "full");
let rawLengthEscapeHatch = u.roundedCorner("start-end", "3px");
```

```tsx
<div mix={[u.rounded("lg"), u.roundedCorner("end-start", "none"), u.p(3), u.bg("brand.tint")]} />
```

#### `saturate(value?: number | (string & {})): UtilityMixin`

Applies a `filter: saturate(...)`, scaling the element's color intensity. `0` is fully desaturated, `1` is unchanged, and values above `1` oversaturate. Reach for it to give a muted photograph some life, or to pull an image's colors back so it sits behind foreground content without competing.

This is the `filter` counterpart to `u.backdropSaturate()`, and the distinction is which pixels get filtered: `u.saturate()` saturates the element itself and everything it paints, while `u.backdropSaturate()` saturates whatever shows _through_ the element and does nothing at all unless the element is translucent. They write different variables and different properties, so applying both to one element is meaningful rather than a conflict — the element's own colors and the colors behind it are saturated independently.

Like every filter utility, it writes only `--ui-filter-saturate` plus the shared composite `filter` declaration, so it stacks with `u.brightness()`, `u.contrast()`, `u.blur()`, and the rest; see `u.brightness()` for the mechanism and the fixed function order. Any saturation other than `1` makes the element a stacking context and a containing block for fixed-position descendants.

**Parameters:**

- `value`: The saturation factor. Defaults to `1.5`.
  - a `number` — stringified as-is into an unitless multiplier: `1` is unchanged, `0` is fully desaturated (equivalent to `u.grayscale()`), values above `1` intensify. `1.5` is the default.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.saturate("150%")` emits `--ui-filter-saturate: 150%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-saturate` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.saturate() */
.host {
	--ui-filter-saturate: 1.5;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}

/* [u.saturate(1.5), u.backdropSaturate(1.4)] — different variables, different properties, no conflict */
.host {
	--ui-filter-saturate: 1.5;
	--ui-backdrop-saturate: 1.4;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
	backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
		contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
		hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
		opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
		sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
		brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
		grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
		invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
		saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
		drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.saturate();
let muted = u.saturate(0.6);
let percentageEscapeHatch = u.saturate("150%");
let fullyDesaturated = u.saturate(0);
```

A gallery thumbnail that sits muted at rest and comes up to full color on hover, with the transition on `filter` rather than on any individual function:

```tsx
<a
	href={photo.href}
	mix={[
		u.block(),
		u.rounded("md"),
		u.overflow("hidden"),
		u.saturate(0.7),
		u.transition("filter"),
		u.hover(u.saturate(1.1)),
		u.focusVisible(u.saturate(1.1)),
	]}
>
	<img src={photo.thumb} alt={photo.alt} mix={[u.is("full"), u.fit("cover")]} />
</a>
```

#### `sepia(value?: number | (string & {})): UtilityMixin`

Applies a `filter: sepia(...)`, shifting the element toward a warm brown monochrome. `1` is a full conversion and `0` leaves it untouched. It is the aged-photograph treatment — an archival or historical framing for imagery — and, at low amounts, a way to warm a cold photograph without a full grade.

It composes through the shared composite `filter` declaration, writing only `--ui-filter-sepia`, so it stacks with the other filter utilities; see `u.brightness()` for the mechanism and the fixed function order. Sepia sits after grayscale in that order, which is why combining the two is redundant rather than additive — sepia already collapses the element to a single hue, so reach for one or the other. Any sepia other than `0` makes the element a stacking context and a containing block for fixed-position descendants.

**Parameters:**

- `value`: The amount of conversion. Defaults to `1`, a full conversion.
  - a `number` — stringified as-is: `0` leaves the element untouched, `0.4` warms it partway, `1` is fully sepia. Values above `1` are clamped by CSS.
  - a `string` — the raw CSS escape hatch, passed through verbatim, so percentage notation works: `u.sepia("40%")` emits `--ui-filter-sepia: 40%`. Also how you'd hand it a `var(...)` or `calc(...)` reference.
- No value throws; there is no token scale and no validation.

**Returns:**

- A `UtilityMixin` that sets the `--ui-filter-sepia` custom property plus the shared composite `filter` declaration.

**CSS:**

```css
/* u.sepia() */
.host {
	--ui-filter-sepia: 1;
	filter: blur(var(--ui-filter-blur, 0px)) brightness(var(--ui-filter-brightness, 1))
		contrast(var(--ui-filter-contrast, 1)) grayscale(var(--ui-filter-grayscale, 0))
		hue-rotate(var(--ui-filter-hue-rotate, 0deg)) invert(var(--ui-filter-invert, 0))
		opacity(var(--ui-filter-opacity, 1)) saturate(var(--ui-filter-saturate, 1))
		sepia(var(--ui-filter-sepia, 0)) drop-shadow(var(--ui-filter-drop-shadow, 0 0 0 transparent));
}
```

**Example:**

```typescript
let result = u.sepia();
let subtleWarmth = u.sepia(0.4);
let percentageEscapeHatch = u.sepia("40%");
let cancelled = u.sepia(0);
```

An archival photo aged and given a touch more contrast — two filter utilities in one composite, with the fixed order putting the contrast bump before the sepia conversion:

```tsx
<figure mix={[u.vstack({ gap: 2 }), u.maxIs("32rem")]}>
	<img
		src={record.scan}
		alt={record.caption}
		mix={[u.is("full"), u.rounded("sm"), u.sepia(0.8), u.contrast(1.1)]}
	/>
	<figcaption mix={[u.text("sm"), u.fg("neutral.muted")]}>{record.caption}</figcaption>
</figure>
```

#### `shadow(name?: ShadowName | (string & {})): UtilityMixin`

Applies a box shadow from the shadow scale. Shadows read as elevation, so keep the scale meaningful: a resting card at `"sm"` or `"base"`, a hovered or dragged one a step up, an overlay at `"lg"` or `"xl"`.

Unlike the other scale-backed utilities, this one has **no raw-value passthrough**. A literal shadow value can't be told apart from an app-extended token name — both are arbitrary strings with no shape in common with a length — so an unrecognized name always resolves to `var(--ui-shadow-{name}, <md fallback>)`. For a genuinely one-off shadow, write the slot variable directly — `u.raw({ "--ui-box-shadow-elevation": "0 3px 7px -2px rgb(0 0 0 / 0.12)" })` — rather than `u.raw({ boxShadow: "..." })`, which replaces the whole composite declaration and wipes out any `u.ringShadow()` applied alongside it.

`box-shadow` is a single property whose value is a comma-separated _list_, so two utilities that each set it outright cannot stack the way the list syntax suggests — the later declaration replaces the earlier one wholesale. Both shadow utilities therefore write into a fixed two-slot composite instead: this one claims the `elevation` slot via `--ui-box-shadow-elevation`, `u.ringShadow()` claims the `ring` slot via `--ui-box-shadow-ring`, and each emits the exact same `box-shadow` declaration listing both slots with a paints-nothing identity fallback (`0 0 #0000`). Because that value text is byte-identical in both utilities it doesn't matter whose copy wins the cascade — the resolved `box-shadow` always reads whichever slots were set. **So `u.shadow()` and `u.ringShadow()` stack**: an elevation shadow and a selection ring on the same element render as two layers, in either order at the call site, with no need for `u.raw()`. The slot order is fixed: the ring is listed first, so it paints inside the elevation, hugging the element's edge while the depth shadow falls outside it.

A shadow is invisible against most dark backgrounds, so a design that leans on elevation in light mode usually needs a border in dark mode instead — see `u.dark()`.

**Parameters:**

- `name`: A shadow scale step, or an app-extended name declared through module augmentation of `Shadows`. Defaults to `"md"`.
  - `"sm"` — `var(--ui-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))`
  - `"base"` — `var(--ui-shadow-base, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))`
  - `"md"` — `var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))`, the default
  - `"lg"` — `var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))`
  - `"xl"` — `var(--ui-shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))`
  - any unrecognized name falls back to the `md` value inside the `var(...)`, rather than passing through as a literal

**Returns:**

- A `UtilityMixin` that sets the `--ui-box-shadow-elevation` custom property plus the shared composite `box-shadow` declaration.

**CSS:**

```css
/* u.shadow("lg") */
.host {
	--ui-box-shadow-elevation: var(
		--ui-shadow-lg,
		0 10px 15px -3px rgb(0 0 0 / 0.1),
		0 4px 6px -4px rgb(0 0 0 / 0.1)
	);
	box-shadow: var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000);
}

/* [u.shadow("lg"), u.ringShadow("brand")] — both slots set, one composite declaration */
.host {
	--ui-box-shadow-elevation: var(
		--ui-shadow-lg,
		0 10px 15px -3px rgb(0 0 0 / 0.1),
		0 4px 6px -4px rgb(0 0 0 / 0.1)
	);
	--ui-box-shadow-ring: 0 0 0 2px var(--ui-brand-bg-solid);
	box-shadow: var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000);
}
```

**Example:**

```typescript
let result = u.shadow();
let subtleResult = u.shadow("sm");
let overlayResult = u.shadow("xl");
```

Elevation that changes with interaction, and a border standing in for it under dark mode:

```tsx
<article
	mix={[
		u.rounded("lg"),
		u.p(4),
		u.surface("default"),
		u.shadow("sm"),
		u.transition("box-shadow, transform"),
		u.hover([u.shadow("lg"), u.translateY(-1)]),
		u.dark(u.border("neutral")),
	]}
>
	{children}
</article>
```

An elevation and a ring on one element, which is now just two utilities side by side:

```tsx
<button
	type="button"
	mix={[
		u.rounded("lg"),
		u.p(3),
		u.surface("default"),
		u.shadow("md"),
		u.transition("box-shadow"),
		u.aria("pressed", "true", u.ringShadow("brand", 2)),
	]}
	aria-pressed={isActive}
>
	{label}
</button>
```

#### `textShadow(options?: TextShadowOptions): UtilityMixin`

Applies `text-shadow`, which shadows the _glyphs_ themselves. That is the distinction from its two neighbours: `u.shadow()` shadows the element's box, `u.dropShadow()` shadows its rendered shape, and this one traces the letter forms.

The real use is legibility for text sitting directly on an image or a video, where a soft dark shadow keeps the letters readable as the content behind them changes. Treat it as the weaker option, though: it only rescues text whose contrast is already borderline, and it does nothing measurable for a contrast ratio. A real scrim — a translucent overlay between the media and the text — is the reliable fix, with a text shadow layered on top of it at most.

It sets one plain property and nothing else, so unlike `u.dropShadow()` it does not go through the composite `filter` declaration and never interacts with the filter utilities. Note also that `text-shadow` accepts no spread radius and no `inset`, unlike `box-shadow`.

**Parameters:**

- `options`: A `TextShadowOptions` object. Defaults to `{}`, which resolves to a translucent-black shadow one spacing step down with a two-step blur.
  - `x`: The shadow's inline offset. Defaults to `0`.
    - a `number` — resolves against the spacing scale: `2` becomes `calc(var(--ui-spacing, 0.25rem) * 2)`.
    - a `string` — a raw CSS length, passed through unchanged: `"1px"`, `"0.125rem"`, or a `var(...)` reference.
  - `y`: The shadow's block offset. Defaults to `1`, one spacing step down. Same `number`-through-the-spacing-scale / `string`-passthrough handling as `x`.
  - `blur`: The shadow's blur radius. Defaults to `2`. Same handling as `x` and `y`; `0` gives a hard-edged shadow.
  - `color`: The shadow color, a `ColorValue` resolved through the token layer with `border` as its default property. Defaults to the literal `rgb(0 0 0 / 0.35)` — a stronger default alpha than `u.dropShadow()`'s, because glyph edges need more help than a box edge — and that default is **not** a token, so it never touches the resolver and `border` only comes into play once a color is actually passed. Accepted forms:
    - a bare semantic tone — `"neutral"`, `"brand"`, `"success"`, `"warning"`, `"danger"` — which takes the `border` default, so `"brand"` resolves to `var(--ui-brand-border)`.
    - a tone with an explicit property suffix — `"brand.solid"`, `"neutral.strong"`, and so on, resolving to `var(--ui-{tone}-{suffix})`, with the usual friendly aliases (`tint` → `bg-tint`, `solid` → `bg-solid`, `muted` → `fg-muted`, `emphasis` → `fg-emphasis`, `onSolid` → `fg-on-solid`, `strong` → `border-strong`).
    - a raw palette reference — `"color.neutral.400"` resolves to `var(--ui-color-neutral-400)`.
    - `"transparent"`, `"inherit"`, or `"currentColor"` — passed through as-is.
    - the raw CSS escape hatch — any string containing `(` is treated as an already-formed CSS color and passed through untouched, so `u.textShadow({ color: "rgb(0 0 0 / 0.6)" })` works.

**Returns:**

- A `UtilityMixin` that sets only `text-shadow`.

**CSS:**

```css
/* u.textShadow() */
.host {
	text-shadow: calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1)
		calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.35);
}

/* u.textShadow({ y: "1px", blur: "3px", color: "brand" }) */
.host {
	text-shadow: calc(var(--ui-spacing, 0.25rem) * 0) 1px 3px var(--ui-brand-border);
}
```

**Example:**

```typescript
let result = u.textShadow();
let rawLengths = u.textShadow({ x: "1px", y: "2px", blur: "4px" });
let tonedShadow = u.textShadow({ x: "0", y: "0", blur: "6px", color: "brand.solid" });
let hardEdged = u.textShadow({ x: 1, y: 1, blur: 0, color: "color.neutral.400" });
```

A headline over a cover image done properly — a translucent scrim carries the contrast, and the text shadow is the finishing touch on top of it rather than the whole plan:

```tsx
<figure mix={[u.relative(), u.rounded("lg"), u.overflow("hidden")]}>
	<img src={post.cover} alt="" mix={[u.is("full"), u.bs("full"), u.fit("cover")]} />
	<div
		mix={[
			u.absolute(),
			u.inset(0),
			u.bg(u.colorMix("oklab", { color: "color.neutral.900", weight: 45 }, "transparent")),
		]}
	/>
	<figcaption
		mix={[
			u.absolute(),
			u.insBe(0),
			u.p(4),
			u.text("2xl"),
			u.fg("neutral.onSolid"),
			u.textShadow({ y: "1px", blur: "3px" }),
		]}
	>
		{post.title}
	</figcaption>
</figure>
```

#### `transition(properties: string, options?: TransitionOptions): UtilityMixin`

Applies the `transition-property`/`transition-timing-function`/`transition-duration` triplet in one call — the shared shape behind nearly every hover, focus, press, and selection state change, so a call site only names which properties animate and gets sensible timing for free. It writes the three longhands rather than the `transition` shorthand, so it never resets `transition-delay` or `transition-behavior`, which means it composes cleanly with `u.transitionBehavior()`.

On its own it does nothing visible: a transition only runs when a property in its list actually changes value, so this always pairs with something that changes it — a state wrapper like `u.hover()`, `u.focusVisible()`, `u.checked()`, or `u.open()`, a responsive wrapper like `u.at()`, or a class or attribute toggled at runtime. Name every property that changes; a property left out of the list snaps instantly.

It does **no** `prefers-reduced-motion` gating — the transition is declared unconditionally, so honoring a reduced-motion preference is the call site's responsibility. Pair it with `u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s"))` to collapse the duration without restating the property list or the curve.

**Parameters:**

- `properties`: A `transition-property` value, passed through verbatim. Required, with no default.
  - a single property name — `"opacity"`.
  - a comma-separated list — `"color, background-color"`, `"opacity, transform"`.
  - `"all"` — every animatable property; convenient, but liable to animate layout changes you didn't intend.
  - `"none"` — disables transitions on the element while still emitting the duration and easing longhands.
  - a custom property name — `"--ui-scale-x"` and friends, for transitioning a registered custom property.
- `options`: A `TransitionOptions` object. Defaults to `{}`, so both keys are optional:
  - `duration` — sets `transition-duration`. A `number` is treated as milliseconds (`200` → `200ms`); a `string` is the raw escape hatch, passed through unchanged (`"0s"`, `"1.5s"`, `"var(--ui-duration)"`). Defaults to `"150ms"`.
  - `easing` — sets `transition-timing-function`, as a raw CSS string with no token resolution: a keyword (`"linear"`, `"ease-out"`, `"step-end"`), a `cubic-bezier(...)`, or a `linear(...)`/`steps(...)` function. Defaults to the standard ease-in-out curve, `"cubic-bezier(0.4, 0, 0.2, 1)"`.
- Neither parameter throws, and neither is validated.

**Returns:**

- A `UtilityMixin` that sets `transition-property`, `transition-timing-function`, and `transition-duration`.

**CSS:**

```css
/* u.transition("color, background-color") */
.host {
	transition-property: color, background-color;
	transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	transition-duration: 150ms;
}

/* u.transition("transform", { duration: 200, easing: "linear" }) */
.host {
	transition-property: transform;
	transition-timing-function: linear;
	transition-duration: 200ms;
}

/* u.transition("opacity", { duration: "0s" }) — string duration passes through */
.host {
	transition-property: opacity;
	transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	transition-duration: 0s;
}
```

**Example:**

```typescript
let result = u.transition("color, background-color");
let numericDuration = u.transition("transform", { duration: 200 });
let customEasing = u.transition("box-shadow", { easing: "linear" });
let stringDurationEscapeHatch = u.transition("opacity", { duration: "0s" });
```

```tsx
<button
	type="button"
	mix={[
		u.bg("brand.solid"),
		u.fg("brand.onSolid"),
		u.p(3),
		u.rounded("md"),
		u.transition("background-color, box-shadow"),
		u.hover([u.bg("brand.tint"), u.shadow("md")]),
		u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s")),
	]}
/>
```

#### `transitionBehavior(value: TransitionBehaviorValue): UtilityMixin`

Sets `transition-behavior` on its own. Discrete properties — ones whose values can't be interpolated, like `display`, `content-visibility`, and `overlay` — normally flip at the halfway point of a transition, which in practice means an element transitioning to `display: none` vanishes before its fade-out has played. `"allow-discrete"` changes the timing: the discrete flip happens immediately at the _start_ on the way in, and is deferred to the _end_ on the way out, so the element stays painted for the whole duration in both directions.

That's the entire reason popover and dialog exit animations work, and it's why this pairs with `u.startingStyle()`. The two solve separate halves of the problem: `u.startingStyle()` supplies the before-first-update values a transition animates _from_ for an element that starts out `display: none` or in the top layer, while `"allow-discrete"` keeps `display` — and `overlay`, the property controlling top-layer membership for `popover` and `<dialog>` — from cutting either direction short. Both are needed, and the discrete properties must also appear in the `u.transition()` property list to be affected at all: `"allow-discrete"` changes how listed discrete properties behave, it doesn't add them to the list. Because it's a separate longhand, applying it alongside `u.transition()` is safe in either order — `u.transition()` writes only the property, duration, and easing longhands and never resets this one.

**Parameters:**

- `value`: A `TransitionBehaviorValue`. Required, with no default, and no raw-string escape hatch — the union is closed to the two CSS keywords.
  - `"normal"` — the CSS initial value: discrete properties are not transitioned, flipping at the midpoint instead. Use it to opt one element back out of a value set by a composed utility.
  - `"allow-discrete"` — discrete properties listed in `transition-property` participate in the transition, flipping at the start on entry and the end on exit.

**Returns:**

- A `UtilityMixin` that sets `transition-behavior`.

**CSS:**

```css
/* u.transitionBehavior("allow-discrete") */
.host {
	transition-behavior: allow-discrete;
}

/* the full popover composition below */
.host {
	opacity: 0;
	--ui-scale-x: 0.95;
	--ui-scale-y: 0.95;
	transition-property: opacity, transform, display, overlay;
	transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	transition-duration: 200ms;
	transition-behavior: allow-discrete;
}
.host[open],
.host:popover-open {
	opacity: 1;
	--ui-scale-x: 1;
	--ui-scale-y: 1;
}
@starting-style {
	.host[open],
	.host:popover-open {
		opacity: 0;
		--ui-scale-x: 0.95;
		--ui-scale-y: 0.95;
	}
}
```

**Example:**

```typescript
let result = u.transitionBehavior("allow-discrete");
let optedOut = u.transitionBehavior("normal");
```

```tsx
<div
	popover="auto"
	mix={[
		u.opacity(0),
		u.scale(0.95),
		u.transition("opacity, transform, display, overlay", { duration: 200 }),
		u.transitionBehavior("allow-discrete"),
		u.open([u.opacity(100), u.scale(1), u.startingStyle([u.opacity(0), u.scale(0.95)])]),
	]}
/>
```

#### `transitionDelay(value?: string): UtilityMixin`

Sets `transition-delay` on its own, for adding a delay to a transition declared elsewhere without restating its property list, duration, or timing function. The real use is staggering a group of reveals: the same `u.transition()` on every item, an increasing delay per item, so a list or a menu animates in as a sequence rather than all at once.

A delay is asymmetric in practice, and that asymmetry is the caveat. On the _enter_ transition it reads as choreography; on the _leave_ transition the element sits there doing nothing after the user has already acted, which reads as an unresponsive UI. So a stagger almost always belongs on the entering state only — put the delay inside the state wrapper that opens the group and leave the resting state at `0s`.

Being a lone longhand, it only has an effect where a `transition-property` is already in force on the same element, from a `u.transition()` or a `u.transitionProperty()` composed alongside it; `transition-*` properties aren't inherited, so a delay on an element with no transition property of its own does nothing. It is **string-only**, matching its sibling `u.transitionDuration()` — `u.transition()`'s numeric `duration` option is the asymmetric one in this family, since it accepts a bare number as milliseconds, while these two standalone overrides want a CSS time string with its unit spelled out.

**Parameters:**

- `value`: A CSS time string, passed through unchanged with no validation. Defaults to `"0s"`, the no-delay value — useful for cancelling a delay set by a composed utility. There is no numeric form, so `u.transitionDelay(120)` is a type error and `u.transitionDelay("120ms")` is what to write. Accepts:
  - a time in `ms` or `s` — `"0s"`, `"120ms"`, `"1.5s"`.
  - a comma-separated list — `"0s, 120ms"`, matching a multi-property `transition-property` list positionally.
  - a negative time — `"-100ms"`, which starts the transition already part-way through.
  - the raw escape hatch — any CSS string, including `var(...)` and `calc(...)` references, which is how a per-item stagger driven by an index custom property is written: `"calc(var(--index) * 40ms)"`.

**Returns:**

- A `UtilityMixin` that sets only `transition-delay`.

**CSS:**

```css
/* u.transitionDelay() */
.host {
	transition-delay: 0s;
}

/* u.transitionDelay("120ms") */
.host {
	transition-delay: 120ms;
}

/* u.transitionDelay("calc(var(--index) * 40ms)") */
.host {
	transition-delay: calc(var(--index) * 40ms);
}
```

**Example:**

```typescript
let result = u.transitionDelay();
let staggerStep = u.transitionDelay("120ms");
let perPropertyList = u.transitionDelay("0s, 120ms");
let indexDriven = u.transitionDelay("calc(var(--index) * 40ms)");
```

A menu whose items stagger in on open and all leave together — the delay lives inside `u.open()`, so nothing lags on the way out:

```tsx
<ul mix={[u.vstack({ gap: 1 }), u.p(2)]}>
	{items.map((item, index) => (
		<li
			key={item.id}
			mix={[
				u.opacity(0),
				u.translateY(-1),
				u.transition("opacity, transform", { duration: 150 }),
				u.transitionDelay("0s"),
				u.open([u.opacity(100), u.translateY(0), u.transitionDelay(`${index * 40}ms`)]),
				u.motionReduce(u.transitionDelay("0s")),
			]}
		>
			{item.label}
		</li>
	))}
</ul>
```

#### `transitionDuration(value: string): UtilityMixin`

Sets `transition-duration` on its own, for overriding just the duration of a transition declared elsewhere without restating its property list or timing function. The motivating case is a reduced-motion override that collapses an existing transition to zero, which is why it reads naturally inside `u.media()`.

Being a lone longhand, it only has an effect where a `transition-property` is already in force on the same element — from a `u.transition()` or a `u.transitionProperty()` composed alongside it. `transition-*` properties aren't inherited, so setting a duration on an element with no transition property of its own does nothing.

**Parameters:**

- `value`: A CSS duration string, passed through unchanged with no validation. Required — there is no default. Note the asymmetry with `u.transition()`'s `duration` option, which also accepts a bare number as milliseconds: this one is `string`-only, so `u.transitionDuration(300)` is a type error and `u.transitionDuration("300ms")` is the form to write. Accepts:
  - a time in `ms` or `s` — `"0s"`, `"150ms"`, `"1.5s"`.
  - a comma-separated list — `"150ms, 300ms"`, matching a multi-property `transition-property` list positionally.
  - the raw escape hatch — any CSS string, including `var(...)` and `calc(...)` references.

**Returns:**

- A `UtilityMixin` that sets only `transition-duration`.

**CSS:**

```css
/* u.transitionDuration("300ms") */
.host {
	transition-duration: 300ms;
}

/* u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s")) */
@media (prefers-reduced-motion: reduce) {
	.host {
		transition-duration: 0s;
	}
}
```

**Example:**

```typescript
let result = u.transitionDuration("300ms");
let collapsed = u.transitionDuration("0s");
let perPropertyList = u.transitionDuration("150ms, 300ms");
let reducedMotion = u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s"));
```

```tsx
<div
	mix={[
		u.transitionProperty("transform"),
		u.transitionDuration("200ms"),
		u.hover(u.scale(1.05)),
		u.media("(prefers-reduced-motion: reduce)", u.transitionDuration("0s")),
	]}
/>
```

#### `transitionProperty(value: string): UtilityMixin`

Sets `transition-property` on its own, for overriding just which properties animate on a transition declared elsewhere without restating its duration or timing function. It's also the low-level half of a hand-assembled transition: paired with `u.transitionDuration()` it covers the common case with no easing declaration at all, leaving the browser's default `ease` curve in place, where `u.transition()` would impose its own `cubic-bezier(0.4, 0, 0.2, 1)`.

Like the rest of the family it needs a property that actually changes — through `u.hover()`, `u.focusVisible()`, `u.checked()`, `u.open()`, `u.at()`, or a runtime toggle — before anything animates.

**Parameters:**

- `value`: A `transition-property` value, passed through unchanged with no validation. Required, with no default. Accepts:
  - a single property name — `"transform"`.
  - a comma-separated list — `"color, background-color"`; order matters when a matching `transition-duration` or `transition-delay` list is set positionally alongside it.
  - `"all"` — every animatable property.
  - `"none"` — cancels a transition set by a composed utility, without touching the duration or easing longhands it also set.
  - a custom property name — `"--ui-scale-x"` and the like, for transitioning a registered custom property.

**Returns:**

- A `UtilityMixin` that sets only `transition-property`.

**CSS:**

```css
/* u.transitionProperty("transform") */
.host {
	transition-property: transform;
}

/* u.transitionProperty("color, background-color") */
.host {
	transition-property: color, background-color;
}
```

**Example:**

```typescript
let result = u.transitionProperty("transform");
let multipleProperties = u.transitionProperty("color, background-color");
let everything = u.transitionProperty("all");
let cancelled = u.transitionProperty("none");
```

```tsx
<a
	href="/pricing"
	mix={[
		u.fg("neutral.muted"),
		u.transitionProperty("color"),
		u.transitionDuration("150ms"),
		u.hover(u.fg("brand.emphasis")),
		u.focusVisible(u.fg("brand.emphasis")),
	]}
/>
```

#### `visibility(value?: VisibilityValue): UtilityMixin`

Sets the CSS `visibility` property. `"hidden"` sits between the two hiding utilities you'd otherwise reach for. Unlike `u.hidden()`, which applies `display: none` and pulls the element out of layout entirely, a `visibility: hidden` element keeps its box and its space in the flow — so nothing around it shifts as it appears and disappears — and `visibility` is an animatable discrete property, which is what lets a selection indicator or hover-triggered surface fade in place. Unlike `u.opacity(0)`, which leaves a fully interactive invisible element behind, `visibility: hidden` also removes the element from hit-testing and from the accessibility tree, so it can't be clicked or reached by a screen reader while hidden.

Those three utilities target three different CSS properties (`visibility`, `display`, `opacity`), so they never overwrite each other — they stack, and `display: none` dominates: combining `u.hidden()` with `u.visibility("visible")` still renders nothing, because an element with no box has no visibility to speak of. The common pairing is `u.visibility("hidden")` _with_ `u.opacity(0)`: `opacity` supplies the smooth fade and `visibility` supplies the removal from hit-testing and assistive tech, which opacity alone doesn't give you. List both in the `u.transition()` property list so the visibility flip is deferred to the end of the fade-out rather than snapping at the start. When the element should leave layout as well, use `u.hidden()` with `u.transitionBehavior("allow-discrete")` instead.

One inheritance quirk worth knowing: `visibility` is inherited but re-assertable, so a descendant can set `visibility: visible` to show itself inside a hidden ancestor — which no amount of `display: none` on an ancestor allows.

**Parameters:**

- `value`: A `VisibilityValue`. Defaults to `"visible"`. Closed union, no raw-string escape hatch:
  - `"visible"` — the CSS initial value; the element paints normally. This is what a no-argument call emits, so `u.visibility()` is the "re-assert visible" form used inside a state wrapper or to override an inherited `hidden`.
  - `"hidden"` — the element and its descendants don't paint, are skipped by hit-testing, and are removed from the accessibility tree, but the element's box still occupies its space in layout.
  - `"collapse"` — for a table row, row group, column, or column group, removes the track as if it were `display: none` while leaving the rest of the table's sizing intact; on any other element it behaves as `"hidden"`. Browser support for the table behavior is uneven.

**Returns:**

- A `UtilityMixin` that sets `visibility`.

**CSS:**

```css
/* u.visibility() */
.host {
	visibility: visible;
}

/* u.visibility("hidden") */
.host {
	visibility: hidden;
}

/* the fade-in composition below */
.host {
	visibility: hidden;
	opacity: 0;
	transition-property: opacity, visibility;
	transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	transition-duration: 150ms;
}
.host:hover {
	visibility: visible;
	opacity: 1;
}
```

**Example:**

```typescript
let result = u.visibility();
let hiddenButInLayout = u.visibility("hidden");
let collapsedTableRow = u.visibility("collapse");
```

```tsx
<div
	mix={[
		u.visibility("hidden"),
		u.opacity(0),
		u.transition("opacity, visibility"),
		u.hover([u.visibility("visible"), u.opacity(100)]),
	]}
/>
```

### Overflow

#### `clip(): UtilityMixin`

Applies `overflow: clip`, the modern alternative to `overflow: hidden`. The difference matters: `hidden` establishes a scroll container, so its overflow is still reachable — a script can call `scrollTo`, and focusing a clipped descendant makes the browser scroll it into view, visibly shifting content that was meant to be cut off. `clip` establishes no scroll container at all, so overflow can never become scrollable by any route.

Reach for it whenever the intent is purely "cut this off" — clipping a child to a rounded corner, hiding a decorative overflow — and for `u.overflow("hidden")` only when you actually want a programmatically scrollable box.

**Returns:**

- A `UtilityMixin` that sets `overflow: clip`

**CSS:**

```css
/* u.clip() */
.host {
	overflow: clip;
}
```

**Example:**

```typescript
let result = u.clip();
```

The usual job — keeping a child's square corners inside the parent's radius:

```tsx
<div mix={[u.rounded("lg"), u.clip()]}>
	<img mix={[u.is("full"), u.aspect("video"), u.fit("cover")]} src={src} alt="" />
</div>
```

It sets the `overflow` shorthand, so it conflicts with `u.overflow()`, `u.scroll()`, and the per-axis utilities on the same element.

#### `divide(axis?: DivideAxis, colorOrWidth?: ColorValue | (string & {}) | number, maybeWidth?: number): UtilityMixin`

Draws a divider border between every child except the last, so a list or stack gets separators without each child having to know whether it's last. It nests under `& > *:not(:last-child)` and sets a border on that child's trailing edge, which is why it belongs on the _container_.

The middle parameter is overloaded by type: a string is read as a color, a number as a border width. That lets a width be given without naming a color, at the cost of the two shapes looking alike — `u.divide("block", 2)` is a 2px divider in the default color, while `u.divide("block", "brand")` is a 1px brand divider.

**Parameters:**

- `axis`: Which edge the divider is drawn on. Defaults to `"block"`.
  - `"block"` — a `border-block-end` on each child, the horizontal rules of a vertical stack
  - `"inline"` — a `border-inline-end` on each child, the vertical rules of a horizontal row
- `colorOrWidth`: Either a color or a width, distinguished by type. Omit both and the divider is 1px in the system default color.
  - a `ColorValue` string — resolved through the token layer with a default property of `border`, so a bare tone like `"brand"` becomes `var(--ui-brand-border)`. Accepts the same three shapes as `u.border()`: a bare tone, a tone with an explicit suffix (`"brand.strong"`), or a raw palette reference (`"color.neutral.200"`).
  - a `number` — read as the border width in pixels instead, leaving the color at the system default
- `maybeWidth`: The border width in pixels. Only meaningful when `colorOrWidth` is a color; defaults to `1`.

With no color given, the divider falls back to the same tiny system default `u.border()` uses: `var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))`.

**Returns:**

- A `UtilityMixin` that applies a solid border to the trailing edge of every non-last direct child

**CSS:**

```css
/* u.divide() */
.host {
	& > *:not(:last-child) {
		border-style: solid;
		border-block-end-width: 1px;
		border-block-end-color: var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent));
	}
}

/* u.divide("inline", "brand", 2) */
.host {
	& > *:not(:last-child) {
		border-style: solid;
		border-inline-end-width: 2px;
		border-inline-end-color: var(--ui-brand-border);
	}
}
```

**Example:**

```typescript
let result = u.divide();
let axisResult = u.divide("inline");
let coloredResult = u.divide("block", "brand");
let styledResult = u.divide("block", "brand", 2);

// A number in the color position is a width, not a color
let widthResult = u.divide("block", 2);
```

Because it targets direct children, it composes with a stack rather than replacing it:

```tsx
<ul role="list" mix={[u.vstack(), u.divide(), u.rounded("lg"), u.clip(), u.border("neutral")]}>
	{items.map((item) => (
		<li key={item.id} mix={[u.p(3)]}>
			{item.label}
		</li>
	))}
</ul>
```

Since the border lands on the children, it conflicts with a `u.border()` those children set on the same edge.

#### `noScrollbar(): UtilityMixin`

Hides the scrollbar on a scroll container across every browser engine — `::-webkit-scrollbar` for Chrome and Safari, `-ms-overflow-style` for legacy Edge, `scrollbar-width` for Firefox — while leaving the element free to scroll through every other route: wheel, touch, keyboard, and programmatic scrolling all still work.

Consider carefully before reaching for it. A scrollbar is the main affordance telling a sighted mouse user that content continues, and removing it makes hidden content genuinely easy to miss. It is defensible where another cue does that job — a carousel with visible paging controls, a horizontally snapping strip with partial items showing at the edge. Where you just want a less obtrusive scrollbar, `u.thinScrollbar()` is the better trade.

It only hides a scrollbar; it does not create the scroll container. Pair it with `u.scroll()` or `u.overflow()` on the same element.

**Returns:**

- A `UtilityMixin` that sets `-ms-overflow-style: none` and `scrollbar-width: none`, plus a nested `&::-webkit-scrollbar { display: none }`

**CSS:**

```css
/* u.noScrollbar() */
.host {
	-ms-overflow-style: none;
	scrollbar-width: none;
	&::-webkit-scrollbar {
		display: none;
	}
}
```

**Example:**

```typescript
let result = u.noScrollbar();
```

```tsx
<div mix={[u.hstack({ gap: 3 }), u.scroll("x"), u.noScrollbar()]}>{slides}</div>
```

It sets `scrollbar-width`, the same property `u.thinScrollbar()` sets — applying both leaves the outcome to the cascade, so pick one.

#### `overflow(value?: OverflowValue | { x?: OverflowValue; y?: OverflowValue; inline?: OverflowValue; block?: OverflowValue }): UtilityMixin`

Applies `overflow` to the host, defaulting to `"hidden"`. Called with an axis object instead of a bare value, it composes the matching per-axis utility for each key given and leaves the other axes untouched — `u.overflowX()`/`u.overflowY()` for `x`/`y`, and `u.overflowInline()`/`u.overflowBlock()` for `inline`/`block`.

Prefer the `inline`/`block` keys over `x`/`y`: they follow writing mode, so the element stays correct in a right-to-left or vertical context. Reach for `x`/`y` only when the axis genuinely must not flip.

**Parameters:**

- `value`: An `OverflowValue` applied to both axes, or an object naming individual axes. Defaults to `"hidden"`.
  - `"visible"` — content spills outside the box and is painted; no clipping, no scroll container
  - `"hidden"` — content is clipped, but the box _is_ a scroll container: scriptable and scrolled by focusing a clipped descendant
  - `"clip"` — content is clipped and no scroll container is created, so overflow is unreachable by any route. See `u.clip()`.
  - `"auto"` — a scrollbar appears only on the axis where content actually overflows
  - `"scroll"` — a scroll container with scrollbars always present, whether or not content overflows
- `value.inline`: Sets the inline axis only, via `u.overflowInline()`. Preferred over `x`.
- `value.block`: Sets the block axis only, via `u.overflowBlock()`. Preferred over `y`.
- `value.x`: Sets the physical horizontal axis only, via `u.overflowX()`
- `value.y`: Sets the physical vertical axis only, via `u.overflowY()`

Note that CSS resolves a `visible` on one axis to `auto` when the other axis is clipped or scrolling, so mixing `"visible"` with a clipping value on the other axis does not do what it reads like.

**Returns:**

- A `UtilityMixin` that sets `overflow`, or composes the per-axis utilities when given an axis object

**CSS:**

```css
/* u.overflow() */
.host {
	overflow: hidden;
}

/* u.overflow({ inline: "auto", block: "hidden" }) */
.host {
	overflow-inline: auto;
	overflow-block: hidden;
}

/* u.overflow({ x: "auto" }) */
.host {
	overflow-x: auto;
}
```

**Example:**

```typescript
let result = u.overflow();
let valueResult = u.overflow("clip");
let logicalResult = u.overflow({ inline: "auto" });
let bothAxesResult = u.overflow({ inline: "auto", block: "hidden" });
let physicalResult = u.overflow({ x: "auto" });
```

```tsx
<div mix={[u.maxBs(80), u.overflow({ block: "auto", inline: "hidden" }), u.thinScrollbar()]}>
	{children}
</div>
```

An overflow value other than `visible` makes the element a block-formatting context, which also stops its margins collapsing with its children's.

#### `overflowBlock(value?: OverflowValue): UtilityMixin`

Applies `overflow-block` to the host element, independently of the inline axis. It is the logical counterpart to `u.overflowY()` — in a horizontal writing mode the block axis runs vertically, so the two resolve identically, but `overflowBlock` follows the block axis as the writing mode and direction define it and so stays correct under vertical writing modes. Reach for the logical pair by default; drop to `u.overflowY()` only when the constraint really is the physical vertical axis regardless of writing mode, such as clipping a decorative layer whose geometry is expressed in physical pixels. It sets a single property, so it overwrites any other `overflow-block` declaration on the same element, and `u.overflow()` called with a bare value overwrites it in turn since that shorthand covers both axes — but `u.overflow({ block })` composes this utility internally rather than fighting it.

**Parameters:**

- `value`: An `OverflowValue`, one of five keywords. Defaults to `"hidden"` when omitted. The union is closed — there is no raw-string escape hatch.
  - `"visible"`: Content spills out of the box and is not clipped — the CSS initial value.
  - `"hidden"`: Content is clipped, and the box becomes a scroll container the user can't scroll, though it can still be scrolled programmatically or by focusing a clipped descendant.
  - `"clip"`: Content is clipped with no scroll container established at all, so it can never become scrollable by any means.
  - `"auto"`: A scroll container that shows a block-axis scrollbar only when content actually overflows.
  - `"scroll"`: A scroll container that always reserves its block-axis scrollbar, whether content overflows or not.

**Returns:**

- A `UtilityMixin` that sets `overflow-block` to the given value.

**CSS:**

```css
/* u.overflowBlock() */
.host {
	overflow-block: hidden;
}

/* u.overflowBlock("auto") */
.host {
	overflow-block: auto;
}
```

**Example:**

```typescript
let result = u.overflowBlock("auto");
let defaultResult = u.overflowBlock();
let alwaysScrollResult = u.overflowBlock("scroll");
let neverScrollableResult = u.overflowBlock("clip");
```

```tsx
<div mix={[u.overflowBlock("auto"), u.overflowInline("hidden"), u.thinScrollbar(), u.p(4)]}>
	{rows}
</div>
```

#### `overflowInline(value?: OverflowValue): UtilityMixin`

Applies `overflow-inline` to the host element, independently of the block axis. It is the logical counterpart to `u.overflowX()` — in a horizontal writing mode the inline axis runs horizontally, so the two resolve identically, but `overflowInline` follows the inline axis as the writing mode and direction define it and so stays correct under RTL and vertical writing modes. Reach for the logical pair by default; drop to `u.overflowX()` only when the constraint really is the physical horizontal axis regardless of writing mode. It sets a single property, so it overwrites any other `overflow-inline` declaration on the same element, and `u.overflow()` called with a bare value overwrites it in turn — but `u.overflow({ inline })` composes this utility internally rather than fighting it.

**Parameters:**

- `value`: An `OverflowValue`, one of five keywords. Defaults to `"hidden"` when omitted. The union is closed — there is no raw-string escape hatch.
  - `"visible"`: Content spills out of the box and is not clipped — the CSS initial value.
  - `"hidden"`: Content is clipped, and the box becomes a scroll container the user can't scroll, though it can still be scrolled programmatically or by focusing a clipped descendant.
  - `"clip"`: Content is clipped with no scroll container established at all, so it can never become scrollable by any means.
  - `"auto"`: A scroll container that shows an inline-axis scrollbar only when content actually overflows.
  - `"scroll"`: A scroll container that always reserves its inline-axis scrollbar, whether content overflows or not.

**Returns:**

- A `UtilityMixin` that sets `overflow-inline` to the given value.

**CSS:**

```css
/* u.overflowInline() */
.host {
	overflow-inline: hidden;
}

/* u.overflowInline("auto") */
.host {
	overflow-inline: auto;
}
```

**Example:**

```typescript
let result = u.overflowInline("auto");
let defaultResult = u.overflowInline();
let alwaysScrollResult = u.overflowInline("scroll");
let neverScrollableResult = u.overflowInline("clip");
```

```tsx
<div mix={[u.overflowInline("auto"), u.overflowBlock("hidden"), u.thinScrollbar(), u.flex()]}>
	{tabs}
</div>
```

#### `overflowX(value?: OverflowValue): UtilityMixin`

Applies `overflow-x`, the physical horizontal axis, independently of the vertical one. `u.overflowInline()` is the logical counterpart and the better default — it follows writing mode, where this stays pinned to the screen's horizontal axis regardless of direction. Reach for this when the axis genuinely must not flip: a chart, a timeline, or a media element whose geometry is physical rather than typographic.

**Parameters:**

- `value`: An `OverflowValue` — `"visible"`, `"hidden"`, `"auto"`, `"clip"`, or `"scroll"`. Defaults to `"hidden"`. See `u.overflow()` for what each keyword does.

**Returns:**

- A `UtilityMixin` that sets `overflow-x`

**CSS:**

```css
/* u.overflowX("auto") */
.host {
	overflow-x: auto;
}
```

**Example:**

```typescript
let result = u.overflowX();
let scrollResult = u.overflowX("auto");
```

```tsx
<figure mix={[u.overflowX("auto"), u.overflowY("hidden"), u.thinScrollbar()]}>{chart}</figure>
```

It conflicts with `u.overflow()`'s shorthand, with `u.clip()`, and with `u.overflowInline()` in a horizontal writing mode, where both resolve to the same axis.

#### `overflowY(value?: OverflowValue): UtilityMixin`

Applies `overflow-y`, the physical vertical axis, independently of the horizontal one. `u.overflowBlock()` is the logical counterpart and the better default. Reach for this when the axis must stay physical regardless of writing mode.

**Parameters:**

- `value`: An `OverflowValue` — `"visible"`, `"hidden"`, `"auto"`, `"clip"`, or `"scroll"`. Defaults to `"hidden"`. See `u.overflow()` for what each keyword does.

**Returns:**

- A `UtilityMixin` that sets `overflow-y`

**CSS:**

```css
/* u.overflowY("auto") */
.host {
	overflow-y: auto;
}
```

**Example:**

```typescript
let result = u.overflowY();
let scrollResult = u.overflowY("auto");
```

```tsx
<div mix={[u.maxBs(64), u.overflowY("auto"), u.overflowX("hidden")]}>{options}</div>
```

A vertical scroll container needs a bounded block size to scroll against — pair it with `u.maxBs()`, `u.bs()`, or a flex/grid track that constrains it, or the element simply grows and never scrolls.

#### `overscrollBehavior(value?: OverscrollBehaviorValue): UtilityMixin`

Applies `overscroll-behavior`, defaulting to `"contain"`. Its real job is stopping scroll _chaining_: without it, scrolling past the end of a scrollable drawer, dialog, dropdown, or message list hands the remaining momentum to the page behind it, so the background silently scrolls away under a surface the reader is still working in — and once the page has scrolled, dismissing the surface leaves them somewhere they never asked to be.

Reach for it on any scroll container layered over the page. It only changes what happens at the _end_ of the scroll range, so it does nothing to an element that isn't already a scroll container — pair it with `u.scroll()`, `u.overflow()`, or the axis utilities `u.overflowInline()`/`u.overflowBlock()` on the same element.

**Parameters:**

- `value`: What happens once the container reaches the end of its own scrollable area. Defaults to `"contain"`.
  - `"auto"` — the CSS initial behaviour: the scroll chains to the ancestor scroll container, and the platform's overscroll affordance is available
  - `"contain"` — no chaining to the ancestor, but the platform's overscroll affordance is kept: rubber-banding on iOS, pull-to-refresh on Android
  - `"none"` — no chaining _and_ no affordance, suppressing the rubber-band bounce and pull-to-refresh entirely. Worth it only when the bounce itself is the problem — a canvas, a map, or a custom pull gesture of your own that the platform's would fight.

**Returns:**

- A `UtilityMixin` that sets `overscroll-behavior`

**CSS:**

```css
/* u.overscrollBehavior() */
.host {
	overscroll-behavior: contain;
}

/* u.overscrollBehavior("none") */
.host {
	overscroll-behavior: none;
}
```

**Example:**

```typescript
let result = u.overscrollBehavior();
let noneResult = u.overscrollBehavior("none");
let autoResult = u.overscrollBehavior("auto");
```

The shape of a scrollable panel that doesn't drag the page along with it:

```tsx
<div mix={[u.maxBs(96), u.scroll("y"), u.overscrollBehavior(), u.thinScrollbar(), u.p(4)]}>
	{messages}
</div>
```

#### `scroll(axis?: ScrollAxis): UtilityMixin`

Turns the host into a scroll container that shows a scrollbar only on the axis where content actually overflows, rather than reserving one unconditionally. Composes `u.overflowX("auto")` and/or `u.overflowY("auto")` for whichever axis is selected.

This is the utility to reach for over `u.overflow("scroll")`, which shows scrollbars whether or not they're needed. Note that a scroll container needs a bounded size on the scrolling axis — without a `u.maxBs()`, a fixed size, or a constraining flex/grid track, the element grows to fit its content and never scrolls.

**Parameters:**

- `axis`: Which axis becomes scrollable. Defaults to `"both"`.
  - `"x"` — the horizontal axis only, leaving the vertical axis untouched
  - `"y"` — the vertical axis only, leaving the horizontal axis untouched
  - `"both"` — both axes

Note that the untouched axis keeps its initial `visible`, which CSS then resolves to `auto` because the other axis scrolls — so `u.scroll("y")` can still produce a horizontal scrollbar if content overflows sideways. Pair it with an explicit `u.overflowX("hidden")` (or `u.clip()`) when that matters.

**Returns:**

- A `UtilityMixin` that sets `overflow-x` and/or `overflow-y` to `"auto"` for the selected axis

**CSS:**

```css
/* u.scroll() */
.host {
	overflow-x: auto;
	overflow-y: auto;
}

/* u.scroll("y") */
.host {
	overflow-y: auto;
}
```

**Example:**

```typescript
let result = u.scroll();
let yAxisResult = u.scroll("y");
let xAxisResult = u.scroll("x");
```

The full shape of a well-behaved scroll region — bounded, one axis only, with a gutter that doesn't shift layout:

```tsx
<div mix={[u.maxBs(96), u.scroll("y"), u.overflowX("clip"), u.thinScrollbar(), u.pi(2)]}>
	{children}
</div>
```

#### `scrollBehavior(value?: ScrollBehaviorValue): UtilityMixin`

Applies `scroll-behavior`, defaulting to `"smooth"`, so anchor jumps and programmatic scrolls (`scrollIntoView`, `scrollTo`) animate instead of teleporting. It goes on the scroll container whose scroll position is changing — the scrolling element itself, not the link or the target.

Accessibility caveat, stated plainly: smooth scrolling is motion, and this utility does **not** gate itself. Applying it unconditionally overrides the preference of anyone who asked for reduced motion, and a long smooth scroll is exactly the kind of sustained movement that triggers vestibular discomfort. Wrap the call in `u.motionSafe()` so the animation is opt-in for people who tolerate it and the default stays an instant jump.

**Parameters:**

- `value`: Whether a programmatic or anchor-triggered scroll jumps or animates. Defaults to `"smooth"`.
  - `"auto"` — the CSS initial value: the scroll position changes instantly
  - `"smooth"` — the scroll position animates over a browser-defined duration and curve, neither of which is configurable from CSS

**Returns:**

- A `UtilityMixin` that sets `scroll-behavior`

**CSS:**

```css
/* u.scrollBehavior() */
.host {
	scroll-behavior: smooth;
}

/* u.motionSafe(u.scrollBehavior()) — the form to actually ship */
.host {
	@media (prefers-reduced-motion: no-preference) {
		scroll-behavior: smooth;
	}
}
```

**Example:**

```typescript
let result = u.scrollBehavior();
let autoResult = u.scrollBehavior("auto");
let gatedResult = u.motionSafe(u.scrollBehavior());
```

Gated, so the unwrapped baseline is an instant jump and the animation only reaches users who haven't asked for less motion:

```tsx
<div mix={[u.maxBs(96), u.scroll("y"), u.motionSafe(u.scrollBehavior()), u.thinScrollbar()]}>
	{sections}
</div>
```

Note that a user-initiated scroll — a wheel, a drag, a touch flick — is never affected by this property; only scrolls the page or the browser initiates are.

#### `scrollMargin(...values: SpacingValue[]): UtilityMixin`

Applies logical `scroll-margin` on a scroll _item_, growing the box the container aligns when it snaps to this item or an anchor jump targets it. It solves the sticky-header overlap from the item's side rather than the container's: `u.scrollPadding()` insets every landing point at once, while `scrollMargin()` offsets just the items that need the extra room. Reach for it when only some items need clearance — a section heading that should arrive with breathing room above it, a card that shouldn't sit flush against the container edge when it snaps.

Follows the same 1/2/4-value logical mapping as `u.m()`, so it reads exactly like a margin. It affects nothing about layout or painting — the item's actual box is unchanged, and the value is consulted only when a scroll is being aligned.

**Parameters:**

- `values`: One, two, or four `SpacingValue`s. A number resolves against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; any other string is assumed to already be a valid CSS length and passes through verbatim.
  - one value — applies to all four sides via the `scroll-margin` shorthand
  - two values — block then inline, via `scroll-margin-block` and `scroll-margin-inline`
  - four values — block-start, inline-end, block-end, inline-start, mapping onto the logical directions rather than the physical top/right/bottom/left
- Any other count throws: `@pkg/u: expected 1, 2, or 4 values, got {n}`. Three values throw, and so does calling it with no arguments at all — there is no default.

**Returns:**

- A `UtilityMixin` that sets `scroll-margin`, or the block/inline pair, or the four logical longhands

**CSS:**

```css
/* u.scrollMargin(4) */
.host {
	scroll-margin: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.scrollMargin(16, 0) */
.host {
	scroll-margin-block: calc(var(--ui-spacing, 0.25rem) * 16);
	scroll-margin-inline: calc(var(--ui-spacing, 0.25rem) * 0);
}

/* u.scrollMargin(1, 2, 3, 4) */
.host {
	scroll-margin-block-start: calc(var(--ui-spacing, 0.25rem) * 1);
	scroll-margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 2);
	scroll-margin-block-end: calc(var(--ui-spacing, 0.25rem) * 3);
	scroll-margin-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.scrollMargin("3rem") — a raw CSS length passes through */
.host {
	scroll-margin: 3rem;
}
```

**Example:**

```typescript
let result = u.scrollMargin(4);
let axisResult = u.scrollMargin(16, 0);
let cornersResult = u.scrollMargin(1, 2, 3, 4);
let lengthResult = u.scrollMargin("3rem");

// Throws: expected 1, 2, or 4 values, got 3
// let invalidResult = u.scrollMargin(1, 2, 3);
```

Only the headings need the clearance, so the offset lives on them rather than on the container:

```tsx
<div mix={[u.maxBs(96), u.scroll("y"), u.thinScrollbar()]}>
	{sections.map((section) => (
		<section key={section.id} id={section.id} mix={[u.scrollMargin(16, 0)]}>
			<h2 mix={[u.text("lg"), u.weight("semibold")]}>{section.title}</h2>
			{section.body}
		</section>
	))}
</div>
```

#### `scrollPadding(...values: SpacingValue[]): UtilityMixin`

Applies logical `scroll-padding` on a scroll _container_, insetting the region a snap position or an anchor jump is allowed to land in. Without it, a sticky header sitting inside the container covers the top of whatever the scroll just brought into view — the reader arrives at a heading that is hidden behind the bar, which is exactly the content they were being sent to. Give the container scroll-padding equal to the header's height and the landing point clears it.

Reach for this rather than `u.scrollMargin()` when every landing point needs the same clearance, which is the usual case for a fixed piece of chrome: one declaration on the container beats one per item. It changes nothing about layout — unlike `u.p()`, it does not inset the content itself, only where a scroll comes to rest.

Follows the same 1/2/4-value logical mapping as `u.p()`.

**Parameters:**

- `values`: One, two, or four `SpacingValue`s. A number resolves against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`; any other string is assumed to already be a valid CSS length and passes through verbatim.
  - one value — applies to all four sides via the `scroll-padding` shorthand
  - two values — block then inline, via `scroll-padding-block` and `scroll-padding-inline`
  - four values — block-start, inline-end, block-end, inline-start, mapping onto the logical directions rather than the physical top/right/bottom/left
- Any other count throws: `@pkg/u: expected 1, 2, or 4 values, got {n}`. Three values throw, and so does calling it with no arguments at all — there is no default.

**Returns:**

- A `UtilityMixin` that sets `scroll-padding`, or the block/inline pair, or the four logical longhands

**CSS:**

```css
/* u.scrollPadding(4) */
.host {
	scroll-padding: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.scrollPadding(16, 0) */
.host {
	scroll-padding-block: calc(var(--ui-spacing, 0.25rem) * 16);
	scroll-padding-inline: calc(var(--ui-spacing, 0.25rem) * 0);
}

/* u.scrollPadding(1, 2, 3, 4) */
.host {
	scroll-padding-block-start: calc(var(--ui-spacing, 0.25rem) * 1);
	scroll-padding-inline-end: calc(var(--ui-spacing, 0.25rem) * 2);
	scroll-padding-block-end: calc(var(--ui-spacing, 0.25rem) * 3);
	scroll-padding-inline-start: calc(var(--ui-spacing, 0.25rem) * 4);
}

/* u.scrollPadding("3rem") — a raw CSS length passes through */
.host {
	scroll-padding: 3rem;
}
```

**Example:**

```typescript
let result = u.scrollPadding(4);
let axisResult = u.scrollPadding(16, 0);
let cornersResult = u.scrollPadding(1, 2, 3, 4);
let lengthResult = u.scrollPadding("3rem");

// Throws: expected 1, 2, or 4 values, got 3
// let invalidResult = u.scrollPadding(1, 2, 3);
```

The header's height becomes the container's block-start scroll-padding, so nothing ever lands behind it:

```tsx
<div mix={[u.maxBs(96), u.scroll("y"), u.scrollPadding(12, 0), u.thinScrollbar()]}>
	<header mix={[u.sticky(), u.insBs(0), u.z(10), u.surface("muted"), u.p(3)]}>{title}</header>
	{sections}
</div>
```

#### `scrollSnapAlign(value?: ScrollSnapAlignValue): UtilityMixin`

Applies `scroll-snap-align`, defaulting to `"start"`, choosing where the item's box lines up against the scroll container's snapport when the scroll comes to rest.

This one goes on the snap **items** — the children of the scroll container — while `u.scrollSnapType()` goes on the **container**. Splitting them the other way round is the single most common reason snapping silently does nothing, since neither property warns when its counterpart is missing: an item with `scroll-snap-align` inside a container with no `scroll-snap-type` simply scrolls freely, and a container with `scroll-snap-type` whose children declare no alignment has nothing to snap to. Pairs with `u.scrollSnapStop()` on the same item.

**Parameters:**

- `value`: Where the item lines up. Defaults to `"start"`.
  - `"none"` — this item is not a snap position, letting one child opt out of a snapping container
  - `"start"` — the item's start edge meets the snapport's start edge, the paged-carousel and section-list default
  - `"center"` — the item is centred in the snapport, which suits a strip of items narrower than the container so neighbours peek in at both edges
  - `"end"` — the item's end edge meets the snapport's end edge

**Returns:**

- A `UtilityMixin` that sets `scroll-snap-align`

**CSS:**

```css
/* u.scrollSnapAlign() */
.host {
	scroll-snap-align: start;
}

/* u.scrollSnapAlign("center") */
.host {
	scroll-snap-align: center;
}
```

**Example:**

```typescript
let result = u.scrollSnapAlign();
let centerResult = u.scrollSnapAlign("center");
let endResult = u.scrollSnapAlign("end");
let optOutResult = u.scrollSnapAlign("none");
```

On the item, never the container — see `u.scrollSnapType()` for both halves together:

```tsx
<li mix={[u.scrollSnapAlign("center"), u.minIs("full"), u.p(4)]}>{slide}</li>
```

#### `scrollSnapStop(value?: ScrollSnapStopValue): UtilityMixin`

Applies `scroll-snap-stop` to a snap item, defaulting to `"always"`. With `"always"` a single fast flick cannot skip past the item — the scroll is forced to come to rest on it, which is what a paged carousel needs so one swipe advances exactly one page rather than four. `"normal"` lets momentum carry the scroll over any number of snap positions.

Like `u.scrollSnapAlign()`, this belongs on the **items**, not on the container — the container is where `u.scrollSnapType()` goes. It also does nothing on its own: an item needs a `scroll-snap-align` other than `none` to be a snap position at all before there is anything to stop on, so pair it with `u.scrollSnapAlign()` on the same item.

**Parameters:**

- `value`: Whether a fast scroll gesture may pass over this snap position. Defaults to `"always"`.
  - `"normal"` — the CSS initial value: momentum may carry the scroll past this and any number of further snap positions
  - `"always"` — the scroll must stop here, so one gesture advances at most one item

**Returns:**

- A `UtilityMixin` that sets `scroll-snap-stop`

**CSS:**

```css
/* u.scrollSnapStop() */
.host {
	scroll-snap-stop: always;
}

/* u.scrollSnapStop("normal") */
.host {
	scroll-snap-stop: normal;
}
```

**Example:**

```typescript
let result = u.scrollSnapStop();
let normalResult = u.scrollSnapStop("normal");
```

Paging behaviour comes from the two item properties together:

```tsx
<li mix={[u.scrollSnapAlign(), u.scrollSnapStop(), u.minIs("full")]}>{page}</li>
```

Consider whether one-item-per-gesture is actually wanted before reaching for the default: on a long strip it makes travelling to the far end take one deliberate gesture per item, which is tedious where free scrolling with soft snapping would have done.

#### `scrollSnapType(axis?: ScrollSnapAxis | "none", strictness?: ScrollSnapStrictness): UtilityMixin`

Applies `scroll-snap-type` to a scroll **container**, defaulting to `"inline mandatory"` — the paged-carousel case. This is the half of scroll snapping that goes on the container; the children it snaps to need `u.scrollSnapAlign()` (and optionally `u.scrollSnapStop()`) on themselves. Getting that split backwards is the single most common reason snapping silently does nothing, and nothing warns you: neither property has any effect without its counterpart.

It also needs the element to actually be a scroll container, so pair it with `u.scroll()`, `u.overflow()`, or the axis utilities — and with a bounded size on the scrolling axis, or the element grows to fit its content and never scrolls at all.

One real quirk: passing `"none"` short-circuits, and the `strictness` argument is then silently ignored. `u.scrollSnapType("none", "proximity")` emits just `scroll-snap-type: none`, not `none proximity` — which is correct CSS, since the `none` keyword takes no strictness segment, but it means a strictness passed alongside it disappears without complaint.

**Parameters:**

- `axis`: The axis the container snaps along. Defaults to `"inline"`. Prefer the logical `"inline"`/`"block"` — they follow the writing mode, so a carousel stays correct under RTL and vertical writing modes; `"x"`/`"y"` are the physical exception, for the rare case that must stay pinned to the screen axis no matter the writing mode.
  - `"inline"` — snaps along the inline axis, horizontal in a horizontal writing mode. The default, and the right choice for a carousel or a horizontal strip.
  - `"block"` — snaps along the block axis, vertical in a horizontal writing mode. For full-height sections or a vertical pager.
  - `"both"` — snaps along both axes independently, for a two-dimensional grid of panes.
  - `"x"` — the physical horizontal axis, regardless of writing mode
  - `"y"` — the physical vertical axis, regardless of writing mode
  - `"none"` — snapping disabled. Short-circuits, emitting the bare `scroll-snap-type: none` with no strictness segment, and ignoring `strictness` entirely.
- `strictness`: How firmly the container snaps. Defaults to `"mandatory"`. Ignored when `axis` is `"none"`.
  - `"mandatory"` — the container always comes to rest on a snap position, never between two. Right for a pager where an in-between state is meaningless; wrong where an item is taller than the viewport, because content that falls between two snap positions can become unreachable.
  - `"proximity"` — the container snaps only when a scroll ends near a snap position, otherwise leaving it where the user put it. The safer choice for a list of variable-height items.

**Returns:**

- A `UtilityMixin` that sets `scroll-snap-type`

**CSS:**

```css
/* u.scrollSnapType() */
.host {
	scroll-snap-type: inline mandatory;
}

/* u.scrollSnapType("block", "proximity") */
.host {
	scroll-snap-type: block proximity;
}

/* u.scrollSnapType("none") — and u.scrollSnapType("none", "proximity"), identically */
.host {
	scroll-snap-type: none;
}
```

**Example:**

```typescript
let result = u.scrollSnapType();
let axisResult = u.scrollSnapType("block");
let strictnessResult = u.scrollSnapType("inline", "proximity");
let bothAxesResult = u.scrollSnapType("both", "proximity");
let physicalResult = u.scrollSnapType("x");

// "none" short-circuits: the strictness is silently dropped
let disabledResult = u.scrollSnapType("none", "proximity"); // scroll-snap-type: none
```

Both halves of scroll snapping together — the container declares the axis and strictness, each item declares its alignment and whether a flick may pass it:

```tsx
<ul
	role="list"
	mix={[
		u.hstack(),
		u.scroll("x"),
		u.scrollSnapType("inline", "mandatory"),
		u.overscrollBehavior(),
		u.noScrollbar(),
	]}
>
	{slides.map((slide) => (
		<li key={slide.id} mix={[u.scrollSnapAlign(), u.scrollSnapStop(), u.minIs("full")]}>
			<img
				mix={[u.is("full"), u.aspect("video"), u.fit("cover")]}
				src={slide.src}
				alt={slide.alt}
			/>
		</li>
	))}
</ul>
```

#### `thinScrollbar(): UtilityMixin`

Requests a thin scrollbar that reserves its gutter up front, so the scrollbar appearing or disappearing never shifts the content beside it. Unlike `u.noScrollbar()`, which removes the scrollbar entirely, a thin-but-visible scrollbar keeps the affordance intact — the scrollbar is the only standing signal that there is more content to reach, and hiding it leaves both keyboard and pointer users guessing — so prefer this whenever the container's scrollability isn't already obvious from something else on screen. It does nothing to an element that isn't a scroll container, so pair it with `u.scroll()`, `u.overflow()`, or the axis utilities `u.overflowInline()`/`u.overflowBlock()` on the same element. It also conflicts with `u.noScrollbar()`: both set `scrollbar-width`, so whichever lands later in the cascade wins — pick one rather than composing both.

**Parameters:**

- None. Both the thinness and the stable gutter are fixed; there is no argument to widen the scrollbar and none to opt out of the reserved gutter.

**Returns:**

- A `UtilityMixin` applying `scrollbar-width: thin` and `scrollbar-gutter: stable`. Both are standard properties, so unlike `u.noScrollbar()` this reaches for no vendor-prefixed property (`-ms-overflow-style`) and emits no nested `::-webkit-scrollbar` block.

**CSS:**

```css
/* u.thinScrollbar() */
.host {
	scrollbar-width: thin;
	scrollbar-gutter: stable;
}
```

**Example:**

```typescript
let result = u.thinScrollbar();
```

```tsx
<div mix={[u.overflowBlock("auto"), u.thinScrollbar(), u.rounded("md"), u.p(4)]}>{messages}</div>
```

### Stacking

#### `isolate(): UtilityMixin`

Creates a new stacking context on the host without otherwise changing its layout, so a `z-index` on this element or any descendant is resolved _within_ it and can never be interleaved with unrelated siblings outside. Reach for it when a component's internal layering has started leaking — a dropdown inside one card appearing behind a neighbouring card, say. Unlike the other ways to force a stacking context (a `transform`, a `filter`, an `opacity` below 1, a non-`none` `mask`), `isolation: isolate` has no visual side effect of its own.

**Returns:**

- A `UtilityMixin` that sets `isolation: isolate`

**CSS:**

```css
/* u.isolate() */
.host {
	isolation: isolate;
}
```

**Example:**

```typescript
let result = u.isolate();
```

```tsx
<article mix={[u.isolate(), u.relative(), u.rounded("lg"), u.p(4)]}>
	<div mix={[u.absolute(), u.inset(0), u.z(1)]} />
</article>
```

Reach for `u.layer()` instead when the same element also needs a stacking order — it composes this utility with `u.z()` in one call.

#### `layer(value: number): UtilityMixin`

Composes `u.isolate()` and `u.z()` so one call gets both a new stacking context and a stacking order. This is the usual thing you want: setting a `z-index` without an accompanying stacking context leaves the element competing with whatever else happens to be in its ancestor's context, which is how layering bugs start. Only numbers are accepted — this package defines no named component layers such as `"toast"` or `"modal"`, since stacking order for those is an app or component concern rather than a lower-level styling primitive.

**Parameters:**

- `value`: The numeric `z-index` to apply alongside the new stacking context. Negative values are accepted and paint the host behind its parent's background.

**Returns:**

- A `UtilityMixin` that sets both `isolation: isolate` and `z-index`

**CSS:**

```css
/* u.layer(10) */
.host {
	isolation: isolate;
	z-index: 10;
}
```

**Example:**

```typescript
let result = u.layer(10);
let behindResult = u.layer(-1);
```

`z-index` only applies to a positioned element (or a flex/grid item), so pair it with a position utility:

```tsx
<header mix={[u.sticky(), u.insBs(0), u.layer(10), u.translucent()]}>{nav}</header>
```

#### `z(value: number): UtilityMixin`

Sets the host's `z-index` from a plain number. Only numbers are accepted — this package defines no named component layers such as `"toast"` or `"modal"`, since stacking order for those is an app or component concern rather than a lower-level styling primitive.

`z-index` has no effect on a statically positioned block, so it needs `u.relative()`, `u.absolute()`, `u.fixed()`, or `u.sticky()` on the same element — or for the element to be a flex or grid item, where `z-index` applies without a position. It also only orders elements _within the same stacking context_, which is why `u.layer()` exists: reach for it instead when the element should establish its own context as well.

**Parameters:**

- `value`: The numeric `z-index` to apply. Negative values paint the host behind its parent's background.

**Returns:**

- A `UtilityMixin` that sets `z-index`

**CSS:**

```css
/* u.z(10) */
.host {
	z-index: 10;
}
```

**Example:**

```typescript
let result = u.z(10);
let behindResult = u.z(-1);
```

```tsx
<div mix={[u.relative()]}>
	<img mix={[u.absolute(), u.inset(0), u.fit("cover")]} src={src} alt="" />
	<div mix={[u.relative(), u.z(1), u.p(4)]}>{caption}</div>
</div>
```

### Accessibility

#### `debug(mode?: boolean | "nested"): UtilityMixin`

Outlines the host in red so a layout's boundaries are visible while working on it. It is a no-op in production builds — the mixin resolves to an empty style tree when `import.meta.env.DEV` is false rather than relying on tree-shaking — so a call can be left in place without affecting shipped output. The outline is drawn with a `-2px` offset so it sits _inside_ the element's border box and doesn't shift anything: unlike a border, it never participates in layout.

**Parameters:**

- `mode`: How much to outline. Defaults to `false`.
  - `false` — disabled, emitting nothing at all. The default, so a bare `u.debug()` is inert until switched on.
  - `true` — outlines the host element only
  - `"nested"` — outlines the host _and_ every descendant, through an added `& *` rule. Use it to see a subtree's full box model rather than just its outer boundary.

**Returns:**

- A `UtilityMixin` that applies the debug outline in development and an empty style tree in production

**CSS:**

```css
/* u.debug(true) — in development */
.host {
	outline: 2px solid red;
	outline-offset: -2px;
}

/* u.debug("nested") — in development */
.host {
	outline: 2px solid red;
	outline-offset: -2px;
	& * {
		outline: 2px solid red;
		outline-offset: -2px;
	}
}

/* u.debug() — and any call in a production build */
.host {
}
```

**Example:**

```typescript
let result = u.debug();
let hostResult = u.debug(true);
let nestedResult = u.debug("nested");
```

Because `mode` takes a boolean, it reads naturally when driven by a flag rather than being commented in and out:

```tsx
<section mix={[u.vstack({ gap: 4 }), u.debug(inspectLayout)]}>{children}</section>
```

It writes `outline`/`outline-offset`, the same properties `u.outline()` sets and `u.ring()` sets under `:focus-visible` — so while debugging, a focus ring on the same element may be masked.

#### `visuallyHidden(): UtilityMixin`

Applies the standard screen-reader-only clipping recipe. It keeps the host in the accessibility tree _and_ in tab order — preserving its native focusability — while clipping away every rendered pixel. That combination is what distinguishes it from the alternatives: `u.hidden()` (`display: none`) and `u.visibility("hidden")` both remove the element from the accessibility tree entirely, and `u.opacity(0)` leaves it taking up space and catching clicks. Reach for this on a compound control's native `<input>` when a sibling paints the visible indicator, or on a `<label>` whose caption a paired visible control already carries.

Every declaration in the recipe is load-bearing: the `1px` box plus `-1px` margin collapse the element to a point, `clip` and `overflow: hidden` remove its pixels, `padding`/`border-width` of zero stop it contributing any box of its own, and `white-space: nowrap` keeps the clip rect stable no matter how surrounding text wraps.

**Returns:**

- A `UtilityMixin` that visually hides the host without removing it from the accessibility tree or tab order

**CSS:**

```css
/* u.visuallyHidden() */
.host {
	position: absolute;
	inline-size: 1px;
	block-size: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border-width: 0;
}
```

**Example:**

```typescript
let result = u.visuallyHidden();
```

The compound-control pattern it exists for — the real input stays focusable and checkable, and a sibling reads its state to paint the indicator:

```tsx
<label mix={[u.hstack({ gap: 2, align: "center" })]}>
	<span
		mix={[
			u.is(4),
			u.bs(4),
			u.rounded("sm"),
			u.border("neutral"),
			u.hasSibling("input:checked", u.surface("brand")),
			u.hasSibling("input:focus-visible", u.outline({ color: "brand.ring", offset: 2 })),
		]}
		aria-hidden="true"
	/>
	<input type="checkbox" mix={[u.visuallyHidden()]} />
	Remember me
</label>
```

Note the DOM order: the indicator comes **first** and the input **after** it. `:has(~ ...)` only matches a _following_ sibling, so reversing them silently breaks every state rule. And the focus rule uses `u.outline()` rather than `u.ring()` — `ring()` composes `u.focusVisible()` internally, which would look for focus on the span, not on the input.

Since it sets `position: absolute`, the host needs a positioned ancestor to be clipped predictably — and it conflicts with any other position utility (`u.relative()`, `u.fixed()`, `u.sticky()`) or size utility on the same element.

### State

#### `active(input: UtilityInput): UtilityMixin`

Applies the given utilities while the host is being activated — held down by a pointer, or pressed via keyboard. Sugar over `when("&:active", input)`.

`:active` is transient, so it stacks on top of `:hover` rather than replacing it: a pressed button matches both, and the later declaration wins. Put `active()` after `hover()` in a `mix` array when the press state needs to override the hover state.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.active(u.scaleProperty(0.98)) */
.host {
	&:active {
		scale: 0.98;
	}
}
```

**Example:**

```typescript
let result = u.active(u.bg("brand.solid"));
let pressResult = u.active(u.scaleProperty(0.98));
```

The three interaction states in the order they should be layered:

```tsx
<button
	mix={[
		u.surface("brand"),
		u.rounded("md"),
		u.p(2),
		u.transition("background-color, scale"),
		u.hover(u.bg("brand.tint")),
		u.active(u.scaleProperty(0.98)),
		u.ring("brand"),
	]}
>
	Save
</button>
```

#### `after(input: UtilityInput): UtilityMixin`

Applies the given utilities to the host element's `::after` pseudo-element — a generated box laid out as the element's last child, without a corresponding node in the DOM. Sugar over `when("&::after", input)`. A pseudo-element with no `content` declaration generates no box at all, so every use must include `pseudoContent()` (`u.pseudoContent('""')` for a purely decorative box, `u.pseudoContent('"→"')` for a glyph); without it the rule is emitted but nothing ever paints. Its content is not reliably exposed to assistive technology, and is inconsistently included in the accessible name across browsers, so it must stay decorative and never carry meaning a reader needs. The generated box is inline by default — reach for `absolute()` (with `relative()` on the host) or a `block()`/`inlineBlock()` display for a decorative bar, dot, or overlay, and note the pseudo-element cannot be positioned against a host that establishes no containing block.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.after([u.pseudoContent('""'), u.absolute(), u.inset(0)]) */
.host::after {
	content: "";
	position: absolute;
	inset: calc(var(--ui-spacing, 0.25rem) * 0);
}
```

**Example:**

```typescript
let result = u.after([u.pseudoContent('""'), u.absolute(), u.bg("brand.solid")]);
let glyphResult = u.after([u.pseudoContent('"→"'), u.mis(1)]);
let nestedResult = u.after([u.pseudoContent('""'), u.opacity(0), u.hover(u.opacity(100))]);
```

```tsx
<a
	href="/docs"
	mix={[
		u.relative(),
		u.after([
			u.pseudoContent('""'),
			u.absolute(),
			u.insIs(0),
			u.insIe(0),
			u.insBe(0),
			u.bs("1px"),
			u.bg("brand.solid"),
		]),
	]}
>
	Read the docs
</a>
```

#### `aria(attribute: string, input: UtilityInput): UtilityMixin` (overloaded: `aria(attribute: string, value: string | number, input: UtilityInput): UtilityMixin`)

A selector wrapper over the host element's own `aria-*` attribute, for styling from the state a widget already announces to assistive technology instead of mirroring that state into a second, visual-only attribute. The two-argument form targets the attribute's mere presence, the three-argument form an exact value. Sugar over `when()` in both shapes, so it composes and nests like any other state wrapper.

It covers the ARIA states nothing else does. `u.checked()`, `u.disabled()`, and `u.invalid()` already bundle the common ones — `aria-checked`, `aria-disabled`, `aria-invalid` — with their native pseudo-class equivalents, so reach for those first and use this for `aria-expanded`, `aria-selected`, `aria-current`, `aria-pressed`, `aria-busy`, and `aria-sort`.

Matching is exact-string, which means the presence form cannot express "any value except `false`": `u.aria("expanded", input)` matches an `aria-expanded="false"` element too, because the attribute is still present. Target the truthy state explicitly with `u.aria("expanded", "true", input)`.

**Parameters:**

- `attribute`: The attribute name **without** its `aria-` prefix — `"expanded"` targets `aria-expanded`. Interpolated into the selector as written, so it must already be a valid attribute name; passing `"aria-expanded"` yields the wrong `[aria-aria-expanded]` selector.
- `value`: The exact attribute value to match, as a `string` or `number`. A number is interpolated as its string form, so `u.aria("level", 2, ...)` emits `&[aria-level="2"]`. Matching is exact and case-sensitive — there is no substring, prefix, or word-list matching, and no way to negate; wrap `not()` or reach for `when()` for those. Omit this argument entirely for the two-argument form.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.aria("busy", u.opacity(50)) — two-argument form, attribute presence */
.host[aria-busy] {
	opacity: 0.5;
}

/* u.aria("selected", "true", u.bg("brand.tint")) — three-argument form, exact value */
.host[aria-selected="true"] {
	background-color: var(--ui-brand-bg-tint);
}

/* u.aria("level", 2, u.p(4)) — a numeric value is stringified */
.host[aria-level="2"] {
	padding: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let presenceResult = u.aria("busy", u.opacity(50));
let valueResult = u.aria("selected", "true", u.bg("brand.tint"));
let numericResult = u.aria("level", 2, u.p(4));
let nestedResult = u.aria("expanded", "true", u.hover(u.bg("brand.tint")));
```

A tab whose selected state is announced once and styled from the same attribute:

```tsx
<button
	role="tab"
	aria-selected={isActive ? "true" : "false"}
	mix={[
		u.pi(3),
		u.pb(2),
		u.fg("neutral.muted"),
		u.border({ color: "transparent", width: 2 }),
		u.transition("color, border-color"),
		u.aria("selected", "true", [u.fg("brand"), u.border("brand")]),
		u.aria("busy", u.opacity(50)),
	]}
>
	{label}
</button>
```

#### `backdrop(input: UtilityInput): UtilityMixin`

Applies the given utilities to a top-layer element's `::backdrop` — the layer the browser paints behind an element promoted to the top layer, covering the whole viewport beneath it. Sugar over `when("&::backdrop", input)`.

This is the correct way to dim the page behind a modal `<dialog>` or a popover: no extra overlay element in the markup, no `z-index` bookkeeping, and no scroll container to fight, because the browser owns the stacking. An overlay `<div>` sitting in normal flow has to be positioned above everything and clipped by nothing, which is a losing battle; the backdrop is above everything by construction.

It only exists while the element is actually in the top layer — a `<dialog>` opened with `.show()` rather than `.showModal()` has no backdrop at all — so it pairs with `u.open()` when the dialog also needs styling in its closed state, and with `u.startingStyle()` plus `u.transitionBehavior("allow-discrete")` when the dim should fade in rather than snap.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.backdrop([u.bg("neutral.solid"), u.opacity(50)]) */
.host {
	&::backdrop {
		background-color: var(--ui-neutral-bg-solid);
		opacity: 0.5;
	}
}
```

**Example:**

```typescript
let result = u.backdrop(u.bg("neutral.solid"));
let dimResult = u.backdrop([u.bg("neutral.solid"), u.opacity(50)]);
let blurResult = u.backdrop([u.bg("neutral.solid"), u.opacity(50), u.backdropBlur("sm")]);
```

A modal dialog whose dim fades in with the dialog itself:

```tsx
<dialog
	mix={[
		u.surface(),
		u.border({ width: 1 }),
		u.rounded("lg"),
		u.p(6),
		u.backdrop([
			u.bg("neutral.solid"),
			u.opacity(0),
			u.transition("opacity"),
			u.open(u.opacity(50)),
			u.startingStyle(u.open(u.opacity(0))),
		]),
	]}
>
	{children}
</dialog>
```

#### `before(input: UtilityInput): UtilityMixin`

Applies the given utilities to the host element's `::before` pseudo-element — a generated box laid out as the element's first child. Sugar over `when("&::before", input)`. Like `after()`, it generates nothing until a `content` declaration exists, which `pseudoContent()` supplies, and its content is not reliably exposed to assistive technology, so keep it decorative rather than meaningful. Prefer `before()` over `after()` when the decoration reads as leading the content (a bullet, a marker, a leading rule); the two are otherwise identical in behavior and can both be applied to the same element.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.before([u.pseudoContent('"•"'), u.mie(2), u.fg("neutral.muted")]) */
.host::before {
	content: "•";
	margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 2);
	color: var(--ui-neutral-fg-muted);
}
```

**Example:**

```typescript
let result = u.before([u.pseudoContent('""'), u.absolute(), u.inset(0)]);
let markerResult = u.before([u.pseudoContent('"•"'), u.mie(2)]);
let bothResult = [
	u.before([u.pseudoContent('"“"'), u.fg("neutral.muted")]),
	u.after([u.pseudoContent('"”"'), u.fg("neutral.muted")]),
];
```

```tsx
<li
	mix={[
		u.relative(),
		u.pis(5),
		u.before([u.pseudoContent('"•"'), u.absolute(), u.insIs(0), u.fg("brand")]),
	]}
>
	A list item with a decorative marker that carries no meaning of its own.
</li>
```

#### `checked(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is checked, matching both native checked controls and ARIA-checked custom widgets. Sugar over `when('&:checked, &[aria-checked="true"]', input)`.

The doubled selector is the point: `:checked` only matches real `<input type="checkbox">`/`<input type="radio">`/`<option>` elements, so a `<div role="checkbox">` needs the attribute half. Note it does _not_ match `:indeterminate`, which is a third state a tri-state checkbox has to handle separately.

If the visible indicator is a sibling rather than the input itself — the usual arrangement, since a native input can't be styled freely — this wrapper won't help, because it tests the host. Reach for `u.hasSibling("input:checked", ...)` on the indicator instead, and note that it requires the indicator to come _before_ the input in the DOM, since `:has(~ ...)` only looks at following siblings.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.checked(u.bg("brand.solid")) */
.host {
	&:checked,
	&[aria-checked="true"] {
		background-color: var(--ui-brand-bg-solid);
	}
}
```

**Example:**

```typescript
let result = u.checked(u.bg("brand.solid"));
let surfaceResult = u.checked([u.surface("brand"), u.border("brand")]);
```

```tsx
<button
	role="switch"
	aria-checked={enabled}
	mix={[u.surface("muted"), u.checked(u.surface("brand"))]}
/>
```

#### `data(attribute: string, input: UtilityInput): UtilityMixin` (overloaded: `data(attribute: string, value: string | number, input: UtilityInput): UtilityMixin`)

A selector wrapper over the host element's own `data-*` attribute, for styling from state a component already reflects onto the DOM instead of inventing a class-name convention for the same thing. A headless widget that writes `data-state="open"`, `data-orientation="vertical"`, or a bare `data-disabled` becomes directly styleable at the call site, with no extra prop threading and no class strings to keep in sync. Sugar over `when()` in both call shapes, so it composes and nests like any other state wrapper — `u.data("state", "open", u.hover(...))` and `u.at("md", u.data("orientation", "vertical", ...))` both work.

**Parameters:**

- `attribute`: The attribute name **without** its `data-` prefix — `"orientation"` targets `data-orientation`. Interpolated into the selector as written, so it must already be a valid attribute name; passing `"data-orientation"` yields the wrong `[data-data-orientation]` selector.
- `value`: The exact attribute value to match, as a `string` or `number`. A number is interpolated as its string form, so `u.data("count", 3, ...)` emits `&[data-count="3"]`. Matching is exact and case-sensitive — there is no substring, prefix, or word-list matching, and no way to negate; wrap `not()` or reach for `when()` for those. Omit this argument entirely for the two-argument form, which matches the attribute's mere presence.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.data("disabled", u.opacity(50)) — two-argument form, attribute presence */
.host[data-disabled] {
	opacity: 0.5;
}

/* u.data("orientation", "vertical", u.flexCol()) — three-argument form, exact value */
.host[data-orientation="vertical"] {
	flex-direction: column;
}

/* u.data("count", 3, u.p(4)) — a numeric value is stringified */
.host[data-count="3"] {
	padding: calc(var(--ui-spacing, 0.25rem) * 4);
}
```

**Example:**

```typescript
let presenceResult = u.data("disabled", u.opacity(50));
let valueResult = u.data("orientation", "vertical", u.flexCol());
let numericResult = u.data("count", 3, u.p(4));
let nestedResult = u.data("state", "open", u.hover(u.bg("brand.tint")));
```

```tsx
<div
	data-orientation="vertical"
	data-state="open"
	mix={[
		u.flexRow(),
		u.gap(2),
		u.data("orientation", "vertical", [u.flexCol(), u.items("stretch")]),
		u.data("state", "open", u.bg("brand.tint")),
		u.data("disabled", [u.opacity(50), u.pointerEvents("none")]),
	]}
/>
```

#### `detailsContent(input: UtilityInput): UtilityMixin`

Applies the given utilities to a `<details>` element's `::details-content` pseudo-element — the collapsible region holding everything after the `<summary>`. Sugar over `when("&::details-content", input)`.

It exists because that region has no element of its own to target: before this pseudo-element, animating a native disclosure meant wrapping the content in an extra `<div>`. Pair it with `u.interpolateSize()` and `u.transitionBehavior("allow-discrete")` to animate a disclosure open and closed, since the height goes to and from `auto` and the element goes to and from `display: none`.

Combine it with `u.open()`'s selector directly — `when("&[open]::details-content", input)` — for styles that should only apply once the disclosure is open.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.detailsContent([u.overflow("clip"), u.bs(0)]) */
.host {
	&::details-content {
		overflow: clip;
		block-size: calc(var(--ui-spacing, 0.25rem) * 0);
	}
}
```

**Example:**

```typescript
let result = u.detailsContent([u.overflow("clip"), u.bs(0)]);
let paddedResult = u.detailsContent(u.p(4));
```

The animated-disclosure composition — a collapsed height that transitions to `auto` once open:

```tsx
<details
	mix={[
		u.interpolateSize(),
		u.detailsContent([
			u.bs(0),
			u.overflow("clip"),
			u.transition("block-size, content-visibility"),
			u.transitionBehavior("allow-discrete"),
		]),
		u.when("&[open]::details-content", u.bs("auto")),
	]}
>
	<summary>Details</summary>
	{children}
</details>
```

#### `disabled(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is disabled, matching both `:disabled` and `[aria-disabled="true"]`. Sugar over `when('&:disabled, &[aria-disabled="true"]', input)`.

A selector wrapper only — it defines no visual disabled recipe of its own, so apps and components choose the colors, opacity, and cursor. The two halves it matches behave very differently, and the choice matters for accessibility: a genuinely `disabled` control is removed from tab order and stops firing events, while `aria-disabled="true"` leaves it focusable and announced as disabled, which is usually the better choice — a disabled button a keyboard user can't reach also can't be discovered or explained.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.disabled([u.opacity(50), u.cursor("not-allowed")]) */
.host {
	&:disabled,
	&[aria-disabled="true"] {
		opacity: 0.5;
		cursor: not-allowed;
	}
}
```

**Example:**

```typescript
let result = u.disabled(u.opacity(50));
let fullResult = u.disabled([u.opacity(50), u.cursor("not-allowed"), u.pointerEvents()]);
```

Pair it with `u.not()` so the interactive states don't fire on a disabled control:

```tsx
<button
	disabled={isSaving}
	mix={[
		u.surface("brand"),
		u.rounded("md"),
		u.p(2),
		u.not(":disabled", u.hover(u.bg("brand.tint"))),
		u.disabled([u.opacity(50), u.cursor("not-allowed")]),
	]}
>
	Save
</button>
```

#### `focusVisible(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host matches `:focus-visible` — focus the browser has decided should be shown, which in practice means keyboard and assistive-technology focus but not a plain mouse click. Sugar over `when("&:focus-visible", input)`.

Prefer it over a bare `:focus` for anything focus-indicating: styling `:focus` puts a ring on a button every time it's clicked, which is why so many designs end up removing focus outlines altogether and breaking keyboard navigation. For a focus ring specifically, reach for `u.ring()` — it already composes this wrapper.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.focusVisible(u.border("brand")) */
.host {
	&:focus-visible {
		border-color: var(--ui-brand-border);
	}
}
```

**Example:**

```typescript
let result = u.focusVisible(u.ring("brand"));
let borderResult = u.focusVisible(u.border("brand.strong"));
```

```tsx
<a
	href={href}
	mix={[u.rounded("sm"), u.focusVisible(u.outline({ color: "brand", width: 2, offset: 2 }))]}
>
	{label}
</a>
```

Never remove a focus indicator without supplying a replacement here — an element with no visible focus state is unusable by keyboard.

#### `focusWithin(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host _or any of its descendants_ has focus. Sugar over `when("&:focus-within", input)`.

Its real use is styling a container from the focus state of something inside it — highlighting a whole input group when the inner `<input>` is focused, or revealing a row's actions while one of them has keyboard focus. That's the case a plain `:focus` can't express, since the container itself never receives focus.

Unlike `u.focusVisible()`, there is no `:focus-visible-within`, so this matches mouse focus too. When that's too eager, wrap the inner element in `u.focusVisible()` and style the container with `u.when("&:has(:focus-visible)", ...)` instead.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.focusWithin(u.border("brand")) */
.host {
	&:focus-within {
		border-color: var(--ui-brand-border);
	}
}
```

**Example:**

```typescript
let result = u.focusWithin(u.border("brand"));
let ringResult = u.focusWithin(u.outline({ color: "brand", width: 2 }));
```

The input-group pattern — the wrapper carries the border and the focus treatment, the input carries none:

```tsx
<div
	mix={[
		u.hstack({ gap: 2, align: "center" }),
		u.border("neutral"),
		u.rounded("md"),
		u.pi(2),
		u.focusWithin(u.border("brand")),
	]}
>
	<span aria-hidden="true">@</span>
	<input mix={[u.spacer(), u.appearance(), u.bg("color.neutral.50"), u.pb(2)]} />
</div>
```

#### `has(selector: string, input: UtilityInput): UtilityMixin`

A selector wrapper that styles an element from the state of its own descendants: wraps `selector` in `:has(...)` and applies the given utilities there. Sugar over `when(\`&:has(${selector})\`, input)`.

It expresses the thing no selector could express before `:has()`, since CSS otherwise only ever walks downwards. The real cases are a field wrapper reacting to its inner input, so the focus ring and error border land on the wrapper instead of the bare control; a card that has an image, so the two-column layout only kicks in when there is art to lay out; and a list that has a selected row. For the focus case specifically, `u.focusWithin()` is the shorter route, and `u.has(":focus-visible", ...)` is the version that ignores mouse focus.

Reach for `u.hasSibling()` instead when the state lives on a sibling rather than a descendant. Note that `:has()` takes the specificity of its most specific argument, so a heavy selector inside it raises the whole rule's weight and can start winning against declarations you expected to override it.

**Parameters:**

- `selector`: The selector to test for, written as it appears inside `:has(...)` — a descendant (`"img"`, `"input:user-invalid"`), an attribute selector (`'[aria-selected="true"]'`), a combinator-led relative selector (`"> img"`), or a comma-separated list. Interpolated as written and not validated.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.has("input:user-invalid", u.border("danger")) */
.host {
	&:has(input:user-invalid) {
		border-color: var(--ui-danger-border);
	}
}
```

**Example:**

```typescript
let result = u.has("input:user-invalid", u.border("danger"));
let imageResult = u.has("> img", u.p(4));
let selectedResult = u.has('[aria-selected="true"]', u.bg("brand.tint"));
let focusResult = u.has(":focus-visible", u.outline({ color: "brand", offset: 2 }));
```

The field-wrapper pattern — the wrapper carries the border and the error treatment, read off the control inside it:

```tsx
<div
	mix={[
		u.vstack({ gap: 1 }),
		u.border({ color: "neutral", width: 1 }),
		u.rounded("md"),
		u.pi(3),
		u.pb(2),
		u.has(":focus-visible", u.outline({ color: "brand", offset: 2 })),
		u.has("input:user-invalid", u.border("danger")),
	]}
>
	<label mix={[u.text("xs"), u.fg("neutral.muted")]} htmlFor="email">
		{label}
	</label>
	<input id="email" type="email" required mix={[u.appearance(), u.bg("transparent")]} />
</div>
```

#### `hasSibling(selector: string, input: UtilityInput): UtilityMixin`

A selector wrapper that styles an element from the state of a sibling rather than a descendant: emits `&:has(~ {selector})`. Sugar over `when(\`&:has(~ ${selector})\`, input)`.

This is the compound-control idiom. A visually-hidden native `<input>` is paired with a sibling element that paints the visible indicator, and the indicator needs to read the input's state — checked, focused, disabled — while the input itself stays the real, accessible, form-submitting control. It is the single most repeated hand-written selector in real usage, which is why it gets a name of its own.

**DOM order is load-bearing.** The `~` combinator only looks at _following_ siblings, so `&:has(~ input:checked)` matches an element that has a matching sibling _after_ it: the styled indicator must come **first** in the DOM and the hidden input **after** it. Reversed, every rule silently stops matching with no error anywhere. Reach for `u.has()` when the state lives on a descendant instead, and `u.precededBy()` when the source order goes the other way — input first, indicator after, which is the more common arrangement and the one that needs no `:has()` support.

One more trap: do not use `u.ring()` for the focus state inside this wrapper. `ring()` composes `u.focusVisible()` internally, so it would test focus on the indicator — which never receives focus — rather than on the input. Use `u.outline()` inside `u.hasSibling("input:focus-visible", ...)`, where the focus test already lives in the selector.

**Parameters:**

- `selector`: The following-sibling selector to test for, written as it appears after the `~` combinator — `"input:checked"`, `"input:focus-visible"`, `"input:disabled"`, `"input:indeterminate"`, or a comma-separated list. Interpolated as written and not validated.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.hasSibling("input:checked", [u.bg("brand.solid"), u.border("brand")]) */
.host {
	&:has(~ input:checked) {
		background-color: var(--ui-brand-bg-solid);
		border-color: var(--ui-brand-border);
	}
}

/* u.hasSibling("input:disabled", u.opacity(50)) */
.host {
	&:has(~ input:disabled) {
		opacity: 0.5;
	}
}
```

**Example:**

```typescript
let result = u.hasSibling("input:checked", u.bg("brand.solid"));
let focusResult = u.hasSibling("input:focus-visible", u.outline({ color: "brand", offset: 2 }));
let disabledResult = u.hasSibling("input:disabled", [u.opacity(50), u.cursor("not-allowed")]);
let mixedResult = u.hasSibling("input:indeterminate", u.bg("brand.solid"));
```

The full checkbox — note the indicator `<span>` comes before the `<input>`, which is what makes every rule below match:

```tsx
<label mix={[u.hstack({ gap: 2, align: "center" }), u.cursor("pointer")]}>
	<span
		aria-hidden="true"
		mix={[
			u.inlineFlex(),
			u.items("center"),
			u.justify("center"),
			u.is(5),
			u.bs(5),
			u.rounded("sm"),
			u.border({ color: "neutral.strong", width: 2 }),
			u.transition("background-color, border-color"),
			u.hasSibling("input:checked", [
				u.bg("brand.solid"),
				u.border("brand"),
				u.fg("brand.onSolid"),
			]),
			u.hasSibling("input:focus-visible", u.outline({ color: "brand", offset: 2 })),
			u.hasSibling("input:disabled", [u.opacity(50), u.cursor("not-allowed")]),
		]}
	>
		{mark}
	</span>
	<input type="checkbox" mix={[u.visuallyHidden()]} />
	{children}
</label>
```

#### `hover(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host matches `:hover`. Sugar over `when("&:hover", input)`.

Hover is not available on touch input, so it must never be the only way to reach something — a menu or action revealed on hover alone is unreachable on a phone. Pair it with `u.focusWithin()` or `u.focusVisible()` so keyboard and touch users get the same affordance.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.hover(u.bg("brand.tint")) */
.host {
	&:hover {
		background-color: var(--ui-brand-bg-tint);
	}
}
```

**Example:**

```typescript
let result = u.hover(u.bg("brand.tint"));
let multipleResult = u.hover([u.bg("neutral.tint"), u.border("neutral")]);
```

Revealing something on hover, with a focus equivalent so it isn't hover-only:

```tsx
<li
	mix={[
		u.hstack({ gap: 2, align: "center" }),
		u.p(2),
		u.hover(u.bg("neutral.tint")),
		u.when("&:hover [data-slot='actions'], &:focus-within [data-slot='actions']", u.opacity(100)),
	]}
>
	<span mix={[u.spacer()]}>{label}</span>
	<span data-slot="actions" mix={[u.opacity(0), u.transition("opacity")]}>
		{actions}
	</span>
</li>
```

#### `indeterminate(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is in the indeterminate state, matching both natively indeterminate controls and ARIA mixed-state custom widgets. Sugar over `when('&:indeterminate, &[aria-checked="mixed"]', input)`.

`u.checked()` does **not** match this third state — neither `:checked` nor `aria-checked="true"` is true of a mixed checkbox — which is exactly why this wrapper exists. A tri-state checkbox needs it to paint the dash that stands for "some, but not all", and without it a parent checkbox with a partial selection renders identically to an unchecked one.

`:indeterminate` is broader than that one case: it also matches every radio button in a group where no option is selected yet, and a `<progress>` element with no `value` attribute. Scope it to the control you mean rather than applying it broadly.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.indeterminate(u.bg("brand.solid")) */
.host {
	&:indeterminate,
	&[aria-checked="mixed"] {
		background-color: var(--ui-brand-bg-solid);
	}
}
```

**Example:**

```typescript
let result = u.indeterminate(u.bg("brand.solid"));
let fullResult = u.indeterminate([u.bg("brand.solid"), u.border("brand")]);
```

All three states of a tri-state checkbox, with `indeterminate` last so it wins over the unchecked resting styles:

```tsx
<button
	role="checkbox"
	aria-checked={selected.size === 0 ? "false" : selected.size === total ? "true" : "mixed"}
	mix={[
		u.is(5),
		u.bs(5),
		u.rounded("sm"),
		u.border({ color: "neutral.strong", width: 2 }),
		u.checked([u.bg("brand.solid"), u.border("brand")]),
		u.indeterminate([u.bg("brand.solid"), u.border("brand")]),
	]}
>
	{selected.size === total ? check : dash}
</button>
```

#### `invalid(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is invalid, matching both `:user-invalid` and `[aria-invalid="true"]`. Sugar over `when('&:user-invalid, &[aria-invalid="true"]', input)`.

It deliberately uses `:user-invalid` rather than `:invalid`. `:invalid` matches from first render, so an empty required field is styled as an error before the user has typed anything; `:user-invalid` only matches after the user has interacted and left the field, which is when an error is actually informative.

A selector wrapper only — it defines no visual invalid recipe of its own. Colour alone is not a sufficient error signal, so pair it with text describing the problem, referenced from the control.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.invalid([u.border("danger"), u.ring("danger")]) */
.host {
	&:user-invalid,
	&[aria-invalid="true"] {
		border-color: var(--ui-danger-border);
		&:focus-visible {
			outline-color: var(--ui-danger-ring);
			outline-width: 2px;
			outline-style: solid;
		}
	}
}
```

**Example:**

```typescript
let result = u.invalid(u.border("danger"));
let fullResult = u.invalid([u.border("danger"), u.ring("danger")]);
```

```tsx
<input
	aria-invalid={errors.email ? "true" : undefined}
	aria-describedby={errors.email ? "email-error" : undefined}
	mix={[
		u.border("neutral"),
		u.rounded("md"),
		u.p(2),
		u.invalid([u.border("danger"), u.ring("danger")]),
	]}
/>
```

#### `marker(input: UtilityInput): UtilityMixin`

Applies the given utilities to a list item's marker — its bullet or number — and to a `<summary>`'s disclosure triangle, via `::marker`. Sugar over `when("&::marker", input)`.

Only a small set of properties apply here: `color`, the `font-*` family (`font-family`, `font-size`, `font-weight`, `font-style`, and the variant/feature longhands), and `content`. Everything else in the wrapped utilities is emitted but ignored by the browser, so the marker cannot be padded, positioned, or given a background through this wrapper. When the decoration needs box properties, drop `u.listStyle("none")` and draw it with `u.before()` plus `u.pseudoContent()` instead.

To remove the marker entirely rather than restyle it, use `u.listStyle("none")` — recolouring it to match the background only hides it, leaving the space it occupies in the line box behind.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.marker(u.fg("brand")) */
.host {
	&::marker {
		color: var(--ui-brand-fg);
	}
}
```

**Example:**

```typescript
let result = u.marker(u.fg("neutral.muted"));
let toneResult = u.marker(u.fg("brand"));
let contentResult = u.marker(u.pseudoContent('"→ "'));
```

Tinting the bullets of a list without touching the text colour:

```tsx
<ul mix={[u.vstack({ gap: 2 }), u.pis(5), u.marker(u.fg("brand"))]}>
	{items.map((item) => (
		<li key={item.id} mix={[u.text("sm")]}>
			{item.label}
		</li>
	))}
</ul>
```

#### `not(selector: string, input: UtilityInput): UtilityMixin`

A selector wrapper for negated state: wraps `selector` in `:not(...)` and applies the given utilities there. Sugar over `when(\`&:not(${selector})\`, input)`.

Its main job is keeping interactive states off a control that shouldn't respond — `u.not(":disabled", u.hover(...))` rather than a `hover()` that fires on a disabled button too. That composition nests cleanly: the negation wraps the hover, producing `&:not(:disabled):hover`.

**Parameters:**

- `selector`: The selector to negate, written as it appears inside `:not(...)` — a pseudo-class (`":disabled"`, `":last-child"`), an attribute selector (`"[hidden]"`), or a comma-separated list, which modern `:not()` accepts (`":disabled, [aria-disabled='true']"`)
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.not(":disabled", u.hover(u.bg("brand.tint"))) */
.host {
	&:not(:disabled) {
		&:hover {
			background-color: var(--ui-brand-bg-tint);
		}
	}
}
```

**Example:**

```typescript
let result = u.not(":disabled", u.opacity(100));
let hoverResult = u.not(":disabled", u.hover(u.bg("brand.tint")));
let listResult = u.not(":last-child", u.mbe(2));
```

```tsx
<button
	mix={[
		u.surface("brand"),
		u.not(":disabled", [u.hover(u.bg("brand.tint")), u.cursor("pointer")]),
		u.disabled(u.opacity(50)),
	]}
/>
```

Note that `:not()` raises specificity to that of its most specific argument, so a `not()` rule can beat an unwrapped one it was meant to sit alongside.

#### `open(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is open, matching both the `<details>`/`<dialog>` `open` attribute and the Popover API's `:popover-open` pseudo-class. Sugar over `when("&[open], &:popover-open", input)`.

The doubled selector covers all three native disclosure mechanisms in one wrapper. It's the state half of an entry animation: a popover or dialog goes from `display: none` to shown, so the "open" styles here are the end state, `u.startingStyle()` supplies the start state, and `u.transitionBehavior("allow-discrete")` lets the discrete `display` change participate.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.open([u.opacity(100), u.scaleProperty(1)]) */
.host {
	&[open],
	&:popover-open {
		opacity: 1;
		scale: 1;
	}
}
```

**Example:**

```typescript
let result = u.open(u.opacity(100));
let scaleResult = u.open([u.opacity(100), u.scaleProperty(1)]);
```

A complete popover entry animation — resting state, open state, start state, and the discrete-property opt-in:

```tsx
<div
	popover="auto"
	mix={[
		u.opacity(0),
		u.scaleProperty(0.95),
		u.transition("opacity, scale, display, overlay"),
		u.transitionBehavior("allow-discrete"),
		u.open([u.opacity(100), u.scaleProperty(1)]),
		u.startingStyle(u.open([u.opacity(0), u.scaleProperty(0.95)])),
	]}
>
	{children}
</div>
```

#### `placeholder(input: UtilityInput): UtilityMixin`

Applies the given utilities to an `<input>` or `<textarea>`'s `::placeholder` text. Sugar over `when("&::placeholder", input)`.

Placeholder text is not a label substitute: it vanishes the moment the user types, and browsers render it at a contrast ratio that often fails on its own. Styling it does not remove the need for a real `<label>` — give the field a label and use the placeholder for an example value at most. If a design calls for the placeholder to double as the label, that is the float-label pattern, which needs `u.placeholderShown()` as well.

For styling the _input itself_ while it is empty and showing that placeholder, use `u.placeholderShown()`. This wrapper only reaches the placeholder text.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.placeholder(u.fg("neutral.muted")) */
.host {
	&::placeholder {
		color: var(--ui-neutral-fg-muted);
	}
}
```

**Example:**

```typescript
let result = u.placeholder(u.fg("neutral.muted"));
let hiddenResult = u.placeholder(u.fg("transparent"));
let styledResult = u.placeholder([u.fg("neutral.muted"), u.textTransform("none")]);
```

```tsx
<>
	<label htmlFor="search" mix={[u.text("sm"), u.weight("medium")]}>
		{label}
	</label>
	<input
		id="search"
		type="search"
		placeholder="acme.com"
		mix={[
			u.is("full"),
			u.border({ color: "neutral", width: 1 }),
			u.rounded("md"),
			u.pi(3),
			u.pb(2),
			u.placeholder(u.fg("neutral.muted")),
		]}
	/>
</>
```

#### `placeholderShown(input: UtilityInput): UtilityMixin`

Applies the given utilities while the host `<input>` or `<textarea>` is empty and therefore still showing its placeholder. Sugar over `when("&:placeholder-shown", input)`.

It matches the _control_, not the placeholder text — that is `u.placeholder()`. The distinction matters because this is the only CSS handle on "this field has not been filled in", which is what makes the float-label pattern possible with no JavaScript: combine it with `u.has()` on the field wrapper and the label can sit inside an empty field, then shrink and move above it the moment the user types. `u.has(":placeholder-shown", ...)` on the wrapper describes the resting position and the wrapper's default styles describe the floated one, so the field ends up floated whenever the pseudo-class stops matching.

The pattern needs a non-empty placeholder for `:placeholder-shown` to match at all — a single space is the usual trick — and the placeholder text itself is then hidden with `u.placeholder(u.fg("transparent"))`. Keep the real `<label>` in the markup regardless; the visual float is decoration over a properly labelled field.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.placeholderShown(u.fg("neutral.muted")) */
.host {
	&:placeholder-shown {
		color: var(--ui-neutral-fg-muted);
	}
}
```

**Example:**

```typescript
let result = u.placeholderShown(u.fg("neutral.muted"));
let truncateResult = u.placeholderShown(u.truncate());
```

The float-label composition — the wrapper's own `& > span` styles are the floated position, and the `u.has(":placeholder-shown", ...)` branch pushes the label back down into an empty field:

```tsx
<label
	mix={[
		u.relative(),
		u.block(),
		u.when("& > span", [
			u.absolute(),
			u.insBs(1),
			u.insIs(3),
			u.text("xs"),
			u.fg("neutral.muted"),
			u.transition("inset-block-start, font-size"),
		]),
		u.has(":placeholder-shown", u.when("& > span", [u.insBs(3), u.text("base")])),
	]}
>
	<span>{label}</span>
	<input
		type="email"
		placeholder=" "
		mix={[
			u.is("full"),
			u.border({ color: "neutral", width: 1 }),
			u.rounded("md"),
			u.pi(3),
			u.pbs(5),
			u.pbe(2),
			u.placeholder(u.fg("transparent")),
		]}
	/>
</label>
```

#### `precededBy(selector: string, input: UtilityInput): UtilityMixin`

The mirror of `u.hasSibling()`. Both style an element from a _sibling's_ state, and which one you need is decided purely by source order: `hasSibling()` looks forward, so the styled element comes first, while this looks backward, so the element matching `selector` comes first and the styled element follows it. Sugar over `when("{selector} ~ &", input)`.

The backward direction is usually the one a compound control wants, because it is the accessible source order — the real `<input>` first, then the element painting the visible indicator. Two smaller reasons to prefer it where either would work: it has no `:has()` dependency, since a plain `~` combinator has been supported far longer, and it keeps specificity flat, where `:has()` takes the specificity of its most specific argument.

Note that no marker class or attribute goes on the sibling. Some utility-CSS frameworks solve this with a two-part protocol — a `peer`-style marker on one element and a `peer-*` variant on the other — which this package has no way to offer, since its mixins generate opaque class names and it keeps no runtime registry. Naming the sibling by its own selector needs neither half.

**Parameters:**

- `selector`: The preceding sibling's selector, used verbatim on the left of a `~` combinator. Any selector works — `"input:checked"`, `"input:focus-visible"`, `"*:hover"`, `"[data-slot='trigger'][aria-expanded='true']"`. `~` matches _any_ preceding sibling, not only the immediately preceding one; for the adjacent-only form reach for `when("{selector} + &", input)`.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.precededBy("input:checked", u.border("brand.solid")) */
.host {
	input:checked ~ & {
		border-color: var(--ui-brand-bg-solid);
	}
}
```

**Example:**

```typescript
let result = u.precededBy("input:checked", u.border("brand.solid"));
let focusResult = u.precededBy("input:focus-visible", u.outline({ color: "brand", offset: 2 }));
let hoverResult = u.precededBy("*:hover", u.opacity(100));
```

The compound-control pattern in its accessible source order — input first, indicator after, which is what this wrapper exists for:

```tsx
<label mix={[u.hstack({ gap: 2, align: "center" }), u.cursor("pointer")]}>
	<input type="radio" name="plan" mix={[u.visuallyHidden()]} />
	<span
		aria-hidden="true"
		mix={[
			u.is(4),
			u.bs(4),
			u.circle(),
			u.border({ color: "neutral", width: 2 }),
			u.motionSafe(u.transition("border-color, background-color")),
			u.precededBy("input:checked", [u.border("brand.solid"), u.bg("brand.solid")]),
			u.precededBy("input:focus-visible", u.outline({ color: "brand", offset: 2 })),
			u.precededBy("input:disabled", [u.opacity(50), u.cursor("not-allowed")]),
		]}
	/>
	{label}
</label>
```

Because it nests a descendant-style selector rather than a pseudo-class on the host, it composes with the pseudo-element wrappers: `u.precededBy("input:checked", u.after(u.scaleProperty(1)))` targets the indicator's `::after` only while the input is checked.

#### `readOnly(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is read-only, matching both native read-only controls and ARIA read-only custom widgets. Sugar over `when('&:read-only, &[aria-readonly="true"]', input)`.

Read-only is not disabled, and should not look like it. A read-only control is still focusable, still reachable by keyboard, still submits its value with the form, and is still announced with its label and contents — the user simply cannot edit it. `u.disabled()` covers the other case, where the control is inert and its value is dropped from the submission entirely. Style read-only as normal-but-static — a flat background, no editable affordance — rather than greyed-out, or users will read it as broken.

Worth knowing that `:read-only` matches far more than form fields: every non-editable element in the document matches it, so scope this to the control you mean rather than applying it to a container.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.readOnly([u.bg("neutral.tint"), u.cursor("default")]) */
.host {
	&:read-only,
	&[aria-readonly="true"] {
		background-color: var(--ui-neutral-bg-tint);
		cursor: default;
	}
}
```

**Example:**

```typescript
let result = u.readOnly(u.bg("neutral.tint"));
let staticResult = u.readOnly([u.bg("neutral.tint"), u.cursor("default"), u.border("transparent")]);
```

The read-only field keeps its focus ring, because it is still focusable:

```tsx
<input
	readOnly={!canEdit}
	value={apiKey}
	mix={[
		u.is("full"),
		u.border({ color: "neutral", width: 1 }),
		u.rounded("md"),
		u.pi(3),
		u.pb(2),
		u.ring("brand"),
		u.readOnly([u.bg("neutral.tint"), u.cursor("default")]),
	]}
/>
```

#### `required(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host is required, matching both native required controls and ARIA required custom widgets. Sugar over `when('&:required, &[aria-required="true"]', input)`.

Whatever visual marker this paints must not be the only signal that the field is required: a colour change conveys nothing to anyone who cannot see it, and a bare asterisk conveys nothing on its own either. Keep the requirement in the label text or an explicit hint as well, and let this wrapper handle the decoration only.

It pairs with `u.invalid()`, which deliberately matches `:user-invalid` rather than `:invalid` — so an untouched empty required field is styled as required without also being styled as an error before the user has done anything. Applying an error treatment through `:invalid` instead is the mistake this pairing avoids.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.required(u.border("neutral.strong")) */
.host {
	&:required,
	&[aria-required="true"] {
		border-color: var(--ui-neutral-border-strong);
	}
}
```

**Example:**

```typescript
let result = u.required(u.border("neutral.strong"));
let markerResult = u.required(u.after([u.pseudoContent('" *"'), u.fg("danger")]));
```

The requirement is stated in the label text; the border weight and the marker are decoration on top of it, and the error treatment only lands after the user has left the field:

```tsx
<>
	<label htmlFor="email" mix={[u.text("sm"), u.weight("medium")]}>
		{t("form.email.label")}
	</label>
	<input
		id="email"
		type="email"
		required
		aria-describedby="email-error"
		mix={[
			u.is("full"),
			u.border({ color: "neutral", width: 1 }),
			u.rounded("md"),
			u.pi(3),
			u.pb(2),
			u.required(u.border("neutral.strong")),
			u.invalid([u.border("danger"), u.ring("danger")]),
		]}
	/>
	<p id="email-error" mix={[u.text("xs"), u.fg("danger")]}>
		{errors.email}
	</p>
</>
```

#### `selection(input: UtilityInput): UtilityMixin`

Applies the given utilities to the user's text selection inside the element, via `::selection`. Sugar over `when("&::selection", input)`.

Only a small set of properties apply here — `color`, `background-color`, `text-decoration`, and `text-shadow`. Everything else in the wrapped utilities is emitted but ignored by the browser, so a selection cannot be padded, rounded, or given a border.

The platform's own selection colours come with a contrast guarantee the user — or their OS high-contrast setting — has already agreed to, and overriding them throws that guarantee away. If you do override, keep the pair high-contrast and always set `color` and `background-color` together rather than one alone: setting only the background leaves the browser's default selection text colour against your new fill, which is where unreadable selections come from.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.selection([u.bg("brand.solid"), u.fg("brand.onSolid")]) */
.host {
	&::selection {
		background-color: var(--ui-brand-bg-solid);
		color: var(--ui-brand-fg-on-solid);
	}
}
```

**Example:**

```typescript
let result = u.selection(u.bg("brand.tint"));
let pairResult = u.selection([u.bg("brand.solid"), u.fg("brand.onSolid")]);
```

Set once on a wrapper, since `::selection` applies to whichever element the selected text lives in:

```tsx
<article
	mix={[
		u.vstack({ gap: 4 }),
		u.is("65ch"),
		u.selection([u.bg("brand.solid"), u.fg("brand.onSolid")]),
	]}
>
	{children}
</article>
```

#### `when(selector: string, input: UtilityInput): UtilityMixin`

The primitive selector wrapper. It flattens `input`, merges the flattened utilities' style trees, and nests the merged tree under `selector`. Every other state wrapper — `hover()`, `checked()`, `data()`, `before()`, and the rest — is sugar over this function, so reach for those first and use `when()` for the selector they don't cover.

Because it nests under a _selector_, an `@keyframes` rule must never be passed through it: keyframes only hoist to the stylesheet root from a mixin's own top level or from inside `u.media()`/`u.supports()`. Use `u.keyframes()` at the top level with `u.animationHost()` inside the wrapper instead.

**Parameters:**

- `selector`: The CSS selector to nest the merged styles under. `&` refers to the host, and CSS nesting rules apply, so `&` can appear anywhere in the selector:
  - a pseudo-class on the host — `"&:nth-child(odd)"`, `"&:target"`
  - a relational test — `"&:has(input:checked)"`, `"&:has(> img)"`
  - a sibling or child combinator — `"& > li"`, `"& + &"`, `"&:has(~ input:checked)"`
  - an ancestor condition, with `&` on the right — `".dark &"`, `"[dir='rtl'] &"`
  - a pseudo-element — `"&::marker"`, `"&::selection"`, `"&::-webkit-scrollbar-thumb"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")]) */
.host {
	&:has(input:checked) {
		background-color: var(--ui-brand-bg-tint);
		border-color: var(--ui-brand-border);
	}
}
```

**Example:**

```typescript
let result = u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")]);
let childResult = u.when("& > li", u.pb(2));
let ancestorResult = u.when("[dir='rtl'] &", u.textAlign("end"));
let markerResult = u.when("&::marker", u.fg("brand"));
```

Wrappers nest, so a selector can be combined with a state or responsive wrapper rather than hand-writing the compound selector:

```tsx
<label
	mix={[
		u.p(3),
		u.rounded("md"),
		u.border("neutral"),
		u.when("&:has(input:checked)", [u.border("brand"), u.bg("brand.tint")]),
	]}
>
	<input type="radio" mix={[u.visuallyHidden()]} />
	{label}
</label>
```

### Responsive

#### `at(size: ContainerName | (string & {}), input: UtilityInput): UtilityMixin` (overloaded: `at(size: ContainerName | (string & {}), name: string, input: UtilityInput): UtilityMixin`)

A container query, never a viewport media query — the nearest ancestor with `container-type: inline-size` (or `container-type: size`) is what `size` is compared against, so a component embedded in a narrow column adapts to that column's width instead of the page's. This is the default tool for responsive layout in this package; `u.media()` is the escape hatch for the rare rule that genuinely needs the viewport.

It queries a `min-width`, so it is mobile-first: the unwrapped utilities are the narrow case and each `at()` layers on at and above its breakpoint. Reach for `u.atMax()` for the `max-width` counterpart.

Nothing resolves at all without an ancestor declaring a container — use `u.container()` for that. A container also can't query _itself_, so the element carrying the `at()` call must be a descendant of the declaring element, never the same one.

**Parameters:**

- `size`: The inline size to compare the container against. A named scale step resolves to its literal length, and a raw CSS length passes through literally. Nothing here is ever wrapped in `var(--ui-container-{name}, fallback)`: an at-rule condition is evaluated before custom properties are substituted, so a `var()` in the condition would emit a rule that never matches at any width. The `var()` form is for property values only.
  - `"xs"` — `20rem`
  - `"sm"` — `24rem`
  - `"md"` — `36rem`
  - `"lg"` — `48rem`
  - `"xl"` — `64rem`
  - `"2xl"` — `80rem`
  - a raw CSS length (`"40rem"`, `"640px"`) — used verbatim. Only an atomic number-plus-unit is detected as a length, so a `calc(...)` or `clamp(...)` expression is _not_ passed through and would be treated as a token name — reach for `u.atQuery()` there.
  - an app-extended name declared through module augmentation of `Containers`
- `name`: The named container to query, matching a `container-name` on an ancestor. Omit it to match the nearest container regardless of name, same as the two-argument form. Useful once more than one ancestor establishes a container and the query needs to skip past the closest.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.at("md", u.p(6)) */
.host {
	@container (min-width: 36rem) {
		padding: calc(var(--ui-spacing, 0.25rem) * 6);
	}
}

/* u.at("md", "sidebar", u.p(6)) */
.host {
	@container sidebar (min-width: 36rem) {
		padding: calc(var(--ui-spacing, 0.25rem) * 6);
	}
}
```

**Example:**

```typescript
let result = u.at("md", [u.p(6), u.hstack({ gap: 4 })]);
let namedResult = u.at("md", "sidebar", u.p(6));
let literalResult = u.at("40rem", u.p(6));
```

The declaring and querying halves together — the ancestor names a container, the descendant queries it:

```tsx
<article mix={[u.container("card")]}>
	<div mix={[u.vstack({ gap: 2 }), u.p(4), u.at("md", "card", [u.hstack({ gap: 4 }), u.p(6)])]}>
		{children}
	</div>
</article>
```

#### `atMax(size: ContainerName | (string & {}), input: UtilityInput): UtilityMixin` (overloaded: `atMax(size: ContainerName | (string & {}), name: string, input: UtilityInput): UtilityMixin`)

The `max-width` counterpart to `at()`: a container query that applies while the queried container's inline size is at most `size`, where `at()` applies from `size` upward. Like `at()` it is a container query and never a viewport media query, so it needs an ancestor that actually establishes a container — `container()` on that ancestor, or a bare `container-type: inline-size` — otherwise the query has nothing to measure and never matches. `at()` is the mobile-first form and should stay the default: one base rule plus min-width overrides. `atMax` earns its place for the rule that only makes sense _below_ a threshold and would otherwise have to be undone at every larger size. Mixing the two is where it gets expensive — a min-width and a max-width range written against the same token overlap at the boundary, since both conditions are inclusive, so at exactly that width both blocks apply and the later one in source order wins. Keep a given property in one direction, or offset the max-width side to a distinct length (`at("md", ...)` with `atMax("36rem", ...)` still collides; `atMax("35.9375rem", ...)` does not).

**Parameters:**

- `size`: The container inline size the query compares against.
  - `xs`: `20rem`
  - `sm`: `24rem`
  - `md`: `36rem`
  - `lg`: `48rem`
  - `xl`: `64rem`
  - `2xl`: `80rem`
  - An app-extended name declared through module augmentation: resolves to `36rem`, the default length standing in until the name is added to the scale. A condition can't read a custom property, so an app-extended step can't be themed at runtime the way a property value can
  - A raw CSS length (`"40rem"`, `"640px"`): used verbatim, so a one-off breakpoint stays exactly what it was written as. Only a plain number-plus-unit length is recognized as literal — anything else is treated as a token name; reach for `atQuery()` for a condition that isn't a simple length.
- `name`: The named container to query, established on an ancestor by `container()` (or `container-name`). Omit to match the nearest container regardless of name, same as the two-argument call form. Passing a name no ancestor declares means the query never matches — it does not fall back to the nearest container.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.atMax("md", [u.p(2), u.flexCol()]) */
@container (max-width: 36rem) {
	.host {
		padding: calc(var(--ui-spacing, 0.25rem) * 2);
		flex-direction: column;
	}
}

/* u.atMax("40rem", u.flexCol()) — a literal length is used as-is */
@container (max-width: 40rem) {
	.host {
		flex-direction: column;
	}
}

/* u.atMax("md", "sidebar", u.p(4)) — targeting a named container */
@container sidebar (max-width: 36rem) {
	.host {
		padding: calc(var(--ui-spacing, 0.25rem) * 4);
	}
}
```

**Example:**

```typescript
let result = u.atMax("md", [u.p(2), u.flexCol()]);
let literalResult = u.atMax("40rem", u.flexCol());
let namedResult = u.atMax("md", "sidebar", u.p(4));
```

```tsx
<aside mix={[u.container("sidebar")]}>
	<div
		mix={[
			u.flexCol(),
			u.gap(2),
			u.atMax("sm", u.hidden()),
			u.at("md", [u.flexRow(), u.gap(4), u.p(6)]),
		]}
	/>
</aside>
```

#### `atQuery(query: string, input: UtilityInput): UtilityMixin`

The raw `@container` primitive that `at()` and `atMax()` are both sugar over, and the escape hatch for the container query neither of them can express — the same role `when()` plays behind the state wrappers and `media()` plays for viewport rules. `query` is used verbatim as the entire condition, so a named-container segment can be written straight into the string. Reach for it for conditions outside the single min/max inline-size shape the two wrappers cover: a block-size query, a compound `and`/`or` condition, a range syntax comparison, or a `style()` query. Still a container query, so it needs a container-establishing ancestor exactly like `at()` does — and note nothing validates the string, so a malformed condition simply produces an at-rule the browser drops.

**Parameters:**

- `query`: The container-query condition, without the surrounding `@container`, including the named-container segment when one is needed. Written verbatim into the at-rule: `"(min-width: 40rem)"`, `"sidebar (min-width: 40rem)"`, `"(min-height: 30rem)"`, `"(min-width: 20rem) and (max-width: 40rem)"`, `"(400px < width < 800px)"`. Required.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.atQuery("(min-width: 40rem)", u.p(6)) */
@container (min-width: 40rem) {
	.host {
		padding: calc(var(--ui-spacing, 0.25rem) * 6);
	}
}

/* u.atQuery("sidebar (min-width: 40rem)", u.p(6)) */
@container sidebar (min-width: 40rem) {
	.host {
		padding: calc(var(--ui-spacing, 0.25rem) * 6);
	}
}
```

**Example:**

```typescript
let result = u.atQuery("(min-width: 40rem)", u.p(6));
let namedResult = u.atQuery("sidebar (min-width: 40rem)", u.p(6));
let rangeResult = u.atQuery("(400px < width < 800px)", u.flexRow());
let blockResult = u.atQuery("(min-height: 30rem)", u.bs("full"));
```

```tsx
<div mix={[u.container("card", "size")]}>
	<div
		mix={[
			u.flexCol(),
			u.gap(2),
			u.atQuery("card (min-width: 30rem) and (min-height: 20rem)", [u.flexRow(), u.gap(6)]),
		]}
	/>
</div>
```

#### `contrastLess(input: UtilityInput): UtilityMixin`

Applies the given utilities when the user has asked for _less_ contrast. Sugar over `media("(prefers-contrast: less)", input)` — see that entry for the underlying escape hatch.

The counterpart to `u.contrastMore()`, for softening a rule rather than strengthening it: dropping a heavy border back to a subtle one, easing an emphasis foreground toward the muted end. Note it is far less widely honoured by platforms than `more` — several report `no-preference` even where a low-contrast setting exists — so treat anything declared here as an enhancement, never as the only place a style is set. If a rule has to apply, put it in the unwrapped baseline and use this wrapper only to adjust it.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.contrastLess(u.border("neutral")) */
.host {
	@media (prefers-contrast: less) {
		border-color: var(--ui-neutral-border);
	}
}
```

**Example:**

```typescript
let result = u.contrastLess(u.border("neutral"));
let composedResult = u.contrastLess([u.border("neutral"), u.shadow("sm")]);
```

Because it composes rather than replaces, a nested state wrapper stays nested inside the at-rule:

```typescript
let hoverResult = u.contrastLess(u.hover(u.bg("brand.tint")));
```

#### `contrastMore(input: UtilityInput): UtilityMixin`

Applies the given utilities when the user has asked for higher contrast. Sugar over `media("(prefers-contrast: more)", input)`.

Most of the time you shouldn't need it. The theme layer already promotes every tone's subtle `border` to its `border-strong` value under this query, so a call site using `u.border("neutral")` or `u.surface()` strengthens on its own — wrapping a border in this by hand usually just restates what the tones already did.

Reach for it when something _else_ needs strengthening: raising a muted foreground to full contrast, or giving a decorative divider that normally sits at low contrast enough weight to be visible at all.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.contrastMore(u.fg("neutral.emphasis")) */
.host {
	@media (prefers-contrast: more) {
		color: var(--ui-neutral-fg-emphasis);
	}
}
```

**Example:**

```typescript
let result = u.contrastMore(u.fg("neutral.emphasis"));
let composedResult = u.contrastMore([u.fg("neutral.emphasis"), u.weight("medium")]);
```

The muted-caption case — readable by default, fully contrasted on request:

```tsx
<p mix={[u.text("sm"), u.fg("neutral.muted"), u.contrastMore(u.fg("neutral.emphasis"))]}>
	{caption}
</p>
```

#### `dark(input: UtilityInput): UtilityMixin`

Applies the given utilities under dark mode, covering both a forced `.dark` ancestor class and the system `prefers-color-scheme: dark` preference read through a `.system` ancestor. Sugar over `scheme("dark", input)` — see that entry for the full selector contract.

Most of the time you shouldn't need this at all: the semantic tone layer in `theme.css` already redefines every `--ui-{tone}-*` variable under dark mode, so `u.surface("muted")` or `u.bg("brand.tint")` adapts on its own. Reach for `dark()` only when a rule needs to differ _beyond_ what the tones already handle — swapping a border weight, or a shadow that reads wrong on a dark background.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.dark(u.border("neutral.strong")) */
.host {
	.dark & {
		border-color: var(--ui-neutral-border-strong);
	}
	@media (prefers-color-scheme: dark) {
		.system & {
			border-color: var(--ui-neutral-border-strong);
		}
	}
}
```

**Example:**

```typescript
let result = u.dark(u.bg("neutral.solid"));
let borderResult = u.dark(u.border("neutral.strong"));
```

```tsx
<div
	mix={[u.surface("muted"), u.shadow("md"), u.dark([u.shadow("sm"), u.border("neutral.strong")])]}
/>
```

#### `forcedColors(input: UtilityInput): UtilityMixin`

Applies the given utilities when a forced-colors mode is active. Sugar over `media("(forced-colors: active)", input)`.

In forced-colors mode the platform replaces colors with its own limited palette, so most color declarations stop having any effect at all. That makes this the place to fix anything colour alone was carrying: restoring a border so a shape stays visible once its background is overridden, adding an underline to a link that was only distinguished by hue, or setting `forced-color-adjust` through `u.raw()` for the rare element that must keep its own colors — a colour swatch, a chart legend key.

The system color keywords (`Canvas`, `CanvasText`, `Highlight`) keep working here, which is why this package's no-argument defaults — `u.bg()`, `u.fg()`, `u.border()` — are built on those keywords and degrade gracefully without needing this wrapper at all. What needs help is a component whose structure came from a background fill rather than from a border.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.forcedColors(u.raw({ forcedColorAdjust: "none" })) */
.host {
	@media (forced-colors: active) {
		forced-color-adjust: none;
	}
}

/* u.forcedColors(u.border({ width: 1 })) */
.host {
	@media (forced-colors: active) {
		border-style: solid;
		border-width: 1px;
	}
}
```

**Example:**

```typescript
let result = u.forcedColors(u.raw({ forcedColorAdjust: "none" }));
let borderResult = u.forcedColors(u.border({ width: 1 }));
```

A solid-filled button loses its fill to the platform palette, so the border that keeps its shape readable is added back here:

```tsx
<button
	type="button"
	mix={[
		u.bg("brand.solid"),
		u.fg("brand.onSolid"),
		u.rounded("md"),
		u.p(2),
		u.forcedColors(u.border({ width: 1 })),
	]}
>
	{label}
</button>
```

#### `light(input: UtilityInput): UtilityMixin`

Applies the given utilities under light mode, covering both a forced `.light` ancestor class and the system `prefers-color-scheme: light` preference read through a `.system` ancestor. Sugar over `scheme("light", input)` — see that entry for the full selector contract.

Since light is the default rendering, this is the less common of the pair: prefer expressing the light case as the unwrapped base styles and using `u.dark()` for the deviation. Reach for `light()` when a rule must apply _only_ in light mode and would otherwise leak into dark — for instance undoing something a dark-mode branch set.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.light(u.shadow("sm")) */
.host {
	.light & {
		box-shadow: var(--ui-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
	}
	@media (prefers-color-scheme: light) {
		.system & {
			box-shadow: var(--ui-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
		}
	}
}
```

**Example:**

```typescript
let result = u.light(u.bg());
let shadowResult = u.light(u.shadow("sm"));
```

```tsx
<div mix={[u.surface("default"), u.light(u.shadow("sm")), u.dark(u.border("neutral"))]} />
```

#### `media(query: string, input: UtilityInput): UtilityMixin`

The explicit escape hatch for a real viewport or feature media query, for the rare rule that must read the viewport or a user preference rather than a container. `u.at()` covers ordinary responsive layout instead, and should be preferred: a component that queries the viewport breaks when it's placed somewhere narrower than the viewport implies.

Where it _is_ the right tool is user-preference queries, which have no container equivalent — and gating motion and transparency is the main reason this utility gets reached for.

**Parameters:**

- `query`: The media query condition, without the surrounding `@media`, used verbatim. Nothing is validated. The conditions worth knowing:
  - `"(prefers-reduced-motion: reduce)"` — the user has asked for less animation. Gate transitions and animations on this, or on its `no-preference` inverse.
  - `"(prefers-reduced-transparency: reduce)"` — the user has asked for less transparency. `u.translucent()` already gates its blur on the `no-preference` inverse.
  - `"(prefers-contrast: more)"` — the user wants higher contrast. The theme layer already promotes `border` to `border-strong` here.
  - `"(prefers-color-scheme: dark)"` / `"(prefers-color-scheme: light)"` — the system color scheme. Prefer `u.dark()`/`u.light()`, which also handle the forced-class half of the contract.
  - `"(forced-colors: active)"` — a forced-colors mode is in effect, so most colors are being overridden by the platform.
  - `"(min-width: 40rem)"`, `"(max-width: 40rem)"`, `"(orientation: portrait)"` — genuine viewport queries, for page-level layout rather than component layout
  - `"print"` — a media _type_ rather than a feature, for print-only rules
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.media("(prefers-contrast: more)", u.border("brand.strong")) */
.host {
	@media (prefers-contrast: more) {
		border-color: var(--ui-brand-border-strong);
	}
}
```

**Example:**

```typescript
let result = u.media("(prefers-contrast: more)", u.border("brand.strong"));
let printResult = u.media("print", u.hidden());
let viewportResult = u.media("(min-width: 40rem)", u.p(6));
```

The motion-gating idiom — a transition only for users who haven't asked for less:

```tsx
<div
	mix={[
		u.media(
			"(prefers-reduced-motion: no-preference)",
			u.transition("opacity, translate", { duration: 200 }),
		),
		u.hover(u.opacity(80)),
	]}
/>
```

Because it emits an at-rule rather than a selector, an `@keyframes` rule stays valid inside it — `u.media()` and `u.supports()` are the only wrappers `u.animation()` can safely be nested in.

#### `motionReduce(input: UtilityInput): UtilityMixin`

Applies the given utilities when the user has asked for less motion. Sugar over `media("(prefers-reduced-motion: reduce)", input)`.

The opposite approach to `u.motionSafe()`: animate by default, then neutralise the motion here. The usual content is `u.transitionDuration("0s")`, which cancels the duration without having to re-declare `transition-property` and `transition-timing-function`, or a swap to a non-motion property such as opacity so the state change still reads without anything moving.

Prefer `u.motionSafe()` when there is a choice. Declaring motion only inside the positive query means a missing wrapper degrades to no motion instead of to unrequested motion, and it needs no counter-rule at all; with this direction, every animated property is one you have to remember to neutralise.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.motionReduce(u.transitionDuration("0s")) */
.host {
	@media (prefers-reduced-motion: reduce) {
		transition-duration: 0s;
	}
}
```

**Example:**

```typescript
let result = u.motionReduce(u.transitionDuration("0s"));
let composedResult = u.motionReduce([u.transitionDuration("0s"), u.translateY(0)]);
```

The animate-then-neutralise shape, for when the transition genuinely has to be declared unconditionally:

```tsx
<div
	mix={[
		u.transition("opacity, translate", { duration: 200 }),
		u.motionReduce(u.transitionDuration("0s")),
		u.hover(u.opacity(80)),
	]}
/>
```

#### `motionSafe(input: UtilityInput): UtilityMixin`

Applies the given utilities only for users who have _not_ asked for less motion. Sugar over `media("(prefers-reduced-motion: no-preference)", input)`.

This is the correct default home for a transition or an animation. Because the styles inside only apply under the positive preference, the reduced-motion case is simply the unwrapped baseline — it needs no extra rule to neutralise anything, because nothing was ever declared for it. And the polarity fails safe: forgetting the wrapper entirely means no animation at all, rather than an ungated animation that ignores the preference outright.

In practice that makes it the wrapper `u.transition()` and `u.animation()` belong inside, and the fix for `u.scrollBehavior()`, which is motion and does not gate itself. Note that it emits an at-rule rather than a selector, which is what keeps an `@keyframes` rule valid inside it — `u.animation()` can be nested here safely, the same way it can inside `u.media()` and `u.supports()`. Reach for `u.motionReduce()` only when the motion has to be declared unconditionally and neutralised afterwards.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.motionSafe(u.transitionDuration("150ms")) */
.host {
	@media (prefers-reduced-motion: no-preference) {
		transition-duration: 150ms;
	}
}

/* u.motionSafe(u.scrollBehavior()) */
.host {
	@media (prefers-reduced-motion: no-preference) {
		scroll-behavior: smooth;
	}
}
```

**Example:**

```typescript
let result = u.motionSafe(u.transitionDuration("150ms"));
let transitionResult = u.motionSafe(u.transition("opacity, translate", { duration: 200 }));
let scrollResult = u.motionSafe(u.scrollBehavior());
```

The whole animated rule lives inside the wrapper, so the baseline is a plain instant state change:

```tsx
<div
	mix={[
		u.opacity(100),
		u.motionSafe(u.transition("opacity, translate", { duration: 200 })),
		u.hover([u.opacity(80), u.motionSafe(u.translateY(-2))]),
	]}
/>
```

#### `print(input: UtilityInput): UtilityMixin`

Applies the given utilities when the page is being printed or rendered to PDF. Sugar over `media("print", input)`.

`"print"` is a media _type_, not a feature query, so it is passed with no parentheses — `@media print`, never `@media (print)`. It is also the one wrapper in this family that isn't about a user preference at all: nothing here reflects a setting, only a different output medium.

The real uses: hiding interactive chrome that means nothing on paper — navigation, buttons, sticky bars, a scroll container's own affordances — forcing a light surface so a dark theme doesn't print as a solid block of ink, and expanding a truncated or line-clamped block back to its full height so no content is silently cut off at the edge of the page.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.print(u.hidden()) */
.host {
	@media print {
		display: none;
	}
}
```

**Example:**

```typescript
let result = u.print(u.hidden());
let surfaceResult = u.print([u.bg(), u.fg()]);
let expandResult = u.print(u.raw({ WebkitLineClamp: "unset", overflow: "visible" }));
```

Chrome disappears and the clamped body opens up, so the printed page carries the content and nothing else:

```tsx
<article mix={[u.vstack({ gap: 4 })]}>
	<nav mix={[u.hstack({ gap: 2 }), u.print(u.hidden())]}>{actions}</nav>
	<div mix={[u.lineClamp(3), u.print(u.raw({ WebkitLineClamp: "unset", overflow: "visible" }))]}>
		{body}
	</div>
</article>
```

`u.lineClamp()` only takes a line count, so undoing it is one of the cases `u.raw()` exists for.

#### `scheme(mode: "dark" | "light", input: UtilityInput): UtilityMixin`

The color-scheme wrapper for light and dark mode rules — not a direct `color-scheme` property utility. It applies the given utilities under both halves of the theme's dark-mode contract: a forced `.dark`/`.light` ancestor class, and system preference through a `.system` ancestor class gated behind the matching `prefers-color-scheme` media query. Emitting both keeps forced and system modes rendering identically, which is the whole reason to use this rather than a hand-written `prefers-color-scheme` query — a bare media query would ignore a user who has explicitly forced a mode.

The contract's other half lives in the markup: an ancestor (typically `<html>`) carries `.dark`/`.light` to force a mode, or `.system` to follow the OS preference. With neither class present, neither branch matches and only the unwrapped base styles apply.

Composes `u.when()` for the class selectors and `u.media()` for the system-preference gate, with no hand-built selector or at-rule of its own. `u.dark()` and `u.light()` are sugar over it and are what call sites normally reach for; use `scheme()` directly when `mode` is computed rather than literal.

**Parameters:**

- `mode`: Which color scheme the rule targets.
  - `"dark"` — matches a `.dark` ancestor, or a `.system` ancestor under `prefers-color-scheme: dark`
  - `"light"` — matches a `.light` ancestor, or a `.system` ancestor under `prefers-color-scheme: light`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.scheme("dark", u.bg("neutral.solid")) */
.host {
	.dark & {
		background-color: var(--ui-neutral-bg-solid);
	}
	@media (prefers-color-scheme: dark) {
		.system & {
			background-color: var(--ui-neutral-bg-solid);
		}
	}
}
```

**Example:**

```typescript
let result = u.scheme("dark", u.bg("neutral.solid"));

// Useful directly when the mode is a value rather than a literal
let computedResult = u.scheme(preferredScheme, u.border("neutral.strong"));
```

Note that the selectors are ancestor-based (`.dark &`), so the styles apply to the host based on a class _above_ it — putting `.dark` on the same element the mixin is applied to will not match.

#### `startingStyle(input: UtilityInput): UtilityMixin`

Wraps the given utilities in `@starting-style`, declaring the values a transition should animate _from_ on the element's very first style update. A transition needs a previous value to interpolate between, and on first render — or on entry from `display: none`, or into the top layer — there isn't one, so an entry animation simply snaps to its end state; the values declared here supply that missing starting point. Unlike `media()`, `at()`, and `supports()` the at-rule takes no condition, so this wrapper takes nothing but the wrapped input. For a popover or dialog it pairs with `transitionBehavior("allow-discrete")`: the properties that take the element out of the flow (`display`, plus `overlay` for top-layer elements) are discrete and not animatable at all by default, and `allow-discrete` is what keeps the element rendered and in the top layer for the transition's duration, so there is something on screen for the `@starting-style` values to animate away from. Only affects entry — an exit transition runs from the element's current values and needs no `@starting-style` block, just the same `allow-discrete` behavior so the removal is deferred until the transition finishes.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped. Only declarations that the element also transitions have any effect — a property inside this block that isn't named in `transition()` has no starting value to interpolate toward and is ignored.

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.startingStyle(u.opacity(0)) */
@starting-style {
	.host {
		opacity: 0;
	}
}

/* u.startingStyle([u.opacity(0), u.scaleProperty(0.95)]) */
@starting-style {
	.host {
		opacity: 0;
		scale: 0.95;
	}
}
```

**Example:**

```typescript
let result = u.startingStyle(u.opacity(0));
let popoverEntry = [
	u.opacity(100),
	u.transition("opacity, display, overlay", { duration: 200 }),
	u.transitionBehavior("allow-discrete"),
	u.startingStyle(u.opacity(0)),
];
```

```tsx
<div
	popover="auto"
	mix={[
		u.opacity(0),
		u.transition("opacity, display, overlay", { duration: 150 }),
		u.transitionBehavior("allow-discrete"),
		u.open([u.opacity(100), u.startingStyle(u.opacity(0))]),
	]}
/>
```

#### `supports(query: string, input: UtilityInput): UtilityMixin`

A feature-query wrapper, applying the given utilities only when the browser supports `query` — progressive enhancement for CSS features with no reliable fallback other than "don't apply this at all". Use it when applying the declaration unconditionally would either be ignored harmlessly (in which case you don't need this) or leave the element visibly broken (in which case you do).

Some utilities already gate themselves and shouldn't be wrapped again: `u.corner()` and `u.squircle()` come with their own `@supports (corner-shape: ...)` block.

**Parameters:**

- `query`: The feature-query condition, without the surrounding `@supports`, used verbatim. Nothing is validated. It takes CSS's full feature-query grammar:
  - a property/value pair in parentheses — `"(corner-shape: squircle)"`, `"(backdrop-filter: blur(1px))"`
  - a negation — `"not (corner-shape: squircle)"`, for the fallback branch
  - a conjunction or disjunction — `"(display: grid) and (gap: 1rem)"`, `"(a: b) or (c: d)"`
  - a selector test — `"selector(&:popover-open)"`
  - a function test — `"font-tech(color-COLRv1)"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.supports("(backdrop-filter: blur(1px))", u.backdropBlur("md")) */
.host {
	@supports (backdrop-filter: blur(1px)) {
		--ui-backdrop-blur: var(--ui-blur-md, 12px);
		backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
			contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
			hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
			opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
			sepia(var(--ui-backdrop-sepia, 0))
			drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
		-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
			brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
			grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
			invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
			saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
			drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	}
}
```

Wrapping a utility that already self-gates simply nests one `@supports` inside another — harmless, but redundant:

```css
/* u.supports("(corner-shape: squircle)", u.corner("squircle")) — the redundant case */
.host {
	@supports (corner-shape: squircle) {
		@supports (corner-shape: squircle) {
			corner-shape: squircle;
		}
	}
}
```

**Example:**

```typescript
let result = u.supports("(corner-shape: squircle)", u.corner("squircle"));
let notResult = u.supports("not (backdrop-filter: blur(1px))", u.bg("neutral.tint"));
let selectorResult = u.supports("selector(&:popover-open)", u.open(u.opacity(100)));
```

The two-branch pattern — an enhanced version where supported, a solid fallback where not:

```tsx
<div
	mix={[
		u.supports("(backdrop-filter: blur(1px))", u.translucent("md")),
		u.supports("not (backdrop-filter: blur(1px))", u.bg("neutral.tint")),
	]}
/>
```

Like `u.media()`, it emits an at-rule rather than a selector, so an `@keyframes` rule stays valid inside it — `u.supports()` and `u.media()` are the only wrappers `u.animation()` can safely be nested in.

#### `transparencyReduce(input: UtilityInput): UtilityMixin`

Applies the given utilities when the user has asked for less transparency. Sugar over `media("(prefers-reduced-transparency: reduce)", input)`.

The inverse of `u.transparencySafe()`, for supplying a solid fallback explicitly — an opaque background, a stronger border — when the styles that would otherwise have carried the surface are only declared inside the no-preference branch. Usually you don't need it: `u.translucent()` already sets a solid `u.bg()` unconditionally and only gates the blur, so the fallback is the baseline. Reach for this when the translucent version was hand-assembled and the reduced case would otherwise be left with nothing behind the content.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.transparencyReduce(u.bg()) */
.host {
	@media (prefers-reduced-transparency: reduce) {
		background-color: var(--ui-bg, Canvas);
	}
}
```

**Example:**

```typescript
let result = u.transparencyReduce(u.bg());
let composedResult = u.transparencyReduce([u.bg(), u.border("neutral.strong")]);
```

The two-branch shape, each preference getting the surface it needs:

```tsx
<header
	mix={[
		u.sticky(),
		u.insBs(0),
		u.transparencySafe([u.backdropBlur("md"), u.backdropSaturate(1.4)]),
		u.transparencyReduce(u.bg()),
		u.p(3),
	]}
/>
```

#### `transparencySafe(input: UtilityInput): UtilityMixin`

Applies the given utilities only for users who have _not_ asked for less transparency. Sugar over `media("(prefers-reduced-transparency: no-preference)", input)`.

This is the exact gate `u.translucent()` applies internally, exposed for the case where other translucency-dependent styles need to sit behind the same condition. It matters specifically for `u.backdropBlur()` and `u.backdropSaturate()`, which are ungated primitives: composing either one directly alongside `u.translucent()` would leave a reduced-transparency user with the saturation still applied but no blur behind it — a see-through, over-saturated surface, which is worse than either the translucent or the solid version.

Note the two utilities both write the shared composite `backdropFilter` declaration, so putting them in the same branch combines blur and saturation rather than one overwriting the other.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**CSS:**

```css
/* u.transparencySafe(u.backdropSaturate(1.4)) */
.host {
	@media (prefers-reduced-transparency: no-preference) {
		--ui-backdrop-saturate: 1.4;
		backdrop-filter: blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1))
			contrast(var(--ui-backdrop-contrast, 1)) grayscale(var(--ui-backdrop-grayscale, 0))
			hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) invert(var(--ui-backdrop-invert, 0))
			opacity(var(--ui-backdrop-opacity, 1)) saturate(var(--ui-backdrop-saturate, 1))
			sepia(var(--ui-backdrop-sepia, 0))
			drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
		-webkit-backdrop-filter: blur(var(--ui-backdrop-blur, 0px))
			brightness(var(--ui-backdrop-brightness, 1)) contrast(var(--ui-backdrop-contrast, 1))
			grayscale(var(--ui-backdrop-grayscale, 0)) hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))
			invert(var(--ui-backdrop-invert, 0)) opacity(var(--ui-backdrop-opacity, 1))
			saturate(var(--ui-backdrop-saturate, 1)) sepia(var(--ui-backdrop-sepia, 0))
			drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent));
	}
}
```

**Example:**

```typescript
let result = u.transparencySafe(u.backdropSaturate(1.4));
let composedResult = u.transparencySafe([u.backdropBlur("md"), u.backdropSaturate(1.4)]);
```

The fix: `u.translucent()` gates its own blur, so the extra saturation has to be put behind the same gate rather than applied beside it — otherwise a reduced-transparency user gets the saturation with no blur.

```tsx
<header
	mix={[
		u.sticky(),
		u.insBs(0),
		u.z(10),
		u.translucent("md"),
		u.transparencySafe(u.backdropSaturate(1.4)),
		u.p(3),
	]}
/>
```

Written the wrong way — `u.backdropSaturate(1.4)` sitting ungated next to `u.translucent("md")` — the saturation applies to every user while the blur applies to only some of them.

### Animation

#### `animation(name: string, config: AnimationConfig): UtilityMixin` (overloaded: `animation(config: AnimationConfig): UtilityMixin`)

Composes `u.keyframes()` with the host `animation-*` declarations that reference it, emitting both in one mixin. It introduces no animation opinions of its own — no fade, slide, scale, spin, or shimmer recipes — only keyframe emission and declaration composition.

Two call shapes. The named form, `animation(name, config)`, emits the `@keyframes` rule under the given `name`, which is what you want when the name should be recognizable in devtools. The unnamed form, `animation(config)`, derives a stable name from the keyframe content (`ui-anim-{hash}`), so identical `keyframes` content always produces the identical name — use it for one-off animations that don't need a debuggable name.

Because it emits an `@keyframes` rule, it must stay at a mixin's own top level or inside `u.media()`/`u.supports()`. Passing it through `u.when()` or any state wrapper nests the at-rule under a selector and produces broken CSS — reach for a sibling `u.keyframes()` plus `u.animationHost()` in that case.

**Parameters:**

- `name`: (named form only) The name to emit the `@keyframes` rule under and reference in `animation-name`
- `config.keyframes`: The keyframe steps, passed through to `u.keyframes()` — a map of offsets (`from`, `to`, or percentage keys like `"50%"`) to their styles. Required.
- `config.duration`: The value applied as `animation-duration`, as a raw CSS time string (`"150ms"`, `"1s"`). Required, and string-only — a bare number is not accepted here, unlike `u.transition()`'s `duration` option.
- `config.easing`: Applied as `animation-timing-function` (`"ease-out"`, `"linear"`, a `cubic-bezier(...)` or `steps(...)` value). Omitted when not given, leaving CSS's default `ease`.
- `config.delay`: Applied as `animation-delay` — a CSS time string (`"150ms"`, `"0.3s"`), which may be negative to start the animation part-way through instead of waiting. Omitted when not given, leaving CSS's default `0s`. Use this key when the same call declares the animation, and `u.animationDelay()` when the delay has to override an animation declared elsewhere.
- `config.iterationCount`: Applied as `animation-iteration-count` — a number, or `"infinite"`. Omitted when not given, leaving CSS's default of `1`. This is the one field checked for `undefined` rather than truthiness, so an explicit `0` is honored and emitted.
- `config.direction`: Applied as `animation-direction` — `"normal"`, `"reverse"`, `"alternate"`, or `"alternate-reverse"`. Omitted when not given, leaving CSS's default `normal`.
- `config.fillMode`: Applied as `animation-fill-mode` — `"none"`, `"forwards"`, `"backwards"`, or `"both"`. Omitted when not given, leaving CSS's default `none`, which snaps the element back to its unanimated style when the animation ends.
- `config.timeline`: Applied as `animation-timeline` — `"scroll()"`, `"view()"`, or a named `--custom-timeline`, for a scroll-driven rather than time-driven animation. Omitted when not given, leaving CSS's default `auto`.
- `config.range`: Applied as `animation-range` — e.g. `"entry 0% cover 40%"`, which portion of a scroll timeline the animation spans. Only meaningful alongside `timeline`. Omitted when not given.

**Returns:**

- A `UtilityMixin` that emits the `@keyframes` rule together with the host `animation-name`, `animation-duration`, and whichever optional declarations the config supplies

**CSS:**

```css
/* u.animation("fade-in", { keyframes: { from: { opacity: 0 }, to: { opacity: 1 } }, duration: "150ms", easing: "ease-out" }) */
@keyframes fade-in {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
.host {
	animation-name: fade-in;
	animation-duration: 150ms;
	animation-timing-function: ease-out;
}
```

The unnamed form emits the same thing under a content-derived name:

```css
/* u.animation({ keyframes: { from: { opacity: 0 }, to: { opacity: 1 } }, duration: "150ms" }) */
@keyframes ui-anim-1ywsxra {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
.host {
	animation-name: ui-anim-1ywsxra;
	animation-duration: 150ms;
}
```

And with a delay, which lands as its own declaration alongside the rest:

```css
/* u.animation("fade-in", { keyframes: { from: { opacity: 0 }, to: { opacity: 1 } }, duration: "150ms", delay: "150ms" }) */
@keyframes fade-in {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
.host {
	animation-name: fade-in;
	animation-duration: 150ms;
	animation-delay: 150ms;
}
```

**Example:**

```typescript
let named = u.animation("fade-in", {
	keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
	duration: "150ms",
	easing: "ease-out",
});

// Unnamed form — the name is generated from the keyframes content
let unnamed = u.animation({
	keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
	duration: "150ms",
	easing: "ease-out",
});

let delayedResult = u.animation("fade-in", {
	keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
	duration: "150ms",
	delay: "150ms",
});

let loopResult = u.animation("spin", {
	keyframes: { from: { rotate: "0deg" }, to: { rotate: "360deg" } },
	duration: "1s",
	easing: "linear",
	iterationCount: "infinite",
});

let scrollResult = u.animation("reveal", {
	keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
	duration: "auto",
	timeline: "view()",
	range: "entry 0% cover 40%",
	fillMode: "both",
});
```

An animation is motion, so gate it on the user's preference rather than running it unconditionally:

```tsx
<div
	mix={[
		u.media(
			"(prefers-reduced-motion: no-preference)",
			u.animation("fade-in", {
				keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
				duration: "150ms",
			}),
		),
	]}
/>
```

#### `animationDelay(value?: string): UtilityMixin`

Applies `animation-delay`, offsetting when the host's animation starts relative to when it was applied. String-only: a delay is a `<time>`, so it always carries a unit (`"150ms"`, `"0.3s"`) and there is no scale for a bare number to be looked up in.

`u.animation()` already takes a `delay` key, and that is the one to reach for when the same call declares the animation. This standalone exists for the other case: overriding the delay of an animation declared _elsewhere_. The usual shape is a wrapper staggering its children — one shared `u.animation()` call supplies the `@keyframes`, duration, and easing, while each item shifts only its own start time by index. The delay is per element, so the animation itself stays a single declaration and only the offset varies.

A **negative** delay does not wait, it seeks. The animation starts immediately, already advanced by that much of its duration, so `-500ms` on a `1s` animation begins half-way through. That is how a looping animation is seeded as "already in progress" rather than snapping in from its first keyframe, and it is also why a negative delay makes an entry animation appear to skip its opening frames.

**Parameters:**

- `value`: The delay, as a raw CSS `<time>` string. Defaults to `"0s"`, so a bare `u.animationDelay()` explicitly writes out no delay rather than emitting nothing.
  - A positive time (`"150ms"`, `"0.3s"`) — the animation waits that long before its first frame
  - A negative time (`"-500ms"`) — the animation starts at once, already that far into its own timeline
  - A computed string (`` `${index * 60}ms` ``) — the staggering case this utility is for

**Returns:**

- A `UtilityMixin` that sets `animation-delay`, and nothing else — never `animation-name` or `animation-duration`

**CSS:**

```css
/* u.animationDelay("150ms") */
.host {
	animation-delay: 150ms;
}

/* u.animationDelay() */
.host {
	animation-delay: 0s;
}

/* u.animationDelay("-500ms") — seeks half a second in instead of waiting */
.host {
	animation-delay: -500ms;
}
```

**Example:**

```typescript
let result = u.animationDelay("150ms");
let defaultResult = u.animationDelay();
let staggeredResult = u.animationDelay(`${index * 60}ms`);
let seekedResult = u.animationDelay("-500ms");
```

The staggered list it exists for — one animation declared once per item, and only the start time varying by index:

```tsx
<ul mix={[u.vstack({ gap: 2 })]}>
	{items.map((item, index) => (
		<li
			key={item.id}
			mix={[
				u.motionSafe([
					u.animation("ui-item-in", {
						keyframes: {
							from: { opacity: 0, translate: "0 4px" },
							to: { opacity: 1, translate: "0 0" },
						},
						duration: "200ms",
						easing: "ease-out",
						fillMode: "both",
					}),
					u.animationDelay(`${index * 60}ms`),
				]),
			]}
		>
			{item.label}
		</li>
	))}
</ul>
```

#### `animationHost(name: string, config: Omit<AnimationConfig, "keyframes">): UtilityMixin`

Emits just the host `animation-*` declarations that `u.animation()` would, with no accompanying `@keyframes` rule — it is the primitive `u.animation()` is sugar over, splitting the half that _references_ an animation from the half that _defines_ it. Reach for it whenever the keyframes are emitted somewhere else: by a sibling `u.keyframes()` call in the same `mix` array, or by a global stylesheet that already owns the name. Nothing verifies that a matching `@keyframes` rule exists, so a typo in `name` fails silently — the element simply never animates.

It is also the only correct way to gate a running animation behind a selector. `u.when("&[data-busy]", ...)` must never wrap a `u.keyframes()` utility: an `@keyframes` rule only hoists to the stylesheet root from a mixin's own top level (or from inside `u.media()`/`u.supports()`, which are safe), so nesting one under a selector produces broken CSS. Keep the keyframes at the top level of the `mix` array and pass only `animationHost` through the wrapper.

**Parameters:**

- `name`: The animation name written to `animationName`, matching whatever emits the `@keyframes` rule. Required.
- `config`: An `AnimationConfig` minus its `keyframes` field. Only `duration` is required; every optional field below is **omitted from the output entirely** when not given, leaving the platform default in place rather than writing it out.
  - `config.duration`: Required. Applied verbatim as `animationDuration` — a CSS time string (`"1s"`, `"150ms"`) or `"auto"` when a scroll/view timeline drives the progress instead. Not a number; unlike `u.transition()`'s `duration`, a bare number is not accepted.
  - `config.easing`: Applied as `animationTimingFunction` (`"linear"`, `"ease-out"`, `"cubic-bezier(...)"`, `"steps(4, end)"`). Platform default `ease` when omitted.
  - `config.iterationCount`: `string | number`, applied as `animationIterationCount` — `"infinite"` for a loop, or a count like `2` (numbers are passed through unconverted). Platform default `1`. This is the one field checked with `!== undefined`, so an explicit `0` is honored rather than dropped.
  - `config.direction`: Applied as `animationDirection` — `"normal"`, `"reverse"`, `"alternate"`, or `"alternate-reverse"`. Platform default `"normal"`.
  - `config.fillMode`: Applied as `animationFillMode` — `"forwards"` to hold the final frame, `"backwards"` to apply the first frame during any delay, `"both"` for both, `"none"` for neither. Platform default `"none"`.
  - `config.timeline`: Applied as `animationTimeline` — `"scroll()"` to drive progress from a scroll container, `"view()"` from the element's own visibility, or a named `--custom-timeline`. Platform default `"auto"` (the document's monotonic time).
  - `config.range`: Applied as `animationRange`, meaningful only alongside `timeline` — e.g. `"entry 0% cover 40%"`. Platform default `"normal"`.
  - There is no `delay` and no `playState` field; set `animation-delay` or `animation-play-state` through a plain `css()` call if you need them.

**Returns:**

- A `UtilityMixin` that sets `animationName` and `animationDuration` plus whichever optional declarations were given, and no `@keyframes` rule.

**CSS:**

```css
/* u.animationHost("ui-fade", { duration: "150ms" }) — minimal form */
.host {
	animation-name: ui-fade;
	animation-duration: 150ms;
}

/* u.animationHost("ui-spin", {
     duration: "1s", easing: "linear", iterationCount: "infinite",
     direction: "alternate", fillMode: "both",
     timeline: "view()", range: "entry 0% cover 40%",
   }) — every field given */
.host {
	animation-name: ui-spin;
	animation-duration: 1s;
	animation-timing-function: linear;
	animation-iteration-count: infinite;
	animation-direction: alternate;
	animation-fill-mode: both;
	animation-timeline: view();
	animation-range: entry 0% cover 40%;
}

/* Gated through u.when() — the keyframes stay at the root, only the host
   declarations are nested, which is the whole reason this utility exists */
@keyframes ui-spin-rotate {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}
.host[data-busy] {
	animation-name: ui-spin-rotate;
	animation-duration: 1s;
	animation-iteration-count: infinite;
}
```

**Example:**

```typescript
let result = u.animationHost("ui-fade", { duration: "150ms" });

let loopResult = u.animationHost("ui-spin-rotate", {
	duration: "1s",
	easing: "linear",
	iterationCount: "infinite",
});

let heldResult = u.animationHost("ui-fade", {
	duration: "150ms",
	easing: "ease-out",
	fillMode: "forwards",
});

// Scroll-driven: the timeline supplies progress, so duration is "auto"
let scrollDrivenResult = u.animationHost("ui-reveal", {
	duration: "auto",
	timeline: "view()",
	range: "entry 0% cover 40%",
});
```

```tsx
// The keyframes are defined once at the top level of the mix array; only the
// host half is gated behind the attribute, so the spinner runs while busy.
<button
	mix={[
		u.keyframes("ui-spin-rotate", {
			from: { transform: "rotate(0deg)" },
			to: { transform: "rotate(360deg)" },
		}),
		u.when(
			"&[data-busy]",
			u.animationHost("ui-spin-rotate", {
				duration: "1s",
				easing: "linear",
				iterationCount: "infinite",
			}),
		),
		u.p(4),
	]}
	data-busy={isBusy ? "" : undefined}
>
	{label}
</button>
```

```tsx
// Referencing a name a global stylesheet already owns — no u.keyframes() here,
// so u.animation() would be the wrong tool: it would re-emit the rule.
<div mix={[u.animationHost("app-shimmer", { duration: "1.5s", iterationCount: "infinite" })]} />
```

#### `keyframes(name: string, frames: Record<string, CSSStyles>): UtilityMixin`

Emits an `@keyframes` rule under `name` and nothing else — it never sets `animation-name`, `animation-duration`, or any other host declaration, so on its own it makes nothing move. Pair it with `u.animationHost()` (or a plain `css()` call) to actually run it, or reach for `u.animation()` when both halves can be emitted together.

The reason to split the two halves is nesting: an `@keyframes` rule only hoists to the stylesheet root from a mixin's own top level, or from inside `u.media()`/`u.supports()`. Putting `u.animation()` inside `u.when()` or a state wrapper nests the at-rule under a selector and emits invalid CSS. Keeping `keyframes()` at the top level while a sibling `u.animationHost()` sits inside the wrapper is the way to gate an animation behind a selector.

**Parameters:**

- `name`: The name the `@keyframes` rule is emitted under. Nothing cross-checks it against the name a host declaration references, so a typo fails silently — the element simply doesn't animate.
- `frames`: The keyframe steps mapped to their styles. Keys are CSS keyframe selectors: `from` and `to`, percentage offsets (`"0%"`, `"50%"`, `"100%"`), or a comma-separated list of offsets (`"0%, 100%"`). Values are ordinary `CSSStyles` objects.

**Returns:**

- A `UtilityMixin` that emits the `@keyframes` rule, with no host declarations

**CSS:**

```css
/* u.keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } }) */
@keyframes fade-in {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
```

**Example:**

```typescript
let result = u.keyframes("fade-in", {
	from: { opacity: 0 },
	to: { opacity: 1 },
});

let pulseResult = u.keyframes("pulse", {
	"0%, 100%": { opacity: 1 },
	"50%": { opacity: 0.4 },
});
```

The split-halves pattern — keyframes at the top level, the host declarations gated behind a selector:

```tsx
<button
	mix={[
		u.keyframes("spin", { from: { rotate: "0deg" }, to: { rotate: "360deg" } }),
		u.data("busy", u.animationHost("spin", { duration: "1s", iterationCount: "infinite" })),
	]}
/>
```

#### `scrollTimelineName(name: string): UtilityMixin`

Applies `scroll-timeline-name`, naming a scroll progress timeline driven by how far the host has been scrolled. It goes on the _scroll container_ itself — the element that actually overflows — so it needs an `overflow` value that scrolls (see `u.overflow()`) or it supplies no progress at all. The timeline runs from 0% at the scroll start position to 100% at the end.

This is the _declaring_ half of a named timeline, the same declaring/referencing split `u.anchorName()` and `u.positionAnchor()` solve for anchor positioning. `u.animation()`'s `timeline` option already accepts the _anonymous_ `"scroll()"`, which walks up to the animating element's own nearest scrolling ancestor. Declare a name here when the animating element lives outside that container — a progress bar in a header, a marker in a sidebar — so it can point at a specific scroller instead of whichever one happens to be above it.

The referencing half is `u.animation({ timeline: "--{name}" })`. An `animation-timeline` name is a bare **dashed-ident**, so the reference is the literal `--`-prefixed name and **not** a `var()` call: `u.var("page-scroll")` emits `var(--page-scroll)`, which substitutes the _value_ of a custom property rather than naming a timeline, and the animation then silently falls back to the document timeline — it still runs, just on the clock, which is a maddening bug to read back from the rendered result. Write `timeline: "--page-scroll"`.

**Parameters:**

- `name`: The timeline name, written **without** the leading `--` — the utility prepends it, mirroring the convention `u.anchorName()`, `u.vars()`, and `u.var()` already use, since a timeline name is a dashed-ident just like a custom property.

**Returns:**

- A `UtilityMixin` that sets `scroll-timeline-name` to `--{name}`

**CSS:**

```css
/* u.scrollTimelineName("page-scroll") */
.host {
	scroll-timeline-name: --page-scroll;
}

/* u.scrollTimelineName("log") */
.host {
	scroll-timeline-name: --log;
}
```

**Example:**

```typescript
let result = u.scrollTimelineName("page-scroll");
let logResult = u.scrollTimelineName("log-scroll");
```

The scroller declares the name; a descendant references it as a bare dashed-ident, with `duration: "auto"` so progress comes from the timeline rather than the clock:

```tsx
<div mix={[u.overflow("auto"), u.maxBs("24rem"), u.scrollTimelineName("log-scroll"), u.relative()]}>
	<div
		mix={[
			u.sticky(),
			u.insTop(0),
			u.bs(2),
			u.bg("brand.solid"),
			u.transformOrigin("left"),
			u.motionSafe(
				u.animation("ui-log-progress", {
					keyframes: { from: { scale: "0 1" }, to: { scale: "1 1" } },
					duration: "auto",
					timeline: "--log-scroll",
					fillMode: "both",
				}),
			),
		]}
	/>
	{lines.map((line) => (
		<p key={line.id}>{line.text}</p>
	))}
</div>
```

For an animating element outside the scroller's subtree, the name is invisible on its own — raise it with `u.timelineScope()` on a common ancestor.

#### `timelineScope(...names: string[]): UtilityMixin`

Applies `timeline-scope`, widening where one or more named timelines can be seen. This is the piece scroll-driven animations get stuck on: a timeline name declared by `u.scrollTimelineName()` or `u.viewTimelineName()` is only visible to the declaring element's own descendants and its later siblings. An animation on an element _outside_ that subtree — an earlier sibling, an ancestor, a cousin — resolves the name to nothing and silently falls back to the document timeline. Naming the timeline on a common ancestor with this utility raises its visibility to that ancestor's whole subtree, so the declaring element and the animating one are both inside it.

The classic case is a reading-progress bar in a page header driven by a scroller that comes later in the document. The header is an _earlier_ sibling, so it can never see the scroller's name on its own; put `u.timelineScope("page-scroll")` on the element wrapping both, and the bar's `u.animation({ timeline: "--page-scroll", duration: "auto" })` resolves.

It declares scope only — it does not create a timeline. Something inside the subtree still has to declare the actual name, and if nothing does, the name resolves to an inactive timeline: the animation holds at its start rather than running. Called with no names at all it emits an empty value (`timeline-scope: ;`), which scopes nothing, so a spread that happens to be empty is inert rather than an error.

**Parameters:**

- `names`: One or more timeline names to raise into the host's subtree, each written **without** the leading `--` — the utility prepends it to every one and joins them with `", "`, matching the convention `u.vars()`, `u.var()`, and the declaring utilities on the other side already use. With no arguments the emitted value is the empty string.

**Returns:**

- A `UtilityMixin` that sets `timeline-scope` to the comma-separated `--`-prefixed names

**CSS:**

```css
/* u.timelineScope("page-scroll") */
.host {
	timeline-scope: --page-scroll;
}

/* u.timelineScope("page-scroll", "hero-reveal") */
.host {
	timeline-scope: --page-scroll, --hero-reveal;
}
```

**Example:**

```typescript
let result = u.timelineScope("page-scroll");
let multipleResult = u.timelineScope("page-scroll", "hero-reveal");
```

The composition that makes a progress bar in a header work against a scroller elsewhere in the page — the wrapper raises the name, the scroller declares it, the bar references it:

```tsx
<div mix={[u.vstack(), u.timelineScope("page-scroll")]}>
	<header mix={[u.sticky(), u.insTop(0), u.relative()]}>
		<span
			mix={[
				u.absolute(),
				u.insBottom(0),
				u.insLeft(0),
				u.is("100%"),
				u.bs(2),
				u.bg("brand.solid"),
				u.transformOrigin("left"),
				u.motionSafe(
					u.animation("ui-read-progress", {
						keyframes: { from: { scale: "0 1" }, to: { scale: "1 1" } },
						duration: "auto",
						timeline: "--page-scroll",
						fillMode: "both",
					}),
				),
			]}
		/>
		{title}
	</header>

	<main mix={[u.overflow("auto"), u.scrollTimelineName("page-scroll")]}>{children}</main>
</div>
```

Without the `timelineScope` on the wrapper, `--page-scroll` is declared on `<main>` and the `<header>` precedes it, so the bar would animate on the document timeline instead — it would fill once on load and never track the scroll.

#### `viewTimelineName(name: string): UtilityMixin`

Applies `view-timeline-name`, naming a view progress timeline driven by the host's own visibility within its scrollport. It goes on the element being _watched_ — the card, the section, the image — not on the scroll container and not on the element that animates.

This is the _declaring_ half of a named timeline, and it exists for the same reason `u.anchorName()` does: one element declares a name, another references it, and the referencing side alone cannot work. `u.animation()`'s `timeline` option already accepts an _anonymous_ timeline such as `"view()"`, which only ever reads the animating element's own visibility. Declare a name here when the element that animates is not the element whose visibility should drive it.

The referencing half is `u.animation({ timeline: "--{name}" })`. An `animation-timeline` name is a bare **dashed-ident**, so the reference is the literal `--`-prefixed name and **not** a `var()` call: `u.var("reveal")` emits `var(--reveal)`, which substitutes the _value_ of a custom property instead of naming a timeline, and the animation silently falls back to the document timeline. Write `timeline: "--reveal"`.

**Parameters:**

- `name`: The timeline name, written **without** the leading `--` — the utility prepends it, mirroring the convention `u.anchorName()`, `u.vars()`, and `u.var()` already use, since a timeline name is a dashed-ident just like a custom property.

**Returns:**

- A `UtilityMixin` that sets `view-timeline-name` to `--{name}`

**CSS:**

```css
/* u.viewTimelineName("reveal") */
.host {
	view-timeline-name: --reveal;
}

/* u.viewTimelineName("hero-image") */
.host {
	view-timeline-name: --hero-image;
}
```

**Example:**

```typescript
let result = u.viewTimelineName("reveal");
let heroResult = u.viewTimelineName("hero-image");
```

The watched element declares the name and a descendant animates against it, with `u.animation()`'s `range` picking which slice of the pass through the scrollport maps onto the animation, and `duration: "auto"` so the progress comes from the timeline rather than the clock:

```tsx
<article mix={[u.viewTimelineName("reveal"), u.vstack({ gap: 4 }), u.p(6)]}>
	<figure
		mix={[
			u.motionSafe(
				u.animation("ui-reveal", {
					keyframes: { from: { opacity: 0, scale: "0.96" }, to: { opacity: 1, scale: "1" } },
					duration: "auto",
					timeline: "--reveal",
					range: "entry 0% cover 40%",
					fillMode: "both",
				}),
			),
		]}
	>
		<img src={image.src} alt={image.alt} mix={[u.is("100%"), u.rounded("lg")]} />
	</figure>

	<p>{body}</p>
</article>
```

The name is only visible to this element's descendants and later siblings, so an animation anywhere else in the tree needs `u.timelineScope()` on a common ancestor to see it.

### Transform

`transform` is a single CSS property, so a naive per-function utility would silently overwrite another transform utility applied to the same element. Every _transform-function_ utility here instead sets its own CSS custom property (`--ui-translate-x`, `--ui-rotate`, ...) plus the exact same composite `transform` declaration — one fixed expression referencing every transform function's variable with an identity fallback (`0`, `0deg`, `1`). Custom properties from separate classes on the same element all apply simultaneously, so combining any number of these utilities in one `mix` array composes every function instead of the last one winning.

Six utilities in this family are _not_ part of that composition, because they set separate CSS properties rather than a function inside `transform`: `u.transformOrigin()`, `u.transformStyle()`, `u.perspective()`, and `u.perspectiveOrigin()` each set their own property outright, and `u.scaleProperty()`/`u.translateProperty()` set the standalone `scale`/`translate` properties. Those last two are worth care — they move the element _in addition to_ anything the composite `transform` does, so combining them with `u.scale()`/`u.translateX()` compounds rather than replaces.

#### `perspective(value?: number | (string & {})): UtilityMixin`

Sets how far the viewer is from the `z = 0` plane, which is what gives 3D-transformed children a vanishing point. Without it a 3D rotation has no depth cue at all: `u.rotateY(180)` reads as the element squashing horizontally and popping back, not as a card turning over. A smaller value puts the viewer closer and exaggerates the effect; a larger value flattens it.

It belongs on the **parent** of the 3D-transformed children, next to `u.transformStyle()` — not on the rotating child. Together with `u.backfaceVisibility()` on the faces, those three are the complete set a flip effect needs, and the two rotation utilities (`u.rotateX()`, `u.rotateY()`) are the only things a perspective changes the appearance of.

Unlike the rotate/scale/skew/translate utilities described above, `perspective` is its own CSS property rather than a transform function, so this utility sets it outright: it writes no `--ui-*` custom property and no composite `transform` declaration, and never joins that additive composition. A second `u.perspective()` on the same element simply overwrites the first. Note also that a perspective other than `none` makes the element a containing block for fixed-position descendants, the same way a `transform` does.

**Parameters:**

- `value`: The viewing distance. Defaults to `800`, i.e. `800px`.
  - a `number` — treated as pixels, so `400` becomes `400px` and `0` becomes `0px`. Values in the 400–1200 range read as a normal camera; below that the distortion becomes obvious.
  - a `string` — passed through unchanged, for any other length (`"50rem"`) or a `var(...)`/`calc(...)` reference. The `"none"` keyword also passes through, removing the perspective entirely and flattening the subtree's projection.

**Returns:**

- A `UtilityMixin` that sets `perspective`, and nothing else — no `--ui-*` custom property and no composite `transform` declaration.

**CSS:**

```css
/* u.perspective() */
.host {
	perspective: 800px;
}

/* u.perspective(400) */
.host {
	perspective: 400px;
}

/* u.perspective("none") */
.host {
	perspective: none;
}
```

**Example:**

```typescript
let result = u.perspective();
let closeResult = u.perspective(400);
let remResult = u.perspective("50rem");
let noneResult = u.perspective("none");
```

The parent owns the camera; the child owns the rotation:

```tsx
<div mix={[u.perspective(600), u.transformStyle()]}>
	<figure
		mix={[
			u.rounded("lg"),
			u.surface("default"),
			u.p(4),
			u.media(
				"(prefers-reduced-motion: no-preference)",
				u.transition("transform", { duration: 300 }),
			),
			u.hover(u.rotateY(-12)),
		]}
	>
		{children}
	</figure>
</div>
```

#### `perspectiveOrigin(value?: TransformOriginValue): UtilityMixin`

Moves the vanishing point that `u.perspective()` establishes, so the 3D effect can be aimed off-centre: children lean away from wherever the viewer is placed rather than always from the middle of the parent. It is the counterpart to `u.transformOrigin()` — that one moves the pivot of the child's own transform, this one moves the camera.

Set it on the same **parent** element that carries `u.perspective()`. On its own it does nothing: with no perspective there is no vanishing point to move.

It takes the same values as `u.transformOrigin()` (the `TransformOriginValue` union, raw-string escape included). Like the other three utilities in this group, `perspective-origin` is its own CSS property rather than a transform function, so it is set outright and never joins the composite `transform` composition described above.

**Parameters:**

- `value`: A `TransformOriginValue`. Defaults to `"center"`.
  - `"center"` — the camera sits over the middle of the element. CSS's own default, and the neutral choice.
  - `"top"` / `"bottom"` / `"left"` / `"right"` — a single edge keyword, centred on the other axis
  - `"top left"` / `"top right"` / `"bottom left"` / `"bottom right"` — a corner
  - any other `string` — the raw escape, passed through unchanged: a percentage pair (`"25% 75%"`), explicit lengths, or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` that sets `perspective-origin`, and nothing else — no `--ui-*` custom property and no composite `transform` declaration.

**CSS:**

```css
/* u.perspectiveOrigin() */
.host {
	perspective-origin: center;
}

/* u.perspectiveOrigin("top left") */
.host {
	perspective-origin: top left;
}

/* u.perspectiveOrigin("25% 75%") */
.host {
	perspective-origin: 25% 75%;
}
```

**Example:**

```typescript
let result = u.perspectiveOrigin();
let cornerResult = u.perspectiveOrigin("top left");
let percentResult = u.perspectiveOrigin("25% 75%");
let varResult = u.perspectiveOrigin(u.var("origin", "center"));
```

A stack of cards viewed from above, so each tips away from a camera placed near its block start:

```tsx
<ul
	mix={[u.vstack({ gap: 2 }), u.perspective(700), u.perspectiveOrigin("top"), u.transformStyle()]}
>
	{items.map((item) => (
		<li key={item.id} mix={[u.rotateX(-8), u.rounded("md"), u.surface("default"), u.p(3)]}>
			{item.label}
		</li>
	))}
</ul>
```

#### `rotate(value: AngleValue): UtilityMixin`

Rotates the element in its own 2D plane, clockwise for a positive angle. Sets `--ui-rotate` plus the shared composite `transform`, so it combines with every other transform utility instead of overwriting them.

**Parameters:**

- `value`: An `AngleValue`.
  - a `number` — treated as degrees, so `45` becomes `45deg`. Negative values rotate counter-clockwise.
  - a `string` — passed through unchanged, for any other CSS angle unit: `"0.25turn"`, `"1.5rad"`, `"100grad"`, or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` setting `--ui-rotate` and the composite `transform`

**CSS:**

```css
/* u.rotate(45) */
.host {
	--ui-rotate: 45deg;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.rotate(45);
let negativeResult = u.rotate(-90);
let turnResult = u.rotate("0.25turn");
```

Rotation is the usual way to point a disclosure caret, and it composes with a transition:

```tsx
<svg
	mix={[u.is(4), u.bs(4), u.transition("transform"), u.data("expanded", u.rotate(90))]}
	aria-hidden="true"
>
	<path mix={[u.fill("currentColor")]} d="..." />
</svg>
```

Because a transform other than `none` creates a stacking context and a containing block for fixed-position descendants, rotating an element changes how its absolutely positioned children anchor.

#### `rotateX(value: AngleValue): UtilityMixin`

Rotates the element in 3D around its horizontal axis, tipping its top edge toward or away from the viewer — the motion of a flip card or a page turn. Sets `--ui-rotate-x` plus the shared composite `transform`.

A 3D rotation only looks like depth if an ancestor establishes a perspective; without one the element just appears to squash vertically. Pair it with `u.backfaceVisibility()` on the faces so the reversed side doesn't show through mid-rotation.

**Parameters:**

- `value`: An `AngleValue`.
  - a `number` — treated as degrees, so `180` becomes `180deg`, a full flip
  - a `string` — passed through unchanged: `"0.5turn"`, `"3.14rad"`, or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` setting `--ui-rotate-x` and the composite `transform`

**CSS:**

```css
/* u.rotateX(180) */
.host {
	--ui-rotate-x: 180deg;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.rotateX(180);
let partialResult = u.rotateX(-15);
```

```tsx
<div mix={[u.relative(), u.transformStyle(), u.perspective(600)]}>
	<div
		mix={[
			u.backfaceVisibility(),
			u.transition("transform", { duration: 400 }),
			u.data("flipped", u.rotateX(180)),
		]}
	>
		{front}
	</div>
</div>
```

#### `rotateY(value: AngleValue): UtilityMixin`

Rotates the element in 3D around its vertical axis, swinging its leading edge toward or away from the viewer — the other half of a flip-card or page-turn effect. Sets `--ui-rotate-y` plus the shared composite `transform`.

As with `u.rotateX()`, it needs an ancestor perspective to read as depth rather than a horizontal squash, and pairs with `u.backfaceVisibility()`.

**Parameters:**

- `value`: An `AngleValue`.
  - a `number` — treated as degrees, so `180` becomes `180deg`
  - a `string` — passed through unchanged: `"0.5turn"`, `"1rad"`, or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` setting `--ui-rotate-y` and the composite `transform`

**CSS:**

```css
/* u.rotateY(180) */
.host {
	--ui-rotate-y: 180deg;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.rotateY(180);
let subtleResult = u.rotateY("0.05turn");
```

The two faces of a flip card, one pre-rotated so it starts hidden:

```tsx
<div mix={[u.zstack(), u.transformStyle()]}>
	<div mix={[u.backfaceVisibility()]}>{front}</div>
	<div mix={[u.backfaceVisibility(), u.rotateY(180)]}>{back}</div>
</div>
```

#### `scale(value: ScaleValue): UtilityMixin`

Scales the element uniformly on both axes — sugar for setting `u.scaleX()` and `u.scaleY()` to the same factor in one call. Sets both `--ui-scale-x` and `--ui-scale-y` plus the shared composite `transform`.

Note this is a _factor_, not the 0-100 convention `u.opacity()` uses: `1` is unchanged, `1.05` is 5% larger, `0.95` is 5% smaller. It is also distinct from `u.scaleProperty()`, which sets the standalone CSS `scale` property instead and therefore does _not_ compose with this — applying both compounds the two scales rather than one replacing the other.

Scaling an element scales its text and borders too, so a hover-grow on a button will render its label at a non-integer size. Where only position should change, prefer `u.translateY()`.

**Parameters:**

- `value`: A `ScaleValue`.
  - a `number` — a unitless factor, emitted as-is. `1` is unchanged; a negative value mirrors the element.
  - a `string` — passed through unchanged, so a percentage (`"105%"`) or a `var(...)`/`calc(...)` reference works

**Returns:**

- A `UtilityMixin` setting both `--ui-scale-x`/`--ui-scale-y` and the composite `transform`

**CSS:**

```css
/* u.scale(1.05) */
.host {
	--ui-scale-x: 1.05;
	--ui-scale-y: 1.05;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.scale(1.05);
let shrinkResult = u.scale(0.95);
let percentResult = u.scale("105%");
```

```tsx
<article
	mix={[
		u.rounded("lg"),
		u.clip(),
		u.media(
			"(prefers-reduced-motion: no-preference)",
			u.transition("transform", { duration: 200 }),
		),
		u.hover(u.scale(1.02)),
	]}
>
	{children}
</article>
```

#### `scaleProperty(value: number | (string & {})): UtilityMixin`

Sets the standalone `scale` CSS property directly, rather than the `scale(...)` transform function that `u.scale()`/`u.scaleX()`/`u.scaleY()` feed into. It therefore sits outside the `--ui-*` composition mechanism described above: it writes no custom property and no composite `transform` declaration, so nothing merges its value into that expression, and a second `u.scaleProperty()` on the same element overwrites the first outright instead of combining the way two `transform`-based utilities would. Reach for it when the scale has to be transitioned or animated independently — `scale` is its own animatable property, so a hover transition on it won't fight an animation driving `transform` — or when the value is a keyword such as `"none"` that a transform function can't express.

Because `scale` and `transform` are two different properties, combining this with `u.scale()` on the same element does not overwrite anything: both apply, and the element's scaling **compounds** (`u.scaleProperty(0.95)` with `u.scale(1.5)` scales by roughly `1.425`, not `0.95` or `1.5`). That is a real trap — if you want one scale, use one mechanism.

**Parameters:**

- `value`: Required; there is no default.
  - `number`: Stringified as a unitless factor applied to both axes — `1` is unchanged, `0.95` shrinks slightly, `2` doubles.
  - `string`: The raw CSS `scale` escape hatch, passed through untouched. Covers one value (`"0.95"`, both axes), two values (`"1 1.5"`, x then y), three values (`"1 1.5 2"`, adding the z axis), the `"none"` keyword to reset, and percentages (`"95%"`).

**Returns:**

- A `UtilityMixin` that sets the `scale` property to the resolved value, and nothing else — no `--ui-*` custom property and no `transform` declaration.

**CSS:**

```css
/* u.scaleProperty(0.95) — the number is stringified, nothing else is emitted */
.host {
	scale: 0.95;
}

/* u.scaleProperty("none") */
.host {
	scale: none;
}

/* Contrast — u.scale(1.5) goes through the composite transform mechanism instead */
.host {
	--ui-scale-x: 1.5;
	--ui-scale-y: 1.5;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.scaleProperty(0.95);
let rawValueResult = u.scaleProperty("0.95");
let twoAxisResult = u.scaleProperty("1 1.5");
let resetResult = u.scaleProperty("none");
```

```tsx
// Two separate mechanisms on one element: `scale` transitions on its own while
// the composite `transform` carries the rotation. Both apply — the scaling from
// u.scaleProperty and any u.scale() would compound, so only one is used here.
<button
	mix={[
		u.scaleProperty(1),
		u.rotate(0),
		u.transition("scale", { duration: 150 }),
		u.hover(u.scaleProperty(0.97)),
		u.p(4),
	]}
>
	Press me
</button>
```

#### `scaleX(value: ScaleValue): UtilityMixin`

Scales the element along the horizontal axis only. Sets `--ui-scale-x` plus the shared composite `transform`, so it composes with `u.scaleY()` to scale each axis independently.

A negative factor mirrors the element horizontally, which is the usual way to flip an icon.

**Parameters:**

- `value`: A `ScaleValue`.
  - a `number` — a unitless factor. `1` is unchanged, `-1` mirrors horizontally.
  - a `string` — passed through unchanged, so a percentage or a `var(...)`/`calc(...)` reference works

**Returns:**

- A `UtilityMixin` setting `--ui-scale-x` and the composite `transform`

**CSS:**

```css
/* u.scaleX(1.5) */
.host {
	--ui-scale-x: 1.5;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.scaleX(1.5);
let mirrorResult = u.scaleX(-1);
```

A determinate progress bar, scaled from a custom property rather than re-rendering a width:

```tsx
<div mix={[u.is("full"), u.bs(1), u.rounded("full"), u.bg("neutral.tint"), u.clip()]}>
	<div
		mix={[
			u.bs("full"),
			u.bg("brand.solid"),
			u.transformOrigin("left"),
			u.scaleX(u.var("progress", "0")),
			u.transition("transform"),
		]}
	/>
</div>
```

#### `scaleY(value: ScaleValue): UtilityMixin`

Scales the element along the vertical axis only. Sets `--ui-scale-y` plus the shared composite `transform`, so it composes with `u.scaleX()`.

A negative factor mirrors the element vertically.

**Parameters:**

- `value`: A `ScaleValue`.
  - a `number` — a unitless factor. `1` is unchanged, `-1` mirrors vertically.
  - a `string` — passed through unchanged, so a percentage or a `var(...)`/`calc(...)` reference works

**Returns:**

- A `UtilityMixin` setting `--ui-scale-y` and the composite `transform`

**CSS:**

```css
/* u.scaleY(1.5) */
.host {
	--ui-scale-y: 1.5;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.scaleY(1.5);
let mirrorResult = u.scaleY(-1);
```

```tsx
<span mix={[u.inlineBlock(), u.scaleX(1.2), u.scaleY(0.8)]} aria-hidden="true">
	▾
</span>
```

#### `skewX(value: AngleValue): UtilityMixin`

Skews the element along the horizontal axis, sliding its top and bottom edges in opposite directions to slant it. Sets `--ui-skew-x` plus the shared composite `transform`.

Skew slants text along with the box, which reads as distortion rather than italics — for slanted type, use a real italic face via `u.font()` instead. Its honest uses are decorative: a slanted divider, a highlight shape, a hatched background.

**Parameters:**

- `value`: An `AngleValue`.
  - a `number` — treated as degrees, so `10` becomes `10deg`. Angles at or beyond `90` collapse the element.
  - a `string` — passed through unchanged: `"0.05turn"`, `"0.2rad"`, or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` setting `--ui-skew-x` and the composite `transform`

**CSS:**

```css
/* u.skewX(10) */
.host {
	--ui-skew-x: 10deg;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.skewX(10);
let counterResult = u.skewX(-10);
```

The usual trick — skew the decorative parent, counter-skew the content so the text stays upright:

```tsx
<div mix={[u.skewX(-12), u.bg("brand.solid"), u.pi(4), u.pb(2)]}>
	<span mix={[u.inlineBlock(), u.skewX(12), u.fg("brand.onSolid")]}>{label}</span>
</div>
```

#### `skewY(value: AngleValue): UtilityMixin`

Skews the element along the vertical axis, sliding its leading and trailing edges in opposite directions. Sets `--ui-skew-y` plus the shared composite `transform`.

The same caveat as `u.skewX()` applies: it distorts text, so keep it to decorative shapes.

**Parameters:**

- `value`: An `AngleValue`.
  - a `number` — treated as degrees. Angles at or beyond `90` collapse the element.
  - a `string` — passed through unchanged: `"0.05turn"`, `"0.2rad"`, or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` setting `--ui-skew-y` and the composite `transform`

**CSS:**

```css
/* u.skewY(10) */
.host {
	--ui-skew-y: 10deg;
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.skewY(10);
let counterResult = u.skewY(-3);
```

A slanted section edge, built from a skewed decorative layer rather than an image:

```tsx
<section mix={[u.relative(), u.clip()]}>
	<div mix={[u.absolute(), u.inset(0), u.skewY(-3), u.bg("neutral.tint"), u.pointerEvents()]} />
	<div mix={[u.relative(), u.p(6)]}>{children}</div>
</section>
```

#### `transformOrigin(value?: TransformOriginValue): UtilityMixin`

Sets the point every transform on the element pivots around. It is the reason `u.scaleX()` can grow a progress bar from its leading edge instead of from its middle, and the reason a menu can scale open from the corner it is anchored to instead of from its centre. Because the default is the element's centre, a scale or rotate that looks anchored to the wrong place is almost always a missing origin rather than a wrong transform.

It applies to every transform function on the element at once — the whole composite `transform` expression shares one origin — so there is nothing to compose here: one call per element, and a second overwrites the first. `transform-origin` is its own CSS property rather than a transform function, so it is set outright and never joins the additive `transform` composition described above.

The values are physical, not logical: CSS has no logical `transform-origin`, so `"left"` stays on the left under a right-to-left writing mode. An origin that has to flip under RTL cannot be expressed here directly — drive it from a custom property and pass that through the raw-string escape.

**Parameters:**

- `value`: A `TransformOriginValue`. Defaults to `"center"`.
  - `"center"` — the element's centre on both axes. CSS's own default.
  - `"top"` / `"bottom"` / `"left"` / `"right"` — a single edge keyword, centred on the other axis. `"left"` is the one that makes a horizontal progress bar grow rightward.
  - `"top left"` / `"top right"` / `"bottom left"` / `"bottom right"` — a corner, for a popover that should scale out of the edge it is anchored to
  - any other `string` — the raw escape, passed through unchanged: a percentage pair (`"25% 75%"`), explicit lengths, the three-value 3D form that also offsets the origin along the z axis (`"50% 50% 8px"`), or a `var(...)`/`calc(...)` reference

**Returns:**

- A `UtilityMixin` that sets `transform-origin`, and nothing else — no `--ui-*` custom property and no composite `transform` declaration.

**CSS:**

```css
/* u.transformOrigin() */
.host {
	transform-origin: center;
}

/* u.transformOrigin("left") */
.host {
	transform-origin: left;
}

/* u.transformOrigin("50% 50% 8px") */
.host {
	transform-origin: 50% 50% 8px;
}
```

**Example:**

```typescript
let result = u.transformOrigin();
let edgeResult = u.transformOrigin("left");
let cornerResult = u.transformOrigin("bottom right");
let threeValueResult = u.transformOrigin("50% 50% 8px");
let varResult = u.transformOrigin(u.var("origin", "center"));
```

A determinate progress bar driven by a single custom property: the origin is what makes it fill from the leading edge instead of growing out of the middle in both directions.

```tsx
<div
	mix={[u.is("full"), u.bs(1), u.rounded("full"), u.bg("neutral.tint"), u.clip()]}
	role="progressbar"
	aria-valuenow={percent}
>
	<div
		mix={[
			u.bs("full"),
			u.bg("brand.solid"),
			u.transformOrigin("left"),
			u.scaleX(u.var("progress", "0")),
			u.transition("transform"),
		]}
	/>
</div>
```

#### `transformStyle(value?: TransformStyleValue): UtilityMixin`

Keeps an element's children positioned in their own 3D space instead of flattening them into the parent's plane. It belongs on the **parent** of the 3D-transformed children, never on the rotating child itself.

CSS defaults to `flat`, which collapses the whole subtree onto one plane — that is why a `u.rotateY()` flip looks like a horizontal squash rather than a card turning over until `preserve-3d` is set on its container. This is the third piece of the 3D set: pair it with `u.perspective()` on the same parent for a vanishing point, and `u.backfaceVisibility()` on each face so the reversed side does not show through mid-rotation. `transform-style` is its own CSS property rather than a transform function, so it is set outright and never joins the additive `transform` composition described above.

The caveat worth knowing, because it breaks the effect silently rather than loudly: `preserve-3d` cannot be combined with clipping or filtering on the same element. An `overflow` other than `visible` (so `u.clip()`, `u.scroll()`, `u.truncate()`, `u.overflow()`), a `filter` (`u.blur()`), a `mask` (`u.mask()`), or an `opacity` below 1 (`u.opacity()`) each force the subtree back to `flat`. Nothing errors — the flip just goes back to looking like a squash. Move those to a wrapper or down onto the faces instead of listing them next to this utility.

**Parameters:**

- `value`: A `TransformStyleValue`. Defaults to `"preserve-3d"`.
  - `"preserve-3d"` — children keep their own positions in 3D space, so a rotated child reads as depth. The default, and what every 3D effect needs.
  - `"flat"` — children are flattened into the element's own plane. CSS's own default, and useful only to opt a subtree back out.

**Returns:**

- A `UtilityMixin` that sets `transform-style`, and nothing else — no `--ui-*` custom property and no composite `transform` declaration.

**CSS:**

```css
/* u.transformStyle() */
.host {
	transform-style: preserve-3d;
}

/* u.transformStyle("flat") */
.host {
	transform-style: flat;
}
```

**Example:**

```typescript
let result = u.transformStyle();
let flatResult = u.transformStyle("flat");
```

The complete flip card, with each of the three utilities on the element that needs it — note the rounding and clipping sit on the faces, because putting them on the `preserve-3d` parent would silently flatten the whole thing:

```tsx
<div mix={[u.perspective(800), u.transformStyle(), u.aspect(3, 2)]}>
	<div
		mix={[
			u.zstack(),
			u.bs("full"),
			u.transformStyle(),
			u.media(
				"(prefers-reduced-motion: no-preference)",
				u.transition("transform", { duration: 400 }),
			),
			u.data("flipped", u.rotateY(180)),
		]}
		data-flipped={flipped || undefined}
	>
		<div mix={[u.backfaceVisibility(), u.rounded("lg"), u.clip(), u.surface("default"), u.p(4)]}>
			{front}
		</div>
		<div
			mix={[
				u.backfaceVisibility(),
				u.rotateY(180),
				u.rounded("lg"),
				u.clip(),
				u.surface("default"),
				u.p(4),
			]}
		>
			{back}
		</div>
	</div>
</div>
```

#### `translateProperty(value: string): UtilityMixin`

Sets the standalone `translate` CSS property directly, rather than the `translate(...)` transform function that `u.translateX()`/`u.translateY()` feed into. Like `u.scaleProperty()`, it sits outside the `--ui-*` composition mechanism described above: it writes no custom property and no composite `transform` declaration, so its value never reaches that expression, and a second `u.translateProperty()` on the same element overwrites the first outright. Reach for it when the offset has to be transitioned or animated independently of whatever is driving `transform`, or when the value itself is out of `u.translateX()`'s reach — it takes the raw CSS shorthand, so percentages and two-axis offsets (the `"-50% 0"` centering trick) work, where the axis utilities resolve a spacing-scale number or a length on one axis at a time.

Because `translate` and `transform` are two different properties, combining this with `u.translateX()` on the same element does not overwrite anything: both apply and the offsets **compound** (`u.translateProperty("-50% 0")` with `u.translateX(4)` moves the element by both). Use one mechanism per element unless the compounding is what you want.

**Parameters:**

- `value`: Required; there is no default, and unlike the axis utilities there is no spacing-scale resolution — the string is passed through to CSS verbatim, which makes it the raw escape hatch for anything `u.translateX()`/`u.translateY()` can't express.
  - One offset (`"1rem"`): moves along the x axis only; y defaults to `0`.
  - Two offsets (`"-50% 0"`, `"0 -50%"`): x then y. Percentages resolve against the element's own size, which is what makes the centering trick possible.
  - Three offsets (`"0 0 2rem"`): adds a z-axis translation, which requires a perspective on an ancestor to be visible.
  - `"none"`: resets to no translation.

**Returns:**

- A `UtilityMixin` that sets the `translate` property to the given string, and nothing else — no `--ui-*` custom property and no `transform` declaration.

**CSS:**

```css
/* u.translateProperty("-50% 0") — the string passes through verbatim */
.host {
	translate: -50% 0;
}

/* u.translateProperty("none") */
.host {
	translate: none;
}

/* Contrast — u.translateX(4) resolves the spacing scale into a custom property
   and emits the composite transform instead */
.host {
	--ui-translate-x: calc(var(--ui-spacing, 0.25rem) * 4);
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.translateProperty("-50% 0");
let blockAxisResult = u.translateProperty("0 -50%");
let bothAxesResult = u.translateProperty("-50% -50%");
let resetResult = u.translateProperty("none");
```

```tsx
// The percentage centering offset belongs to `translate`; the hover lift and the
// rotation belong to the composite `transform`. They are separate mechanisms, so
// both offsets apply at once and the element ends up centered *and* lifted.
<div
	mix={[
		u.absolute(),
		u.translateProperty("-50% -50%"),
		u.rotate(2),
		u.transition("translate", { duration: 200 }),
		u.hover(u.translateY(-1)),
	]}
>
	{label}
</div>
```

#### `translateX(value: SpacingValue): UtilityMixin`

Translates the element along the inline axis using the spacing scale or a raw CSS length. Sets `--ui-translate-x` plus the shared composite `transform`.

Translation is the right tool for moving something that shouldn't disturb its neighbours: unlike a margin or an inset, it never triggers layout, so it animates cheaply and leaves the element's original space reserved. That also means the moved element can overlap siblings.

Note it is _not_ writing-mode aware despite the name: `transform` operates in physical coordinates, so a positive value always moves right, even in a right-to-left context. Where the offset should flip, drive it from a custom property or reach for a logical inset instead.

**Parameters:**

- `value`: A `SpacingValue`.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`. Negative values move the element toward the inline start.
  - a raw CSS length (`"2px"`, `"50%"`, `"1.5rem"`) — passed through unchanged. A percentage resolves against the element's _own_ inline size, which is what makes the `"-50%"` centering trick work.

**Returns:**

- A `UtilityMixin` setting `--ui-translate-x` and the composite `transform`

**CSS:**

```css
/* u.translateX(4) */
.host {
	--ui-translate-x: calc(var(--ui-spacing, 0.25rem) * 4);
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.translateX(4);
let negativeResult = u.translateX(-2);
let centerResult = u.translateX("-50%");
```

A nudge on hover, which a translate does without reflowing the row:

```tsx
<a href={href} mix={[u.inlineFlex(), u.transition("transform"), u.hover(u.translateX(1))]}>
	{label} →
</a>
```

#### `translateY(value: SpacingValue): UtilityMixin`

Translates the element along the block axis using the spacing scale or a raw CSS length. Sets `--ui-translate-y` plus the shared composite `transform`.

Like `u.translateX()`, it moves the element without affecting layout, which makes it the cheap way to animate a lift or a slide. A percentage resolves against the element's own block size, so `"-50%"` is half its own height.

**Parameters:**

- `value`: A `SpacingValue`.
  - a `number` — resolved against the spacing scale as `calc(var(--ui-spacing, 0.25rem) * n)`. Negative values move the element up in a horizontal writing mode.
  - a raw CSS length (`"2px"`, `"-50%"`, `"1.5rem"`) — passed through unchanged

**Returns:**

- A `UtilityMixin` setting `--ui-translate-y` and the composite `transform`

**CSS:**

```css
/* u.translateY(4) */
.host {
	--ui-translate-y: calc(var(--ui-spacing, 0.25rem) * 4);
	transform: translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0))
		rotate(var(--ui-rotate, 0deg)) rotateX(var(--ui-rotate-x, 0deg))
		rotateY(var(--ui-rotate-y, 0deg)) scale(var(--ui-scale-x, 1), var(--ui-scale-y, 1))
		skew(var(--ui-skew-x, 0deg), var(--ui-skew-y, 0deg));
}
```

**Example:**

```typescript
let result = u.translateY(4);
let liftResult = u.translateY(-1);
let halfResult = u.translateY("-50%");
```

Because both axes read separate custom properties, they compose — here a lift plus a shadow on hover:

```tsx
<article
	mix={[
		u.rounded("lg"),
		u.surface("default"),
		u.media("(prefers-reduced-motion: no-preference)", u.transition("transform, box-shadow")),
		u.hover([u.translateY(-1), u.shadow("lg")]),
	]}
>
	{children}
</article>
```

### Tokens

Pure string resolvers from the `@pkg/u/tokens` subpath. None of these call `css()`, build a mixin, or register anything at runtime — they only stringify a token name into the `var(...)` reference a utility (or a component package building a larger CSS object by hand) should place in a declaration. Kept off the package root because four of them share a name with a utility mixin (`font`, `text`, `shadow`, `blur`) — importing from `@pkg/u/tokens` always gets the resolver, importing `u.font()` etc. from the root always gets the mixin.

#### `spacing(value: SpacingValue): string`

Resolves one spacing value to a CSS length. This is the resolver behind every padding, margin, gap, and inset utility, exposed for building a larger CSS object by hand without duplicating the scale logic.

**Parameters:**

- `value`: A `SpacingValue`.
  - a `number` — resolved against the scale as `calc(var(--ui-spacing, 0.25rem) * n)`, so the whole scale retunes by redefining one variable. At the default `0.25rem` step, `4` is `1rem`. Negative values work and are emitted unchanged.
  - `"auto"` — passed through literally, for margin's auto-centring
  - any other string — assumed to already be a valid CSS length (`"13px"`, `"60ch"`, `"100dvh"`) and passed through unchanged. Nothing is validated, so a typo is emitted as-is.

**Returns:**

- The resolved CSS length string

**Example:**

```typescript
let result = spacing(4);
// "calc(var(--ui-spacing, 0.25rem) * 4)"

let autoResult = spacing("auto");
// "auto"

let lengthResult = spacing("13px");
// "13px"
```

#### `boxLength(value: SizeValue): string`

Resolves one sizing value to a CSS length — the same as `spacing()` plus `"full"` resolving to `100%`. This is the resolver behind `u.is()`, `u.bs()`, and their `min`/`max` variants, where "fill the available space" needs a name.

**Parameters:**

- `value`: Anything `spacing()` accepts, plus `"full"`.
  - `"full"` — `100%`
  - a `number` — resolved against the spacing scale
  - `"auto"` — passed through literally
  - any other string — passed through unchanged

**Returns:**

- The resolved CSS length string

**Example:**

```typescript
let result = boxLength("full");
// "100%"

let scaleResult = boxLength(4);
// "calc(var(--ui-spacing, 0.25rem) * 4)"
```

Note the margin and padding utilities take `SpacingValue`, not `SizeValue`, so `"full"` is _not_ special-cased there and would be emitted as the invalid literal `full`.

#### `isLength(value: unknown): boolean`

Reports whether `value` is a raw CSS length string rather than a named scale step. It is what lets `radius()`, `text()`, `container()`, and `blur()` accept a one-off literal length without mistaking it for an app-extended token name.

Its narrowness is worth knowing, since it decides that behavior: the pattern matches an optional minus sign, digits, an optional decimal part, and one recognized unit — nothing more. A compound expression like `"calc(1rem - 2px)"` or `"clamp(1rem, 2vw, 2rem)"` therefore does **not** match, so passing one to `u.rounded()` or `u.text()` silently produces `var(--ui-radius-calc(1rem - 2px), 0px)` instead of passing through. Reach for `u.raw()` in that case.

**Parameters:**

- `value`: The value to test. Non-strings always return `false`.

  The recognized units are `px`, `ch`, `em`, `rem`, `%`, `vw`, `vh`, `dvw`, `dvh`, `vi`, `vb`, `svw`, `svh`, `lvw`, `lvh`, `cqw`, `cqh`, `cqmin`, and `cqmax`. Note that `pt`, `cm`, `in`, `ex`, `lh`, and the `vmin`/`vmax` pair are _not_ included.

**Returns:**

- `true` when `value` is a string matching a supported CSS length unit

**Example:**

```typescript
let result = isLength("13px");
// true

let scaleResult = isLength("md");
// false

let compoundResult = isLength("calc(1rem - 2px)");
// false — compound expressions are not detected
```

#### `color(value: ColorValue, defaultProperty?: string): string`

Resolves a color value to a `var(...)` reference. This is the resolver behind every color-accepting utility, exposed for building a larger CSS object by hand.

**Parameters:**

- `value`: A `ColorValue`, resolved in this order:
  - `"transparent"`, `"inherit"` — returned literally
  - `"currentColor"` — returned as `currentColor`, matching on any casing
  - any value containing `(` — returned untouched. This is the escape hatch that lets a `u.colorMix()` result, a `var(...)` reference, or a raw `oklch(...)` be passed anywhere a `ColorValue` is accepted, since tone names and their suffixes are always plain identifiers with no parentheses.
  - a raw palette reference `` `color.${palette}.${shade}` `` — resolves to `var(--ui-color-{palette}-{shade})`. Shades are `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`.
  - a tone with an explicit suffix `` `${tone}.${suffix}` `` — resolves to `var(--ui-{tone}-{property})`, where the suffix is mapped through the friendly-name alias table: `tint`→`bg-tint`, `solid`→`bg-solid`, `muted`→`fg-muted`, `emphasis`→`fg-emphasis`, `onSolid`→`fg-on-solid`, `strong`→`border-strong`. An unaliased suffix is used as the property segment verbatim, so `"brand.border"` resolves to `var(--ui-brand-border)`.
  - a bare tone name — resolves using `defaultProperty` as the property segment
- `defaultProperty`: The property segment to use when `value` names a bare tone with no suffix. **Throws** `@pkg/u: color("...") has no property and no default was given` if omitted in that case — which is why `u.bg("brand")` throws while `u.fg("brand")` (which passes `"fg"`) does not.

**Returns:**

- The resolved `var(...)` reference

**Example:**

```typescript
let result = color("brand.tint");
// "var(--ui-brand-bg-tint)"

let paletteResult = color("color.neutral.50");
// "var(--ui-color-neutral-50)"

let defaultResult = color("brand", "border");
// "var(--ui-brand-border)"

let passthroughResult = color("color-mix(in oklab, red 50%, blue)");
// "color-mix(in oklab, red 50%, blue)"
```

#### `radius(name: RadiusName | (string & {})): string`

Resolves a named radius to `var(--ui-radius-{name}, fallback)`, with a sensible fallback baked in so the scale works before an app defines the variable.

**Parameters:**

- `name`: A named radius-scale value, a raw CSS length, or an app-extended name.
  - `"none"` — `var(--ui-radius-none, 0px)`
  - `"sm"` — `var(--ui-radius-sm, 0.25rem)`
  - `"md"` — `var(--ui-radius-md, 0.375rem)`
  - `"lg"` — `var(--ui-radius-lg, 0.5rem)`
  - `"xl"` — `var(--ui-radius-xl, 0.75rem)`
  - `"full"` — `var(--ui-radius-full, 9999px)`
  - a raw CSS length — passed through literally, as decided by `isLength()`
  - any other name — treated as app-extended and resolved as `var(--ui-radius-{name}, 0px)`

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = radius("lg");
// "var(--ui-radius-lg, 0.5rem)"

let literalResult = radius("3px");
// "3px"
```

#### `font(name: FontFamilyName | (string & {})): string`

Resolves a named font family to `var(--ui-font-{name}, fallback)`.

**Parameters:**

- `name`: A named font-family value, or an app-extended name.
  - `"sans"` — `var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)`
  - `"serif"` — `var(--ui-font-serif, ui-serif, Georgia, serif)`
  - `"mono"` — `var(--ui-font-mono, ui-monospace, SFMono-Regular, monospace)`
  - any other name — treated as app-extended and resolved as `var(--ui-font-{name}, sans-serif)`

Note this resolver has no `"inherit"`/`"unset"` passthrough — that special case lives in the `u.font()` mixin, not here.

**Returns:**

- The resolved `var(...)` reference with its fallback font stack

**Example:**

```typescript
let result = font("serif");
// "var(--ui-font-serif, ui-serif, Georgia, serif)"
```

#### `text(name: TextSizeName | (string & {})): string`

Resolves a named text size to `var(--ui-text-{name}, fallback)`. Note it resolves the font size only — the paired line-height lives in the `u.text()` mixin.

**Parameters:**

- `name`: A named text-size value, a raw CSS length, or an app-extended name.
  - `"xs"` — `0.75rem`, `"sm"` — `0.875rem`, `"base"` — `1rem`, `"lg"` — `1.125rem`, `"xl"` — `1.25rem`
  - `"2xl"` — `1.5rem`, `"3xl"` — `1.875rem`, `"4xl"` — `2.25rem`
  - `"5xl"` — `3rem`, `"6xl"` — `3.75rem`, `"7xl"` — `4.5rem`, `"8xl"` — `6rem`, `"9xl"` — `8rem`
  - a raw CSS length — passed through literally, as decided by `isLength()`
  - any other name — treated as app-extended and resolved as `var(--ui-text-{name}, 1rem)`

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = text("lg");
// "var(--ui-text-lg, 1.125rem)"

let literalResult = text("0.9375rem");
// "0.9375rem"
```

#### `container(name: ContainerName | (string & {})): string`

Resolves a named container breakpoint to `var(--ui-container-{name}, fallback)`, for use as a **property value** — a `max-inline-size`, a grid track, anywhere the themable indirection is what you want. Query conditions need `containerLength()` instead.

Note this shares its name with the `u.container()` _mixin_ in the Layout family, which declares a container rather than resolving a breakpoint. Importing from the `tokens` subpath always gets this resolver; importing from the package root always gets the mixin.

**Parameters:**

- `name`: A named container-breakpoint value, a raw CSS length, or an app-extended name.
  - `"xs"` — `20rem`
  - `"sm"` — `24rem`
  - `"md"` — `36rem`
  - `"lg"` — `48rem`
  - `"xl"` — `64rem`
  - `"2xl"` — `80rem`
  - a raw CSS length — passed through literally rather than becoming `var(--ui-container-40rem, 36rem)`
  - any other name — treated as app-extended and resolved as `var(--ui-container-{name}, 36rem)`

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = container("md");
// "var(--ui-container-md, 36rem)"

let literalResult = container("40rem");
// "40rem"
```

#### `containerLength(name: ContainerName | (string & {})): string`

Resolves a named container breakpoint to its **literal** length — the form `u.at()` and `u.atMax()` write into an `@container` condition.

`@container` and `@media` conditions are evaluated before custom properties are substituted, so a `var()` inside a condition makes the whole at-rule inert: it parses, it is emitted into the stylesheet, and it never matches at any size. Only the declarations _inside_ an at-rule can read custom properties. That is why the container scale has two resolvers — `container()` for property values, where the indirection makes the scale themable, and this one for conditions, where it cannot work at all.

**Parameters:**

- `name`: A named container-breakpoint value, a raw CSS length, or an app-extended name.
  - `"xs"` — `20rem`
  - `"sm"` — `24rem`
  - `"md"` — `36rem`
  - `"lg"` — `48rem`
  - `"xl"` — `64rem`
  - `"2xl"` — `80rem`
  - a raw CSS length — passed through literally, exactly as in `container()`
  - any other name — resolves to `36rem`, the default step

**Returns:**

- A literal CSS length, never a `var(...)` reference

**Example:**

```typescript
let result = containerLength("md");
// "36rem"

let literalResult = containerLength("40rem");
// "40rem"
```

#### `shadow(name: ShadowName | (string & {})): string`

Resolves a named shadow to `var(--ui-shadow-{name}, fallback)`.

Unlike `radius()`, `text()`, `container()`, and `blur()`, this resolver has **no literal-passthrough escape hatch**: a literal shadow value can't be told apart from an app-extended token name, since both are arbitrary strings with no shape in common with a length. An unrecognized name therefore always resolves to a `var(...)` reference with the `md` value as its fallback. For a genuinely one-off shadow, compose through `u.raw({ boxShadow: "..." })`.

**Parameters:**

- `name`: A named shadow value, or an app-extended name.
  - `"sm"` — `var(--ui-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))`
  - `"base"` — `var(--ui-shadow-base, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))`
  - `"md"` — `var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))`
  - `"lg"` — `var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))`
  - `"xl"` — `var(--ui-shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))`
  - any other name — resolved as `var(--ui-shadow-{name}, <the md value>)`

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = shadow("md");
// "var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))"
```

#### `blur(name: BlurName | (string & {})): string`

Resolves a named blur strength to `var(--ui-blur-{name}, fallback)`. It backs both `u.blur()` (a `filter`) and `u.backdropBlur()`/`u.translucent()` (a `backdrop-filter`).

**Parameters:**

- `name`: A named blur value, a raw CSS length, or an app-extended name.
  - `"sm"` — `var(--ui-blur-sm, 4px)`
  - `"md"` — `var(--ui-blur-md, 12px)`
  - `"lg"` — `var(--ui-blur-lg, 24px)`
  - a raw CSS length — passed through literally, as decided by `isLength()`
  - any other name — treated as app-extended and resolved as `var(--ui-blur-{name}, 12px)`

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = blur("sm");
// "var(--ui-blur-sm, 4px)"

let literalResult = blur("8px");
// "8px"
```

### Extensible Types

Empty interfaces from the package root, each holding token names as keys so an app can add its own through declaration merging. No runtime registry backs any of them — adding a name only changes what TypeScript accepts; the matching `--ui-*` variable is what makes it actually resolve.

- `ColorPalettes` — raw palette scale names (`neutral`, `brand`, `success`, `warning`, `danger` by default)
- `SemanticTones` — semantic tone names, mapped to the `bg-tint`/`bg-solid`/`fg`/`fg-muted`/`fg-emphasis`/`fg-on-solid`/`border`/`border-strong`/`ring` property set
- `Radii` — named corner-radius scale (`none`, `sm`, `md`, `lg`, `xl`, `full` by default)
- `TextSizes` — named font-size scale (`xs` through `9xl` by default)
- `FontFamilies` — named font-family stacks (`sans`, `serif`, `mono` by default)
- `Containers` — named container-query breakpoints (`xs` through `2xl` by default)
- `Shadows` — named box-shadow scale (`sm`, `base`, `md`, `lg`, `xl` by default)
- `Blurs` — named blur scale (`sm`, `md`, `lg` by default)

Derived types built from these interfaces: `ColorPaletteName`, `SemanticToneName`, `RadiusName`, `TextSizeName`, `FontFamilyName`, `ContainerName`, `ShadowName`, `BlurName` (each `keyof` the interface above), `PaletteShade` (`50 | 100 | 200 | ... | 900 | 950`), and `ColorValue` — the union every color-accepting utility (`u.bg()`, `u.fg()`, `u.border()`, `u.ring()`, `u.accent()`, `u.surface()`) is typed against: a raw palette reference (`` `color.${ColorPaletteName}.${PaletteShade}` ``), a semantic tone with an explicit suffix (`` `${SemanticToneName}.${string}` ``), a bare tone name, or one of the three CSS keywords `"inherit"`, `"currentColor"`, and `"transparent"`. Every color-accepting utility also widens to `(string & {})`, which is what lets a `u.colorMix()` result or a raw `var(...)`/`oklch(...)` value pass straight through — see the `color()` resolver for the exact precedence.

**Example:**

```typescript
declare module "@pkg/u" {
	interface ColorPalettes {
		info: true;
	}
	interface SemanticTones {
		info: true;
	}
}
```

## Patterns

### Pattern: Responsive card with dark-mode support

Compose spacing, a surface recipe, and a container-query breakpoint to build a card that grows more spacious at wider container widths, and swaps its border for a stronger one under forced or system dark mode:

```tsx
import * as u from "@pkg/u";

<section
	mix={[
		u.surface("muted"),
		u.rounded("lg"),
		u.p(4),
		u.at("md", [u.p(6), u.hstack({ gap: 4 })]),
		u.dark(u.border("neutral.strong")),
	]}
>
	{children}
</section>;
```

### Pattern: A stateful, accessible interactive control

Wrapper utilities compose freely with atomic ones to express hover, focus, and disabled states without any JavaScript-managed state:

```tsx
import * as u from "@pkg/u";

<button
	mix={[
		u.surface("brand"),
		u.rounded("md"),
		u.p(2),
		u.hover(u.bg("brand.solid")),
		u.ring("brand"),
		u.disabled(u.opacity(50)),
	]}
>
	Save
</button>;
```

### Pattern: Extending the palette with a new tone

Add a new color everywhere the built-in tones already work — `u.bg()`, `u.fg()`, `u.border()`, `u.surface()`, and beyond — with a type declaration plus the matching CSS variables:

```ts
// app-wide ambient types
declare module "@pkg/u" {
	interface ColorPalettes {
		info: true;
	}
	interface SemanticTones {
		info: true;
	}
}
```

```css
:root {
	--ui-color-info-50: oklch(0.97 0.02 230);
	--ui-color-info-600: oklch(0.52 0.18 230);
	/* ...through 950 */

	--ui-info-bg-tint: var(--ui-color-info-50);
	--ui-info-bg-solid: var(--ui-color-info-600);
	--ui-info-fg: var(--ui-color-info-600);
	--ui-info-fg-on-solid: white;
	--ui-info-border: var(--ui-color-info-200);
	--ui-info-border-strong: var(--ui-color-info-600);
	--ui-info-ring: var(--ui-color-info-500);
}
```

```tsx
<div mix={[u.surface("info.tinted"), u.border("info")]} />
```

### Pattern: A named container declared and queried in the same component

`u.container()` is the declaring half of the container-query pair and `u.at()`/`u.atMax()` the querying half — naming the container on the root lets each part query that one row's width even once the component is nested inside another container that would otherwise be the nearest match:

```tsx
import * as u from "@pkg/u";

const ROW = "ui-row";
const NARROW = "32rem";

<article
	mix={[
		u.hstack({ gap: 3, align: "center" }),
		u.container(ROW),
		u.atMax(NARROW, ROW, u.flexWrap()),
	]}
>
	<span mix={[u.shrink()]}>{icon}</span>
	<div mix={[u.minIs(0)]}>{content}</div>
	<div mix={[u.mis("auto"), u.shrink(), u.atMax(NARROW, ROW, [u.basis("100%"), u.justify("end")])]}>
		{actions}
	</div>
</article>;
```

### Pattern: Compound parts placed by name instead of by order

Declaring the grid's `areas` on the root and matching each part by its own `data-slot` lets a slot be optional, reordered, or aligned independently without the root tracking which parts are present — `u.self()` anchors one area's occupant against its neighbors:

```tsx
import * as u from "@pkg/u";

<article
	mix={[
		u.grid(),
		u.gap(1, 3),
		u.gridTemplate({ columns: "auto 1fr", areas: `"media header" "media body" ". footer"` }),
		u.when('& > [data-slot="media"]', [u.gridArea("media"), u.self("end")]),
		u.when('& > [data-slot="header"]', u.gridArea("header")),
		u.when('& > [data-slot="body"]', u.gridArea("body")),
		u.when('& > [data-slot="footer"]', u.gridArea("footer")),
	]}
>
	{children}
</article>;
```

### Pattern: A metrics row that neither reflows nor jitters

`u.repeat("auto-fit", ...)` lets the grid pick its own track count from the space it's given, so a row of readouts needs no breakpoints at all, and `u.tabularNums()` keeps each value's digits at a fixed width so a live number changing doesn't nudge its own label:

```tsx
import * as u from "@pkg/u";

<dl
	mix={[
		u.grid(),
		u.gap(4),
		u.items("end"),
		u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(140px, 1fr)") }),
	]}
>
	{metrics.map((metric) => (
		<div key={metric.id}>
			<dt mix={[u.text("sm"), u.fg("neutral.muted"), u.mbe(1)]}>{metric.label}</dt>
			<dd mix={[u.m(0), u.text("lg"), u.weight(600), u.tabularNums(), u.fg("neutral.emphasis")]}>
				{metric.value}
			</dd>
		</div>
	))}
</dl>;
```

### Pattern: One attribute driving a whole table of tones

Mapping tone names through `u.data()` and folding the result with `u.combine()` produces every branch as a sibling in a single mixin, so a host picks its whole surface — border, background, and foreground together — by setting one attribute and never has to be re-rendered to change it:

```tsx
import * as u from "@pkg/u";

const TONES = ["brand", "neutral", "success", "warning", "danger"] as const;

<div
	data-tone={tone}
	mix={[
		u.rounded("lg"),
		u.border({ width: 1 }),
		u.p(4),
		u.combine(
			TONES.map((name) =>
				u.data("tone", name, [
					u.border(`${name}.border`),
					u.bg(`${name}.tint`),
					u.fg(`${name}.emphasis`),
				]),
			),
		),
	]}
>
	{children}
</div>;
```

### Pattern: An edge-anchored panel that slides in

The block edges stay logical (`u.insBs()`/`u.insBe()`) while the edge the panel slides from stays physical, because the platform's own safe-area geometry is physical and has to agree with it; `u.transitionBehavior("allow-discrete")` lets `display` and `overlay` participate, and `u.startingStyle()` supplies the off-screen values the entry animates from. `u.overscrollBehavior("contain")` stops a flick at the end of the panel's own scroll from carrying on into the page behind it, and `u.motionReduce()` drops the slide for anyone who asked for less motion:

```tsx
import * as u from "@pkg/u";

<dialog
	data-side={side}
	mix={[
		u.fixed(),
		u.m(0),
		u.insBs(0),
		u.insBe(0),
		u.is("min(90vw, 24rem)"),
		u.maxIs("none"),
		u.maxBs("none"),
		u.pbe(u.calc(`1.5rem + ${u.env("safe-area-inset-bottom", "0px")}`)),
		u.willChange("transform"),
		u.transition("transform, display, overlay", { duration: 300 }),
		u.transitionBehavior("allow-discrete"),
		u.data("side", "left", [u.insLeft(0), u.safeAreaPadding("left"), u.translateX("-100%")]),
		u.data("side", "right", [u.insRight(0), u.safeAreaPadding("right"), u.translateX("100%")]),
		u.open(u.translateX(0)),
		u.startingStyle([
			u.when('&[data-side="left"][open]', u.translateX("-100%")),
			u.when('&[data-side="right"][open]', u.translateX("100%")),
		]),
		u.overscrollBehavior("contain"),
		u.motionReduce(u.transitionProperty("none")),
	]}
>
	{children}
</dialog>;
```

### Pattern: A top-layer surface that fades and scales on entry

The resting values sit on the element itself, the shown values in an `u.open()` branch, and the same branch repeats inside `u.startingStyle()` to give the transition somewhere to start from — without which an element entering from `display: none` simply appears. The `u.motionReduce()` branch drops `scale` from both the property list and the element, leaving the fade:

```tsx
import * as u from "@pkg/u";

<div
	popover="auto"
	mix={[
		u.rounded("lg"),
		u.p(3),
		u.shadow("md"),
		u.bg("neutral.solid"),
		u.fg("neutral.onSolid"),
		u.opacity(0),
		u.scaleProperty(0.95),
		u.transition("opacity, scale, display, overlay", { duration: 150 }),
		u.transitionBehavior("allow-discrete"),
		u.open([u.opacity(100), u.scaleProperty("none")]),
		u.startingStyle(u.open([u.opacity(0), u.scaleProperty(0.95)])),
		u.motionReduce([
			u.transition("opacity, display, overlay", { duration: 150 }),
			u.scaleProperty("none"),
		]),
	]}
>
	{children}
</div>;
```

### Pattern: A native control clipped away and painted by a sibling

`u.visuallyHidden()` keeps the real input focusable, operable, and submitted with the form while rendering none of its own pixels; a sibling element paints the visible indicator and reads every state off that input through `u.hasSibling()`, so checked, focused, and disabled all resolve in CSS with no state to track. Note the order: `u.hasSibling()` emits `:has(~ ...)`, which only matches a _following_ sibling, so the indicator has to come first and the input after it:

```tsx
import * as u from "@pkg/u";

<label mix={[u.hstack({ gap: 2, align: "center" }), u.cursor("pointer")]}>
	<span
		aria-hidden
		mix={[
			u.inlineFlex(),
			u.items("center"),
			u.justify("center"),
			u.is(5),
			u.bs(5),
			u.rounded("sm"),
			u.border({ color: "neutral.strong", width: 2 }),
			u.transition("background-color, border-color"),
			u.hasSibling("input:checked", [
				u.border("brand.solid"),
				u.bg("brand.solid"),
				u.fg("brand.onSolid"),
			]),
			u.hasSibling("input:focus-visible", u.outline({ color: "brand.ring", offset: 2 })),
			u.hasSibling("input:disabled", [u.cursor("not-allowed"), u.opacity(50)]),
		]}
	>
		{mark}
	</span>
	<input type="checkbox" mix={[u.visuallyHidden()]} />
	{children}
</label>;
```

### Pattern: A control whose moving part is a pseudo-element

`u.before()`/`u.after()` paired with `u.pseudoContent('""')` gives a form control a thumb, track, or marker without a wrapper element, and because the part is positioned with the logical `ins*` family it travels along the inline axis in whichever direction the writing mode runs — the transition then names `inset-inline-start` directly:

```tsx
import * as u from "@pkg/u";

<input
	type="checkbox"
	role="switch"
	mix={[
		u.appearance(),
		u.relative(),
		u.inlineBlock(),
		u.is(u.var("track-is", "2.75rem")),
		u.bs(u.var("track-bs", "1.5rem")),
		u.rounded("full"),
		u.bg("neutral.border"),
		u.before([
			u.pseudoContent('""'),
			u.absolute(),
			u.insBs(u.var("thumb-inset", "0.125rem")),
			u.insIs(u.var("thumb-inset", "0.125rem")),
			u.is(u.var("thumb-size", "1.25rem")),
			u.bs(u.var("thumb-size", "1.25rem")),
			u.rounded("full"),
			u.bg("brand.onSolid"),
			u.shadow("base"),
			u.transition("inset-inline-start, scale"),
		]),
		u.checked([
			u.bg("brand.solid"),
			u.before(
				u.insIs(
					`calc(${u.var("track-is", "2.75rem")} - ${u.var("thumb-size", "1.25rem")} - ${u.var("thumb-inset", "0.125rem")})`,
				),
			),
		]),
		u.active(u.before(u.scaleProperty(0.95))),
		u.motionReduce(u.before(u.transitionDuration("0s"))),
	]}
/>;
```

### Pattern: A numbered list whose numbers come from CSS

A counter reset on the list and incremented per item, drawn through a `::before` pseudo-element, keeps the numbering correct when items are added, removed, or reordered — and keeps the number out of the accessible text, since it's decoration rather than content:

```tsx
import * as u from "@pkg/u";

<ol mix={[u.vstack({ gap: 4 }), u.listStyle("none"), u.p(0), u.counterReset("step")]}>
	{steps.map((step) => (
		<li
			key={step.id}
			mix={[
				u.relative(),
				u.pis(10),
				u.counterIncrement("step"),
				u.before([
					u.pseudoContent("counter(step)"),
					u.absolute(),
					u.insBs(0),
					u.insIs(0),
					u.hstack({ align: "center", justify: "center" }),
					u.is(7),
					u.bs(7),
					u.rounded("full"),
					u.bg("brand.solid"),
					u.fg("brand.onSolid"),
					u.text("sm"),
					u.weight(600),
				]),
			]}
		>
			{step.body}
		</li>
	))}
</ol>;
```

### Pattern: A scroll container with a stable gutter and faded edges

`u.scroll()` only shows a scrollbar on the axis that actually overflows, `u.thinScrollbar()` reserves its gutter up front so its appearance never shifts content, `u.overscrollBehavior("contain")` keeps a flick at either end from scrolling the page instead, and a four-stop gradient through `u.mask()` feathers both edges — a standing hint that content continues past the visible box:

```tsx
import * as u from "@pkg/u";

const FADE = "1.5rem";

<div
	tabIndex={0}
	mix={[
		u.scroll("y"),
		u.thinScrollbar(),
		u.overscrollBehavior("contain"),
		u.maxBs("24rem"),
		u.mask(
			`linear-gradient(to bottom, transparent 0%, black ${FADE}, black calc(100% - ${FADE}), transparent 100%)`,
		),
		u.when("&::-webkit-scrollbar-track", u.bg("transparent")),
		u.when("&::-webkit-scrollbar-thumb", [
			u.rounded("full"),
			u.bg("neutral.border"),
			u.hover(u.bg("neutral.strong")),
		]),
		u.focusVisible(u.outline({ color: "brand.ring", offset: 2 })),
	]}
>
	{children}
</div>;
```

### Pattern: SVG shapes painted from the same tones as text

`u.fill()` and `u.stroke()` resolve the same semantic tones `u.fg()` does, so a plotted shape inherits its color from an ancestor's foreground rather than carrying a hardcoded one; `u.strokeWidth()` takes a unitless SVG user value and `u.vectorEffect("non-scaling-stroke")` keeps hairlines a hairline however the drawing is scaled:

```tsx
import * as u from "@pkg/u";

<svg viewBox="0 0 320 120" mix={[u.block(), u.is("full"), u.fg("brand")]}>
	<line
		x1={0}
		x2={320}
		y1={60}
		y2={60}
		mix={[u.stroke("neutral.border"), u.strokeWidth(1), u.vectorEffect("non-scaling-stroke")]}
	/>
	<path
		d={path}
		mix={[
			u.fill("none"),
			u.stroke("currentcolor"),
			u.strokeWidth(u.var("series-width", "2px")),
			u.strokeLinejoin("round"),
			u.strokeLinecap("round"),
		]}
	/>
</svg>;
```

### Pattern: A translucent bar pinned to the block-start edge

`u.colorMix()` builds the partially transparent tint the bar sits behind, so `u.backdropBlur()` has something to blur through while the tint still tracks whatever the neutral surface token resolves to under either color scheme:

```tsx
import * as u from "@pkg/u";

<header
	mix={[
		u.sticky(),
		u.insBs(0),
		u.z(10),
		u.hstack({ align: "center", justify: "between", gap: 4 }),
		u.p(3, 6),
		u.borderEdge("block-end", { color: "neutral", width: 1 }),
		u.bg(u.colorMix("oklab", { color: u.var("ui-neutral-bg-tint"), weight: 80 }, "transparent")),
		u.backdropBlur(),
	]}
>
	{children}
</header>;
```

### Pattern: A component-level knob declared once and read everywhere

`u.vars()` publishes a component's own tunable values on its root — with the leading `--` omitted — and `u.var()` reads them back with the same fallback at each use site, so every part agrees on one number and a single call in a consumer's `mix` retunes the whole component without touching its internals:

```tsx
import * as u from "@pkg/u";

<section mix={[u.vstack({ gap: 3 }), u.vars({ "panel-is": "18rem", "panel-inset": "1rem" })]}>
	<div mix={[u.is(u.var("panel-is", "18rem")), u.p(u.var("panel-inset", "1rem")), u.rounded("lg")]}>
		{children}
	</div>
</section>;
```

```tsx
// A consumer widening one instance, with nothing else overridden
<Panel mix={[u.vars({ "panel-is": "24rem" })]} />
```

### Pattern: A carousel that snaps one item at a time

`u.scrollSnapType()` goes on the container and `u.scrollSnapAlign()` on each item — the split is the thing to get right, since setting either alone does nothing. `u.scrollSnapStop("always")` forbids a fast flick from skipping past items, so paging stays one-at-a-time. `u.scrollPadding()` keeps the snap position clear of the container's own inline padding, and `u.overscrollBehavior("contain")` stops a swipe that reaches the end from scrolling the page instead. Smooth scrolling is motion, so it goes behind `u.motionSafe()` rather than being applied unconditionally:

```tsx
import * as u from "@pkg/u";

<div
	mix={[
		u.hstack({ gap: 3 }),
		u.scroll("x"),
		u.scrollSnapType("inline"),
		u.scrollPadding(4),
		u.overscrollBehavior("contain"),
		u.thinScrollbar(),
		u.pi(4),
		u.motionSafe(u.scrollBehavior("smooth")),
	]}
>
	{slides.map((slide) => (
		<figure
			key={slide.id}
			mix={[
				u.scrollSnapAlign("start"),
				u.scrollSnapStop("always"),
				u.shrink(0),
				u.is("min(80cqi, 22rem)"),
				u.rounded("lg"),
				u.clip(),
			]}
		>
			<img
				mix={[u.is("full"), u.aspect("video"), u.fit("cover")]}
				src={slide.src}
				alt={slide.alt}
			/>
		</figure>
	))}
</div>;
```

Reach for `u.thinScrollbar()` over `u.noScrollbar()` unless another paging affordance is visible — a hidden scrollbar removes the only cue that the strip scrolls at all.

### Pattern: A tooltip anchored to its trigger

Anchor positioning replaces the measure-and-position pass a floating element used to need. `u.anchorName()` names the trigger, `u.positionAnchor()` points the tooltip at that name, and `u.positionArea()` places it relative to the anchor without any coordinates. `u.positionTryFallbacks()` supplies the flip order for when the preferred side would overflow the viewport — the part a hand-rolled implementation usually gets wrong:

```tsx
import * as u from "@pkg/u";

<>
	<button mix={[u.anchorName("tip"), u.rounded("md"), u.p(2)]} popoverTarget="tip-content">
		{label}
	</button>

	<div
		id="tip-content"
		popover="hint"
		role="tooltip"
		mix={[
			u.absolute(),
			u.positionAnchor("tip"),
			u.positionArea("block-start center"),
			u.positionTryFallbacks("flip-block", "flip-inline"),
			u.m(0),
			u.mbe(2),
			u.maxIs("18rem"),
			u.rounded("md"),
			u.pb(1),
			u.pi(2),
			u.text("sm"),
			u.pretty(),
			u.surface("neutral"),
			u.shadow("md"),
			u.opacity(0),
			u.transition("opacity, display, overlay", { duration: 120 }),
			u.transitionBehavior("allow-discrete"),
			u.open(u.opacity(100)),
			u.startingStyle(u.open(u.opacity(0))),
		]}
	>
		{description}
	</div>
</>;
```

Both halves are required: an `anchorName()` with no `positionAnchor()` referencing it does nothing, and a `positionArea()` with no resolved anchor falls back to normal absolute positioning against the nearest positioned ancestor.

### Pattern: A card that flips to reveal its back

Three utilities have to agree for a 3D rotation to read as depth rather than a horizontal squash: `u.transformStyle()` keeps the subtree in 3D, `u.perspective()` gives it a vanishing point, and both belong on the **parent** of the rotating faces. `u.backfaceVisibility()` on each face hides it once it turns away. The back face starts pre-rotated so it is already facing away at rest:

```tsx
import * as u from "@pkg/u";

<div mix={[u.transformStyle(), u.perspective(800), u.zstack()]}>
	<div
		mix={[
			u.backfaceVisibility(),
			u.rounded("lg"),
			u.clip(),
			u.surface("muted"),
			u.p(4),
			u.motionSafe(u.transition("transform", { duration: 400 })),
			u.data("flipped", u.rotateY(180)),
		]}
		data-flipped={flipped || undefined}
	>
		{front}
	</div>
	<div
		mix={[
			u.backfaceVisibility(),
			u.rotateY(180),
			u.rounded("lg"),
			u.clip(),
			u.surface("brand.tinted"),
			u.p(4),
			u.motionSafe(u.transition("transform", { duration: 400 })),
			u.data("flipped", u.rotateY(0)),
		]}
		data-flipped={flipped || undefined}
	>
		{back}
	</div>
</div>;
```

Note the radius and clipping sit on the **faces**, not on the `u.transformStyle()` parent: an `overflow` other than `visible`, a filter, a mask, or an opacity below 1 on that parent silently forces the subtree back to flat and the effect collapses.

### Pattern: A link whose underline clears its descenders

An underline at the browser's default offset cuts through the descenders of `g`, `p`, and `y`. `u.textDecoration()`'s options form fixes that in one call, and takes its colour from the tone layer — so the underline can sit a shade back from the text rather than matching it exactly, which reads as less heavy without losing the affordance:

```tsx
import * as u from "@pkg/u";

<a
	href={href}
	mix={[
		u.fg("brand"),
		u.rounded("sm"),
		u.textDecoration({ line: "underline", color: "brand.muted", thickness: 1, offset: 2 }),
		u.transition("text-decoration-color, color"),
		u.hover(u.textDecoration({ color: "brand" })),
		u.ring("brand"),
	]}
>
	{children}
</a>;
```

`thickness` and `offset` are the two properties CSS's `text-decoration` shorthand does _not_ include, which is why they are separate keys here. Never trade the underline for colour alone — colour is not a sufficient signal that something is a link.

### Pattern: A selected thumbnail carrying both a ring and elevation

`u.shadow()` and `u.ringShadow()` write different slots of the same composite `box-shadow`, so they stack: the ring hugs the element's edge and the elevation shadow falls outside it. Before that composition existed this needed one hand-written `box-shadow` with both layers in it:

```tsx
import * as u from "@pkg/u";

<label mix={[u.relative(), u.cursor("pointer")]}>
	<span
		mix={[
			u.block(),
			u.is(20),
			u.aspect("square"),
			u.rounded("lg"),
			u.clip(),
			u.shadow("sm"),
			u.motionSafe(u.transition("box-shadow, translate", { duration: 150 })),
			u.hover([u.shadow("lg"), u.translateY(-1)]),
			u.hasSibling("input:checked", u.ringShadow("brand", 3)),
			u.hasSibling("input:focus-visible", u.outline({ color: "brand.ring", offset: 2 })),
		]}
	>
		<img
			mix={[u.is("full"), u.bs("full"), u.fit("cover"), u.objectPosition("top")]}
			src={src}
			alt=""
		/>
	</span>
	<input type="radio" name="thumb" mix={[u.visuallyHidden()]} />
</label>;
```

`u.objectPosition("top")` is what keeps a portrait subject's head in frame once `u.fit("cover")` crops a square out of a taller image. A raw `u.raw({ boxShadow })` on this element would replace the whole composite and silently erase the ring — write the slot variable directly if you ever need a genuinely custom layer.

### Pattern: A tile grid where one item spans two tracks

`u.gridTemplate()` establishes the tracks and `u.gridColumn()`/`u.gridRow()` place an individual item across them. A bare number means a grid _line_, so spanning is written `"span 2"` — that distinction is the one people trip over. `u.gridAutoRows()` sizes the implicit rows that appear beyond the declared template, so tiles added later keep the same height without touching the container:

```tsx
import * as u from "@pkg/u";

<div
	mix={[
		u.grid(),
		u.gridTemplate({ columns: "repeat(auto-fit, minmax(14rem, 1fr))" }),
		u.gridAutoRows("10rem"),
		u.gap(3),
	]}
>
	<article
		mix={[
			u.gridColumn("span 2"),
			u.gridRow("span 2"),
			u.surface("brand.tinted"),
			u.rounded("lg"),
			u.p(4),
		]}
	>
		{featured}
	</article>
	{tiles.map((tile) => (
		<article key={tile.id} mix={[u.surface("muted"), u.rounded("lg"), u.p(3)]}>
			{tile.label}
		</article>
	))}
</div>;
```

Avoid `u.gridAutoFlow("dense")` here if the tiles are interactive: backfilling holes reorders them visually while leaving tab order in DOM order, which strands keyboard users.

### Pattern: A textarea that grows with its content

`u.fieldSizing("content")` is the native replacement for the resize-observer-and-scrollHeight dance: the control sizes itself to its own value. Bound it with `u.minBs()` and `u.maxBs()` so it starts at a sensible height and stops before it takes over the page, then let `u.scroll("y")` handle anything past the ceiling:

```tsx
import * as u from "@pkg/u";

<textarea
	rows={2}
	mix={[
		u.fieldSizing("content"),
		u.minBs("3lh"),
		u.maxBs("12lh"),
		u.scroll("y"),
		u.resize("block"),
		u.is("full"),
		u.appearance(),
		u.font("inherit"),
		u.text("base"),
		u.leading("relaxed"),
		u.p(2),
		u.border({ color: "neutral", width: 1 }),
		u.rounded("md"),
		u.autofill(),
		u.ring("brand"),
		u.invalid([u.border("danger"), u.ring("danger")]),
	]}
/>;
```

`u.resize("block")` leaves the manual handle available on the axis that makes sense, which matters because auto-growing is a guess — someone with a long answer or a large font may still want to drag it taller. The `lh` unit ties both bounds to the control's own line height, so they stay right if the text size changes.

### Pattern: A field whose label floats out of the way

`u.placeholderShown()` matches an input only while it is empty, and `u.has()` lets the _wrapper_ read that state — so a label can sit inside an empty field and lift above it the moment the user types, with no JavaScript and no state to track. The input keeps a real `<label>` throughout, because a placeholder is not a label:

```tsx
import * as u from "@pkg/u";

<div
	mix={[
		u.relative(),
		u.pbs(3),
		u.has(
			"input:placeholder-shown:not(:focus)",
			u.when("& > label", [u.translateY("1.7rem"), u.text("base")]),
		),
		u.has("input:focus", u.when("& > label", u.fg("brand"))),
	]}
>
	<input
		id="email"
		type="email"
		placeholder=" "
		mix={[
			u.is("full"),
			u.appearance(),
			u.font("inherit"),
			u.p(2),
			u.border({ color: "neutral", width: 1 }),
			u.rounded("md"),
			u.autofill(),
			u.ring("brand"),
		]}
	/>
	<label
		htmlFor="email"
		mix={[
			u.absolute(),
			u.insBs(0),
			u.insIs(2),
			u.text("xs"),
			u.fg("neutral.muted"),
			u.pointerEvents(),
			u.motionSafe(u.transition("translate, font-size, color", { duration: 120 })),
		]}
	>
		Email
	</label>
</div>;
```

Two details make it work. Give the input `placeholder=" "` — a single space — so `:placeholder-shown` tracks emptiness without showing text that competes with the label. And the `:not(:focus)` is what lets the label lift on focus rather than waiting for the first character.

### Pattern: An unavailable card dimmed with stacked filters

`filter` is one CSS property, but each filter utility writes its own variable into a shared composite — so `u.grayscale()`, `u.brightness()`, and `u.blur()` combine instead of overwriting each other. Order in the composite is fixed, so the result does not depend on the order of the calls:

```tsx
import * as u from "@pkg/u";

<article
	aria-disabled="true"
	mix={[
		u.surface("muted"),
		u.rounded("lg"),
		u.p(4),
		u.motionSafe(u.transition("filter, opacity", { duration: 200 })),
		u.aria("disabled", "true", [
			u.grayscale(0.8),
			u.brightness(0.98),
			u.opacity(60),
			u.cursor("not-allowed"),
		]),
	]}
>
	{children}
	<p mix={[u.text("sm"), u.weight("medium"), u.fg("neutral")]}>Unavailable in your region</p>
</article>;
```

The visible dimming carries no meaning on its own — a filter is invisible to assistive technology — so the `aria-disabled` attribute and the sentence of text are doing the actual work. Never let a filter be the only signal.

### Pattern: A modal that dims the page behind it

`u.backdrop()` styles the layer the browser paints behind a top-layer element, which is the correct way to dim the page rather than rendering an overlay `<div>` and managing its stacking. It transitions on the same `u.transitionBehavior("allow-discrete")` and `u.startingStyle()` contract the dialog itself uses, and `u.overscrollBehavior("contain")` keeps a scroll inside the dialog from leaking to the page:

```tsx
import * as u from "@pkg/u";

<dialog
	mix={[
		u.m("auto"),
		u.maxIs("min(90vw, 32rem)"),
		u.maxBs("85dvh"),
		u.scroll("y"),
		u.overscrollBehavior("contain"),
		u.surface("default"),
		u.border({ color: "neutral", width: 1 }),
		u.rounded("xl"),
		u.p(5),
		u.shadow("xl"),
		u.opacity(0),
		u.transition("opacity, display, overlay", { duration: 150 }),
		u.transitionBehavior("allow-discrete"),
		u.open(u.opacity(100)),
		u.startingStyle(u.open(u.opacity(0))),
		u.backdrop([
			u.bg(u.colorMix("oklab", { color: "CanvasText", weight: 40 }, "transparent")),
			u.transparencySafe(u.backdropBlur("sm")),
			u.opacity(0),
			u.transition("opacity, display, overlay", { duration: 150 }),
			u.transitionBehavior("allow-discrete"),
		]),
		u.when("&[open]::backdrop", u.opacity(100)),
		u.startingStyle(u.when("&[open]::backdrop", u.opacity(0))),
	]}
>
	{children}
</dialog>;
```

The blur goes behind `u.transparencySafe()` because `u.backdropBlur()` is an ungated primitive — without that wrapper it would override a reduced-transparency preference, while the solid `u.bg()` outside the gate keeps the dim either way.

### Pattern: A headline filled with a gradient

`u.bg({ clip: "text" })` clips a background to the glyphs, and a transparent foreground lets it show through. The text stays real, selectable, searchable text — which is the whole reason to do it this way rather than shipping an image:

```tsx
import * as u from "@pkg/u";

<h1
	mix={[
		u.type("5xl"),
		u.weight("bold"),
		u.tracking("tighter"),
		u.balance(),
		u.bg({
			image: u.linearGradient("to right", "var(--ui-brand-fg)", "var(--ui-brand-fg-emphasis)"),
			clip: "text",
		}),
		u.fg("transparent"),
	]}
>
	{title}
</h1>;
```

Two cautions. Only the unprefixed `background-clip` is emitted, so an engine that still needs `-webkit-background-clip` requires a `u.raw()` alongside. And a gradient has no contrast guarantee against the page background — check the lightest stop, not the average, or the headline fails contrast at one end while looking fine at the other.

### Pattern: A long list that skips off-screen rendering work

`u.virtualize()` is the pattern to reach for: it pairs `content-visibility: auto` with a `contain-intrinsic-size` placeholder, so the browser skips layout and paint for rows outside the viewport _and_ still reserves their space, which keeps the scrollbar stable. `u.contentVisibility()` is the bare primitive underneath, for when the size is already known. `u.scrollMargin()` on each row keeps a scrolled-to row clear of the sticky header:

```tsx
import * as u from "@pkg/u";

<div mix={[u.scroll("y"), u.overscrollBehavior("contain"), u.maxBs("32rem"), u.scrollPadding(12)]}>
	<div mix={[u.sticky(), u.insBs(0), u.layer(1), u.translucent(), u.pb(2), u.pi(3)]}>{header}</div>

	<ul role="list" mix={[u.listStyle(), u.divide()]}>
		{rows.map((row) => (
			<li
				key={row.id}
				id={row.id}
				mix={[
					u.virtualize("auto 3rem"),
					u.scrollMargin(12),
					u.hstack({ gap: 3, align: "center" }),
					u.p(3),
				]}
			>
				<span mix={[u.spacer(), u.minIs(0), u.truncate()]}>{row.label}</span>
				<span mix={[u.tabularNums(), u.text("sm"), u.fg("neutral.muted")]}>{row.value}</span>
			</li>
		))}
	</ul>
</div>;
```

Get the `contain-intrinsic-size` estimate roughly right — too small and the scrollbar jumps as rows mount, too large and it overshoots the same way. Note `content-visibility: auto` also hides skipped content from find-in-page in some engines, which is a real tradeoff for a searchable list.

### Pattern: A cell that breaks a long identifier instead of overflowing

`u.overflowWrap()` breaks a word only when it would otherwise overflow, leaving ordinary prose alone — which is why it, and not `u.wordBreak("break-all")`, is the right tool for a URL, hash, or generated ID. It needs something to overflow _against_, so the bounded size is part of the pattern: in a table that means `u.maxIs()`, and in a flex row it means `u.minIs(0)`:

```tsx
import * as u from "@pkg/u";

<table mix={[u.is("full"), u.borderCollapse()]}>
	<tbody>
		{rows.map((row) => (
			<tr
				key={row.id}
				mix={[
					u.when("& > td", [
						u.pb(2),
						u.pi(3),
						u.borderEdge("block-end", { color: "neutral", width: 1 }),
					]),
				]}
			>
				<th scope="row" mix={[u.textAlign("start"), u.nowrap(), u.weight("medium")]}>
					{row.label}
				</th>
				<td mix={[u.maxIs("28rem"), u.overflowWrap("break-word"), u.font("mono"), u.text("sm")]}>
					{row.value}
				</td>
			</tr>
		))}
	</tbody>
</table>;
```

Reach for `"anywhere"` instead of `"break-word"` when the cell also has to _shrink_: only `anywhere` lets the break affect the element's intrinsic min-content size, so a flex or grid item can narrow past its longest word.

### Pattern: A disclosure driven by its ARIA state

`u.aria()` styles straight from the attribute a component already sets for accessibility, so there is no parallel `data-` flag or class to keep in sync — the accessible state _is_ the styling state. (For a native `<details>` instead of a button, the equivalents are `u.open()` for the state, `u.marker()` for the disclosure triangle, and `u.detailsContent()` for the collapsible region.)

```tsx
import * as u from "@pkg/u";

<button
	aria-expanded={open}
	aria-controls="panel"
	mix={[
		u.hstack({ gap: 2, align: "center", justify: "between" }),
		u.is("full"),
		u.p(3),
		u.rounded("md"),
		u.hover(u.bg("neutral.tint")),
		u.ring("brand"),
		u.aria("expanded", "true", u.when("& > svg", u.rotate(90))),
	]}
>
	<span mix={[u.weight("medium")]}>{summary}</span>
	<svg
		aria-hidden="true"
		mix={[
			u.is(4),
			u.bs(4),
			u.shrink(0),
			u.fill("currentColor"),
			u.motionSafe(u.transition("transform", { duration: 150 })),
		]}
	>
		<path d={caretPath} />
	</svg>
</button>;
```

Note the two-argument form, `u.aria("expanded", ...)`, matches the attribute being _present_ — which includes `aria-expanded="false"`. Pass the value explicitly, as above, whenever `false` is a state you care about distinguishing.

### Pattern: An article that prints cleanly

`u.print()` is the one wrapper in its family that is not about a user preference. Printing is where a screen layout quietly fails: interactive chrome wastes paper, a dark surface burns ink, and anything truncated or clamped loses content that has no second page to continue onto:

```tsx
import * as u from "@pkg/u";

<>
	<nav mix={[u.hstack({ gap: 3 }), u.print(u.hidden())]}>{links}</nav>

	<article
		mix={[
			u.maxIs("65ch"),
			u.mi("auto"),
			u.vstack({ gap: 4 }),
			u.pretty(),
			u.leading("relaxed"),
			u.print([u.maxIs("none"), u.fg("color.neutral.950"), u.bg("color.neutral.50")]),
		]}
	>
		<h1 mix={[u.type("3xl"), u.weight("bold"), u.balance()]}>{title}</h1>
		<p mix={[u.lineClamp(3), u.print(u.raw({ WebkitLineClamp: "unset", overflow: "visible" }))]}>
			{summary}
		</p>
		{body}
	</article>
</>;
```

Undoing a clamp is one of the few genuine `u.raw()` cases left: `u.lineClamp()` takes a line count and has no "off" value, so the reset has to name the underlying properties.

## Related Packages

- [`@pkg/r3-ui`](/packages/r3-ui) - A component library built on `remix/ui` that styles its components through `css()` mixins and pairs naturally with these lower-level utilities.

## Tips

1. **Prefer the namespace import for application code** - `import * as u from "@pkg/u"` reads clearly at call sites (`u.p(4)`, `u.hover(...)`) and still tree-shakes down to only the utilities actually referenced.
2. **Reach for a wrapper before hand-rolling a selector or at-rule** - `u.when()`, `u.not()`, `u.hover()` and friends, `u.at()`, `u.media()`, and `u.supports()` all compose with any other utility; there's rarely a reason to write a raw nested selector by hand.
3. **`u.at()` is for layout, `u.media()` is the escape hatch** - default to container queries for responsive layout so a component adapts to the space it's actually given; reach for `u.media()` only for real viewport or user-preference queries like `prefers-contrast`.
4. **Token extension is additive only** - declaration merging can add a new name to `ColorPalettes`, `Radii`, and the rest, but it can't remove or override a built-in one — there's no way to "disable" a default token name through the type system.
5. **`u.surface()` chooses background, foreground, and border together** - reach for it instead of composing `u.bg()`/`u.fg()`/`u.border()` by hand whenever a surface needs to preserve contrast by construction.
6. **Accessibility gating is opt-in per utility, not automatic everywhere** - `u.translucent()` gates its blur behind `prefers-reduced-transparency` and `u.ring()` only ever shows on `:focus-visible`, but primitives like `u.backdropBlur()` apply unconditionally; reach for the gated pattern by name when it matters.
7. **Name the container you intend to query** - `u.at()`/`u.atMax()` without a name bind to whichever ancestor container is nearest, which silently changes the moment another component establishes one in between; pairing `u.container(NAME)` on the root with `u.at(size, NAME, ...)` in each part keeps the query pinned to the box it was written against.
8. **`u.startingStyle()` has to repeat the selector that reveals the element** - the entry values only apply where the shown state matches, so a wrapper like `u.startingStyle(u.open(...))` (or a `u.when()` naming the same `[open]`/`:popover-open` branch) is what actually animates; a bare `u.startingStyle(u.opacity(0))` on an element that enters from `display: none` compiles fine and does nothing.
9. **`u.safeAreaPadding()` is deliberately physical, and its neighbors should be too** - notch and home-indicator geometry doesn't flip with writing mode, so pair it with `u.insLeft()`/`u.insRight()` on the same element; reaching for `u.insIs()`/`u.insIe()` alongside it puts the reserved padding on the opposite edge under a right-to-left writing direction.
10. **Fold a variant table with `u.combine()` rather than writing each branch out** - mapping tone or state names through `u.data()`/`u.when()` and combining the result yields one mixin whose branches are all siblings, which is also the only way to build branches from a list — neither a CSS selector nor a custom property name can be parameterized by a loop of its own.
11. **`u.strokeWidth()` is unitless where every other width utility is pixels** - `u.strokeWidth(1)` means one SVG user unit, not `1px`, because a `px` suffix would make the stroke scale with the viewport instead of the drawing's own coordinate system; reach for `u.vectorEffect("non-scaling-stroke")` when a hairline needs to stay a hairline through a transform.
12. **Transition `u.scaleProperty()`, not `u.scale()`** - the standalone `scale` property animates on its own without contending with whatever else composes into `transform`, which is why entry and press animations name `scale` in their property list and reset it with `u.scaleProperty("none")` rather than a bare `1`.
13. **Snap type goes on the container, snap alignment on the items** - `u.scrollSnapType()` on the scroll container and `u.scrollSnapAlign()` on each child; either one alone does nothing, which is the most common way a carousel ends up not snapping. Add `u.scrollPadding()` so the snap position clears a sticky header or the container's own padding.
14. **`u.shadow()` and `u.ringShadow()` now stack, but a raw `box-shadow` erases both** - they write separate slots of one composite declaration, so a ring and an elevation shadow coexist. A `u.raw({ boxShadow: "..." })` on the same element replaces the whole composite and silently drops the other layer; write the slot custom property directly instead.
15. **Put motion behind `u.motionSafe()`, not `u.motionReduce()`** - wrapping the animation means the reduced-motion case is the unwrapped baseline, so forgetting the wrapper fails safe with no animation. The inverse form ships an ungated animation whenever you forget to add the override.
16. **`u.transformStyle()` and `u.perspective()` belong on the parent, and clipping defeats them** - the 3D context has to be established above the rotating faces. On that same parent, an `overflow` other than `visible`, a filter, a mask, or an opacity below 1 all force the subtree back to flat, so put the radius and `u.clip()` on the faces instead.
17. **Anchor positioning needs both halves** - `u.anchorName()` on the element being anchored to, `u.positionAnchor()` on the positioned one. With only one of them, `u.positionArea()` quietly falls back to ordinary absolute positioning against the nearest positioned ancestor, which usually looks almost right and is the hardest version to debug.
18. **`u.overflowWrap()` is for long URLs, `u.wordBreak()` is not** - `overflow-wrap` breaks a word only when it would otherwise overflow, leaving prose intact; `word-break: break-all` breaks at any character and mangles it. Both need a bounded inline size to do anything, and only `u.overflowWrap("anywhere")` also lets a flex or grid item shrink below its longest word.
