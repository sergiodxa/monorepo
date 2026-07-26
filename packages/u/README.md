# @pkg/u

A utility-first styling layer for `remix/ui`, composed from small, terse mixins.

## Overview

Every export is a `remix/ui` mixin factory: `u.p(4)`, `u.bg("brand.tint")`, `u.hover(u.border("brand"))`. Each one drops directly into a `mix` prop, and wrapper utilities like `u.hover()` and `u.at()` compose with any other utility to build responsive, stateful styles:

```tsx
<div mix={[u.p(4), u.bg(), u.at("md", [u.p(6), u.hover(u.border("brand"))])]} />
```

The package covers CSS primitives and patterns: spacing, color, layout, typography, `u.surface()`, `u.hstack()`, `u.circle()`, and more.

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
import { p } from "@pkg/ui/size";
import bg from "@pkg/u/color/bg";
import p from "@pkg/u/size/p";
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
```

#### `var(name: string, fallback?: string): string`

Resolves a custom property reference: `var(--{name})`, or `var(--{name}, {fallback})` when a fallback is given. The leading `--` is omitted from `name`, mirroring `u.vars()`'s convention for defining the same custom properties. A plain string resolver, not a mixin — use it anywhere a utility accepts a raw CSS value, such as `u.p(u.var("gap"))`.

**Parameters:**

- `name`: The custom property name, without the leading `--`
- `fallback`: An optional fallback value

**Returns:**

- The resolved `var(...)` reference

**Example:**

```typescript
let result = u.var("sidebar-width", "18rem");
// "var(--sidebar-width, 18rem)"
```

#### `vars(values: Record<string, string | number>): UtilityMixin`

Sets custom properties on the host element. Each key in `values` is written as a CSS custom property with a leading `--` prepended, so call sites can reference option names without repeating the `--` prefix.

**Parameters:**

- `values`: A map of custom property names (without the leading `--`) to their string or number values

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.vars({ "sidebar-width": "18rem" });
```

### Layout

#### `absolute(): UtilityMixin`

Sets the host element's position to absolute, taking it out of normal document flow and positioning it relative to its nearest positioned ancestor.

**Returns:**

- A `UtilityMixin` applying `position: absolute`.

**Example:**

```typescript
let result = u.absolute();
```

#### `appearance(value?: AppearanceValue | (string & {})): UtilityMixin`

Resets or restores the platform's native control chrome on form controls. It only clears (or restores) the native rendering; it does not supply a replacement visual, which stays owned by component packages or apps.

**Parameters:**

- `value`: The `appearance` keyword to apply. `"none"` (the default) clears native control chrome; `"auto"` restores it. Other strings type-check too, covering legacy "compat" keywords that make one control type mimic another's native rendering.

**Returns:**

- A `UtilityMixin` applying the `appearance` property.

**Example:**

```typescript
let result = u.appearance("none");
```

#### `block(): UtilityMixin`

Sets the host element's display to block.

**Returns:**

- A `UtilityMixin` applying `display: block`.

**Example:**

```typescript
let result = u.block();
```

#### `center(): UtilityMixin`

A zero-argument convenience pattern that centers content along both axes. It composes `u.flex()`, `u.items("center")`, and `u.justify("center")` and adds no declarations of its own beyond what those three already produce.

**Returns:**

- A `UtilityMixin` applying `display: flex`, `align-items: center`, and `justify-content: center`.

**Example:**

```typescript
let result = u.center();
```

#### `content(value?: JustifyValue): UtilityMixin`

Sets how the host element's content lines are distributed along the cross axis.

**Parameters:**

- `value`: The distribution keyword to apply. Accepts the same keywords as `u.justify()`, including the `"between"`/`"around"`/`"evenly"` short forms, which are aliased to their `"space-between"`/`"space-around"`/`"space-evenly"` CSS equivalents. Defaults to `"start"`.

**Returns:**

- A `UtilityMixin` applying the `align-content` property.

**Example:**

```typescript
let result = u.content("between");
```

#### `contents(): UtilityMixin`

Sets the host element's display to contents, removing the element's own box from layout so its children behave as if the host weren't there.

**Returns:**

- A `UtilityMixin` applying `display: contents`.

**Example:**

```typescript
let result = u.contents();
```

#### `fixed(): UtilityMixin`

Sets the host element's position to fixed, positioning it relative to the viewport regardless of scrolling.

**Returns:**

- A `UtilityMixin` applying `position: fixed`.

**Example:**

```typescript
let result = u.fixed();
```

#### `flex(): UtilityMixin`

Sets the host element's display to flex.

**Returns:**

- A `UtilityMixin` applying `display: flex`.

**Example:**

```typescript
let result = u.flex();
```

#### `flexCol(): UtilityMixin`

Sets the host element's flex direction to column, stacking flex children vertically.

**Returns:**

- A `UtilityMixin` applying `flex-direction: column`.

**Example:**

```typescript
let result = u.flexCol();
```

#### `flexRow(): UtilityMixin`

Sets the host element's flex direction to row, laying out flex children horizontally.

**Returns:**

- A `UtilityMixin` applying `flex-direction: row`.

**Example:**

```typescript
let result = u.flexRow();
```

#### `flexWrap(value?: "wrap" | "nowrap" | "wrap-reverse"): UtilityMixin`

Controls whether flex children wrap onto multiple lines.

**Parameters:**

- `value`: The wrap behavior to apply. Defaults to `"wrap"`.

**Returns:**

- A `UtilityMixin` applying the `flex-wrap` property.

**Example:**

```typescript
let result = u.flexWrap("nowrap");
```

#### `gap(...values: SpacingValue[]): UtilityMixin`

Sets spacing between flex or grid children using the spacing scale or a raw CSS length.

**Parameters:**

- `values`: One or two spacing values. A single value applies to both row and column gap; two values are read as `"{row} {column}"`. Throws if given any other count.

**Returns:**

- A `UtilityMixin` applying the `gap` property.

**Example:**

```typescript
let result = u.gap(2, 4);
```

#### `grid(): UtilityMixin`

Sets the host element's display to grid.

**Returns:**

- A `UtilityMixin` applying `display: grid`.

**Example:**

```typescript
let result = u.grid();
```

#### `hidden(): UtilityMixin`

Sets the host element's display to none, removing it from layout entirely.

**Returns:**

- A `UtilityMixin` applying `display: none`.

**Example:**

```typescript
let result = u.hidden();
```

#### `hstack(options?: StackOptions): UtilityMixin`

A horizontal flex stack. Composes `u.flex()` and `u.flexRow()` unconditionally, then — from whichever option keys are given — `u.gap()`, `u.items()`, and `u.justify()`.

**Parameters:**

- `options.gap`: Sets `gap` using the spacing scale or a raw CSS length.
- `options.align`: Sets `align-items`.
- `options.justify`: Sets `justify-content`, aliasing `"between"`/`"around"`/`"evenly"` to `"space-between"`/`"space-around"`/`"space-evenly"` the same way `u.justify()` does.

**Returns:**

- A `UtilityMixin` applying `display: flex`, `flex-direction: row`, and any styles from the given options.

**Example:**

```typescript
let result = u.hstack({ gap: 4, align: "center", justify: "between" });
```

#### `inline(): UtilityMixin`

Sets the host element's display to inline.

**Returns:**

- A `UtilityMixin` applying `display: inline`.

**Example:**

```typescript
let result = u.inline();
```

#### `inlineBlock(): UtilityMixin`

Sets the host element's display to inline-block.

**Returns:**

- A `UtilityMixin` applying `display: inline-block`.

**Example:**

```typescript
let result = u.inlineBlock();
```

#### `inlineFlex(): UtilityMixin`

Sets the host element's display to inline-flex.

**Returns:**

- A `UtilityMixin` applying `display: inline-flex`.

**Example:**

```typescript
let result = u.inlineFlex();
```

#### `inlineGrid(): UtilityMixin`

Sets the host element's display to inline-grid.

**Returns:**

- A `UtilityMixin` applying `display: inline-grid`.

**Example:**

```typescript
let result = u.inlineGrid();
```

#### `inset(...values: SpacingValue[]): UtilityMixin`

Applies a logical `inset` shorthand using the spacing scale or a raw CSS length, mirroring the 1/2/4-value box shorthand `u.p()`/`u.m()` use for padding and margin.

**Parameters:**

- `values`: One, two, or four spacing values. A single value applies to all four sides via `inset`. Two values map to block then inline via `insetBlock`/`insetInline`. Four values map to block-start, inline-end, block-end, and inline-start via their individual logical properties. Throws if given any other count.

**Returns:**

- A `UtilityMixin` applying the resolved logical inset properties.

**Example:**

```typescript
let result = u.inset(1, 2, 3, 4);
```

#### `interpolateSize(value?: InterpolateSizeValue): UtilityMixin`

Opts the element into animating to and from keyword sizes (`auto`, `min-content`, `max-content`, `fit-content`) instead of only numeric lengths, so a transition to `height: auto` (or `block-size: auto`) can actually animate rather than jumping instantly.

**Parameters:**

- `value`: `"allow-keywords"` or `"numeric-only"`. Defaults to `"allow-keywords"`.

**Returns:**

- A `UtilityMixin` applying `interpolate-size`.

**Example:**

```typescript
let result = u.interpolateSize();
```

#### `items(value?: AlignItemsValue): UtilityMixin`

Sets how the host element aligns its children along the cross axis.

**Parameters:**

- `value`: The alignment keyword to apply — `"start"`, `"center"`, `"end"`, `"stretch"`, or `"baseline"`. Defaults to `"stretch"`.

**Returns:**

- A `UtilityMixin` applying the `align-items` property.

**Example:**

```typescript
let result = u.items("center");
```

#### `justify(value?: JustifyValue): UtilityMixin`

Sets how the host element distributes its children along the main axis.

**Parameters:**

- `value`: The distribution keyword to apply. `"between"`, `"around"`, and `"evenly"` are aliased to their `"space-between"`, `"space-around"`, and `"space-evenly"` CSS equivalents; `"start"`, `"center"`, and `"end"` pass through unchanged. Defaults to `"start"`.

**Returns:**

- A `UtilityMixin` applying the `justify-content` property.

**Example:**

```typescript
let result = u.justify("between");
```

#### `place(options?: PlaceOptions): UtilityMixin`

Sets item and/or content placement on both axes from whichever option keys are given, leaving the other untouched when its key is omitted. Composes `u.items()` for `align-items` and `u.content()`/`u.justify()` for `align-content`/`justify-content`; `justify-items` has no dedicated utility of its own to compose, so it's set directly alongside `u.items()`.

**Parameters:**

- `options.items`: Sets `align-items` and `justify-items` together.
- `options.content`: Sets `align-content` and `justify-content` together, aliasing `"between"`/`"around"`/`"evenly"` to `"space-between"`/`"space-around"`/`"space-evenly"` the same way `u.justify()` does.

**Returns:**

- A `UtilityMixin` applying the resolved alignment and content properties.

**Example:**

```typescript
let result = u.place({ items: "center", content: "between" });
```

#### `relative(): UtilityMixin`

Sets the host element's position to relative, establishing a positioning context for absolutely positioned descendants without moving the element itself.

**Returns:**

- A `UtilityMixin` applying `position: relative`.

**Example:**

```typescript
let result = u.relative();
```

#### `self(value?: AlignSelfValue): UtilityMixin`

Overrides the host element's own cross-axis alignment within its parent flex or grid container.

**Parameters:**

- `value`: The alignment keyword to apply — the same keywords as `u.items()` plus `"auto"`, which defers to the container's `align-items`. Defaults to `"auto"`.

**Returns:**

- A `UtilityMixin` applying the `align-self` property.

**Example:**

```typescript
let result = u.self("center");
```

#### `spacer(): UtilityMixin`

A flexible spacer: grows and shrinks to fill whatever room is left in a flex container, pushing siblings on either side of it apart — a toolbar's trailing action pinned to the end, or two groups split to opposite ends of a row.

**Returns:**

- A `UtilityMixin` applying `flex: 1 1 auto`.

**Example:**

```typescript
let result = u.spacer();
```

#### `sticky(): UtilityMixin`

Sets the host element's position to sticky, letting it toggle between relative and fixed positioning based on scroll offset.

**Returns:**

- A `UtilityMixin` applying `position: sticky`.

**Example:**

```typescript
let result = u.sticky();
```

#### `vstack(options?: StackOptions): UtilityMixin`

A vertical flex stack. Composes `u.flex()` and `u.flexCol()` unconditionally, then — from whichever option keys are given — `u.gap()`, `u.items()`, and `u.justify()`.

**Parameters:**

- `options.gap`: Sets `gap` using the spacing scale or a raw CSS length.
- `options.align`: Sets `align-items`.
- `options.justify`: Sets `justify-content`, aliasing `"between"`/`"around"`/`"evenly"` to `"space-between"`/`"space-around"`/`"space-evenly"` the same way `u.justify()` does.

**Returns:**

- A `UtilityMixin` applying `display: flex`, `flex-direction: column`, and any styles from the given options.

**Example:**

```typescript
let result = u.vstack({ gap: 4, align: "stretch" });
```

#### `zstack(options?: ZStackOptions): UtilityMixin`

A grid-overlay stack for layering children directly on top of each other. Rather than pulling children out of flow with absolute positioning, it places every direct child in the same single grid cell (`grid-area: 1 / 1`). Overlapping children this way still participate in the grid's intrinsic sizing — the host sizes to its largest child just as it would with a single child present — whereas absolutely positioned children collapse the parent to zero size unless a height is set by hand. Composes `u.grid()` and, when given, `u.items()` for `align-items`; `justify-items` has no dedicated utility of its own to compose, so it's set directly.

**Parameters:**

- `options.align`: Sets `align-items`.
- `options.justify`: Sets `justify-items`. Takes the same self-alignment keywords as `align`, not `u.justify()`'s `between`/`around`/`evenly` distribution keywords, since `justify-items` positions a grid item within its own cell rather than distributing space along a track.

**Returns:**

- A `UtilityMixin` applying `display: grid`, any given alignment options, and a nested rule stacking every direct child into the same grid area.

**Example:**

```typescript
let result = u.zstack({ align: "center", justify: "center" });
```

### Size

#### `aspect(ratio: AspectRatioName): UtilityMixin` (overloaded: `aspect(width: number, height: number): UtilityMixin`)

Applies `aspect-ratio`, either from a width/height pair or one of a handful of common named ratios. Aspect ratios otherwise vary too continuously for a full token family to pay for itself, so only these few common shapes get names:

- `"square"` — 1 / 1
- `"video"` — 16 / 9, standard widescreen video
- `"widescreen"` — 21 / 9, ultrawide/cinema
- `"portrait"` — 3 / 4, print/photo portrait orientation
- `"story"` — 9 / 16, vertical video (Stories, Reels, Shorts)
- `"photo"` — 4 / 3, standard print/photo landscape orientation

**Parameters:**

- `ratio`: A named aspect ratio (see the list above) — used when calling with a single argument
- `width`: The width side of the ratio, used together with `height` when calling with two arguments
- `height`: The height side of the ratio, paired with `width`

**Returns:**

- A `UtilityMixin` that sets `aspect-ratio` on the host

**Example:**

```typescript
let result = u.aspect(16, 9);
let squareResult = u.aspect("square");
```

#### `bleed(value: SpacingValue): UtilityMixin`

Pulls the host past its container's inline padding by `value` on both sides through a negative inline margin — a full-bleed image or divider inside an otherwise padded section. Composes `u.mi()` with a negated length.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length; defaults to `4`

**Returns:**

- A `UtilityMixin` that sets a negative `margin-inline` on the host

**Example:**

```typescript
let result = u.bleed(4);
```

#### `bs(value: SizeValue): UtilityMixin`

Applies `block-size` — the logical height, which is the physical width in a vertical writing mode.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, `"full"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `block-size` on the host

**Example:**

```typescript
let result = u.bs("full");
```

#### `circle(): UtilityMixin`

A shape pattern for circular boxes: a square aspect ratio plus full radius — an avatar frame, a status dot, an icon badge. Composes `u.aspect("square")` and `u.rounded("full")`.

**Returns:**

- A `UtilityMixin` that sets `aspect-ratio: 1 / 1` and a full `border-radius` on the host

**Example:**

```typescript
let result = u.circle();
```

#### `corner(shape: CornerShape): UtilityMixin`

The primitive `corner-shape` utility. Composes `u.supports()` so the declaration only applies behind `@supports`, keeping an unsupported browser on its normal `border-radius` shape instead of getting no corner treatment at all.

**Parameters:**

- `shape`: The corner treatment — `"squircle"`, `"bevel"`, or `"notch"`

**Returns:**

- A `UtilityMixin` that sets `corner-shape` on the host inside an `@supports (corner-shape: ...)` block

**Example:**

```typescript
let result = u.corner("squircle");
```

#### `fit(value: FitValue): UtilityMixin`

Applies `object-fit`, for media elements (`img`, `video`) sized by their container rather than their intrinsic dimensions.

**Parameters:**

- `value`: One of `"cover"`, `"contain"`, `"fill"`, `"none"`, or `"scale-down"`; defaults to `"cover"`

**Returns:**

- A `UtilityMixin` that sets `object-fit` on the host

**Example:**

```typescript
let result = u.fit("cover");
```

#### `is(value: SizeValue): UtilityMixin`

Applies `inline-size` — the logical width, which is the physical height in a vertical writing mode.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, `"full"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `inline-size` on the host

**Example:**

```typescript
let result = u.is("full");
```

#### `m(...values: SpacingValue[]): UtilityMixin`

Applies logical margin using the spacing scale, `"auto"`, or a raw CSS length. Follows the same 1/2/4-value logical mapping as `p()`: one value applies uniformly; two values map to block then inline; four values map to block-start, inline-end, block-end, and inline-start — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

**Parameters:**

- `values`: One value for a uniform margin, two values for block/inline, or four values for block-start/inline-end/block-end/inline-start — each a spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets the resolved logical `margin` properties on the host

**Example:**

```typescript
let result = u.m(4);
let sidesResult = u.m(4, "auto");
```

#### `mb(...values: SpacingValue[]): UtilityMixin`

Applies `margin-block`. One value applies both block edges; two values map to block-start then block-end.

**Parameters:**

- `values`: One value for both block edges, or two values for block-start then block-end — each a spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `margin-block` on the host

**Example:**

```typescript
let result = u.mb(4);
```

#### `mbe(value: SpacingValue): UtilityMixin`

Applies `margin-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `margin-block-end` on the host

**Example:**

```typescript
let result = u.mbe(4);
```

#### `mbs(value: SpacingValue): UtilityMixin`

Applies `margin-block-start` — the leading block edge, the top edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `margin-block-start` on the host

**Example:**

```typescript
let result = u.mbs(4);
```

#### `mi(...values: SpacingValue[]): UtilityMixin`

Applies `margin-inline`. One value applies both inline edges; two values map to inline-start then inline-end.

**Parameters:**

- `values`: One value for both inline edges, or two values for inline-start then inline-end — each a spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `margin-inline` on the host

**Example:**

```typescript
let result = u.mi(4, "auto");
```

#### `mie(value: SpacingValue): UtilityMixin`

Applies `margin-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `margin-inline-end` on the host

**Example:**

```typescript
let result = u.mie("auto");
```

#### `minBs(value: SizeValue): UtilityMixin`

Applies `min-block-size`.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, `"full"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `min-block-size` on the host

**Example:**

```typescript
let result = u.minBs(0);
```

#### `minIs(value: SizeValue): UtilityMixin`

Applies `min-inline-size`.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, `"full"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `min-inline-size` on the host

**Example:**

```typescript
let result = u.minIs(0);
```

#### `mis(value: SpacingValue): UtilityMixin`

Applies `margin-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number, `"auto"`, or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `margin-inline-start` on the host

**Example:**

```typescript
let result = u.mis("auto");
```

#### `p(...values: SpacingValue[]): UtilityMixin`

Applies logical padding using the spacing scale or a raw CSS length. One value applies all sides; two values map to block then inline; four values map to block-start, inline-end, block-end, and inline-start — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

**Parameters:**

- `values`: One value for uniform padding, two values for block/inline, or four values for block-start/inline-end/block-end/inline-start — each a spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets the resolved logical `padding` properties on the host

**Example:**

```typescript
let result = u.p(4);
let sidesResult = u.p(1, 2, 3, 4);
```

#### `pb(...values: SpacingValue[]): UtilityMixin`

Applies `padding-block`. One value applies both block edges; two values map to block-start then block-end.

**Parameters:**

- `values`: One value for both block edges, or two values for block-start then block-end — each a spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-block` on the host

**Example:**

```typescript
let result = u.pb(4);
```

#### `pbe(value: SpacingValue): UtilityMixin`

Applies `padding-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-block-end` on the host

**Example:**

```typescript
let result = u.pbe(4);
```

#### `pbs(value: SpacingValue): UtilityMixin`

Applies `padding-block-start` — the leading block edge, the top edge in a horizontal writing mode.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-block-start` on the host

**Example:**

```typescript
let result = u.pbs(4);
```

#### `pi(...values: SpacingValue[]): UtilityMixin`

Applies `padding-inline`. One value applies both inline edges; two values map to inline-start then inline-end.

**Parameters:**

- `values`: One value for both inline edges, or two values for inline-start then inline-end — each a spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-inline` on the host

**Example:**

```typescript
let result = u.pi(4);
```

#### `pie(value: SpacingValue): UtilityMixin`

Applies `padding-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-inline-end` on the host

**Example:**

```typescript
let result = u.pie(4);
```

#### `pis(value: SpacingValue): UtilityMixin`

Applies `padding-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length

**Returns:**

- A `UtilityMixin` that sets `padding-inline-start` on the host

**Example:**

```typescript
let result = u.pis(4);
```

#### `squircle(name: RadiusName | (string & {})): UtilityMixin`

A shape pattern for continuous rounded corners: sets a radius and uses `corner-shape` as progressive enhancement where supported, falling back to the plain radius shape everywhere else. Composes `u.rounded()` and `u.corner("squircle")`.

**Parameters:**

- `name`: A named radius-scale value (`"none"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"full"`) or a raw CSS length; defaults to `"md"`

**Returns:**

- A `UtilityMixin` that sets `border-radius` on the host and, where supported, `corner-shape: squircle` behind `@supports`

**Example:**

```typescript
let result = u.squircle("lg");
```

### Color

#### `accent(value?: ColorValue): UtilityMixin`

Sets `accent-color`, the property native form controls (`checkbox`, `radio`, `range`, `progress`) use to paint their own control surface. Defaults to `"brand"` when called with no argument, so a bare `u.accent()` always resolves to the brand's solid color instead of the browser default.

**Parameters:**

- `value`: A `ColorValue` naming the tone to paint the control with. Accepts a bare semantic tone (`"brand"`, `"danger"`) which always resolves to that tone's `bg-solid` shade, a tone with an explicit suffix (`"danger.solid"`), or a raw palette reference (`"color.neutral.50"`). Defaults to `"brand"`.

**Returns:**

- A `UtilityMixin` that applies `accent-color`.

**Example:**

```typescript
let result = u.accent("danger");
```

#### `autofill(background?: ColorValue, foreground?: ColorValue): UtilityMixin`

Overrides the browser's autofill background and text color under `&:-webkit-autofill`, so an autofilled input keeps looking like every other input instead of getting the browser's own highlight color (often a bright yellow). Defaults to the system background/foreground tokens, matching a plain input's own default appearance.

**Parameters:**

- `background`: A `ColorValue` for the autofill background. Defaults to the system background token.
- `foreground`: A `ColorValue` for the autofill text color. Defaults to the system foreground token.

**Returns:**

- A `UtilityMixin` applying an inset `box-shadow`/`-webkit-box-shadow` and `-webkit-text-fill-color` (each with `!important`, required to override the browser's own autofill styling) nested under `&:-webkit-autofill`.

**Example:**

```typescript
let result = u.autofill();
let themedResult = u.autofill("neutral.tint", "neutral");
```

#### `bg(value?: ColorValue): UtilityMixin` (overloaded: `bg(options: BgOptions): UtilityMixin`)

Sets `background-color`, or a full set of background properties when given an options object instead of a bare color. Called with no argument it falls back to the tiny system default (`var(--ui-bg, Canvas)`); called with a semantic tone it requires an explicit `tint`/`solid` suffix so the call site states which background weight it means, rather than guessing a default. Called with an options object, only the given keys are set.

**Parameters:**

- `value`: A `ColorValue` describing the background to apply. Accepts a semantic tone with an explicit weight suffix (`"brand.tint"`, `"brand.solid"`) or a raw palette reference (`"color.neutral.50"`). Omit it to get the system default background.
- `options.color`: Sets `background-color`. Same accepted shapes as the bare `value` form.
- `options.image`: Sets `background-image` — a `url(...)` reference or a CSS gradient.
- `options.size`: Sets `background-size` (`"auto"`, `"cover"`, `"contain"`, or a raw string like `"100% auto"`).
- `options.position`: Sets `background-position` (e.g. `"center"`, `"top left"`, `"50% 50%"`).
- `options.repeat`: Sets `background-repeat` (`"repeat"`, `"no-repeat"`, `"repeat-x"`, `"repeat-y"`, `"round"`, `"space"`).
- `options.attachment`: Sets `background-attachment` (`"scroll"`, `"fixed"`, `"local"`).

**Returns:**

- A `UtilityMixin` that applies `background-color`, or whichever background properties the options object specifies.

**Example:**

```typescript
let result = u.bg("brand.tint");
let heroResult = u.bg({ image: "url(/hero.jpg)", size: "cover", position: "center" });
```

#### `border(value?: ColorValue): UtilityMixin` (overloaded: `border(options: BorderOptions): UtilityMixin`)

Sets `border-color`, or a full set of border properties when given an options object instead of a bare color. Called with no argument it falls back to the tiny system default (a translucent mix over `CanvasText`); called with a bare tone it defaults to that tone's plain `border` weight, which the theme layer promotes to `border-strong` under `prefers-contrast: more`. Called with an options object, only the given keys are set — when `width` is given without an explicit `style`, `style` defaults to `"solid"`, since `border-color`/`border-width` alone render nothing (CSS's initial `border-style` is `none`).

**Parameters:**

- `value`: A `ColorValue` describing the border color. Accepts a bare semantic tone (`"brand"`, resolving to its default `border` weight), a tone with an explicit suffix (`"brand.strong"`), or a raw palette reference (`"color.neutral.50"`). Omit it to get the system default border color.
- `options.color`: Same as the bare `value` form.
- `options.width`: Sets `border-width`. A bare number is treated as pixels; a string passes through unchanged.
- `options.style`: Sets `border-style`. Defaults to `"solid"` when `width` is given and `style` isn't.

**Returns:**

- A `UtilityMixin` that applies `border-color`, or whichever border properties the options object specifies.

**Example:**

```typescript
let result = u.border("brand.strong");
let thickResult = u.border({ color: "brand", width: 2 });
```

#### `fg(value?: ColorValue): UtilityMixin`

Sets `color` (foreground text color). Called with no argument it falls back to the tiny system default (`var(--ui-fg, CanvasText)`); called with a bare tone it defaults to that tone's plain `fg` weight.

**Parameters:**

- `value`: A `ColorValue` describing the text color. Accepts a bare semantic tone (`"brand"`, resolving to its default `fg` weight), a tone with an explicit suffix (`"brand.muted"`, `"brand.emphasis"`), or a raw palette reference (`"color.neutral.50"`). Omit it to get the system default text color.

**Returns:**

- A `UtilityMixin` that applies `color`.

**Example:**

```typescript
let result = u.fg("brand.muted");
```

#### `linearGradient(angle: number | GradientDirection, ...stops: GradientStop[]): string`

Builds a `linear-gradient(...)` value string for `u.bg({ image })` or any other `background-image` use. A plain string resolver, not a mixin. A numeric `angle` is treated as degrees; a string passes through unchanged, so CSS's own side/corner keywords work too (`"to right"`, `"to top left"`) and get autocomplete via the `GradientDirection` type, alongside raw angle strings (`"45deg"`, `"0.25turn"`) via its `(string & {})` escape hatch.

**Parameters:**

- `angle`: A number of degrees, or a `GradientDirection` — one of the named side/corner keywords, or any other raw CSS angle/direction string (`"45deg"`, `"0.25turn"`)
- `stops`: Each stop is a `GradientColor` (`"transparent"`, `"currentColor"`, or any other raw color string) or `{ color, position }` to add a stop position (e.g. `"20%"`)

**Returns:**

- The resolved `linear-gradient(...)` string

**Example:**

```typescript
let result = u.linearGradient(45, "red", { color: "blue", position: "80%" });
// "linear-gradient(45deg, red, blue 80%)"
let bgResult = u.bg({ image: u.linearGradient("to right", "brand.tint", "brand.solid") });
```

#### `radialGradient(shape: GradientShape, ...stops: GradientStop[]): string`

Builds a `radial-gradient(...)` value string for `u.bg({ image })` or any other `background-image` use. A plain string resolver, not a mixin. `shape` is the raw shape/size/position clause CSS expects — `GradientShape` is a template literal type covering the bare keywords (`"circle"`, `"closest-side"`) and their compound combinations (`"ellipse at top left"`, `"circle closest-side"`, `"circle closest-side at top left"`), each checked against `GradientPosition`'s named positions; any other clause (e.g. a percentage position) still passes through unchanged. Each stop is either a `GradientColor` or a `{ color, position }` pair.

**Parameters:**

- `shape`: A `GradientShape` — one of the named shape/extent keywords, one of their compound combinations with a `GradientPosition`, or any other raw shape/size/position clause
- `stops`: Each stop is a `GradientColor` (`"transparent"`, `"currentColor"`, or any other raw color string) or `{ color, position }` to add a stop position

**Returns:**

- The resolved `radial-gradient(...)` string

**Example:**

```typescript
let result = u.radialGradient("circle at top left", "red", "blue");
// "radial-gradient(circle at top left, red, blue)"
```

#### ``conicGradient(angle: number | `from ${number}deg` | `from ${number}deg at ${GradientPosition}` | (string & {}), ...stops: GradientStop[]): string``

Builds a `conic-gradient(...)` value string for `u.bg({ image })` or any other `background-image` use. A plain string resolver, not a mixin. A numeric `angle` is treated as degrees and wrapped in the `from` keyword CSS requires; a string passes through unchanged, so the full `from <angle> at <position>` clause can be given directly — typed as a template literal against `GradientPosition`'s named positions, so the common `` `from ${number}deg at ${GradientPosition}` `` shape gets real structure instead of a bare `string`. Any other clause (e.g. a percentage position) still passes through unchanged.

**Parameters:**

- `angle`: A number of degrees (wrapped as `from {n}deg`), a template literal `from ${n}deg` or `from ${n}deg at ${GradientPosition}` string, or any other raw `from <angle> at <position>` string
- `stops`: Each stop is a `GradientColor` (`"transparent"`, `"currentColor"`, or any other raw color string) or `{ color, position }` to add a stop position

**Returns:**

- The resolved `conic-gradient(...)` string

**Example:**

```typescript
let result = u.conicGradient(45, "red", "blue");
// "conic-gradient(from 45deg, red, blue)"
```

#### `outline(color?: ColorValue, width?: number): UtilityMixin` (overloaded: `outline(width: number): UtilityMixin`, `outline(options: OutlineOptions): UtilityMixin`)

Applies an outline: `outline-color`/`outline-width`/`outline-style` together with `outline-offset` — a property CSS's `outline` shorthand never includes, so setting it always takes a separate declaration. Unlike `u.ring()`, this is unconditional — it doesn't nest under `&:focus-visible`, so use it for a persistent or decorative outline rather than a focus indicator. A bare string is a color, a bare number is a width (in pixels), the two together set both, and an options object sets every property at once, including `style` and `offset`.

**Parameters:**

- `color`: A `ColorValue` describing the outline color. Same accepted shapes as `u.border()`'s color. Defaults to the system ring color.
- `width`: A width in pixels. Defaults to `2`.
- `options.color`: Same as the bare `color` form.
- `options.width`: Sets `outline-width`. A bare number is treated as pixels; a string passes through unchanged. Defaults to `2`.
- `options.style`: Sets `outline-style`. Defaults to `"solid"`.
- `options.offset`: Sets `outline-offset`, the gap between the outline and the element's border edge. A bare number is treated as pixels; a string passes through unchanged.

**Returns:**

- A `UtilityMixin` that applies `outline-color`, `outline-width`, `outline-style`, and (when given) `outline-offset`.

**Example:**

```typescript
let result = u.outline();
let dangerResult = u.outline("danger");
let thickResult = u.outline(4);
let dangerThickResult = u.outline("danger", 4);
let offsetResult = u.outline({ color: "danger", offset: 4 });
```

#### `ring(value?: ColorValue): UtilityMixin`

Applies a focus ring. It composes `u.focusVisible()` internally, so the outline it draws only appears under `&:focus-visible` — keyboard and assistive-tech focus — never on a plain mouse `:focus`. Called with no argument the ring color falls back to the tiny system default (`var(--ui-ring, Highlight)`).

**Parameters:**

- `value`: A `ColorValue` describing the ring color. Accepts a bare semantic tone (`"danger"`, resolving to its default `ring` weight), a tone with an explicit suffix, or a raw palette reference (`"color.neutral.50"`). Omit it to get the system default ring color.

**Returns:**

- A `UtilityMixin` that applies the outline declarations nested under `&:focus-visible`.

**Example:**

```typescript
let result = u.ring("danger");
```

#### `surface(recipe?: SurfaceRecipe): UtilityMixin`

A surface recipe, not a single-property utility: composes `u.bg()`, `u.fg()`, and `u.border()` together so a surface's background, text, and border are chosen as a matching set rather than one channel at a time. Only accepts one of the four recipe shapes below — never a raw palette value like `"color.brand.500"` — because a surface must preserve contrast by construction.

**Parameters:**

- `recipe`: A `SurfaceRecipe` naming which surface to build. Accepts:
  - `"default"` — the tiny system defaults: `u.bg()`, `u.fg()`, and `u.border()` with no arguments (`Canvas`/`CanvasText`/translucent border). This is also the default when `recipe` is omitted.
  - `"muted"` — a neutral, low-emphasis surface: `neutral.tint` background, `neutral` foreground, `neutral` border.
  - a bare tone (e.g. `"brand"`, `"danger"`) — a solid, high-emphasis surface: that tone's `solid` background, `onSolid` foreground, and `solid` border (background and border match, so the surface reads as one filled block).
  - `${tone}.tinted` (e.g. `"brand.tinted"`) — a soft, tinted surface: that tone's `tint` background, `emphasis` foreground, and `border` border.

**Returns:**

- A `UtilityMixin` composing the background, foreground, and border declarations for the chosen recipe.

**Example:**

```typescript
let result = u.surface("brand.tinted");
```

#### `translucent(name?: BlurName): UtilityMixin`

An optional translucent surface pattern: a solid background plus a backdrop blur, gated behind `@media (prefers-reduced-transparency: no-preference)`. A user who has requested reduced transparency keeps the plain solid background instead of ever getting a half-applied blur. Composes `u.bg()`'s system default, `u.backdropBlur()`'s declaration, and `u.media()`'s gate rather than hand-rolling a media query.

**Parameters:**

- `name`: A `BlurName` (`"sm"`, `"md"`, or `"lg"`) selecting the blur strength. Defaults to `"md"`.

**Returns:**

- A `UtilityMixin` applying the system default background plus a gated backdrop-filter blur.

**Example:**

```typescript
let result = u.translucent("sm");
```

### Typography

#### `balance(): UtilityMixin`

Balances line lengths across a wrapped block of text, so each line ends up closer to the same width instead of leaving a short last line. Best suited to short text such as headings — browsers cap balancing to a small number of lines, so it has no effect on long-form body copy. Use `pretty()` there instead.

**Returns:**

- A `UtilityMixin` that sets `text-wrap: balance`.

**Example:**

```typescript
let result = u.balance();
```

#### `font(name: FontFamilyName | (string & {})): UtilityMixin`

Applies `font-family` from the named font-family scale. Resolves through `var(--ui-font-{name}, fallback)`, so the family renders correctly even before an app defines the corresponding CSS variable.

**Parameters:**

- `name`: A named font-family (`sans`, `serif`, `mono`), or an app-extended name declared through module augmentation.

**Returns:**

- A `UtilityMixin` that sets `font-family`.

**Example:**

```typescript
let result = u.font("serif");
```

#### `leading(value?: LeadingValue): UtilityMixin`

Applies `line-height`. Named values resolve through `var(--ui-leading-{name}, fallback)`, so an app can override the scale without losing the sensible default; a raw number passes through unchanged as a unitless line-height multiplier.

**Parameters:**

- `value`: A named leading value (`none`, `tight`, `snug`, `normal`, `relaxed`, `loose`) or a raw unitless number. Defaults to `"normal"`.

**Returns:**

- A `UtilityMixin` that sets `line-height`.

**Example:**

```typescript
let result = u.leading("relaxed");
```

#### `lineClamp(lines: number): UtilityMixin`

Truncates text to a fixed number of lines with an ellipsis, using the standard `-webkit-line-clamp` trick (a `-webkit-box` with vertical box orientation). Widely supported despite the vendor prefix; there is no unprefixed equivalent with comparable support yet.

**Parameters:**

- `lines`: The number of lines to display before truncating with an ellipsis.

**Returns:**

- A `UtilityMixin` that sets `display: -webkit-box`, `-webkit-box-orient: vertical`, `-webkit-line-clamp`, and `overflow: hidden`.

**Example:**

```typescript
let result = u.lineClamp(3);
```

#### `nowrap(): UtilityMixin`

Prevents text from wrapping onto multiple lines, letting it overflow its box instead. Pair with `truncate()` when overflow should end in an ellipsis rather than spill out.

**Returns:**

- A `UtilityMixin` that sets `white-space: nowrap`.

**Example:**

```typescript
let result = u.nowrap();
```

#### `pretty(): UtilityMixin`

Avoids leaving a short orphan word alone on the last line of a wrapped block. Unlike `balance()`, it scales to long-form body copy since browsers don't cap how many lines it applies to.

**Returns:**

- A `UtilityMixin` that sets `text-wrap: pretty`.

**Example:**

```typescript
let result = u.pretty();
```

#### `text(name: TextSizeName | (string & {})): UtilityMixin`

Applies `font-size` from the named text scale (`xs` through `9xl`, or an app-extended name) together with its paired `line-height`. Font size resolves through `var(--ui-text-{name}, fallback)`; line height resolves through the companion `var(--ui-leading-{name}, 1.5)` variable, so an app extending the scale with a custom name (say, `hero`) gets a matched line height the moment it defines `--ui-leading-hero` alongside `--ui-text-hero`. This utility does not set `font-family` — pair it with `font()`, or reach for `type()` when a call site also wants the base sans family in one call.

**Parameters:**

- `name`: A named text size (`xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`, `8xl`, `9xl`), or an app-extended name declared through module augmentation.

**Returns:**

- A `UtilityMixin` that sets `font-size` and `line-height`.

**Example:**

```typescript
let result = u.text("lg");
```

#### `textAlign(value?: TextAlignValue): UtilityMixin`

Applies `text-align` using the logical `start`/`end` keywords instead of physical `left`/`right`, so alignment flips automatically in right-to-left writing modes through the standard `dir` attribute. Only the logical values are accepted — `left` and `right` are never valid inputs.

**Parameters:**

- `value`: One of `start`, `center`, `end`, or `justify`. Defaults to `"start"`.

**Returns:**

- A `UtilityMixin` that sets `text-align`.

**Example:**

```typescript
let result = u.textAlign("end");
```

#### `tracking(value?: TrackingValue): UtilityMixin`

Applies `letter-spacing` from the named tracking scale, resolving through `var(--ui-tracking-{name}, fallback)` so the scale works before an app ever defines the variable.

**Parameters:**

- `value`: A named tracking value (`tighter`, `tight`, `normal`, `wide`, `wider`, `widest`). Defaults to `"normal"`.

**Returns:**

- A `UtilityMixin` that sets `letter-spacing`.

**Example:**

```typescript
let result = u.tracking("wide");
```

#### `truncate(): UtilityMixin`

Truncates single-line text with an ellipsis once it overflows its box. Composes `u.overflow("hidden")` and `u.nowrap()`, adding only `text-overflow: ellipsis` of its own. Requires the element to have a bounded inline size (a `max-inline-size`, a flex/grid item with `min-inline-size: 0`, or similar) — otherwise there is nothing for the text to overflow against.

**Returns:**

- A `UtilityMixin` that sets `overflow: hidden`, `white-space: nowrap`, and `text-overflow: ellipsis`.

**Example:**

```typescript
let result = u.truncate();
```

#### `type(name: TextSizeName | (string & {})): UtilityMixin`

A convenience combining `text()`'s `font-size`/`line-height` pair with the base sans font family, for the common case of setting a full text style in one call instead of pairing `u.font("sans")` with `u.text()` separately. Unlike bare `text()`, which is font-family agnostic so it composes under any `font()` a call site already applied, `type()` always opinionates the family to `sans` — reach for `text()` plus an explicit `font()` when a non-sans family is needed alongside a text size.

**Parameters:**

- `name`: A named text size (`xs` through `9xl`), or an app-extended name declared through module augmentation.

**Returns:**

- A `UtilityMixin` that sets `font-family`, `font-size`, and `line-height`.

**Example:**

```typescript
let result = u.type("lg");
```

#### `weight(value?: FontWeightValue): UtilityMixin`

Applies `font-weight`. Named values alias the standard numeric weight scale; a raw number passes through unchanged for values the named scale doesn't cover.

**Parameters:**

- `value`: A named weight (`thin` 100, `extralight` 200, `light` 300, `normal` 400, `medium` 500, `semibold` 600, `bold` 700, `extrabold` 800, `black` 900) or a raw number. Defaults to `"normal"`.

**Returns:**

- A `UtilityMixin` that sets `font-weight`.

**Example:**

```typescript
let result = u.weight("semibold");
```

### Effects

#### `backdropBlur(name?: BlurName | string): UtilityMixin`

Applies a `backdrop-filter: blur(...)` from the blur scale to the host element. It's an ungated primitive: it always applies the blur, even under `prefers-reduced-transparency`, unlike `u.translucent()`, which composes the accessible pattern with a solid-background fallback. Use `u.translucent()` when that gating is needed instead of composing this primitive by hand.

**Parameters:**

- `name`: A blur scale token name (e.g. `"sm"`, `"md"`, `"lg"`) or a raw CSS length. Defaults to `"md"`.

**Returns:**

- A `UtilityMixin` that sets `backdrop-filter` to the resolved blur value.

**Example:**

```typescript
let result = u.backdropBlur("lg");
```

#### `backfaceVisibility(value?: BackfaceVisibilityValue): UtilityMixin`

Controls whether the back face of a 3D-transformed element is rendered when it's rotated to face away from the viewer — `"hidden"` (the default) is what a flip-card or page-turn effect needs so the reversed face doesn't show through.

**Parameters:**

- `value`: `"visible"` or `"hidden"`. Defaults to `"hidden"`.

**Returns:**

- A `UtilityMixin` that sets `backface-visibility`.

**Example:**

```typescript
let result = u.backfaceVisibility();
```

#### `blur(name?: BlurName | string): UtilityMixin`

Applies a `filter: blur(...)` from the blur scale to the host element.

**Parameters:**

- `name`: A blur scale token name (e.g. `"sm"`, `"md"`, `"lg"`) or a raw CSS length. Defaults to `"md"`.

**Returns:**

- A `UtilityMixin` that sets `filter` to the resolved blur value.

**Example:**

```typescript
let result = u.blur("lg");
```

#### `opacity(value: number): UtilityMixin`

Applies opacity to the host element from a 0-100 integer, following Tailwind's convention, rather than the CSS `opacity` property's own native 0-1 range. The value is divided by 100 before being written out, so `opacity(50)` produces `opacity: 0.5`.

**Parameters:**

- `value`: An integer from 0 to 100, converted to the equivalent 0-1 CSS opacity value.

**Returns:**

- A `UtilityMixin` that sets `opacity` to `value / 100`.

**Example:**

```typescript
let result = u.opacity(50);
```

#### `rounded(name?: RadiusName | string): UtilityMixin`

Applies a corner radius to the host element from the radius scale or a raw CSS length.

**Parameters:**

- `name`: A radius scale token name (e.g. `"sm"`, `"md"`, `"lg"`) or a raw CSS length. Defaults to `"md"`.

**Returns:**

- A `UtilityMixin` that sets `border-radius` to the resolved value.

**Example:**

```typescript
let result = u.rounded("lg");
```

#### `shadow(name?: ShadowName | string): UtilityMixin`

Applies a box shadow to the host element from the shadow scale.

**Parameters:**

- `name`: A shadow scale token name (e.g. `"sm"`, `"base"`, `"md"`, `"lg"`) or a raw CSS value. Defaults to `"md"`.

**Returns:**

- A `UtilityMixin` that sets `box-shadow` to the resolved value.

**Example:**

```typescript
let result = u.shadow("lg");
```

### Overflow

#### `clip(): UtilityMixin`

Applies `overflow: clip`, the modern alternative to `overflow: hidden`. Unlike `hidden`, `clip` doesn't establish a scroll container, so the element's overflow can never become scrollable through user input, programmatic scrolling, or focusing a clipped descendant.

**Returns:**

- A `UtilityMixin` that sets `overflow` to `"clip"`.

**Example:**

```typescript
let result = u.clip();
```

#### `divide(axis?: DivideAxis, colorOrWidth?: ColorValue | string | number, maybeWidth?: number): UtilityMixin`

Applies a divider border between every child except the last, along the given axis. It accepts five distinct call shapes depending on which arguments are supplied.

**Parameters:**

- `axis`: `"block"` or `"inline"`, the axis the divider border is drawn on. Defaults to `"block"`.
- `colorOrWidth`: Either a color name/value, a border width in pixels, or omitted entirely. A string is resolved as a color through the semantic and palette token layers; a number in this position is instead read as the border width, letting a width be set without an explicit color.
- `maybeWidth`: A border width in pixels, only meaningful when `colorOrWidth` is a color.

Supported shapes: no arguments (default color and width, `"block"` axis); axis only; axis + color (1px width); axis + color + width; and axis + width (default color, `colorOrWidth` given as a number). With no color supplied, the divider falls back to the same tiny system default `u.border()` uses.

**Returns:**

- A `UtilityMixin` that applies a solid border to the block-end or inline-end edge of every non-last child.

**Example:**

```typescript
let result = u.divide();
let styledResult = u.divide("block", "brand", 2);
```

#### `noScrollbar(): UtilityMixin`

Hides the scrollbar on a scroll container across every browser engine — `::-webkit-scrollbar` for Chrome/Safari, `-ms-overflow-style` for legacy Edge, and `scrollbar-width` for Firefox — while leaving the element free to scroll through any other input (wheel, touch, keyboard, programmatic). Pair with `u.scroll()`/`u.overflow()` on the same element.

**Returns:**

- A `UtilityMixin` applying `-ms-overflow-style: none`, `scrollbar-width: none`, and a nested `&::-webkit-scrollbar { display: none }`.

**Example:**

```typescript
let result = u.noScrollbar();
```

#### `overflow(value?: OverflowValue | { x?: OverflowValue; y?: OverflowValue }): UtilityMixin`

Applies `overflow` to the host element, defaulting to `"hidden"`. Called with an axis object instead of a bare value, it composes `u.overflowX()`/`u.overflowY()` internally for whichever of `x`/`y` is given, leaving the other axis untouched.

**Parameters:**

- `value`: An `OverflowValue` (`"visible"`, `"hidden"`, `"auto"`, `"clip"`, or `"scroll"`) applied to both axes, or an object with independent `x`/`y` values. Defaults to `"hidden"`.

**Returns:**

- A `UtilityMixin` that sets `overflow`, or composes `overflowX`/`overflowY` when given an axis object.

**Example:**

```typescript
let result = u.overflow();
let xAxisResult = u.overflow({ x: "auto" });
```

#### `overflowX(value?: OverflowValue): UtilityMixin`

Applies `overflow-x` to the host element, independently of the block axis.

**Parameters:**

- `value`: An `OverflowValue`. Defaults to `"hidden"`.

**Returns:**

- A `UtilityMixin` that sets `overflow-x` to the given value.

**Example:**

```typescript
let result = u.overflowX("auto");
```

#### `overflowY(value?: OverflowValue): UtilityMixin`

Applies `overflow-y` to the host element, independently of the inline axis.

**Parameters:**

- `value`: An `OverflowValue`. Defaults to `"hidden"`.

**Returns:**

- A `UtilityMixin` that sets `overflow-y` to the given value.

**Example:**

```typescript
let result = u.overflowY("auto");
```

#### `scroll(axis?: ScrollAxis): UtilityMixin`

Turns the host element into a scroll container that only scrolls where its content actually overflows, along the given axis, rather than always showing scrollbars. Composes `u.overflowX("auto")`/`u.overflowY("auto")` internally for whichever axis is selected.

**Parameters:**

- `axis`: `"x"`, `"y"`, or `"both"`. Defaults to `"both"`.

**Returns:**

- A `UtilityMixin` that sets `overflow-x`/`overflow-y` to `"auto"` for the selected axis.

**Example:**

```typescript
let result = u.scroll();
let yAxisResult = u.scroll("y");
```

### Stacking

#### `isolate(): UtilityMixin`

Creates a new stacking context on the host element without otherwise changing its layout, so a later `z-index` on this element (or on a descendant) can't be interleaved with unrelated siblings outside it.

**Returns:**

- A `UtilityMixin` that sets `isolation` to `"isolate"`.

**Example:**

```typescript
let result = u.isolate();
```

#### `layer(value: number): UtilityMixin`

Composes `u.isolate()` and `u.z()` so a single call gets both a new stacking context and a stacking order. Only numbers are accepted — this package doesn't define named component layers such as `"toast"` or `"modal"`, since stacking order for those is an app or component concern, not a lower-level styling primitive.

**Parameters:**

- `value`: The numeric `z-index` to apply alongside the new stacking context.

**Returns:**

- A `UtilityMixin` that sets both `isolation: isolate` and `z-index`.

**Example:**

```typescript
let result = u.layer(10);
```

#### `z(value: number): UtilityMixin`

Sets the host element's `z-index` from a plain number. Only numbers are accepted — this package doesn't define named component layers such as `"toast"` or `"modal"`, since stacking order for those is an app or component concern, not a lower-level styling primitive.

**Parameters:**

- `value`: The numeric `z-index` to apply.

**Returns:**

- A `UtilityMixin` that sets `z-index` to the given value.

**Example:**

```typescript
let result = u.z(10);
```

### Accessibility

#### `debug(mode?: boolean | "nested"): UtilityMixin`

Outlines the host in red so a layout's boundaries are visible during development. It is a no-op in production builds, gated behind `import.meta.env.DEV`, so a call can be left in place without affecting shipped output. Passing `false` (the default) or omitting the argument disables the outline. Passing `true` outlines just the host element. Passing `"nested"` extends the same red outline to every descendant as well, via a `"& *"` descendant rule, which is useful for inspecting a layout's full box model rather than just its outer boundary.

**Parameters:**

- `mode`: `false` to disable (default), `true` to outline the host, or `"nested"` to outline the host and all of its descendants

**Returns:**

- A `UtilityMixin` that applies the debug outline in development and resolves to an empty style tree in production

**Example:**

```typescript
let result = u.debug();
let nestedResult = u.debug("nested");
```

#### `visuallyHidden(): UtilityMixin`

Applies the standard screen-reader-only clipping recipe. It keeps the host in the accessibility tree and in tab order — preserving its native focusability — while clipping away every rendered pixel, so it's suited to a compound control's native `<input>` when a sibling paints the visible indicator, or a `<label>` whose caption a paired visible control already carries.

**Returns:**

- A `UtilityMixin` that visually hides the host without removing it from the accessibility tree or tab order

**Example:**

```typescript
let result = u.visuallyHidden();
```

### State

#### `active(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element is in the `:active` state. Sugar over `when("&:active", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.active(u.bg("brand.solid"));
```

#### `checked(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element is checked, matching both native checked controls (`:checked`) and ARIA-checked custom widgets (`[aria-checked="true"]`). Sugar over `when('&:checked, &[aria-checked="true"]', input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.checked(u.bg("brand.solid"));
```

#### `detailsContent(input: UtilityInput): UtilityMixin`

Applies the given utilities to a `<details>` element's `::details-content` pseudo-element — the collapsible region holding everything after the `<summary>`. Sugar over `when("&::details-content", input)`. Combine with `u.open()`'s selector directly (`when("&[open]::details-content", input)`) for styles that should only apply once the disclosure is open.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.detailsContent([u.overflow("clip"), u.bs(0)]);
```

#### `disabled(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element is disabled, matching both `:disabled` and `[aria-disabled="true"]`. A selector wrapper only — it defines no visual disabled recipe of its own, so apps and components choose the actual colors, opacity, and cursor. Sugar over `when('&:disabled, &[aria-disabled="true"]', input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.disabled(u.opacity(50));
```

#### `focusVisible(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element matches `:focus-visible`. Sugar over `when("&:focus-visible", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.focusVisible(u.ring("brand"));
```

#### `focusWithin(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element or any of its descendants matches `:focus-within`. Sugar over `when("&:focus-within", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.focusWithin(u.border("brand"));
```

#### `hover(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element matches `:hover`. Sugar over `when("&:hover", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.hover(u.bg("brand.tint"));
```

#### `invalid(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element is invalid, matching both `:user-invalid` and `[aria-invalid="true"]`. A selector wrapper only — it defines no visual invalid recipe of its own. Sugar over `when('&:user-invalid, &[aria-invalid="true"]', input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.invalid(u.border("danger"));
```

#### `not(selector: string, input: UtilityInput): UtilityMixin`

A selector wrapper for negated state: wraps `selector` in `:not(...)` and applies the given utilities there.

**Parameters:**

- `selector`: The selector to negate, e.g. `":disabled"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.not(":disabled", u.opacity(100));
```

#### `open(input: UtilityInput): UtilityMixin`

Applies the given utilities when the host element is open, matching both the `<details>`/`<dialog>` `open` attribute and the Popover API's `:popover-open` pseudo-class. Sugar over `when("&[open], &:popover-open", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.open(u.opacity(100));
```

#### `when(selector: string, input: UtilityInput): UtilityMixin`

The primitive selector wrapper. Flattens `input`, merges the flattened utilities' style trees, and nests the merged tree under `selector`. Every other state wrapper (`hover()`, `checked()`, and so on) is sugar over this function.

**Parameters:**

- `selector`: The CSS selector to nest the merged styles under, e.g. `"&:has(input:checked)"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")]);
```

### Responsive

#### `at(size: ContainerName | (string & {}), input: UtilityInput): UtilityMixin` (overloaded: `at(size: ContainerName | (string & {}), name: string, input: UtilityInput): UtilityMixin`)

A container query, never a viewport media query — the nearest ancestor with `container-type: inline-size` (or `container-type: size`) is what `size` is compared against, so a component embedded in a narrow column adapts to that column's width instead of the page's. Called with a third argument, `name` targets a specific named container (established via `container-name` or the `container` shorthand on an ancestor) rather than whichever one is nearest.

**Parameters:**

- `size`: A named container size token, or a raw container-size string
- `name`: The named container to query. Omit to match the nearest container regardless of name, same as the two-argument call form.
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.at("md", [u.p(6), u.hstack({ gap: 4 })]);
let namedResult = u.at("md", "sidebar", u.p(6));
```

#### `dark(input: UtilityInput): UtilityMixin`

Applies the given utilities under dark mode, covering both a forced `.dark` ancestor class and the system `prefers-color-scheme: dark` preference. Sugar over `scheme("dark", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.dark(u.bg("neutral.solid"));
```

#### `light(input: UtilityInput): UtilityMixin`

Applies the given utilities under light mode, covering both a forced `.light` ancestor class and the system `prefers-color-scheme: light` preference. Sugar over `scheme("light", input)`.

**Parameters:**

- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.light(u.bg());
```

#### `media(query: string, input: UtilityInput): UtilityMixin`

The explicit escape hatch for a real viewport or feature media query, for the rare rule that must read the viewport or a user preference rather than a container — `u.at()` covers ordinary responsive layout instead.

**Parameters:**

- `query`: The media query condition, without the surrounding `@media`, e.g. `"(prefers-contrast: more)"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.media("(prefers-contrast: more)", u.border("brand.strong"));
```

#### `scheme(mode: "dark" | "light", input: UtilityInput): UtilityMixin`

The color-scheme wrapper for light and dark mode rules — not a direct `color-scheme` property utility. Applies the given utilities under both halves of the theme's dark-mode contract: a forced `.dark`/`.light` ancestor class, and system preference through a `.system` ancestor class gated behind the matching `prefers-color-scheme` media query. Both halves stay in sync so forced and system modes render identically. Composes `u.when()` for the class selectors and `u.media()` for the system-preference gate, with no hand-built selector or at-rule of its own.

**Parameters:**

- `mode`: Which color scheme the rule targets, `"dark"` or `"light"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.scheme("dark", u.bg("neutral.solid"));
```

#### `supports(query: string, input: UtilityInput): UtilityMixin`

A feature-query wrapper, applying the given utilities only when the browser supports `query` — progressive enhancement for CSS features without a reliable fallback path other than "don't apply this at all".

**Parameters:**

- `query`: The feature-query condition, without the surrounding `@supports`, e.g. `"(corner-shape: squircle)"`
- `input`: One utility mixin, or a (possibly nested) array of them, falsy values dropped

**Returns:**

- A utility mixin

**Example:**

```typescript
let result = u.supports("(corner-shape: squircle)", u.corner("squircle"));
```

### Animation

#### `animation(name: string, config: AnimationConfig): UtilityMixin` (overloaded: `animation(config: AnimationConfig): UtilityMixin`)

Composes `u.keyframes()` with the host `animation-*` declarations that reference it, emitting both in one mixin. It introduces no animation opinions of its own (no fade, slide, scale, spin, or shimmer recipes) — it only provides keyframe emission and declaration composition.

`animation()` is overloaded with two call shapes. The named form, `animation(name, config)`, emits the `@keyframes` rule under the given `name` — useful when the name needs to be recognizable in devtools. The unnamed form, `animation(config)`, generates a stable name from the keyframe content instead, so identical `keyframes` content always produces the identical name; use it for one-off animations that don't need a debuggable name.

**Parameters:**

- `name`: (named form only) The name to emit the `@keyframes` rule under and reference in `animationName`
- `config.keyframes`: The keyframe steps passed through to `u.keyframes()`
- `config.duration`: The value applied as `animationDuration`
- `config.easing`: Optional value applied as `animationTimingFunction`

**Returns:**

- A `UtilityMixin` that emits the `@keyframes` rule together with the host `animationName`, `animationDuration`, and (when given) `animationTimingFunction` declarations

**Example:**

```typescript
let named = u.animation("fade-in", {
	keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
	duration: "150ms",
	easing: "ease-out",
});

// Unnamed form — name is generated from the keyframes content
let unnamed = u.animation({
	keyframes: { from: { opacity: 0 }, to: { opacity: 1 } },
	duration: "150ms",
	easing: "ease-out",
});
```

#### `keyframes(name: string, frames: Record<string, CSSStyles>): UtilityMixin`

Emits an `@keyframes` rule under `name`. It only produces the keyframes rule itself and never sets `animationName`, `animationDuration`, or any other host declaration, so pair it with a plain `css()` call (or reach for `u.animation()` instead) to actually run it on an element.

**Parameters:**

- `name`: The name the `@keyframes` rule is emitted under
- `frames`: The keyframe steps (e.g. `from`/`to` or percentage keys) mapped to their styles

**Returns:**

- A `UtilityMixin` that emits the `@keyframes` rule, with no host declarations

**Example:**

```typescript
let result = u.keyframes("fade-in", {
	from: { opacity: 0 },
	to: { opacity: 1 },
});
```

### Transform

`transform` is a single CSS property, so a naive per-function utility would silently overwrite another transform utility applied to the same element. Every utility in this family instead sets its own CSS custom property (`--ui-translate-x`, `--ui-rotate`, ...) plus the exact same composite `transform` declaration — one fixed expression referencing every transform function's variable with an identity fallback (`0`, `0deg`, `1`). Custom properties from separate classes on the same element all apply simultaneously, so combining any number of these utilities in one `mix` array composes every function instead of the last one winning.

#### `rotate(value: AngleValue): UtilityMixin`

Rotates the element in its own 2D plane. A bare number is treated as degrees; a string passes through unchanged (e.g. `"0.25turn"`).

**Parameters:**

- `value`: A number (degrees) or a raw CSS angle string.

**Returns:**

- A `UtilityMixin` setting `--ui-rotate` and the composite `transform`.

**Example:**

```typescript
let result = u.rotate(45);
```

#### `rotateX(value: AngleValue): UtilityMixin`

Rotates the element in 3D around its horizontal axis — a flip-card or page-turn effect. Pair with `u.backfaceVisibility()` so the reversed face doesn't show through mid-rotation.

**Parameters:**

- `value`: A number (degrees) or a raw CSS angle string.

**Returns:**

- A `UtilityMixin` setting `--ui-rotate-x` and the composite `transform`.

**Example:**

```typescript
let result = u.rotateX(180);
```

#### `rotateY(value: AngleValue): UtilityMixin`

Rotates the element in 3D around its vertical axis — a flip-card or page-turn effect.

**Parameters:**

- `value`: A number (degrees) or a raw CSS angle string.

**Returns:**

- A `UtilityMixin` setting `--ui-rotate-y` and the composite `transform`.

**Example:**

```typescript
let result = u.rotateY(180);
```

#### `scale(value: ScaleValue): UtilityMixin`

Scales the element uniformly on both axes — sugar for setting `u.scaleX()` and `u.scaleY()` to the same factor in one call.

**Parameters:**

- `value`: A number (a unitless factor, `1` is unchanged) or a raw string (e.g. a percentage).

**Returns:**

- A `UtilityMixin` setting both `--ui-scale-x`/`--ui-scale-y` and the composite `transform`.

**Example:**

```typescript
let result = u.scale(1.5);
```

#### `scaleX(value: ScaleValue): UtilityMixin`

Scales the element along the horizontal axis only.

**Parameters:**

- `value`: A number (a unitless factor) or a raw string.

**Returns:**

- A `UtilityMixin` setting `--ui-scale-x` and the composite `transform`.

**Example:**

```typescript
let result = u.scaleX(1.5);
```

#### `scaleY(value: ScaleValue): UtilityMixin`

Scales the element along the vertical axis only.

**Parameters:**

- `value`: A number (a unitless factor) or a raw string.

**Returns:**

- A `UtilityMixin` setting `--ui-scale-y` and the composite `transform`.

**Example:**

```typescript
let result = u.scaleY(1.5);
```

#### `skewX(value: AngleValue): UtilityMixin`

Skews the element along the horizontal axis.

**Parameters:**

- `value`: A number (degrees) or a raw CSS angle string.

**Returns:**

- A `UtilityMixin` setting `--ui-skew-x` and the composite `transform`.

**Example:**

```typescript
let result = u.skewX(10);
```

#### `skewY(value: AngleValue): UtilityMixin`

Skews the element along the vertical axis.

**Parameters:**

- `value`: A number (degrees) or a raw CSS angle string.

**Returns:**

- A `UtilityMixin` setting `--ui-skew-y` and the composite `transform`.

**Example:**

```typescript
let result = u.skewY(10);
```

#### `translateX(value: SpacingValue): UtilityMixin`

Translates the element along the inline axis using the spacing scale or a raw CSS length.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length.

**Returns:**

- A `UtilityMixin` setting `--ui-translate-x` and the composite `transform`.

**Example:**

```typescript
let result = u.translateX(4);
```

#### `translateY(value: SpacingValue): UtilityMixin`

Translates the element along the block axis using the spacing scale or a raw CSS length.

**Parameters:**

- `value`: A spacing-scale number or a raw CSS length.

**Returns:**

- A `UtilityMixin` setting `--ui-translate-y` and the composite `transform`.

**Example:**

```typescript
let result = u.translateY(4);
```

### Tokens

Pure string resolvers from the `@pkg/u/tokens` subpath. None of these call `css()`, build a mixin, or register anything at runtime — they only stringify a token name into the `var(...)` reference a utility (or a component package building a larger CSS object by hand) should place in a declaration. Kept off the package root because four of them share a name with a utility mixin (`font`, `text`, `shadow`, `blur`) — importing from `@pkg/u/tokens` always gets the resolver, importing `u.font()` etc. from the root always gets the mixin.

#### `spacing(value: SpacingValue): string`

Resolves one spacing value to a CSS length.

**Parameters:**

- `value`: A number (resolved against the spacing scale), `"auto"`, or a raw CSS length string (`"13px"`, `"60ch"`, `"100dvh"`)

**Returns:**

- The resolved CSS length string

**Example:**

```typescript
let result = spacing(4);
// "calc(var(--ui-spacing, 0.25rem) * 4)"
```

#### `boxLength(value: SizeValue): string`

Resolves one sizing value to a CSS length, the same as `spacing()` plus `"full"` resolving to `100%` — the keyword `u.is()`/`u.bs()` and their `min`/`max` variants use for "fill the available space".

**Parameters:**

- `value`: Anything `spacing()` accepts, plus `"full"`

**Returns:**

- The resolved CSS length string

**Example:**

```typescript
let result = boxLength("full");
// "100%"
```

#### `isLength(value: unknown): boolean`

Reports whether `value` is a raw CSS length string (any of `px`, `ch`, `em`, `rem`, `%`, `vw`, `vh`, `dvw`, `dvh`, `vi`, `vb`, `svw`, `svh`, `lvw`, `lvh`, `cqw`, `cqh`, `cqmin`, `cqmax`) rather than a spacing-scale number.

**Parameters:**

- `value`: The value to test

**Returns:**

- `true` when `value` is a string matching a supported CSS length unit

**Example:**

```typescript
let result = isLength("13px");
// true
```

#### `color(value: ColorValue, defaultProperty?: string): string`

Resolves a color value to a `var(...)` reference. A raw palette value (`"color.brand.600"`) resolves to `var(--ui-color-brand-600)`. A semantic tone resolves to `var(--ui-{tone}-{property})`, where `property` is either the explicit suffix on `value` (aliased through a small friendly-name table — `tint`→`bg-tint`, `solid`→`bg-solid`, `muted`→`fg-muted`, `emphasis`→`fg-emphasis`, `onSolid`→`fg-on-solid`, `strong`→`border-strong`) or `defaultProperty` when `value` names a bare tone.

**Parameters:**

- `value`: A `ColorValue` — a raw palette reference, a tone with an explicit suffix, or a bare tone name
- `defaultProperty`: The property to use when `value` is a bare tone with no suffix; throws if omitted in that case

**Returns:**

- The resolved `var(...)` reference

**Example:**

```typescript
let result = color("brand.tint");
// "var(--ui-brand-bg-tint)"
```

#### `radius(name: RadiusName): string`

Resolves a named radius to `var(--ui-radius-{name}, fallback)`, with a sensible fallback baked in so the radius scale works before an app ever defines the variable.

**Parameters:**

- `name`: A named radius-scale value (`"none"`, `"sm"`, `"md"`, `"lg"`, `"xl"`, `"full"`, or an app-extended name)

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = radius("lg");
// "var(--ui-radius-lg, 0.5rem)"
```

#### `font(name: FontFamilyName): string`

Resolves a named font family to `var(--ui-font-{name}, fallback)`.

**Parameters:**

- `name`: A named font-family value (`"sans"`, `"serif"`, `"mono"`, or an app-extended name)

**Returns:**

- The resolved `var(...)` reference with its fallback font stack

**Example:**

```typescript
let result = font("serif");
// 'var(--ui-font-serif, ui-serif, Georgia, serif)'
```

#### `text(name: TextSizeName): string`

Resolves a named text size to `var(--ui-text-{name}, fallback)`.

**Parameters:**

- `name`: A named text-size value (`"xs"` through `"9xl"`, or an app-extended name)

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = text("lg");
// "var(--ui-text-lg, 1.125rem)"
```

#### `container(name: ContainerName): string`

Resolves a named container breakpoint to `var(--ui-container-{name}, fallback)`, the length `u.at()` compares the nearest container's inline size against.

**Parameters:**

- `name`: A named container-breakpoint value (`"xs"` through `"2xl"`, or an app-extended name)

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = container("md");
// "var(--ui-container-md, 36rem)"
```

#### `shadow(name: ShadowName): string`

Resolves a named shadow to `var(--ui-shadow-{name}, fallback)`.

**Parameters:**

- `name`: A named shadow value (`"sm"`, `"base"`, `"md"`, `"lg"`, or an app-extended name)

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = shadow("md");
```

#### `blur(name: BlurName): string`

Resolves a named blur strength to `var(--ui-blur-{name}, fallback)`.

**Parameters:**

- `name`: A named blur value (`"sm"`, `"md"`, `"lg"`, or an app-extended name)

**Returns:**

- The resolved `var(...)` reference with its fallback

**Example:**

```typescript
let result = blur("sm");
// "var(--ui-blur-sm, 4px)"
```

### Extensible Types

Empty interfaces from the package root, each holding token names as keys so an app can add its own through declaration merging. No runtime registry backs any of them — adding a name only changes what TypeScript accepts; the matching `--ui-*` variable is what makes it actually resolve.

- `ColorPalettes` — raw palette scale names (`neutral`, `brand`, `success`, `warning`, `danger` by default)
- `SemanticTones` — semantic tone names, mapped to the `bg-tint`/`bg-solid`/`fg`/`fg-muted`/`fg-emphasis`/`fg-on-solid`/`border`/`border-strong`/`ring` property set
- `Radii` — named corner-radius scale (`none`, `sm`, `md`, `lg`, `xl`, `full` by default)
- `TextSizes` — named font-size scale (`xs` through `9xl` by default)
- `FontFamilies` — named font-family stacks (`sans`, `serif`, `mono` by default)
- `Containers` — named container-query breakpoints (`xs` through `2xl` by default)
- `Shadows` — named box-shadow scale (`sm`, `base`, `md`, `lg` by default)
- `Blurs` — named blur scale (`sm`, `md`, `lg` by default)

Derived types built from these interfaces: `ColorPaletteName`, `SemanticToneName`, `RadiusName`, `TextSizeName`, `FontFamilyName`, `ContainerName`, `ShadowName`, `BlurName` (each `keyof` the interface above), `PaletteShade` (`50 | 100 | 200 | ... | 900 | 950`), and `ColorValue` — the union every color-accepting utility (`u.bg()`, `u.fg()`, `u.border()`, `u.ring()`, `u.accent()`, `u.surface()`) is typed against: a raw palette reference (`` `color.${ColorPaletteName}.${PaletteShade}` ``), a semantic tone with an explicit suffix (`` `${SemanticToneName}.${string}` ``), or a bare tone name.

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

## Related Packages

- [`@pkg/r3-ui`](/packages/r3-ui) - A component library built on `remix/ui` that styles its components through `css()` mixins and pairs naturally with these lower-level utilities.

## Tips

1. **Prefer the namespace import for application code** - `import * as u from "@pkg/u"` reads clearly at call sites (`u.p(4)`, `u.hover(...)`) and still tree-shakes down to only the utilities actually referenced.
2. **Reach for a wrapper before hand-rolling a selector or at-rule** - `u.when()`, `u.not()`, `u.hover()` and friends, `u.at()`, `u.media()`, and `u.supports()` all compose with any other utility; there's rarely a reason to write a raw nested selector by hand.
3. **`u.at()` is for layout, `u.media()` is the escape hatch** - default to container queries for responsive layout so a component adapts to the space it's actually given; reach for `u.media()` only for real viewport or user-preference queries like `prefers-contrast`.
4. **Token extension is additive only** - declaration merging can add a new name to `ColorPalettes`, `Radii`, and the rest, but it can't remove or override a built-in one — there's no way to "disable" a default token name through the type system.
5. **`u.surface()` chooses background, foreground, and border together** - reach for it instead of composing `u.bg()`/`u.fg()`/`u.border()` by hand whenever a surface needs to preserve contrast by construction.
6. **Accessibility gating is opt-in per utility, not automatic everywhere** - `u.translucent()` gates its blur behind `prefers-reduced-transparency` and `u.ring()` only ever shows on `:focus-visible`, but primitives like `u.backdropBlur()` apply unconditionally; reach for the gated pattern by name when it matters.
