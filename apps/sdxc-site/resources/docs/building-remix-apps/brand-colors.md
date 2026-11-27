---
title: Theme a page from a chosen color
description: Read a color a user picked, derive hover and muted shades in OKLCH, keep text readable at WCAG AA, and build a chart palette from it.
section:
    title: Interface
    order: 4.5
order: 10
lastUpdated: 2026-11-27
outcomes:
    - "How to read a stored or submitted CSS color with `Color.parse`"
    - "How to derive shades that keep their hue with OKLCH lightness and chroma"
    - "How to keep text readable with `contrast`, `ensureContrast` and `contrastingText`"
    - "How to build an evenly spaced palette with `Color.steps`"
---

This guide themes a workspace from the accent color its owner picked: a button in the accent,
a darker hover, text on the button that stays readable, links that pass AA on the page, and a
chart palette that runs from the accent to a neutral. [`@sdxc/color`](/api/color) does every
step as pure math, so the same code runs in a Worker, the browser or a test.

```bash
npm add @sdxc/color @sdxc/result
```

## Read the color

A color arrives as text, from an `<input type="color">`, a settings row or `getComputedStyle`.
`Color.parse` reads any CSS color and answers a `Result`, so a bad value is a branch, not a throw:

```typescript {% title="app/services/workspaces/accent.ts" %}
import { Color } from "@sdxc/color";
import { unwrap } from "@sdxc/result";

export function readAccent(stored: string | null): Color {
	return unwrap(Color.parse(stored ?? ""), () => Color.oklch(0.55, 0.15, 260));
}
```

`oklch(0.24 0.008 70)`, `#3a81f6`, `color(display-p3 1 0 0)` and `rebeccapurple` all parse.
A wide-gamut color keeps its full chroma until you print it.

## Derive the shades

Shades come from OKLCH, where lightness is perceptual and hue stays put. `darken(0.1)` is 10%
darker; `desaturate` and `withAlpha` give quieter variants of the same hue:

```typescript {% title="app/services/workspaces/theme.ts" %}
import type { Color } from "@sdxc/color";

export function accentTheme(accent: Color, page: Color) {
	let button = accent.toGamut();
	let link = accent.ensureContrast(page, 4.5);

	return {
		"--accent": String(button),
		"--accent-hover": String(button.darken(0.1).toGamut()),
		"--accent-muted": String(button.desaturate(0.6).withAlpha(0.15)),
		"--accent-text": String(button.contrastingText()),
		"--link": String(link.status === "success" ? link.data : link.error.best),
	};
}
```

`String(color)` prints `rgb()` for a color inside sRGB and `oklch()` for one outside it, both
valid CSS. `toGamut()` maps a wide-gamut pick onto sRGB by lowering chroma, so the button shows
the same hue everywhere instead of a clipped one.

## Keep text readable

`contrastingText()` answers black or white, whichever reads better on the button.
`ensureContrast(page, 4.5)` moves only the accent's lightness until links pass WCAG AA against the
page: `#3a81f6` on white becomes `#2b72e6`. When no lightness gets there, its failure still carries the most readable extreme in
`error.best`, which is what the theme falls back to.

To report on a pair instead of fixing it, `contrast` answers the ratio and every WCAG flag:

```typescript
let accent = readAccent("#3a81f6");
let page = Color.rgb(1, 1, 1);
let result = accent.contrast(page);

result.ratio; // 3.72
result.aa.text; // false, needs 4.5
result.aa.largeText; // true, needs 3
result.aa.nonText; // true, borders and icons need 3
```

A translucent color is painted over the background before it is measured, so a 60% accent on
white is judged as the lighter color a reader actually sees.

## Build a chart palette

`Color.steps` spaces colors evenly along a scale. It interpolates in Oklab by default, as CSS
gradients do, so each step looks equally far from the next. Four steps from `#3a81f6` give
`#3a81f6`, `#70a3f5`, `#a3c1f2` and `#d6dfec`:

```typescript {% title="app/services/workspaces/chart-palette.ts" %}
import { Color } from "@sdxc/color";

export function chartPalette(accent: Color, count: number): string[] {
	let neutral = accent.with({ chroma: 0.02, lightness: 0.9 });
	return Color.steps([accent, neutral], count).map((color) =>
		color.toString("hex"),
	);
}
```

Pass `{ space: "oklch" }` to keep chroma up through the middle of a scale between two hues, and
`hue: "longer"` to go the other way round the hue circle.
