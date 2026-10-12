# @sdxc/u

Utility-first styling for `remix/component`, composed from small, terse mixins.

Every export is a mixin factory for a `mix` prop. Plain utilities set CSS properties, and wrapper
utilities (`u.hover()`, `u.at()`, `u.dark()`, ...) nest any other utilities under a selector or
at-rule. Token names resolve to `--ui-*` custom properties, and logical properties are the
default, each with a physical counterpart.

## Installation

```sh
npm add @sdxc/u
```

Every utility returns a `remix/component` mixin, so [`remix`](https://www.npmjs.com/package/remix)
installs alongside this package.

## Usage

### Style an element

```tsx
import * as u from "@sdxc/u";

<section mix={[u.p(4), u.rounded("lg"), u.surface("muted"), u.vstack({ gap: 3 })]}>
	{children}
</section>;
```

A number on a spacing utility multiplies the spacing scale (`u.p(4)` is
`calc(var(--ui-spacing, 0.25rem) * 4)`), and a string passes through as a raw CSS length
(`u.p("1.5rem")`). Box utilities follow the logical 1/2/4-value mapping: `u.p(2, 4)` is block
then inline.

### Add state and responsive variants

```tsx
import * as u from "@sdxc/u";

<button
	mix={[
		u.surface("brand"),
		u.rounded("md"),
		u.p(2, 4),
		u.hover(u.bg("brand.tint")),
		u.ring("brand"),
		u.disabled([u.opacity(50), u.cursor("not-allowed")]),
		u.at("md", u.p(3, 6)),
		u.dark(u.border("neutral.strong")),
		u.motionSafe(u.transition("background-color")),
	]}
>
	Save
</button>;
```

A wrapper takes one utility, an array of them, or a falsy value, which it drops. `u.at()` is a
container query against the nearest ancestor declared with `u.container()`; `u.media()` is the
viewport query.

### Import the theme

```css
@import "@sdxc/u/theme.css";

:root {
	--ui-color-neutral-50: oklch(0.985 0 0);
	--ui-color-neutral-600: oklch(0.45 0 0);
	/* ...every shade from 50 through 950 */

	--ui-color-brand-50: oklch(0.97 0.02 250);
	--ui-color-brand-600: oklch(0.52 0.18 250);
	/* ...every shade from 50 through 950 */
}
```

`theme.css` maps the `neutral`, `brand`, `success`, `warning` and `danger` tones
(`--ui-{tone}-bg-tint`, `--ui-{tone}-fg`, `--ui-{tone}-border`, ...) onto a palette the app
defines as `--ui-color-{name}-{50..950}`, and sets the spacing, container, font and text-size
scales. Add the `dark` class to an ancestor such as `<html>` for dark mode, or `system` to follow
`prefers-color-scheme`.

Color utilities take a tone with a suffix (`"brand.tint"`, `"brand.solid"`, `"neutral.muted"`,
`"brand.emphasis"`, `"brand.onSolid"`, `"neutral.strong"`), a bare tone where the utility has a
default weight (`u.fg("brand")`), a palette shade (`"color.neutral.950"`), or any raw CSS color.

### Import by family

```tsx
import { bg, p } from "@sdxc/u";
import { hover } from "@sdxc/u/state";
import { ring } from "@sdxc/u/color/ring";
import { blur, spacing } from "@sdxc/u/tokens";

<a mix={[p(2), bg("neutral.tint"), hover(bg("brand.tint")), ring()]} />;

spacing(4); // "calc(var(--ui-spacing, 0.25rem) * 4)"
blur("sm"); // "var(--ui-blur-sm, 4px)"
```

Each family (`general`, `layout`, `size`, `color`, `typography`, `effects`, `overflow`,
`stacking`, `a11y`, `state`, `responsive`, `animation`, `transform`) has its own entry point,
and each utility its own module under it (`@sdxc/u/color/ring`). `@sdxc/u/tokens` holds the string
resolvers; four of them (`font`, `text`, `shadow`, `blur`) share a name with a root utility.

### Extend the token names

```ts
declare module "@sdxc/u" {
	interface SemanticTones {
		info: true;
	}
	interface ColorPalettes {
		info: true;
	}
}
```

```css
:root {
	--ui-color-info-50: oklch(0.97 0.02 230);
	--ui-color-info-600: oklch(0.52 0.18 230);
	/* ... */
	--ui-info-bg-tint: var(--ui-color-info-50);
	--ui-info-bg-solid: var(--ui-color-info-600);
	--ui-info-fg: var(--ui-color-info-600);
	--ui-info-fg-on-solid: white;
	--ui-info-border: var(--ui-color-info-200);
	--ui-info-border-strong: var(--ui-color-info-600);
	--ui-info-ring: var(--ui-color-info-500);
}
```

Every token family (palettes, tones, radii, text sizes, fonts, containers, shadows, blurs) is an
interface an app extends through declaration merging. The utilities then accept the new name
(`u.surface("info.tinted")`, `u.border("info")`) and resolve it to the matching `--ui-*`
variable.

## API

Every function returns a `UtilityMixin` for a `mix` prop unless its heading names another return
type. A parameter typed `UtilityInput` takes a `UtilityMixin`, a falsy value, or a nested array
of them. `SpacingValue` is a number on the spacing scale, `"auto"`, or a raw CSS length;
`SizeValue` adds `"full"` for `100%`. Filter, backdrop-filter, transform and box-shadow utilities
each write their own slot of one composite declaration, so `u.blur()` with `u.grayscale()`, or
`u.shadow()` with `u.ringShadow()`, combine instead of overriding each other.

### General

#### `calc(expression: string): string`

Wraps a CSS `calc()` expression: `calc({expression})`. Returns a plain string, usable anywhere a utility accepts a raw CSS value, typically with `u.var()` to combine a custom property with an arithmetic operation.

#### `counterIncrement(name: string, value?: number)`

Applies `counter-increment` to the element's CSS counter, named by the bare counter identifier `name`. `value` is the integer the counter is incremented by; omit it to fall back to CSS's own default of `1`.

#### `counterReset(name: string, value?: number)`

Applies `counter-reset`, creating or resetting the element's CSS counter named by the bare counter identifier `name`. `value` is the integer the counter is set to; omit it to fall back to CSS's own default of `0`.

#### `cursor(value: CursorValue | string)`

Applies `cursor`. Accepts any `CursorValue` keyword — `"pointer"` for an interactive control, `"not-allowed"` for a disabled one, `"default"` to force the plain arrow — or an arbitrary string for a `url(...)` cursor.

#### `combine(input: UtilityInput)`

Flattens `input` and merges the flattened utilities' style trees into one declaration set at the host's own level, so unrelated utilities compose as a single mixin with each nested selector kept as a sibling.

#### `env(name: string, fallback?: string): string`

Resolves a CSS environment variable reference: `env({name})`, or `env({name}, {fallback})` when a fallback is given. Returns a plain string, usable anywhere a utility accepts a raw CSS value.

#### `if(condition: unknown, input: UtilityInput): UtilityMixin | false`

Conditionally returns `input` as one mixin, or `false` when `condition` is falsy. A list (`u.if(active, [u.bg("brand.solid"), u.fg("brand.onSolid")])`) is merged through `u.combine()`, so it cascades as one unit.

#### `listStyle(value: ListStyleValue = "none")`

Applies `list-style`. Defaults to `"none"`, the common case of a `<ul>` or `<ol>` serving as a plain layout container.

#### `pointerEvents(value: PointerEventsValue = "none")`

Applies `pointer-events`. Defaults to `"none"`, the common case of an overlay, icon, or decorative element that should let clicks and hovers pass through to whatever's underneath it.

#### `pseudoContent(value: string)`

Applies the CSS `content` property, almost always on a `::before`/`::after` pseudo-element. The `pseudo` prefix keeps the name distinct from `@sdxc/u/layout`'s `content()`, which sets `align-content`.

#### `raw(styles: CSSStyles)`

Wraps a plain style object as a utility mixin, so bespoke declarations — a property outside this package's surface, or a call-site-computed value — compose inside wrappers like `when()`, whose inputs are utility mixins.

#### `touchAction(value: TouchActionValue = "none")`

Applies `touch-action`. Defaults to `"none"`, the common case of a custom drag handle or gesture surface that handles its own touch input.

#### `userSelect(value: UserSelectValue = "none")`

Applies `user-select`. Defaults to `"none"`, the common case of a label, icon, or drag handle that stays clear of highlight through an incidental click-drag.

#### `var(name: string, fallback?: string): string`

Resolves a custom property reference: `var(--{name})`, or with a fallback, `var(--{name}, {fallback})`. `name` omits the leading `--`, matching `u.vars()`; the raw string fits anywhere a utility takes a CSS value.

#### `vars(values: Record<string, string | number>)`

Sets custom properties on the host element, with the leading `--` omitted from each key so call sites read as plain option names.

#### `willChange(value: WillChangeValue)`

Applies `will-change`, hinting the browser to optimize for an upcoming animation on the given property/properties before it starts.

### Layout

#### `absolute()`

Sets `position: absolute`.

#### `anchor(name: string, side: AnchorSide, fallback?: string): string`

Resolves an `anchor()` reference to a plain string — the length an inset utility needs to pin an edge to the anchor's geometry. The leading `--` is prepended; `fallback` keeps the inset valid when no anchor resolves.

#### `anchorName(name: string)`

Applies `anchor-name`, the _declaring_ half of anchor positioning: it goes on the element anchored **to**, and `positionAnchor` points back at this name. The leading `--` is prepended — an anchor name is a dashed-ident.

#### `anchorSize(name: string, dimension: AnchorSizeDimension, fallback?: string): string`

Resolves an `anchor-size()` reference to a plain string, letting a panel track its trigger's size in one browser-maintained declaration. The leading `--` is prepended; `fallback` keeps it valid when no anchor resolves.

#### `appearance(value: AppearanceValue | string = "none", options: AppearanceOptions = {})`

Applies `appearance` (default `"none"`, clearing a form control's native chrome) together with its `-webkit-` and `-moz-` twins; `options.webkit` / `options.moz` set to `false` drop a prefix.

#### `basis(value: SizeValue = "auto")`

Applies `flex-basis`, defaulting to `"auto"` to match the property's own initial value — the remainder of a `flex: N N M` shorthand once `u.grow()`/`u.shrink()` have been extracted from it.

#### `block()`

Sets `display: block`.

#### `borderCollapse(value: BorderCollapseValue = "collapse")`

Applies `border-collapse`. Defaults to `"collapse"`, the common case of a table whose cell borders should merge into single lines instead of doubling up.

#### `borderSpacing(value: string)`

Applies the `border-spacing` property — the gap between adjacent table cell borders when `border-collapse: separate` is in effect (its default).

#### `boxSizing(value: BoxSizingValue)`

Applies `box-sizing`, controlling whether `width`/`height` (and the logical `inline-size`/`block-size` pair) span padding and border (`"border-box"`) or the content area alone (`"content-box"`, the CSS default).

#### `center()`

A zero-argument convenience pattern that centers content both ways. Composes `u.flex()`, `u.items("center")`, and `u.justify("center")`, so its output is exactly the declarations those three produce.

#### `contain(value: ContainValue = "content")`

Applies `contain`, letting the browser skip layout and paint work it can prove stays inside the subtree. Defaults to `"content"`; every value beyond `"none"` makes the element a containing block and a stacking context.

#### `container(name: string, type: ContainerTypeValue = "inline-size")`

Declares the host as a named container query context via the `container` shorthand (`container-name` and `container-type` together), so a descendant's `u.at(size, name, ...)` query can target it by name.

#### `content(value: JustifyValue = "start")`

Sets `align-content`, using the same accepted keywords and `between`/`around`/`evenly` aliasing as `u.justify()`.

#### `contentVisibility(value: ContentVisibilityValue = "auto")`

Applies `content-visibility` so the browser skips rendering work for an element's contents; defaults to `"auto"`. Long scrollable lists want `virtualize`, which also reserves a placeholder size for the scrollbar.

#### `contents()`

Sets `display: contents`, removing the host element's own box so its children participate directly in the parent's layout.

#### `fieldSizing(value: FieldSizingValue = "content")`

Applies `field-sizing` to an `<input>`, `<textarea>` or `<select>`. `"content"` (the default) sizes the control to its value; cap it with `u.maxBs()` or `u.maxIs()`.

#### `fixed()`

Sets `position: fixed`.

#### `flex()`

Sets `display: flex`.

#### `flexCol()`

Sets `flex-direction: column`.

#### `flexColReverse()`

Sets `display: flex; flex-direction: column-reverse`.

#### `flexRow()`

Sets `flex-direction: row`.

#### `flexRowReverse()`

Sets `display: flex; flex-direction: row-reverse`.

#### `flexWrap(value: "wrap" | "nowrap" | "wrap-reverse" = "wrap")`

Sets `flex-wrap`, defaulting to `wrap`.

#### `gap(...values: SpacingValue[])`

Applies `gap` using the spacing scale or a raw CSS length. One value applies to both the row and column gap; two values are read as `"{row} {column}"`.

#### `grid()`

Sets `display: grid`.

#### `gridArea(name: string)`

Applies `grid-area`, placing an element in a named area of its parent's `grid-template-areas`.

#### `gridAutoColumns(value: SizeValue)`

Applies `grid-auto-columns` to the _implicit_ columns a grid creates past its explicit tracks. A number resolves on the spacing scale, `"full"` to `100%`; raw strings such as `minmax(...)` reach CSS verbatim.

#### `gridAutoFlow(value: GridAutoFlowValue = "row")`

Applies `grid-auto-flow`, the axis auto-placed items fill along; defaults to `"row"`. `dense` backfills earlier holes with later items, diverging visual order from the DOM order focus follows — keep it presentational.

#### `gridAutoRows(value: SizeValue)`

Applies `grid-auto-rows` to the _implicit_ rows a grid creates past its explicit tracks. A number resolves on the spacing scale, `"full"` to `100%`; raw strings such as `minmax(...)` reach CSS verbatim.

#### `gridColumn(value: GridLineValue)`

Applies `grid-column`, shorthand for `grid-column-start` / `grid-column-end`: one value sets the start line and spans one track, a `"start / end"` string sets both. A number always reads as a line number.

#### `gridRow(value: GridLineValue)`

Applies `grid-row`, placing or spanning a grid item along the block axis. A number is a line number: `u.gridRow(2)` starts the item at the second row line and occupies one track, while `u.gridRow("span 2")` occupies two.

#### `gridTemplate(options: GridTemplateOptions = {})`

Applies `grid-template-columns`/`-rows`/`-areas` from whichever option keys are given. Track lists vary too continuously for a named scale, so values are raw CSS strings; `repeat` builds the `repeat(count, track)` shape.

`GridTemplateOptions`: `columns`, `rows` and `areas`, each a raw CSS string.

#### `grow(value: number | string = 1)`

Applies `flex-grow`. Defaults to `1`, the common case of a flexible item — a content area next to a fixed-size sidebar or icon — that should expand to fill whatever room is left in its flex container.

#### `hidden()`

Sets `display: none`, removing the host element from layout entirely.

#### `hstack(options: StackOptions = {})`

A horizontal flex stack. Composes `u.flex()`, `u.flexRow()`, and — from whichever option keys are given — `u.gap()`, `u.items()`, and `u.justify()`.

`StackOptions`: `gap` (spacing scale), `align` (`align-items`) and `justify` (`justify-content`).

#### `inline()`

Sets `display: inline`.

#### `inlineBlock()`

Sets `display: inline-block`.

#### `inlineFlex()`

Sets `display: inline-flex`.

#### `inlineGrid()`

Sets `display: inline-grid`.

#### `insBe(value: SpacingValue)`

Applies `inset-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

#### `insBottom(value: SizeValue)`

Applies the physical `bottom` property. Reach for it when the offset is genuinely tied to the physical bottom side; `u.insBe()` (`inset-block-end`) covers the logical block edge.

#### `insBs(value: SpacingValue)`

Applies `inset-block-start` — the leading block edge, the top edge in a horizontal writing mode.

#### `insIe(value: SpacingValue)`

Applies `inset-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

#### `insIs(value: SpacingValue)`

Applies `inset-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

#### `insLeft(value: SizeValue)`

Applies the physical `left` property, for offsets genuinely tied to the viewport's left side. `u.insIs()` (`inset-inline-start`) covers the writing-direction-aware default.

#### `insRight(value: SizeValue)`

Applies the physical `right` property, for offsets genuinely tied to the viewport's right side. `u.insIe()` (`inset-inline-end`) covers the writing-direction-aware default.

#### `insTop(value: SizeValue)`

Applies the physical `top` property, for offsets genuinely tied to the viewport's top side. `u.insBs()` (`inset-block-start`) covers the writing-direction-aware default.

#### `inset(...values: SpacingValue[])`

Applies a logical `inset` shorthand from the spacing scale or a raw CSS length. One value covers every side; two map to block then inline; four map to block-start, inline-end, block-end, inline-start.

#### `interpolateSize(value: InterpolateSizeValue = "allow-keywords")`

Opts the element into animating to and from keyword sizes (`auto`, `min-content`, `max-content`, `fit-content`), so a transition to `height: auto` or `block-size: auto` animates across its full duration.

#### `items(value: AlignItemsValue = "stretch")`

Sets `align-items` (`"start"`, `"center"`, `"end"`, `"baseline"`, `"stretch"`).

#### `justify(value: JustifyValue = "start")`

Sets `justify-content`, aliasing the short `between`/`around`/`evenly` forms to their `space-*` CSS keywords.

#### `place(options: PlaceOptions = {})`

Sets item and/or content placement on both axes from whichever option keys are given, so a partial options object emits only the declarations belonging to the keys it carries.

`PlaceOptions`: `items` (`place-items`) and `content` (`place-content`).

#### `positionAnchor(name: string)`

Points an absolutely or fixed positioned element (a tooltip, popover, or menu) at the anchor name `anchorName` declared on its target. Pass `name` bare; the `--` custom-property prefix is added here.

#### `positionArea(value: string)`

Applies the CSS Anchor Positioning `position-area` property, placing an anchor-positioned element in a named region of the 3x3 grid around its anchor. Accepts the whole logical-position-keyword grammar as a string.

#### `positionTryFallbacks(...values: string[])`

Applies the CSS Anchor Positioning `position-try-fallbacks` property, listing named tactics or `--custom-position-try` references tried in order when the preferred position overflows its containing block.

#### `relative()`

Sets `position: relative`.

#### `repeat(count: RepeatCount, track: RepeatTrack): string`

Builds a `repeat(...)` track-list value string for `u.gridTemplate()`'s `columns`/`rows` options, or any `grid-template-columns`/`-rows` use, since track sizing varies too continuously for a named scale to usefully cover.

#### `resize(value: ResizeValue = "block")`

Applies `resize`, controlling which axes a user can drag the element's resize handle along. Defaults to `"block"`, the shape most textareas want, and only takes effect on an element whose `overflow` is not `visible`.

#### `self(value: AlignSelfValue = "auto")`

Sets `align-self`.

#### `shrink(value: number | string = 0)`

Applies `flex-shrink`. Defaults to `0`, the common case of a fixed-size flex item — an icon or graphic slot — that keeps its size alongside the flexible content next to it.

#### `spacer()`

A flexible spacer: grows and shrinks to fill whatever room is left in a flex container, pushing siblings on either side of it apart — a toolbar's trailing action pinned to the end, or two row groups split to the edges.

#### `sticky()`

Sets `position: sticky`.

#### `virtualize(intrinsicSize: string)`

Applies `content-visibility: auto` with `contain-intrinsic-size` so the browser skips rendering off-screen rows in a long list or table, using `intrinsicSize` as a placeholder so the scrollbar doesn't jump on mount.

#### `vstack(options: StackOptions = {})`

A vertical flex stack. Composes `u.flex()`, `u.flexCol()`, and — from whichever option keys are given — `u.gap()`, `u.items()`, and `u.justify()`.

#### `zstack(options: ZStackOptions = {})`

A grid-overlay stack for layering children on top of each other. Composes `u.grid()` and, when given, `u.items()` for `align-items`; `justify-items` has no dedicated utility, so it's set directly.

`ZStackOptions`: `align` (`align-items`) and `justify` (`justify-items`).

### Size

#### `aspect(ratio: AspectRatioName)` / `aspect(width: number, height: number)`

Applies `aspect-ratio`, either from a width/height pair or one of the named ratios in `AspectRatioName`. Ratios vary too continuously for a full token family to pay for itself, so only a handful of common shapes get names.

#### `bleed(value: SpacingValue = 4)`

Pulls the host past its container's inline padding by `value` on both sides via a negative inline margin — for a full-bleed image or divider inside an otherwise padded section, composing `u.mi()` with a negated length.

#### `bs(value: SizeValue)`

Applies `block-size` — the logical height, which is the physical width in a vertical writing mode.

#### `circle()`

A shape pattern for circular boxes: a square aspect ratio plus full radius — an avatar frame, a status dot, an icon badge. Composes `u.aspect("square")` and `u.rounded("full")`.

#### `corner(shape: CornerShape)`

Applies `corner-shape` behind `@supports`, so browsers without it keep the plain `border-radius` shape.

#### `fit(value: FitValue = "cover")`

Applies `object-fit`, shaping how a container-sized media element (`img`, `video`) fills its box.

#### `height(value: SizeValue)`

Applies the physical `height` property, keeping element size tied to the viewport axis across writing-modes and directions. Prefer `u.bs()` (`block-size`) for content that should track the logical block axis.

#### `is(value: SizeValue)`

Applies `inline-size` — the logical width, which is the physical height in a vertical writing mode.

#### `m(...values: SpacingValue[])`

Applies logical margin using the spacing scale, `"auto"`, or a raw CSS length. Follows the same 1/2/4-value logical mapping as `p()` — see [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

#### `marginLeft(value: SpacingValue)`

Sets the physical `margin-left` property directly, pinned to the fixed left edge regardless of writing direction. Prefer `u.mi()` (`margin-inline`) for direction-aware margins.

#### `marginRight(value: SpacingValue)`

Sets the physical `margin-right` property directly, pinned to the fixed right edge regardless of writing direction. Prefer `u.mi()` (`margin-inline`) for direction-aware margins.

#### `paddingLeft(value: SpacingValue)`

Applies the physical `padding-left` property, for padding pinned to a fixed, physical viewport edge — such as a safe-area-inset offset on a docked panel. Prefer `u.pis()`/`u.pi()` for logical inline padding.

#### `paddingRight(value: SpacingValue)`

Applies the physical `padding-right` property, for padding pinned to a fixed, physical viewport edge — such as a safe-area-inset offset on a docked panel. Prefer `u.pie()`/`u.pi()` for logical inline padding.

#### `maxBs(value: SizeValue)`

Applies `max-block-size`.

#### `maxHeight(value: SizeValue)`

Applies the physical `max-height` property, for components whose sizing tracks the physical viewport axis. Use `u.maxBs()` (`max-block-size`) for the logical block-axis default.

#### `maxIs(value: SizeValue)`

Applies `max-inline-size`.

#### `maxWidth(value: SizeValue)`

Applies the physical `max-width` property, for elements whose sizing is genuinely tied to the physical viewport axis. Prefer `u.maxIs()` (`max-inline-size`) for the logical default.

#### `mb(...values: SpacingValue[])`

Applies `margin-block`. One value applies both block edges; two values map to block-start then block-end.

#### `mbe(value: SpacingValue)`

Applies `margin-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

#### `mbs(value: SpacingValue)`

Applies `margin-block-start` — the leading block edge, the top edge in a horizontal writing mode.

#### `mi(...values: SpacingValue[])`

Applies `margin-inline`. One value applies both inline edges; two values map to inline-start then inline-end.

#### `mie(value: SpacingValue)`

Applies `margin-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

#### `minBs(value: SizeValue)`

Applies `min-block-size`.

#### `minHeight(value: SizeValue)`

Applies the physical `min-height` property. Prefer `u.minBs()` (`min-block-size`) unless the element's sizing must track the physical viewport axis regardless of writing-mode or direction.

#### `minIs(value: SizeValue)`

Applies `min-inline-size`.

#### `minWidth(value: SizeValue)`

Applies the physical `min-width` property, for elements whose sizing is tied to the physical viewport axis. Prefer `u.minIs()` (`min-inline-size`) for the logical default.

#### `mis(value: SpacingValue)`

Applies `margin-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

#### `objectPosition(value: ObjectPositionValue = "center")`

Applies `object-position`, choosing which part of a replaced element's cropped content stays visible, keeping a subject's face in frame once `u.fit("cover")` crops it. Only works with `u.fit()` on replaced elements.

#### `p(...values: SpacingValue[])`

Applies logical padding using the spacing scale or a raw CSS length. One value applies all sides; two values map to block then inline; four values map to block-start, inline-end, block-end, and inline-start.

#### `pb(...values: SpacingValue[])`

Applies `padding-block`. One value applies both block edges; two values map to block-start then block-end.

#### `pbe(value: SpacingValue)`

Applies `padding-block-end` — the trailing block edge, the bottom edge in a horizontal writing mode.

#### `pbs(value: SpacingValue)`

Applies `padding-block-start` — the leading block edge, the top edge in a horizontal writing mode.

#### `pi(...values: SpacingValue[])`

Applies `padding-inline`. One value applies both inline edges; two values map to inline-start then inline-end.

#### `pie(value: SpacingValue)`

Applies `padding-inline-end` — the trailing inline edge, which is the right edge in `ltr` and the left edge in `rtl`.

#### `pis(value: SpacingValue)`

Applies `padding-inline-start` — the leading inline edge, which is the left edge in `ltr` and the right edge in `rtl`.

#### `safeAreaPadding(side: SafeAreaSide, fallback: string = "0px")`

Pads the given physical `side` by its `env(safe-area-inset-{side})` value, falling back to `fallback` (`"0px"` by default) on platforms with no safe area to avoid. Sets only that one physical padding property.

#### `squircle(name: RadiusName | string = "md")`

A shape pattern for continuous rounded corners: sets a radius, then refines it with `corner-shape` where supported, so every browser renders at least the plain rounded shape. Composes `u.rounded()` and `u.corner()`.

#### `width(value: SizeValue)`

Applies the physical `width` property, for an element whose sizing is tied to the physical viewport axis; `u.is()` (`inline-size`) covers sizing along the logical inline axis.

### Color

#### `accent(value: ColorValue | string = "brand")`

Applies `accent-color`, the property native form controls (`checkbox`, `radio`, `range`, `progress`) read for their own painted color. Defaults to the brand solid color so a bare `u.accent()` always resolves.

#### `autofill(background?: ColorValue | string, foreground?: ColorValue | string)`

Overrides the browser's autofill background and text color under `&:-webkit-autofill`, so an autofilled input keeps the appearance every other input has. Defaults to the system background/foreground tokens.

#### `bg(value?: ColorValue | string)` / `bg(options: BgOptions)`

Applies `background-color`, or the full set of background properties when given an options object, of which only the given keys are set. A semantic tone requires a `tint`/`solid` suffix so the call site states its weight.

`BgOptions`: `color`, `image`, `size`, `position`, `repeat`, `attachment`, `clip` (`"text"` clips the background to the glyphs).

#### `border(value?: ColorValue | string)` / `border(options: BorderOptions)`

Applies `border-color`, or the full set of border properties when given an options object, of which only the given keys are set. A bare tone resolves its plain `border` weight, which the theme promotes under high contrast.

`BorderOptions`: `color`, `width` (a number is pixels), `style` (`"solid"` when only `width` is given), and `noStyleDefault` to leave the style to another rule. `u.border("none")` removes the border.

#### `borderEdge(edge: BorderEdge, options: BorderEdgeOptions = {})`

Applies a border to a single edge only, for a divider between two adjacent elements (e.g. two stepper buttons sharing one frame). Only the given keys are set; prefer a logical edge so the divider follows writing mode.

`edge` is `"block-start"`, `"block-end"`, `"inline-start"`, `"inline-end"` or a physical side; `BorderEdgeOptions` takes the same keys as `BorderOptions`.

#### `caretColor(value?: ColorValue | string)`

Sets `caret-color` for an editable field, resolving a tone at its `fg` weight. With no value it emits `"auto"`, deriving the caret from the field's text color; pass a tone when that reads near-invisible on a tint.

#### `colorMix(colorSpace: string, ...stops: ColorMixStop[]): string`

Builds a `color-mix(...)` value string for any color-accepting property. `colorSpace` is the raw interpolation space CSS expects (`"oklab"`, `"srgb"`, `"hsl"`, ...).

#### `colorScheme(value: ColorSchemeValue = "light dark")`

Sets `color-scheme`, which tells the browser which schemes an element renders correctly in, so the chrome the browser paints itself — scrollbars, pickers, form controls — follows the theme. It inherits: set it on `<html>`.

#### `fg(value?: ColorValue | string)`

Applies `color` (foreground text color). Called with no value it resolves the tiny system default (`var(--ui-fg, CanvasText)`); called with a bare tone it defaults to that tone's plain `fg` weight.

#### `fill(value?: ColorValue | string)`

Applies the SVG `fill` paint property, resolving semantic tones the same way `color` does. With no value it resolves the system default (`var(--ui-fg, CanvasText)`); a bare tone resolves that tone's `fg` weight.

#### `fillOpacity(value: number | string)`

Sets the SVG `fill-opacity` paint property. A bare number is read as a 0-100 integer, matching `u.opacity()`.

#### `conicGradient(angle: number | string, ...stops: GradientStop[]): string`

Builds a `conic-gradient(...)` value string for any `background-image` use. A numeric `angle` is treated as degrees and wrapped in the `from` keyword CSS requires; a string passes through as the full `from ... at ...` clause.

#### `linearGradient(angle: number | GradientDirection, ...stops: GradientStop[]): string`

Builds a `linear-gradient(...)` value string for any `background-image` use. A numeric `angle` is treated as degrees; a string passes through unchanged, so CSS's own side/corner keywords work too.

#### `radialGradient(shape: GradientShape, ...stops: GradientStop[]): string`

Builds a `radial-gradient(...)` value string for any `background-image` use. `shape` is the raw shape/size/position clause CSS expects, so a compound clause such as `"ellipse at top left"` passes through unchanged.

#### `outline()` / `outline(color: ColorValue | string)` / `outline(width: number)` / `outline(color: ColorValue | string, width: number)` / `outline(options: OutlineOptions)`

Applies an outline unconditionally, for a persistent or decorative edge. A bare string is a color, a bare number is a width in pixels, the two together set both, and an options object sets every property at once.

`OutlineOptions`: `color` (the system ring color by default), `width` (`2` by default, pixels), `style` (`"solid"`), and `offset`.

#### `outlineColor(value?: ColorValue | string)`

Sets `outline-color` alone, so a state such as `[aria-invalid]` can tint an outline while the width and style already in effect stay in force. With no argument it resolves the system default ring color.

#### `outlineStyle(value: OutlineStyleValue)`

Sets `outline-style` alone, so a state can override the style while the color and width already in effect stay in force.

#### `outlineWidth(value: number | string)`

Sets `outline-width` alone, so a state can override the width while the color and style already in effect stay in force. A bare number is treated as pixels; a string passes through unchanged.

#### `ring(value?: ColorValue | string)`

Applies a focus ring already scoped to `&:focus-visible`, so it shows for keyboard and assistive-tech focus and a component can apply it directly.

#### `stroke(value?: ColorValue | string)`

Applies `stroke`, resolving a semantic tone to an SVG shape's outline color. With no value it resolves the system default `var(--ui-fg, CanvasText)`; a bare tone resolves that tone's `fg` weight.

#### `strokeLinecap(value: "butt" | "round" | "square")`

Sets `stroke-linecap`, the SVG paint property controlling how a `<path>`/`<line>` shape's stroke renders at the two open ends of an unclosed subpath.

#### `strokeLinejoin(value: "miter" | "round" | "bevel")`

Sets `stroke-linejoin`, the SVG paint property controlling how a `<path>`/`<polyline>`/`<polygon>` shape's stroke renders at a corner between two segments.

#### `strokeWidth(value: number | string)`

Sets `stroke-width` on an SVG shape. A bare number stays a unitless SVG user-unit value, so the stroke scales with the SVG's own coordinate system; a string passes through for a value that needs an explicit unit.

#### `surface(recipe: SurfaceRecipe = "default")`

Composes `u.bg()`, `u.fg()`, and `u.border()` so a surface's contrast holds by construction. Accepts recipe names only, because a surface's background, foreground, and border must be chosen as one matching set.

#### `translucent(name: BlurName | string = "md")`

A see-through background plus backdrop blur, gated behind `prefers-reduced-transparency: no-preference`; a reduced-transparency preference gets the opaque `--ui-bg` background and stays legible.

#### `vectorEffect(value: "none" | "non-scaling-stroke" | "non-scaling-size" | "non-rotation" | "fixed-position")`

Sets `vector-effect`, exempting an SVG shape from its ancestor transforms: `"non-scaling-stroke"` keeps a chart line's stroke width constant while the chart itself scales or zooms.

### Typography

#### `balance()`

Balances line lengths across a wrapped block, best suited to short text such as headings, since browsers cap balancing to a small number of lines. Use `pretty` for long-form body copy.

#### `font(name: FontFamilyName | string)`

Applies `font-family` from the named font scale (`sans`, `serif`, `mono`, or an app-extended name) via `var(--ui-font-{name}, fallback)`. `"inherit"` and `"unset"` pass through unchanged as literal CSS keywords.

#### `fontSize(name: TextSizeName | string)`

Applies `font-size` from the named text scale (`xs` through `9xl`, or an app-extended name), resolving the same token as `u.text()`'s font-size half but touching only `font-size`, leaving line-height fully caller-set.

#### `fontVariantNumeric(value: FontVariantNumericValue = "tabular-nums")`

Sets `font-variant-numeric`; `u.tabularNums()` covers the common tabular-nums case and shares the same declaration. Each keyword names an OpenType feature — a font that lacks it renders unchanged digits.

#### `hyphens(value: HyphensValue = "auto")`

Lets long words break with a hyphen instead of forcing the line short. `"auto"` hyphenates only when the element or an ancestor carries a `lang` attribute to pick a dictionary from — omit it and nothing hyphenates.

#### `leading(value: LeadingValue = "normal")`

Applies `line-height`. Named values resolve through `var(--ui-leading-{name}, fallback)`, so an app can override the scale without losing the default; numbers and other strings pass through unchanged.

#### `lineClamp(lines: number)`

Clamps text to `lines` lines, ending in an ellipsis, through `-webkit-line-clamp`.

#### `nowrap()`

Prevents text from wrapping onto multiple lines, letting it overflow its box instead. Pair with `truncate` when overflow should end in an ellipsis rather than spill out.

#### `overflowWrap(value: OverflowWrapValue = "break-word")`

Applies `overflow-wrap`, breaking a word only when it would otherwise overflow a bounded inline size, while ordinary text keeps its normal break points — ideal for a long URL, hash, or identifier in a narrow column.

#### `pretty()`

Avoids leaving a short orphan word alone on the last line of a wrapped block, scaling to long-form body copy since browsers don't cap how many lines it applies to.

#### `tabSize(value: number | string = 2)`

Applies `tab-size`. A bare number is stringified so it stays unitless — CSS would otherwise read it as a `px` length — while a string such as `"4ch"` passes through unchanged as a CSS length.

#### `tabularNums()`

Applies `font-variant-numeric: tabular-nums`, so digits render at a fixed width instead of their proportional metrics — a running total, countdown, or one-time-code field reads without its layout shifting as digits change.

#### `text(name: TextSizeName | string)`

Applies `font-size` and its paired `line-height` from the named text scale through matching `var(--ui-text-*)` / `var(--ui-leading-*)` properties, so an extended name inherits a sensible default leading before defining one.

#### `textAlign(value: TextAlignValue = "start")`

Applies `text-align` using the logical `start`/`end` keywords so alignment flips automatically under `dir="rtl"`. A raw value such as `"left"` or `"right"` is also accepted for alignment that must stay physical.

#### `textDecoration(value?: TextDecorationLineValue)` / `textDecoration(options: TextDecorationOptions)`

Applies `text-decoration-line` from a bare value, or sets only the given keys from a text-decoration options object. `thickness` and `offset` are kept separate because `text-decoration`'s shorthand cannot set or reset them.

`TextDecorationOptions`: `line`, `color`, `style`, `thickness` and `offset` (numbers are pixels).

#### `textTransform(value: TextTransformValue)`

Applies `text-transform`.

#### `tracking(value: TrackingValue = "normal")`

Applies `letter-spacing` from the named tracking scale, resolving through `var(--ui-tracking-{name}, fallback)` so the scale works before an app defines the variable; any other string is treated as a raw `letter-spacing` value.

#### `truncate()`

Truncates single-line text with an ellipsis once it overflows its box; requires a bounded inline size (`max-inline-size`, a flex/grid item with `min-inline-size: 0`, or similar) or there is nothing to overflow against.

#### `type(name: TextSizeName | string)`

Applies `u.text(name)` plus the `sans` font family; pair `u.text()` with `u.font()` for another family.

#### `verticalAlign(value: VerticalAlignValue)`

Applies `vertical-align`, e.g. for aligning an inline-block icon against adjacent text.

#### `weight(value: FontWeightValue = "normal")`

Applies `font-weight`. Named values alias the standard numeric weight scale (`thin` 100 through `black` 900); a raw number passes through unchanged for values the named scale doesn't cover.

#### `whiteSpace(value: WhiteSpaceValue = "pre-wrap")`

Applies `white-space`; also written by `u.nowrap()`, `u.truncate()`, and `u.visuallyHidden()`, so pick one. Defaults to `pre-wrap`, keeping preformatted line breaks while still wrapping in a narrow container.

#### `wordBreak(value: WordBreakValue = "normal")`

Applies `word-break`.

### Effects

#### `backdropBlur(name: BlurName | string = "md")`

Blurs the backdrop by a step from the blur scale, whatever the user's transparency preference; `u.translucent()` is the gated variant with a solid fallback. Sibling utilities combine through the shared composite filter.

#### `backdropBrightness(value: number | string = 1.1)`

Scales the backdrop's lightness — below `1` darkens, above `1` brightens — keeping overlaid text legible. Needs a partly transparent host background; combines with sibling backdrop utilities; `u.transparencySafe()` gates it.

#### `backdropContrast(value: number | string = 1.25)`

Pushes the backdrop away from (above `1`) or toward (below `1`) mid-grey; flattening it to a uniform tone keeps overlaid text legible. Needs a partly transparent host; sibling utilities combine; `u.transparencySafe()` gates it.

#### `backdropDropShadow(options: BackdropDropShadowOptions = {})`

Shadows the shapes showing through the host. The shadow shows only where the backdrop is transparent, so the shapes need their own backdrop root (a parent with `willChange("filter")`); over an opaque page it paints nothing. `u.transparencySafe()` gates it.

`BackdropDropShadowOptions` takes the same `x`, `y`, `blur` and `color` keys as `DropShadowOptions`.

#### `backdropGrayscale(value: number | string = 1)`

Desaturates the backdrop toward grey (`1` fully, `0` untouched) so a coloured overlay reads as the only hue in the area. Needs a partly transparent host; combines with sibling utilities; `u.transparencySafe()` gates it.

#### `backdropHueRotate(value: AngleValue = 90)`

Rotates the backdrop's hue while preserving lightness and saturation, so a busy backdrop pulls toward one brand hue with its light/dark structure intact. Needs a partly transparent host; `u.transparencySafe()` gates it.

#### `backdropInvert(value: number | string = 1)`

Inverts the colours showing through the element's translucent background. Composes with every other backdrop utility through the shared composite `backdropFilter`; wrap in `u.transparencySafe()` for a solid fallback.

#### `backdropOpacity(value: number | string = 0.5)`

Fades what shows through the element's translucent background, taking CSS's native `0`–`1` range or a percentage string. Composes with every other backdrop utility; wrap in `u.transparencySafe()` for a solid fallback.

#### `backdropSaturate(value: number | string = 1.4)`

Boosts or mutes the saturation of what shows through the element's translucent background. Composes with every other backdrop utility; wrap in `u.transparencySafe()` for a solid fallback.

#### `backdropSepia(value: number | string = 1)`

Shifts what shows through the element's translucent background toward a warm brown monochrome. Composes with every other backdrop utility; wrap in `u.transparencySafe()` for a solid fallback.

#### `backfaceVisibility(value: BackfaceVisibilityValue = "hidden")`

Controls whether the back face of a 3D-transformed element renders once it rotates away from the viewer; the `"hidden"` default keeps flip-card and page-turn effects showing only their front face.

#### `blur(name: BlurName | string = "md")`

Applies a blur from the blur scale by writing only its own `--ui-filter-blur` custom property, so it combines with `u.grayscale()`, `u.brightness()`, and every other filter utility in one composite `filter`.

#### `brightness(value: number | string = 1.1)`

Applies a `filter: brightness(...)`, scaling every pixel's lightness. Values below `1` darken and above `1` brighten; `0` is solid black.

#### `contrast(value: number | string = 1.25)`

Applies a `filter: contrast(...)`, pushing pixels away from (above `1`) or toward (below `1`) mid-grey; `0` flattens the element to uniform grey. Composes with every other filter utility through the shared composite filter.

#### `dropShadow(options: DropShadowOptions = {})`

Applies `filter: drop-shadow(...)`, shadowing the element's rendered shape — a PNG's alpha channel, an SVG icon's outline — with offsets and a blur radius. Composes with every filter utility through the shared composite `filter`.

`DropShadowOptions`: `x` (default `0`), `y` (`1`) and `blur` (`2`) on the spacing scale or as raw lengths, and `color`.

#### `filterOpacity(value: number | string = 0.5)`

Applies a `filter: opacity(...)`, fading the element inside the filter pipeline so one pass carries the fade along with any `blur()` or `grayscale()`. Takes CSS's native `0`–`1` range, or a percentage string.

#### `grayscale(value: number | string = 1)`

Applies a `filter: grayscale(...)`, desaturating toward grey; `1` (the default) is fully grey, dimming an inactive element while its layout holds. Purely visual, so pair it with a cue assistive technology can read.

#### `hueRotate(value: AngleValue = 90)`

Applies a `filter: hue-rotate(...)`, rotating every pixel's hue by the given angle while preserving lightness and saturation, so one source asset can be retinted per theme. A bare number is degrees; strings pass through as-is.

#### `invert(value: number | string = 1)`

Inverts colors (`1`, the default, fully) to flip single-color raster assets for dark mode. Composes through the shared composite `filter` declaration, so it combines with every other filter utility.

#### `mask(image: string)` / `mask(options: MaskOptions)`

Applies a CSS mask image, or the given subset of mask properties when passed an options object. Every property is mirrored onto its `-webkit-` prefixed twin, which Safari requires to render an element mask.

`MaskOptions`: `image`, `size`, `position`, `repeat` and `mode`.

#### `mixBlendMode(value: MixBlendModeValue = "multiply")`

Blends the element with the content painted behind it. Any value but `normal` makes the element its own stacking context, and blending stops at the nearest one — put `u.isolate()` on the ancestor that should bound it.

#### `opacity(value: number)`

Applies opacity from a 0-100 integer. Sets the `opacity` property, which flattens the element and all of its descendants into one group and fades that group as a whole.

#### `ringShadow(value: ColorValue | string, width: number | string = 2)`

Draws a selection ring that stays visible for as long as a component applies it, for persistently-selected swatches, chips, and thumbnails. Occupies the composite `boxShadow` `ring` slot, painting inside `u.shadow()`'s elevation.

#### `rounded(name: RadiusName | string = "md")`

Applies `border-radius` from the radius scale (`none`, `sm`, `md`, `lg`, `xl`, `full`) or a raw CSS length.

#### `roundedCorner(corner: LogicalCorner, name: RadiusName | string = "md")`

Applies a radius from the radius scale, or a raw CSS length, to one logical corner — for shapes that round three corners uniformly and differentiate the fourth, like a chat bubble's tail.

#### `saturate(value: number | string = 1.5)`

Applies a `filter: saturate(...)` to the element itself, where `0` is fully desaturated and values above `1` oversaturate. Writes into the shared composite `filter` declaration, so it stacks with every other filter utility.

#### `sepia(value: number | string = 1)`

Applies a `filter: sepia(...)`, shifting the element toward a warm brown monochrome; `1` (the default) is a full conversion. Writes into the shared composite `filter` declaration, so it stacks with every other filter utility.

#### `shadow(name: ShadowName | string = "md")`

Applies a box shadow from the shadow scale, written to the `elevation` slot of the shared composite `boxShadow` declaration. Claiming only that slot lets an elevation shadow and a `u.ringShadow()` render as two stacked layers. `"none"` clears the slot and a raw CSS shadow passes through.

#### `textShadow(options: TextShadowOptions = {})`

Applies `text-shadow`, tracing the glyph forms themselves. The practical use is keeping text legible over an image or video; a translucent scrim between the media and the text stays the reliable fix, with this layered on top.

`TextShadowOptions`: `x` (default `0`), `y` (`1`) and `blur` (`2`) on the spacing scale or as raw lengths, and `color` (a translucent black by default).

#### `transition(properties: string, options: TransitionOptions = {})`

Applies the `transition-property`/`transition-timing-function`/ `transition-duration` triplet behind most hover, focus, press and selection state changes, so a call site only names which properties animate.

`TransitionOptions`: `duration` (a number is milliseconds, `150` by default) and `easing` (`cubic-bezier(0.4, 0, 0.2, 1)` by default).

#### `transitionBehavior(value: TransitionBehaviorValue)`

Applies the `transition-behavior` property on its own; `"allow-discrete"` lets a discrete property such as `display` or `content-visibility` animate across a transition, commonly paired with `@starting-style`.

#### `transitionDelay(value: string = "0s")`

Applies `transition-delay` on its own, so items sharing one transition can stagger by giving each an increasing delay. Keep the stagger on the entering state and leave the leaving state at `0s`, so dismissal stays immediate.

#### `transitionDuration(value: string)`

Applies `transition-duration` on its own, so a media query such as `prefers-reduced-motion` can shrink an already-declared transition to zero while its property list and timing function stay in place.

#### `transitionProperty(value: string)`

Applies `transition-property` on its own, so a variant can change which properties animate while the duration and timing function declared elsewhere stay in place.

#### `visibility(value: VisibilityValue = "visible")`

Controls the CSS `visibility` property: a `"hidden"` element keeps its layout box and can transition back to `"visible"`, which is what a selection indicator or hover-triggered surface needs to fade in place.

### Overflow

#### `clip()`

Applies `overflow: clip`, the modern alternative to `overflow: hidden`. Overflow stays permanently unreachable: user input, programmatic scrolling, and focusing a clipped descendant all leave the element unscrolled.

#### `divide(axis: DivideAxis = "block", colorOrWidth?: ColorValue | string | number, maybeWidth?: number)`

Applies a divider border between every child except the last, along `axis`. A number in the color position is read as the border width, so a width can be set alone; a color name resolves through the semantic and palette tokens.

#### `noScrollbar()`

Hides the scrollbar across Chrome/Safari, legacy Edge, and Firefox, while the element stays scrollable by wheel, touch, keyboard, and script. Pair with `u.scroll()`/`u.overflow()` on the same element.

#### `overflow(value: OverflowValue | { x?, y?, inline?, block? } = "hidden")`

Applies `overflow`, defaulting to `"hidden"`. An axis object sets only the axes it names and leaves the rest untouched; prefer its `inline`/`block` keys over `x`/`y` to stay correct under RTL and vertical writing modes.

#### `overflowAnchor(value: OverflowAnchorValue = "none")`

Applies `overflow-anchor`, the browser's choice of which element holds the scroll position steady as content above it resizes. The `"none"` default suits infinite-scroll sentinels, whose own growth fights anchoring.

#### `overflowBlock(value: OverflowValue = "hidden")`

Applies `overflow-block`, independently of the inline axis. The block axis follows writing mode and direction, so the utility stays correct under RTL and vertical writing modes.

#### `overflowInline(value: OverflowValue = "hidden")`

Applies `overflow-inline`, independently of the block axis. The inline axis follows writing mode and direction, so the utility stays correct under RTL and vertical writing modes.

#### `overflowX(value: OverflowValue = "hidden")`

Applies `overflow-x`, independently of the block axis.

#### `overflowY(value: OverflowValue = "hidden")`

Applies `overflow-y`, independently of the inline axis.

#### `overscrollBehavior(value: OverscrollBehaviorValue = "contain")`

Applies `overscroll-behavior`, defaulting to `"contain"`: a scroll past the end stays inside this element and the platform affordance — iOS rubber-banding, Android pull-to-refresh — survives. `"none"` suppresses it.

#### `scroll(axis: ScrollAxis = "both")`

Turns the element into a scroll container that reveals a scrollbar only where content actually overflows the given axis, defaulting to `"both"`. Composes `u.overflowX("auto")`/`u.overflowY("auto")` for the selected axis.

#### `scrollBehavior(value: ScrollBehaviorValue = "smooth")`

Applies `scroll-behavior`, defaulting to `"smooth"`, so anchor jumps and programmatic scrolls animate. Smooth scrolling is motion: wrap the call in `u.motionSafe()` to honor a reduced-motion preference with an instant jump.

#### `scrollMargin(...values: SpacingValue[])`

Applies logical `scroll-margin` on a scroll item, growing the box the container aligns when it snaps to this item or an anchor jump targets it, so a sticky header clears only the items that need the extra room.

#### `scrollPadding(...values: SpacingValue[])`

Applies logical `scroll-padding` so a scroll snap position or anchor jump lands clear of a sticky header — set it to the header's height. Follows `p()`'s 1/2/4-value logical mapping; see [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).

#### `scrollSnapAlign(value: ScrollSnapAlignValue = "start")`

Applies `scroll-snap-align`, defaulting to `"start"`, on the snap _items_ — the children of the scroll container — while `u.scrollSnapType()` goes on the _container_; swapping the two silently disables snapping either way.

#### `scrollSnapStop(value: ScrollSnapStopValue = "always")`

Applies `scroll-snap-stop` to a snap item, defaulting to `"always"` so a fast flick rests on the item and one swipe advances exactly one page. `"normal"` lets momentum carry past it.

#### `scrollSnapType(axis: ScrollSnapAxis | "none" = "inline", strictness: ScrollSnapStrictness = "mandatory")`

Applies `scroll-snap-type` to a scroll container, defaulting to `"inline mandatory"`, the paged-carousel case; pass `"none"` to disable snapping. Snapped children need `u.scrollSnapAlign()`.

#### `scrollbarColor(thumb?: ColorValue | string, track?: ColorValue | string)`

Themes a scroll container's scrollbar via the standard `scrollbar-color` property, supported by Firefox and modern Chromium alike through plain CSS. Inherits down the tree, theming nested scroll containers too.

#### `scrollbarGutter(value: ScrollbarGutterValue = "stable")`

Applies `scrollbar-gutter`, defaulting to `"stable"`, so the container is already the size it settles at and content holds its position the moment a scrollbar appears. Takes effect on a scroll container (`u.scroll()`).

#### `thinScrollbar()`

Requests a thin scrollbar that reserves its gutter up front, so layout stays put whether or not the scrollbar is showing. Pair with `u.scroll()`/`u.overflow()` on the same scroll container.

### Stacking

#### `isolate()`

Creates a new stacking context on the host element while preserving its layout, so a later `z-index` on this element (or a descendant) stays confined here, isolated from unrelated siblings outside it.

#### `layer(value: number)`

Composes `isolate` and `z` so a single call gets both a new stacking context and a stacking order. Accepts only numeric values, leaving named layers like `"toast"` or `"modal"` to app or component code.

#### `z(value: number)`

Sets the host element's `z-index` from a plain number. Named component layers such as `"toast"` or `"modal"` are an app or component concern, so this primitive stays scoped to raw numeric values.

### Accessibility

#### `debug(mode: boolean | "nested" = true)`

Outlines the host in red while `import.meta.env.DEV` is true and emits nothing otherwise. `false` turns it off from a flag; `"nested"` extends the outline to every descendant to inspect a full box model.

#### `forcedColorAdjust(value: ForcedColorAdjustValue = "none")`

Applies `forced-color-adjust`, defaulting to `"none"` so author colours survive where colour itself carries the information — swatches, chart legends, syntax highlighting. Scope it with `u.forcedColors()`.

#### `visuallyHidden()`

Clips the host to a `1px` box taken out of layout flow, keeping its native focusability and tab order intact so screen readers and keyboard users still reach it.

### State

#### `active(input: UtilityInput)`

Sugar over `when("&:active", input)`.

#### `after(input: UtilityInput)`

Applies the given utilities to an element's `::after` pseudo-element. Sugar over `when("&::after", input)`.

#### `aria(attribute: string, input: UtilityInput)` / `aria(attribute: string, value: string | number, input: UtilityInput)`

Sugar over `when(...)` for an element's `aria-*` attribute selector: two args match the attribute present with any value — including `"false"` — while three args match a value exactly; pass `"true"` for the truthy case.

#### `backdrop(input: UtilityInput)`

Applies the given utilities to a top-layer element's `::backdrop`, the layer the browser paints behind a `<dialog>` or popover to dim the page with no overlay, z-index, or scroll container; pairs with `u.open()`.

#### `before(input: UtilityInput)`

Applies the given utilities to an element's `::before` pseudo-element. Sugar over `when("&::before", input)`.

#### `checked(input: UtilityInput)`

Sugar over `when('&:checked, &[aria-checked="true"]', input)`, matching both native checked controls and ARIA-checked custom widgets.

#### `data(attribute: string, input: UtilityInput)` / `data(attribute: string, value: string | number, input: UtilityInput)`

Sugar over an element's own `data-*` attribute selector: matches `&[data-{attribute}]` (any value, including a bare boolean attribute) with no `value` argument, or `&[data-{attribute}="{value}"]` with one.

#### `detailsContent(input: UtilityInput)`

Applies the given utilities to a `<details>` element's `::details-content` pseudo-element, the region holding everything after the `<summary>`. Combine with `u.open()`'s selector to scope styles to the open state.

#### `disabled(input: UtilityInput)`

Sugar over `when('&:disabled, &[aria-disabled="true"]', input)`, applying the given utilities under both the native and ARIA disabled selectors. Callers choose the actual colors, opacity, and cursor for that state.

#### `focusVisible(input: UtilityInput)`

Sugar over `when("&:focus-visible", input)`.

#### `focusWithin(input: UtilityInput)`

Sugar over `when("&:focus-within", input)`.

#### `has(selector: string, input: UtilityInput)`

Sugar over `when("&:has({selector})", input)`. Styles an element by its own descendants' state; `:has()` takes the specificity of its heaviest argument, so a complex selector here can outweigh overriding declarations.

#### `hasSibling(selector: string, input: UtilityInput)`

Sugar over `when("&:has(~ {selector})", input)`, styling an element by a sibling's state. `~` matches only _following_ siblings, so the indicator must come before the source input in the DOM.

#### `hover(input: UtilityInput)`

Sugar over `when("&:hover", input)`.

#### `indeterminate(input: UtilityInput)`

Matches indeterminate checkboxes and ARIA mixed-state widgets, painting a third visual state; it also matches radios in an unselected group and valueless `<progress>`, so scope it to the control you mean.

#### `invalid(input: UtilityInput)`

Waits for user interaction before flagging a field invalid, matching `:user-invalid` alongside the ARIA fallback so validation only surfaces once it is meaningful to the person filling in the field.

#### `marker(input: UtilityInput)`

Applies the given utilities to a list item's marker or a `<summary>` disclosure triangle via `::marker`; only `color`, `font-*`, and `content` apply. Use `u.listStyle("none")` to remove the marker along with its space.

#### `not(selector: string, input: UtilityInput)`

A selector wrapper for negated state: wraps `selector` in `:not(...)` and applies the given utilities there.

#### `open(input: UtilityInput)`

Sugar over `when("&[open], &:popover-open", input)`, matching both the `<details>`/`<dialog>` `open` attribute and the Popover API's `:popover-open` pseudo-class.

#### `placeholder(input: UtilityInput)`

Styles an input or textarea's `::placeholder` text. Give the field a real `<label>` too, since placeholder text vanishes on input and often renders at low contrast; style the empty input itself with `u.placeholderShown()`.

#### `placeholderShown(input: UtilityInput)`

Sugar over `when("&:placeholder-shown", input)`, matching an input or textarea while it is empty and therefore still showing its placeholder. Enables the float-label pattern with no JavaScript, paired with `u.has()`.

#### `precededBy(selector: string, input: UtilityInput)`

Sugar over `when(":is({selector}) ~ &", input)`, styling an element by a _preceding_ sibling's state; the counterpart of `hasSibling()`.

#### `readOnly(input: UtilityInput)`

Sugar over `when('&:read-only, &[aria-readonly="true"]', input)`, matching native and ARIA read-only controls. They stay focusable and keep submitting their value with the form, so give them a flat, normal-but-static style.

#### `required(input: UtilityInput)`

Sugar over `when('&:required, &[aria-required="true"]', input)`, matching required controls and widgets. Add a textual cue in the label too, since colour and a bare asterisk alone only reach sighted users.

#### `selection(input: UtilityInput)`

Applies utilities to the element's `::selection`; only `color`, `background-color`, `text-decoration`, and `text-shadow` take effect, and overriding the platform's contrast guarantee requires a high-contrast pair.

#### `when(selector: string, input: UtilityInput)`

Nests `input` under `selector`; every other state wrapper (`hover()`, `checked()`, ...) is sugar over it. `selector` starts with `&`, `@`, `:`, `[` or `.`; any other selector is dropped with a console warning.

#### `where(selector: string, input: UtilityInput)`

Sugar over `when("& :where({selector})", input)`, targeting descendants of the host. `:where()` always contributes zero specificity, so the resulting rule stays overridable by any later single-class rule.

### Responsive

#### `at(size: ContainerName | string, input: UtilityInput)` / `at(size: ContainerName | string, name: string, input: UtilityInput)`

Applies `input` while the nearest container, or the container called `name`, is at least `size` wide. `size` is a `Containers` step (`"md"`) or a raw length.

#### `atMax(size: ContainerName | string, input: UtilityInput)` / `atMax(size: ContainerName | string, name: string, input: UtilityInput)`

The `max-width` counterpart to `at`: applies while the nearest container's inline size is at most `size`. Shares `at`'s named-scale/literal-length resolution and named-container targeting.

#### `atQuery(query: string, input: UtilityInput)`

The raw escape hatch for expressing a container condition directly — querying `height`, `orientation`, a style feature, or combining several with `and`/`or`. `query` is used verbatim as the full `@container` condition.

#### `contrastLess(input: UtilityInput)`

Sugar over `media("(prefers-contrast: less)", input)`. Browser support for this query lags behind `contrastMore`, so keep a base declaration alongside it to cover browsers that ignore the query.

#### `contrastMore(input: UtilityInput)`

Sugar over `media("(prefers-contrast: more)", input)`. The theme layer already strengthens every tone's `border` here; reach for this wrapper to strengthen other properties, like a muted foreground.

#### `dark(input: UtilityInput)`

Sugar over `scheme("dark", input)`.

#### `forcedColors(input: UtilityInput)`

Sugar over `media("(forced-colors: active)", input)`. Forced-colors mode swaps colors for a system palette — use this to restore non-color cues like borders, or keep an element's own colors via `forced-color-adjust`.

#### `light(input: UtilityInput)`

Sugar over `scheme("light", input)`.

#### `media(query: string, input: UtilityInput)`

The explicit escape hatch for a real viewport/feature media query, for a rule that must read the viewport or a user preference. `u.at()` handles container-based responsive layout.

#### `motionReduce(input: UtilityInput)`

Sugar over `media("(prefers-reduced-motion: reduce)", input)`. Prefer `u.motionSafe()` when there is a choice: declaring motion only inside the positive query lets a missing wrapper fall back to no motion.

#### `motionSafe(input: UtilityInput)`

Sugar over `media("(prefers-reduced-motion: no-preference)", input)`. Styles apply only when the user has not asked for less motion, so a missing wrapper safely defaults to no animation.

#### `print(input: UtilityInput)`

Sugar over `media("print", input)`. `"print"` is a media type, so it's passed without parentheses — used to hide interactive chrome, force a light surface, and expand truncated content back to full height on paper.

#### `scheme(mode: "dark" | "light", input: UtilityInput)`

Applies the given utilities under both the forced `.dark`/`.light` class and the system-preference `.system` class behind `prefers-color-scheme`, so both stay in sync. Composed from `u.when()` and `u.media()`.

#### `startingStyle(input: UtilityInput)`

Wraps utilities in `@starting-style`, defining the values a transition animates from — for entry fade/scale-ins on dialogs, tooltips, popovers, and other elements starting `display: none` or in the top layer.

#### `supports(query: string, input: UtilityInput)`

A feature-query wrapper, applying the given utilities only when the browser supports `query` — progressive enhancement for CSS features without a reliable fallback path other than "don't apply this at all".

#### `transparencyReduce(input: UtilityInput)`

Sugar over `media("(prefers-reduced-transparency: reduce)", input)`. Supplies an explicit solid fallback — an opaque background, a stronger border — for a surface styled only inside the no-preference branch.

#### `transparencySafe(input: UtilityInput)`

Sugar over `media("(prefers-reduced-transparency: no-preference)", input)`, the same gate `u.translucent()` uses internally. Wrap `u.backdropBlur()` or `u.backdropSaturate()` in it directly to keep both effects gated together.

### Animation

#### `animation(name: string, config: AnimationConfig)` / `animation(config: AnimationConfig)`

Emits an `@keyframes` rule together with the `animation-*` declarations that run it. `@keyframes` only takes effect at the top level of `mix`; under a wrapper, use `u.keyframes()` with `u.animationHost()`.

`AnimationConfig`: `keyframes` and `duration` are required; `easing`, `delay`, `iterationCount`, `direction`, `fillMode`, `timeline` and `range` map to their `animation-*` properties. The unnamed form derives a stable name from the keyframes.

#### `animationHost(name: string, config: Omit<AnimationConfig, "keyframes">)`

Emits the host `animation-*` declarations alone, taking every `AnimationConfig` key but `keyframes`. Pair it with a sibling `u.keyframes` call, since `@keyframes` only hoists from a mixin's top level.

#### `animationDelay(value: string = "0s")`

Applies the `animation-delay` property. The value is a `<time>` string, so it always carries its unit, and a negative delay seeks: the animation starts immediately, already advanced by that much of its duration.

#### `keyframes(name: string, frames: Record<string, CSSStyles>)`

Emits an `@keyframes` rule under `name` with stop keys such as `from`, `to` and `50%`; place it at the top level of `mix`. Pair it with `u.animationHost()`, which can sit inside a wrapper.

#### `scrollTimelineName(name: string)`

Applies `scroll-timeline-name` to the scroll container itself, which needs an `overflow` value that scrolls. The leading `--` is added here, and the animation references the literal dashed-ident: `timeline: "--{name}"`.

#### `timelineScope(...names: string[])`

Applies the `timeline-scope` property, raising a named timeline's visibility to a common ancestor's subtree so animations outside the declaring element can resolve the name; the subtree still declares it.

#### `viewTimelineName(name: string)`

Applies `view-timeline-name` to the element being _watched_ — the card, the section, the image. The leading `--` is added here, and the animation references the literal dashed-ident: `timeline: "--{name}"`.

### Transform

#### `perspective(value: number | string = 800)`

Sets how far the viewer is from the z=0 plane; without it, 3D rotation reads as a flat scale, not depth. Goes on the **parent**, alongside `u.transformStyle()`, as its own CSS property outside the composed `transform`.

#### `perspectiveOrigin(value: TransformOriginValue = "center")`

Moves the vanishing point that `u.perspective()` establishes, aiming the 3D effect off-centre; set it on the same parent element that carries `u.perspective()`.

#### `rotate(value: AngleValue)`

Rotates the element in its own 2D plane. A bare number is treated as degrees; a string passes through unchanged (e.g. `"0.25turn"`).

#### `rotateX(value: AngleValue)`

Rotates the element in 3D around its horizontal axis. Pair with `u.perspective()` and `u.transformStyle()` on the parent and `u.backfaceVisibility()` on each face.

#### `rotateY(value: AngleValue)`

Rotates the element in 3D around its vertical axis — a flip-card or page-turn effect. Pair with `u.backfaceVisibility()` to hide the reversed face mid-rotation.

#### `scale(value: ScaleValue)`

Scales the element uniformly on both axes — sugar for setting `u.scaleX()` and `u.scaleY()` to the same factor in one call. Composable with every other `transform/` utility.

#### `scaleProperty(value: number | string)`

Sets the standalone `scale` property, which transitions independently of `transform`; `u.scale()` writes the `scale(...)` slot of the composite `transform`.

#### `scaleX(value: ScaleValue)`

Scales the element along the horizontal axis only. A bare number is a unitless factor (`1` is unchanged, `1.5` is 150%); a string passes through unchanged.

#### `scaleY(value: ScaleValue)`

Scales the element along the vertical axis only. A bare number is a unitless factor; a string passes through unchanged.

#### `skewX(value: AngleValue)`

Skews the element along the horizontal axis. A bare number is treated as degrees; a string passes through unchanged.

#### `skewY(value: AngleValue)`

Skews the element along the vertical axis. A bare number is treated as degrees; a string passes through unchanged.

#### `transformOrigin(value: TransformOriginValue = "center")`

Sets the pivot point for every transform on the element. It's its own CSS property, set outright rather than joining the additive `transform` composition.

#### `transformStyle(value: TransformStyleValue = "preserve-3d")`

Sets the standalone `transform-style` property outright on the **parent** of 3D-transformed children, since CSS defaults to `flat`; an `overflow`, `filter`, `mask`, or opacity below 1 on the element silently forces it back to `flat`.

#### `translateProperty(value: string)`

Sets the standalone `translate` property from raw CSS (`"0 -4px"`, `"none"`), independently of the composite `transform`.

#### `translateX(value: SpacingValue)`

Translates the element along the inline axis using the spacing scale or a raw CSS length. Composes with every other `transform/` utility, so `u.translateX()` combined with `u.rotate()` applies both.

#### `translateY(value: SpacingValue)`

Translates the element along the block axis using the spacing scale or a raw CSS length. Composable with every other `transform/` utility.

### Tokens

String resolvers from `@sdxc/u/tokens`, for a component that needs a token's CSS value outside a utility.

#### `color(value: ColorValue | string, defaultProperty?: string): string`

Resolves a `ColorValue` to a `var(...)` reference, using `defaultProperty` for a bare tone (`color("brand", "border")`). A hex value, a named or system color, and a value containing `(` are CSS colors and pass through.

#### `spacing(value: SpacingValue): string`

Resolves one spacing value to a CSS length: a number multiplies the spacing scale, `"auto"` passes through for margin centering, and any other string is taken as an already-valid CSS length.

#### `boxLength(value: SizeValue): string`

Resolves one sizing value to a CSS length, same as `spacing` plus `"full"` resolving to `100%` — the keyword `u.is()`/`u.bs()` and their `min`/`max` variants use for "fill the available space".

#### `isLength(value: unknown): boolean`

True when `value` is a raw CSS length string (`"12px"`, `"50%"`, `"2rem"`), as opposed to a scale name such as `"lg"`.

#### `radius(name: RadiusName | string): string`

Resolves a `RadiusName` to `var(--ui-radius-{name}, fallback)`, so the scale works before an app defines the variable; a raw CSS length passes through.

#### `font(name: FontFamilyName | string): string`

Resolves a `FontFamilyName` to `var(--ui-font-{name}, fallback)`.

#### `text(name: TextSizeName | string): string`

Resolves a `TextSizeName` to `var(--ui-text-{name}, fallback)`; a raw CSS length passes through literally, as in `radius`.

#### `container(name: ContainerName | string): string`

Resolves a `ContainerName` to `var(--ui-container-{name}, fallback)` for use as a property value, where the indirection makes the scale themable; a literal length passes through, as in `radius`.

#### `containerLength(name: ContainerName | string): string`

Resolves a `ContainerName` to a literal length, for an `@container` or `@media` condition, where custom properties do not resolve.

#### `shadow(name: ShadowName | string): string`

Resolves a `ShadowName` to `var(--ui-shadow-{name}, fallback)`; `"none"` and a raw CSS shadow (any value with a space or a function) pass through.

#### `blur(name: BlurName | string): string`

Resolves a `BlurName` to `var(--ui-blur-{name}, fallback)`; a literal length passes through unchanged, as in `radius`.

### Types

`UtilityMixin` is what every utility returns and `UtilityInput` what every wrapper accepts; name
them when writing a function that returns or takes utilities.

`ColorPalettes`, `SemanticTones`, `Radii`, `TextSizes`, `FontFamilies`, `Containers`, `Shadows`
and `Blurs` are the extensible token interfaces, and `ColorPaletteName`, `SemanticToneName`,
`RadiusName`, `TextSizeName`, `FontFamilyName`, `ContainerName`, `ShadowName` and `BlurName` are
their key unions. `PaletteShade` is `50`, `100` through `900`, and `950`. `ColorValue` is the
color input every color utility takes: `` `color.${palette}.${shade}` ``, `` `${tone}.${suffix}` ``,
a bare tone, `"inherit"`, `"currentColor"` or `"transparent"`, widened to any CSS color string.

`SpacingValue` and `SizeValue` come from `@sdxc/u/tokens`.

Options objects: `BgOptions`, `BorderOptions`, `BorderEdgeOptions`, `OutlineOptions`,
`TextDecorationOptions`, `GridTemplateOptions`, `StackOptions`, `ZStackOptions`, `PlaceOptions`,
`AppearanceOptions`, `DropShadowOptions`, `BackdropDropShadowOptions`, `TextShadowOptions`,
`MaskOptions`, `TransitionOptions` and `AnimationConfig`.

Value types, each naming what one utility parameter accepts:
`AlignItemsValue`, `AlignSelfValue`, `AnchorSide`, `AnchorSizeDimension`, `AppearanceValue`,
`AspectRatioName`, `BackfaceVisibilityValue`,
`BackgroundAttachmentValue`, `BackgroundClipValue`, `BackgroundRepeatValue`, `BorderCollapseValue`,
`BorderEdge`, `BorderStyleValue`, `BoxSizingValue`, `ColorMixStop`, `ColorSchemeValue`,
`ContainValue`, `ContainerTypeValue`, `ContentVisibilityValue`, `CornerShape`, `CursorValue`,
`DivideAxis`, `FieldSizingValue`, `FitValue`, `FontVariantNumericValue`, `FontWeightValue`,
`ForcedColorAdjustValue`, `GradientColor`, `GradientDirection`, `GradientPosition`,
`GradientShape`, `GradientStop`, `GridAutoFlowValue`, `GridLineValue`, `HyphensValue`,
`InterpolateSizeValue`, `JustifyValue`, `LeadingValue`, `ListStyleValue`, `LogicalCorner`,
`MaskModeValue`, `MaskRepeatValue`, `MixBlendModeValue`, `ObjectPositionValue`,
`OutlineStyleValue`, `OverflowAnchorValue`, `OverflowValue`, `OverflowWrapValue`,
`OverscrollBehaviorValue`, `PointerEventsValue`, `RepeatCount`, `RepeatTrack`, `ResizeValue`,
`SafeAreaSide`, `ScrollAxis`, `ScrollBehaviorValue`, `ScrollSnapAlignValue`, `ScrollSnapAxis`,
`ScrollSnapStopValue`, `ScrollSnapStrictness`, `ScrollbarGutterValue`, `SurfaceRecipe`,
`TextAlignValue`, `TextDecorationLineValue`, `TextDecorationStyleValue`, `TextTransformValue`,
`TouchActionValue`, `TrackingValue`, `TransformOriginValue`, `TransformStyleValue`,
`TransitionBehaviorValue`, `UserSelectValue`, `VerticalAlignValue`, `VisibilityValue`,
`WhiteSpaceValue`, `WillChangeValue` and `WordBreakValue`. Unions whose property takes free-form
values (`CursorValue`, `ListStyleValue`, `TouchActionValue`, ...) also accept any string.

## Pattern: A Card That Adapts To Its Container

Name a container on the card and query it from the parts, so the card lays itself out by its own
width wherever it is placed. One `data-tone` attribute picks the whole color set: `u.data()` builds
each branch and `u.combine()` folds them into one mixin.

```tsx
import * as u from "@sdxc/u";

let TONES = ["neutral", "brand", "success", "warning", "danger"] as const;

<article
	data-tone={tone}
	mix={[
		u.container("card"),
		u.grid(),
		u.gap(3),
		u.p(4),
		u.rounded("lg"),
		u.border({ width: 1 }),
		u.shadow("sm"),
		u.combine(
			TONES.map((name) =>
				u.data("tone", name, [u.bg(`${name}.tint`), u.fg(`${name}.emphasis`), u.border(name)]),
			),
		),
		u.at("md", "card", [u.gridTemplate({ columns: "8rem 1fr" }), u.p(6)]),
		u.aria("disabled", "true", [u.grayscale(0.8), u.opacity(60), u.cursor("not-allowed")]),
	]}
>
	<img src={src} alt="" mix={[u.is("full"), u.aspect("square"), u.fit("cover"), u.rounded("md")]} />
	<div mix={[u.vstack({ gap: 1 }), u.minIs(0)]}>
		<h3 mix={[u.type("lg"), u.weight("semibold"), u.truncate()]}>{title}</h3>
		<p mix={[u.text("sm"), u.lineClamp(3), u.pretty()]}>{summary}</p>
		<dl
			mix={[
				u.grid(),
				u.gap(2),
				u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(6rem, 1fr)") }),
			]}
		>
			{stats}
		</dl>
	</div>
</article>;
```

`u.repeat("auto-fit", ...)` lets the stats row pick its own column count without a breakpoint.

## Pattern: A Custom Checkbox Painted By A Sibling

`u.visuallyHidden()` keeps the real input focusable and submitted with the form, and a sibling
paints the indicator, reading every state through `u.hasSibling()`. The selector matches
following siblings, so the indicator comes before the input.

```tsx
import * as u from "@sdxc/u";

<label mix={[u.hstack({ gap: 2, align: "center" }), u.cursor("pointer"), u.userSelect()]}>
	<span
		aria-hidden="true"
		mix={[
			u.relative(),
			u.is(5),
			u.bs(5),
			u.rounded("sm"),
			u.border({ color: "neutral.strong", width: 2 }),
			u.after([
				u.pseudoContent('""'),
				u.absolute(),
				u.inset(1),
				u.rounded("sm"),
				u.bg("brand.onSolid"),
				u.scaleProperty(0),
			]),
			u.motionSafe(u.transition("background-color, border-color")),
			u.hasSibling("input:checked", [
				u.bg("brand.solid"),
				u.border("brand.solid"),
				u.after(u.scaleProperty(1)),
			]),
			u.hasSibling("input:focus-visible", u.outline({ color: "brand.ring", offset: 2 })),
			u.hasSibling("input:disabled", u.opacity(50)),
		]}
	/>
	<input type="checkbox" name="terms" mix={[u.visuallyHidden()]} />
	{children}
</label>;
```

The same pieces build a switch: `u.appearance()` clears the native chrome, `u.before()` draws the
thumb, and `u.checked()` moves it with `u.insIs()`, so the thumb travels in the writing
direction.

## Pattern: A Dialog That Fades In Over A Dimmed Page

The resting values sit on the element, the shown values in `u.open()`, and the same branch inside
`u.startingStyle()` gives the entry transition its starting point. `u.backdrop()` dims the page
behind the top layer, and `u.transitionBehavior("allow-discrete")` lets `display` and `overlay`
take part in the transition.

```tsx
import * as u from "@sdxc/u";

<dialog
	mix={[
		u.m("auto"),
		u.maxIs("min(90vw, 32rem)"),
		u.maxBs("85dvh"),
		u.scroll("y"),
		u.overscrollBehavior("contain"),
		u.surface(),
		u.rounded("xl"),
		u.p(5),
		u.shadow("xl"),
		u.opacity(0),
		u.scaleProperty(0.95),
		u.transition("opacity, scale, display, overlay", { duration: 150 }),
		u.transitionBehavior("allow-discrete"),
		u.open([u.opacity(100), u.scaleProperty(1)]),
		u.startingStyle(u.open([u.opacity(0), u.scaleProperty(0.95)])),
		u.motionReduce(u.scaleProperty("none")),
		u.backdrop([
			u.bg(u.colorMix("oklab", { color: "CanvasText", weight: 40 }, "transparent")),
			u.transparencySafe(u.backdropBlur("sm")),
		]),
	]}
>
	{children}
</dialog>;
```

`u.backdropBlur()` applies regardless of the transparency preference, so it goes inside
`u.transparencySafe()`; `u.translucent()` is the gated background-plus-blur in one call.

## Pattern: A Tooltip Anchored To Its Trigger

`u.anchorName()` names the trigger, `u.positionAnchor()` points the tooltip at it,
`u.positionArea()` places it beside the anchor, and `u.positionTryFallbacks()` lists where to
flip when the preferred side overflows.

```tsx
import * as u from "@sdxc/u";

<>
	<button popovertarget="tip" mix={[u.anchorName("tip"), u.rounded("md"), u.p(2)]}>
		{label}
	</button>
	<div
		id="tip"
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
			u.p(1, 2),
			u.rounded("md"),
			u.text("sm"),
			u.surface("neutral"),
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

`u.anchor()` and `u.anchorSize()` return strings for an inset or size utility, for when an edge
or width must track the anchor's geometry exactly: `u.minIs(u.anchorSize("tip", "inline"))`.

## Pattern: A Snapping Carousel With Faded Edges

`u.scrollSnapType()` goes on the container and `u.scrollSnapAlign()` on each item.
`u.scrollSnapStop("always")` keeps a fast flick to one item, and a gradient mask feathers the
edges to show the strip continues.

```tsx
import * as u from "@sdxc/u";

<div
	mix={[
		u.hstack({ gap: 3 }),
		u.scroll("x"),
		u.thinScrollbar(),
		u.scrollSnapType("inline"),
		u.scrollPadding(4),
		u.overscrollBehavior("contain"),
		u.pi(4),
		u.mask(
			u.linearGradient(
				"to right",
				"transparent",
				{ color: "black", position: "1.5rem" },
				{ color: "black", position: "calc(100% - 1.5rem)" },
				"transparent",
			),
		),
		u.motionSafe(u.scrollBehavior("smooth")),
	]}
>
	{slides.map((slide) => (
		<figure
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
				src={slide.src}
				alt={slide.alt}
				mix={[u.is("full"), u.aspect("video"), u.fit("cover")]}
			/>
		</figure>
	))}
</div>;
```

For a long vertical list, `u.virtualize("auto 3rem")` on each row skips rendering off-screen
rows while reserving their space.

## Pattern: A Text Field With A Floating Label

`u.placeholderShown()` matches an empty input, and `u.has()` lets the wrapper read that state, so
the label sits inside the empty field and lifts once the field has focus or a value. The input
keeps `placeholder=" "` so the pseudo-class tracks emptiness without visible text.

```tsx
import * as u from "@sdxc/u";

<div
	mix={[
		u.relative(),
		u.pbs(3),
		u.has(
			"textarea:placeholder-shown:not(:focus)",
			u.when("& > label", [u.translateY("1.7rem"), u.text("base")]),
		),
		u.has("textarea:focus", u.when("& > label", u.fg("brand"))),
	]}
>
	<textarea
		id="message"
		placeholder=" "
		mix={[
			u.appearance(),
			u.is("full"),
			u.fieldSizing("content"),
			u.minBs("3lh"),
			u.maxBs("12lh"),
			u.resize("block"),
			u.font("inherit"),
			u.p(2),
			u.border({ color: "neutral", width: 1 }),
			u.rounded("md"),
			u.autofill(),
			u.ring("brand"),
			u.invalid([u.border("danger"), u.ring("danger")]),
		]}
	/>
	<label
		for="message"
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
		Message
	</label>
</div>;
```

`u.fieldSizing("content")` grows the textarea with its value between the two bounds.

## Pattern: Component Knobs And Escape Hatches

`u.vars()` publishes a component's tunable values and `u.var()` reads them back with a fallback,
so a consumer retunes the component with one `u.vars()` call. `u.calc()` and `u.env()` build
values, and `u.raw()` carries a declaration no utility covers. `@keyframes` stays at the top
level of `mix`, so a conditional animation pairs `u.keyframes()` with `u.animationHost()` inside
the wrapper.

```tsx
import * as u from "@sdxc/u";

<div
	data-busy={busy || undefined}
	mix={[
		u.vars({ "spinner-size": "1.5rem" }),
		u.is(u.var("spinner-size", "1.5rem")),
		u.bs(u.var("spinner-size", "1.5rem")),
		u.mbe(u.calc(`1rem + ${u.env("safe-area-inset-bottom", "0px")}`)),
		u.rounded("full"),
		u.border({ color: "brand", width: 2 }),
		u.raw({ borderBlockStartColor: "transparent" }),
		u.keyframes("spin", { to: { rotate: "1turn" } }),
		u.data(
			"busy",
			u.motionSafe(
				u.animationHost("spin", {
					duration: "800ms",
					easing: "linear",
					iterationCount: "infinite",
				}),
			),
		),
		u.print(u.hidden()),
	]}
/>;
```

A consumer resizes one instance with `mix={[u.vars({ "spinner-size": "3rem" })]}`. An
animation that always runs takes `u.animation("spin", { keyframes, duration })`, which emits both
halves in one call.

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
		"@sdxc/u": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
