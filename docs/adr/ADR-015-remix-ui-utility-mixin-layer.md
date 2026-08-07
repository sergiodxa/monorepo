# ADR-015: Remix UI Utility Mixin Layer

## Status

**Proposed** - 2026-07-22

## Background

Remix UI applications and component packages need a lower-level styling layer that keeps the utility-first workflow of small composable declarations while using `remix/ui` host-element mixins instead of Tailwind classes or hand-written CSS objects at every call site.

The current `r3-ui` component package already uses `css()` mixin factories for reusable styling recipes, such as visually hidden controls. The next step is to extract the repeatable styling primitives underneath those recipes into a package that application UI and `r3-ui` can share.

## Context

`remix/ui` styling attaches to host elements through the `mix` prop. The built-in `css()` mixin emits generated rules under the `rmx` cascade layer, while `createMixin()` defines reusable host-element mixins that can compose other mixins, transform props, and participate in the host lifecycle.

The desired API should feel utility-first and terse:

```tsx
<div
	mix={[
		u.p(4),
		u.bg(),
		u.hover([u.bg("neutral.tint"), u.border("neutral")]),
		u.at("md", [u.p(6), u.hstack({ gap: 4 })]),
	]}
/>
```

The utilities must also work in nested selectors and responsive rules. Plain mixin descriptors are not enough for this because a selector wrapper such as `u.hover()` must read the styles produced by `u.bg()` and re-emit them under `&:hover`.

The existing `r3-ui` theme uses a `--ui-*` semantic variable contract. The lower-level utility package should adopt that namespace so the component package can build on the same theme instead of maintaining a parallel styling system.

## Decision

Create a package named `@pkg/u`. The public import is intentionally short because call sites will use it heavily:

```tsx
import * as u from "@pkg/u";
```

Every public utility is also exported as a named export so performance-sensitive modules can import only what they use:

```tsx
import { animation, bg, p } from "@pkg/u";
```

The package must remain tree-shakeable. Importing named utilities should pull in only those utilities and their direct shared helpers. Avoid a runtime namespace object, global registry, or eager initialization that forces every utility into the bundle. The package declares side-effect-free modules except for explicit CSS entrypoints.

Exports are organized at three levels so callers can choose ergonomics or precision:

```tsx
import * as u from "@pkg/u";
import { bg, p } from "@pkg/u";
import { bg } from "@pkg/u/color";
import bg from "@pkg/u/color/bg";
```

Each utility lives in its own module, each family subpath re-exports its utilities, and the root entrypoint re-exports every public utility. This keeps utilities individually tree-shakeable while preserving the short namespace import for most application code.

The package exposes a utility-first styling layer for `remix/ui`. Every public utility returns a first-class host-element mixin built with `createMixin()`. Utilities are not plain functions that return CSS objects, and semantic utilities are not plain arrays of other mixins.

### 1. Inspectable Utility Mixins

Every utility mixin carries private metadata through an internal symbol. The metadata exposes a style tree that wrapper utilities can inspect and re-emit under selectors, container queries, and media queries.

Conceptually:

```ts
const UTILITY = Symbol("utility");

interface UtilityMixin {
	[UTILITY]: UtilityNode;
}

interface UtilityNode {
	toStyles(): CSSStyles;
}
```

Atomic utilities such as `u.p(4)` produce declaration nodes. Wrapper utilities such as `u.when()`, `u.at()`, and `u.media()` produce nested nodes. Semantic utilities such as `u.vstack()` compose atomic utility nodes and still expose a flattened style tree.

This makes all of these valid:

```tsx
<div mix={u.p(4)} />

<div mix={u.hover(u.p(6))} />

<div
	mix={u.at("md", [
		u.p(4),
		u.hover(u.p(6)),
	])}
/>
```

The last example emits styles equivalent to:

```css
@container (min-width: var(--ui-container-md, 36rem)) {
	padding: calc(var(--ui-spacing, 0.25rem) * 4);

	&:hover {
		padding: calc(var(--ui-spacing, 0.25rem) * 6);
	}
}
```

> **Superseded, 2026-08-07.** The `var(--ui-container-md, 36rem)` condition shown here
> and in the `at()` section below is **inert**: a container query's condition is evaluated
> before custom properties are substituted, so the rule is emitted and never matches at
> any width. Commit `c8e49b20` fixed `@pkg/u` — query conditions now resolve a named step
> to a literal length through a new `containerLength()`, so `at("md", …)` emits
> `@container (min-width: 36rem)`. `container()` is unchanged and still returns the custom
> property, which is what a property value wants for theming. The CSS in this document is
> kept as written for the record; read the emitted condition as the literal length.

Wrapper utilities accept either a single utility or an array of utilities. Nested arrays are flattened recursively.

```tsx
u.hover(u.p(6));
u.hover([u.p(6), u.bg("brand.tint")]);
u.at("md", u.p(6));
u.media("(prefers-contrast: more)", [u.border("brand.strong")]);
```

When duplicate declarations are merged in the same rule, the later utility wins.

### 2. State And Rule Wrappers

`u.when()` is the primitive selector wrapper:

```tsx
u.when("&:has(input:checked)", [u.bg("brand.tint"), u.border("brand")]);
```

`u.not()` is a selector wrapper for negated state. It wraps the selector in `:not(...)` and applies the given utilities there:

```tsx
u.not(":disabled", u.opacity(100));
```

Named state wrappers are sugar over `u.when()`:

```tsx
u.hover(input); // &:hover
u.active(input); // &:active
u.focusVisible(input); // &:focus-visible
u.focusWithin(input); // &:focus-within
u.open(input); // &[open], &:popover-open
u.checked(input); // &:checked, &[aria-checked="true"]
u.disabled(input); // &:disabled, &[aria-disabled="true"]
u.invalid(input); // &:user-invalid, &[aria-invalid="true"]
```

`u.disabled()` and `u.invalid()` are selector wrappers only. They do not define a visual disabled or invalid recipe. Apps and components choose the actual colors, opacity, borders, and rings.

`u.ring()` applies only to `:focus-visible`, never plain `:focus`.

`u.if()` conditionally returns a utility or a falsy value. It exists for call sites that prefer a utility-shaped conditional, even though `mix` accepts falsy values directly:

```tsx
u.if(isActive, u.bg("brand.tint"));
```

### 3. Responsive And Media Wrappers

`u.at()` always means a container query, not a viewport media query:

```tsx
u.at("md", [u.p(6), u.hstack({ gap: 4 })]);
```

It emits a container query using `--ui-container-*` variables with fallbacks:

```css
@container (min-width: var(--ui-container-md, 36rem)) {
	/* nested utilities */
}
```

> **Superseded, 2026-08-07.** See the note above: this condition never matched, because a
> container query resolves its condition before custom properties. Since commit
> `c8e49b20`, `at("md", …)` emits `@container (min-width: 36rem)` — the named step is
> resolved to its literal length by `containerLength()` while `container()` keeps
> returning the custom property for property values.

The initial container breakpoint tokens are:

```css
--ui-container-xs: 20rem; /* 320px */
--ui-container-sm: 24rem; /* 384px */
--ui-container-md: 36rem; /* 576px */
--ui-container-lg: 48rem; /* 768px */
--ui-container-xl: 64rem; /* 1024px */
--ui-container-2xl: 80rem; /* 1280px */
```

`u.media()` is the explicit escape hatch for real media queries:

```tsx
u.media("(prefers-contrast: more)", u.border("brand.strong"));
```

`u.supports()` is the equivalent wrapper for feature queries:

```tsx
u.supports("(corner-shape: squircle)", u.corner("squircle"));
```

`u.scheme()` is the color-scheme wrapper for light and dark mode rules, not a direct `color-scheme` property utility:

```tsx
u.scheme("dark", u.bg("neutral.solid"));
u.dark(u.bg("neutral.solid"));
u.light(u.bg());
```

`u.dark()` and `u.light()` are sugar over `u.scheme()`. The exact selectors/media queries follow the theme's dark-mode contract so forced and system modes stay consistent.

### 4. Theme Contract

The package uses `--ui-*` variables. Tailwind-compatible concepts keep their Tailwind names with the `ui` prefix added, such as `--ui-spacing`.

Colors are organized in two foundational layers plus tiny system defaults.

#### Palette Tokens

Palette tokens are raw color scales. Each named color exposes `50`, then `100` through `900` in steps of `100`, then `950`:

```css
:root {
	--ui-color-neutral-50: hsl(...);
	--ui-color-neutral-100: hsl(...);
	--ui-color-neutral-900: hsl(...);
	--ui-color-brand-50: hsl(...);
	--ui-color-brand-600: hsl(...);
	--ui-color-success-600: hsl(...);
	--ui-color-warning-600: hsl(...);
	--ui-color-danger-600: hsl(...);
}
```

Utilities can access palette values directly when needed:

```tsx
u.bg("color.neutral.50");
u.fg("color.neutral.900");
u.border("color.brand.600");
```

#### Semantic Tone Tokens

Semantic tokens map palette values to reusable UI meanings. The package uses `brand` for the main product color so `accent` remains available for the CSS `accent-color` property:

```css
:root {
	--ui-brand-bg-tint: var(--ui-color-brand-50);
	--ui-brand-bg-solid: var(--ui-color-brand-600);
	--ui-brand-fg: var(--ui-color-brand-600);
	--ui-brand-fg-muted: var(--ui-color-brand-500);
	--ui-brand-fg-emphasis: var(--ui-color-brand-900);
	--ui-brand-fg-on-solid: white;
	--ui-brand-border: var(--ui-color-brand-200);
	--ui-brand-border-strong: var(--ui-color-brand-600);
	--ui-brand-ring: var(--ui-color-brand-500);
}
```

The same semantic matrix applies to `neutral`, `success`, `warning`, and `danger`.

Utilities expose semantic tones directly:

```tsx
u.bg("brand.tint");
u.bg("brand.solid");
u.fg("brand");
u.fg("brand.muted");
u.fg("brand.emphasis");
u.fg("brand.onSolid");
u.border("brand");
u.border("brand.strong");
u.ring("brand");
```

#### Extensible Colors

Applications can extend palette and semantic tone names through TypeScript declaration merging plus the same CSS variable conventions. The package defines extension interfaces whose keys become accepted color names:

```ts
export interface ColorPalettes {
	neutral: true;
	brand: true;
	success: true;
	warning: true;
	danger: true;
}

export interface SemanticTones {
	neutral: true;
	brand: true;
	success: true;
	warning: true;
	danger: true;
}
```

An app that wants an `info` color augments the package types:

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

Then it defines the matching variables:

```css
:root {
	--ui-color-info-50: hsl(...);
	--ui-color-info-100: hsl(...);
	--ui-color-info-200: hsl(...);
	--ui-color-info-300: hsl(...);
	--ui-color-info-400: hsl(...);
	--ui-color-info-500: hsl(...);
	--ui-color-info-600: hsl(...);
	--ui-color-info-700: hsl(...);
	--ui-color-info-800: hsl(...);
	--ui-color-info-900: hsl(...);
	--ui-color-info-950: hsl(...);

	--ui-info-bg-tint: var(--ui-color-info-50);
	--ui-info-bg-solid: var(--ui-color-info-600);
	--ui-info-fg: var(--ui-color-info-600);
	--ui-info-fg-muted: var(--ui-color-info-500);
	--ui-info-fg-emphasis: var(--ui-color-info-900);
	--ui-info-fg-on-solid: white;
	--ui-info-border: var(--ui-color-info-200);
	--ui-info-border-strong: var(--ui-color-info-600);
	--ui-info-ring: var(--ui-color-info-500);
}
```

The extended color works everywhere the corresponding layer is accepted:

```tsx
u.bg("color.info.500");
u.bg("info.tint");
u.bg("info.solid");
u.fg("info");
u.fg("info.emphasis");
u.border("info");
u.ring("info");
u.surface("info");
u.surface("info.tinted");
u.accent("info");
```

No runtime registry is required. Utilities derive CSS variable names from the typed string values.

#### Extensible Design Tokens

Named token families are extensible when a stable name adds value and maps predictably to a `--ui-*` variable. The package exposes declaration-merging interfaces for those families:

```ts
export interface Radii {
	none: true;
	sm: true;
	md: true;
	lg: true;
	xl: true;
	full: true;
}

export interface TextSizes {
	xs: true;
	sm: true;
	base: true;
	lg: true;
	xl: true;
	"2xl": true;
	"3xl": true;
	"4xl": true;
	"5xl": true;
	"6xl": true;
	"7xl": true;
	"8xl": true;
	"9xl": true;
}

export interface FontFamilies {
	sans: true;
	serif: true;
	mono: true;
}

export interface Containers {
	xs: true;
	sm: true;
	md: true;
	lg: true;
	xl: true;
	"2xl": true;
}

export interface Shadows {
	sm: true;
	md: true;
	lg: true;
}

export interface Blurs {
	sm: true;
	md: true;
	lg: true;
}
```

An app can add names to these families and provide the matching variables:

```ts
declare module "@pkg/u" {
	interface Radii {
		"2xl": true;
	}

	interface TextSizes {
		hero: true;
	}

	interface FontFamilies {
		display: true;
	}

	interface Containers {
		"3xl": true;
	}
}
```

```css
:root {
	--ui-radius-2xl: 1rem;
	--ui-text-hero: 4.5rem;
	--ui-leading-hero: 1;
	--ui-font-display: "Fraunces", var(--ui-font-serif);
	--ui-container-3xl: 96rem;
}
```

The new names become valid utility values:

```tsx
u.rounded("2xl");
u.text("hero");
u.type("hero");
u.font("display");
u.at("3xl", u.p(8));
```

Token families stay closed when names add little value or the utility already accepts the useful value directly. Spacing is numeric through `--ui-spacing`, opacity is numeric, z-index and `u.layer()` accept numbers only, and aspect ratios use `u.aspect(n, n)` rather than named token extension.

Token resolver helpers are exported for component packages that need to build larger CSS objects without duplicating token logic:

```ts
spacing(4);
color("brand.tint");
radius("lg");
font("serif");
text("lg");
container("md");
```

These helpers are pure string resolvers. They do not emit CSS, create mixins, or register tokens.

#### System Defaults

System defaults are intentionally tiny and point to semantic tone tokens first, with platform system colors as final fallbacks:

```css
:root {
	--ui-bg: var(--ui-neutral-bg-tint, Canvas);
	--ui-fg: var(--ui-neutral-fg-emphasis, CanvasText);
	--ui-border: var(--ui-neutral-border, color-mix(in oklab, CanvasText 16%, transparent));
	--ui-ring: var(--ui-brand-ring, Highlight);
}
```

This keeps default utilities terse without introducing component-role tokens:

```tsx
u.bg();
u.fg();
u.border();
u.ring();
```

The package does not define role tokens such as `--ui-card-bg`, `--ui-popover-bg`, or `--ui-surface-bg`. Component-specific roles belong in component packages or apps.

### 5. Spacing, Typography, And Scale Variables

Spacing uses `--ui-spacing`:

```css
:root {
	--ui-spacing: 0.25rem;
}
```

Numeric spacing values resolve to `calc(var(--ui-spacing, 0.25rem) * n)`. Utilities that accept spacing also accept raw CSS length strings such as `px`, `ch`, `em`, `rem`, `%`, `vw`, `vh`, `dvw`, `dvh`, `vi`, `vb`, `svw`, `svh`, `lvw`, `lvh`, `cqw`, `cqh`, `cqmin`, and `cqmax` values when a call site needs an exact value. Utilities that map to CSS shorthand accept one, two, or four values.

```tsx
u.p(4);
u.p("13px");
u.p(4, 6);
u.p(1, 2, 3, 4);

u.m(4);
u.m(4, "auto");
u.m(1, 2, 3, 4);
u.maxIs("60ch");
```

Four-value shorthand maps to logical directions: block start, inline end, block end, inline start.

Font families include sans, serif, and mono:

```css
--ui-font-sans
--ui-font-serif
--ui-font-mono
```

The text scale follows Tailwind's size names with the `ui` prefix:

```css
--ui-text-xs
--ui-text-sm
--ui-text-base
--ui-text-lg
--ui-text-xl
--ui-text-2xl
--ui-text-3xl
--ui-text-4xl
--ui-text-5xl
--ui-text-6xl
--ui-text-7xl
--ui-text-8xl
--ui-text-9xl
```

### 6. Logical Properties

The package uses logical properties whenever the platform provides a good logical alternative. Padding and margin helpers include compact logical shorthands:

```tsx
u.pi(4); // padding-inline
u.pb(4); // padding-block
u.pis(4); // padding-inline-start
u.pie(4); // padding-inline-end
u.pbs(4); // padding-block-start
u.pbe(4); // padding-block-end

u.mi(4); // margin-inline
u.mb(4); // margin-block
u.mis(4); // margin-inline-start
u.mie(4); // margin-inline-end
u.mbs(4); // margin-block-start
u.mbe(4); // margin-block-end
```

Sizing utilities prefer logical dimensions:

```tsx
u.is("full"); // inline-size
u.bs("full"); // block-size
u.minIs(0);
u.maxIs("full");
u.minBs(0);
u.maxBs("full");
```

### 7. Semantic CSS Pattern Utilities

The package includes semantic CSS patterns, but not UI component recipes.

Stack utilities use short stack terminology:

```tsx
u.hstack({ gap: 4, align: "center", justify: "between" });
u.vstack({ gap: 4, align: "stretch" });
u.zstack({ align: "center", justify: "center" });
```

`u.zstack()` uses grid overlay semantics so overlapping children preserve intrinsic sizing better than absolute positioning.

`u.surface()` is a utility pattern, not a theme layer:

```tsx
u.surface();
u.surface("muted");
u.surface("brand");
u.surface("brand.tinted");
u.surface("danger");
```

It composes background, foreground, and border primitives using the palette, semantic, and system default token layers.

`u.surface()` accepts only surface recipe names such as default, muted, brand, brand.tinted, danger, or danger.tinted. It does not accept raw palette values like `color.brand.500`, because surfaces must choose a matching background, foreground, and border together. Each recipe preserves contrast by construction and may include a `prefers-contrast: more` override when a tinted surface needs a stronger border or foreground in high-contrast mode.

`u.circle()` is a shape pattern for circular boxes. It composes a square aspect ratio and full radius:

```tsx
u.circle();
```

It emits styles equivalent to:

```css
aspect-ratio: 1 / 1;
border-radius: var(--ui-radius-full, 9999px);
```

`u.squircle()` is a shape pattern for continuous rounded corners. It sets a radius and uses `corner-shape` as progressive enhancement where supported:

```tsx
u.squircle();
u.squircle("lg");
```

It emits styles equivalent to:

```css
border-radius: var(--ui-radius-lg, 0.5rem);

@supports (corner-shape: squircle) {
	corner-shape: squircle;
}
```

`u.corner()` is the primitive `corner-shape` utility. It emits `corner-shape` behind `@supports` so unsupported browsers keep the normal `border-radius` shape:

```tsx
u.corner("squircle");
u.corner("bevel");
u.corner("notch");
```

It emits styles equivalent to:

```css
@supports (corner-shape: squircle) {
	corner-shape: squircle;
}
```

`u.translucent()` is an optional translucent surface pattern. It composes surface styling and backdrop blur. The optional first argument controls blur strength and resolves through the `--ui-blur-*` token family:

```tsx
u.translucent();
u.translucent("sm");
u.translucent("lg");
```

Transparency-sensitive effects are accessible by default:

```css
@media (prefers-reduced-transparency: no-preference) {
	backdrop-filter: blur(var(--ui-blur-{value}, <fallback>));
}
```

When reduced transparency is requested, the utility preserves a solid background fallback.

### 8. Initial Utility Surface

The initial package should include these utility families.

General utilities:

```tsx
u.if();
u.vars();
```

`u.vars()` sets custom properties with the leading `--` omitted from keys:

```tsx
u.vars({ "sidebar-width": "18rem" });
```

It emits:

```css
--sidebar-width: 18rem;
```

Display and position:

```tsx
u.block();
u.inline();
u.inlineBlock();
u.contents();
u.hidden();
u.relative();
u.absolute();
u.fixed();
u.sticky();
u.inset();
u.appearance();
```

Layout:

```tsx
u.flex();
u.inlineFlex();
u.flexRow();
u.flexCol();
u.flexWrap();
u.grid();
u.inlineGrid();
u.items();
u.justify();
u.content();
u.self();
u.place();
u.gap();
u.hstack();
u.vstack();
u.zstack();
u.center();
```

Spacing and sizing:

```tsx
u.p();
u.m();
u.bleed();
u.is();
u.bs();
u.minIs();
u.maxIs();
u.minBs();
u.maxBs();
u.aspect();
u.fit();
u.circle();
u.squircle();
u.corner();
```

Color and surfaces:

```tsx
u.bg();
u.fg();
u.border();
u.ring();
u.accent();
u.surface();
u.translucent();
```

`u.accent()` maps to the CSS `accent-color` property for native controls and defaults to the brand solid color:

```tsx
u.accent();
u.accent("brand");
u.accent("danger");
```

Typography:

```tsx
u.font();
u.text();
u.type();
u.weight();
u.leading();
u.tracking();
u.textAlign();
u.truncate();
u.lineClamp();
u.balance();
u.pretty();
u.nowrap();
```

Borders and effects:

```tsx
u.rounded();
u.shadow();
u.opacity();
u.blur();
u.backdropBlur();
```

Overflow, scroll, and media:

```tsx
u.overflow();
u.scroll();
u.clip();
u.divide();
```

`u.divide()` supports defaults, axis, color, and width overloads:

```tsx
u.divide();
u.divide("block");
u.divide("block", "brand");
u.divide("block", "brand", 2);
u.divide("block", 2);
```

Stacking and isolation:

```tsx
u.isolate();
u.z();
u.layer();
```

`u.layer(n)` composes `u.isolate()` and `u.z(n)`. It accepts numbers only, not named component layers such as toast or modal.

Accessibility:

```tsx
u.visuallyHidden();
u.debug();
```

`u.debug()` applies a clearly visible red outline in development only, so it can be left in code without affecting production output. `u.debug(true)` or `u.debug("nested")` also outlines descendants.

Feature and condition wrappers:

```tsx
u.when();
u.not();
u.hover();
u.active();
u.focusVisible();
u.focusWithin();
u.open();
u.checked();
u.disabled();
u.invalid();
u.at();
u.media();
u.supports();
u.scheme();
u.dark();
u.light();
```

Animation primitives:

```tsx
u.keyframes();
u.animation();
```

### 9. Package Boundary

The package stops at CSS primitives and CSS patterns. It does not expose component recipes such as cards, buttons, badges, alerts, dialogs, popovers, or toasts.

Public utility names should avoid component words. Names such as `surface`, `translucent`, `hstack`, `vstack`, `ring`, and `divide` describe CSS patterns and are allowed. Names such as `card`, `button`, `popover`, `toast`, `dialog`, and `alert` describe UI components and belong in `r3-ui` or apps.

Those belong in `r3-ui` and may be built from utility patterns:

```tsx
<section mix={[u.vstack({ gap: 4 }), u.surface("muted"), u.p(4), u.rounded("lg")]} />
```

Animation presets remain outside this package. CSS animation recipes such as fade, slide, scale, spin, shimmer, and enter/exit transitions stay in `r3-ui/animations` or a future animation package built on top of this layer.

The package still includes primitive animation utilities. `u.keyframes()` emits only an `@keyframes` rule and does not style the host element:

```tsx
<div
	mix={[
		u.keyframes("fade-in", {
			from: { opacity: 0 },
			to: { opacity: 1 },
		}),
		css({
			animationName: "fade-in",
			animationDuration: "150ms",
		}),
	]}
/>
```

`u.animation()` is a primitive composer that emits keyframes and host animation declarations together. It supports named animation names for debugging and generated stable names for one-off animations:

```tsx
<div
	mix={u.animation("fade-in", {
		keyframes: {
			from: { opacity: 0 },
			to: { opacity: 1 },
		},
		duration: "150ms",
		easing: "ease-out",
	})}
/>

<div
	mix={u.animation({
		keyframes: {
			from: { opacity: 0 },
			to: { opacity: 1 },
		},
		duration: "150ms",
		easing: "ease-out",
	})}
/>
```

The unnamed form generates a stable name from the keyframe content. These primitives do not introduce animation opinions; they only provide CSS keyframe emission and animation declaration composition.

`u.appearance()` is allowed as a primitive form-control reset utility:

```tsx
u.appearance("none");
```

The package does not expose a reset utility. Reset styles remain CSS entrypoints owned by component packages or apps.

### 10. Implementation And Verification

The implementation starts with the shared utility descriptor and a small representative utility set before adding the full surface:

1. Implement the internal utility descriptor, metadata symbol, recursive input flattening, and merge behavior.
2. Implement representative atomic utilities such as `u.p()`, `u.bg()`, and `u.border()`.
3. Implement wrappers such as `u.when()`, `u.hover()`, `u.at()`, `u.media()`, `u.supports()`, and `u.scheme()`.
4. Test nested wrappers such as `u.at("md", [u.p(4), u.hover(u.p(6))])` before expanding the package.
5. Test whether repeated identical `css()` declarations dedupe to the same generated CSS rule, then tune semantic wrappers to compose primitives or emit grouped declarations accordingly.
6. Expand semantic utilities such as `u.hstack()`, `u.vstack()`, `u.surface()`, and `u.translucent()` after the wrapper model is proven.

Merging of final style objects is delegated to the `css()` mixin serializer. The utility layer only flattens inputs and builds the nested style object.

Public utilities should share internal helpers for descriptor creation, token resolution, and mixin wrapping, but each utility remains an explicit exported function in its own file so it can carry accurate JSDoc and examples.

### 11. Utility Documentation

Every public utility must have JSDoc. The JSDoc explains what the utility does, when to use it, and any important behavior such as logical direction mapping, selector wrapping, accessibility defaults, or token resolution.

Each utility JSDoc includes at least one usage example and one emitted-style example:

```ts
/**
 * Applies logical padding using the spacing scale or a raw CSS length.
 * One value applies all sides; two values map to block and inline; four
 * values map to block-start, inline-end, block-end, and inline-start.
 *
 * @example u.p(4)
 * @example css({ padding: "calc(var(--ui-spacing, 0.25rem) * 4)" })
 * @example u.p(1, 2, 3, 4)
 * @example css({ paddingBlockStart: "...", paddingInlineEnd: "..." })
 */
export function p(...values: SpacingValue[]) {
	// ...
}
```

Utilities that use logical properties must either explain the logical mapping directly or link to MDN documentation for logical properties. For example, a four-value spacing shorthand must document that values map to block-start, inline-end, block-end, and inline-start rather than physical top, right, bottom, and left.

## Consequences

- Application UI and `r3-ui` share one utility-first styling foundation.
- The public namespace stays terse through `u`, which is important because utilities appear frequently in JSX.
- Utilities remain valid `remix/ui` mixins while also being inspectable enough for selector, media, and container-query wrappers.
- Atomic declarations can dedupe across elements when `css()` dedupes identical style content.
- Semantic wrappers can compose atomic utilities without forcing new combined classes for every recipe.
- The theme remains customizable through palette and semantic tone layers without introducing component-role variables into the lower-level package.
- The package defaults to logical properties, container-query responsive design, and accessible focus and transparency behavior.

## Alternatives Considered

### Tailwind-Compatible Class Names

Keeping Tailwind class strings would preserve familiarity but require a Tailwind build step, class scanning, and string-based composition. That does not fit `remix/ui`'s mixin model.

### Plain `css()` Factory Functions

Plain functions returning `css()` mixins are simple, but they cannot be inspected and re-emitted under `u.when()`, `u.at()`, or `u.media()`.

### Large Role Token Layer

A large role-token layer with names such as card, popover, panel, and overlay was rejected for the lower-level package. Those names describe component and application responsibilities. The utility package keeps palette tokens, semantic tone tokens, tiny system defaults, and pattern utilities instead.
