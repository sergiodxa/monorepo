---
name: sdxc-u
description: "@sdxc/u is utility-first styling for `remix/ui`: every export is a mixin factory that drops into a `mix` prop, covering CSS primitives across thirteen families plus wrappers like `u.hover()`, `u.at()` and `u.dark()` that re-nest other utilities. Use when styling a `remix/ui` component without a stylesheet, writing responsive or stateful styles inline, resolving `--ui-*` design tokens, or extending the palette and tone names."
---

# @sdxc/u

Every export is a `remix/ui` mixin factory returning a `UtilityMixin` — a real host-element mixin valid directly in a `mix` prop, carrying a hidden style tree the wrapper utilities can read and re-nest. Families cover the CSS primitives (layout, size, color, typography, effects, overflow, stacking, a11y, state, responsive, animation, transform, general) plus composed patterns such as `u.surface()`, `u.hstack()` and `u.vstack()`. Logical properties are the default, each with a physical counterpart for values that must not flip with writing mode. Token names resolve straight to `var(--ui-*)` at call time with no runtime registry, and `theme.css` ships the semantic tone layer and the spacing, breakpoint, font and text-size scales. Its only dependency is `remix`.

Full API, options and examples: [packages/u/README.md](packages/u/README.md)

## When to reach for it

- A `remix/ui` component needs styling and you would otherwise write a stylesheet or a one-off `css()` block.
- A style has to vary by breakpoint, container width, color scheme, or an interaction state such as hover, focus-visible, checked or disabled.
- A style keys off a `data-*` or `aria-*` attribute, a pseudo-element, or a `:has()` relationship.
- A design token — a spacing step, a radius, a blur, a tone — has to be resolved to its `var(--ui-*)` value in a raw CSS string.
- An app needs a new palette or semantic tone name to typecheck alongside the built-in ones.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/u": "workspace:*" } }
```

```tsx
import * as u from "@sdxc/u";

<div mix={[u.p(4), u.bg(), u.hover([u.bg("neutral.tint"), u.border("neutral")])]} />;
```

Wrappers compose with any other utility, so responsive and stateful styles nest at the call site:

```tsx
<div mix={[u.p(4), u.bg(), u.at("md", [u.p(6), u.hover(u.border("brand"))])]} />
```

The pure token resolvers live at their own subpath, because four of them share a name with a utility mixin (`font`, `text`, `shadow`, `blur`):

```ts
import { blur, spacing } from "@sdxc/u/tokens";

spacing(4); // "calc(var(--ui-spacing, 0.25rem) * 4)"
blur("sm"); // "var(--ui-blur-sm, 4px)"
```

The theme is a stylesheet import:

```ts
import "@sdxc/u/theme.css";
```

### Entry points

- `@sdxc/u` — every utility from every family, plus the `UtilityMixin`/`UtilityInput` types and the token-name interfaces declaration merging targets.
- `@sdxc/u/<family>` and `@sdxc/u/<family>/<utility>` — one family, or one utility as a default export, for the thirteen families: `general`, `layout`, `size`, `color`, `typography`, `effects`, `overflow`, `stacking`, `a11y`, `state`, `responsive`, `animation`, `transform`.
- `@sdxc/u/tokens` — the pure token resolvers, returning strings rather than mixins.
- `@sdxc/u/theme.css` — the semantic tone layer and the spacing, breakpoint, font and text-size scale variables.

## Suggestions

- Anywhere a parameter is typed `UtilityInput` it takes one mixin, a falsy value (dropped), or a nested array of the same, so conditional styling is an inline `&&` rather than a filter.
- A `mix` array keeps each utility separate and leaves conflicts to the cascade; `u.combine()` merges them left to right into one declaration set at call time. Reach for it when something has to hand out a single mixin, not to satisfy a wrapper — every wrapper already takes arrays.
- `theme.css` defines the semantic layer but not the raw palette scale: an app has to define `--ui-color-{name}-{50..950}` itself. Add `.dark` to an ancestor for forced dark mode, or `.system` to follow `prefers-color-scheme`.
- New palette, tone, radius, text-size, font, breakpoint, shadow and blur names are added by merging the matching interface into `"@sdxc/u"` and defining the matching `--ui-*` variables — nothing registers at runtime.
- Import from the root for the mixin and from `@sdxc/u/tokens` for the resolver whenever the name is one of the four that collide.

## Related

- `@sdxc/ui` — the styled component catalog built on these mixins and the same `--ui-*` contract; skill `sdxc-ui`
