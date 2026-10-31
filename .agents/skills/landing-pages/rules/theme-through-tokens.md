---
title: Theme Through Tokens
impact: HIGH
tags: [theme, colors, dark-mode, tokens, typography, art-direction]
---

# Theme Through Tokens

A brand is a palette plus a handful of `--ui-marketing-*` tokens, set once at the root. Components read
the tokens; pages never hard-code colours, radii or fonts on individual elements. The same components look
like a SaaS dashboard, an editorial book or a consumer app depending only on the tokens.

## Why

- **One change restyles everything**: CTA shape, radii, eyebrow style and display type move together.
- **Dark mode comes for free** when every colour is a semantic token; a fixed step like
  `--ui-color-brand-600` used for text fails contrast in one of the two themes.
- **Misspelled tokens fail silently**: `var(--ui-neutral-tint-hover)` resolves to nothing and the hover
  fill vanishes. This shipped twice before a test caught it.

## The palette

`@sdxc/ui` ships no colours. The app defines eleven steps (50–950) for `brand`, `neutral`, `success`,
`warning` and `danger`, in oklch on one shared lightness ramp, held inside the sRGB gamut:

```css
/* resources/css/colors.css, imported between @sdxc/ui/reset.css and @sdxc/ui/theme.css */
:root {
	--ui-color-brand-500: oklch(0.6 0.11 162);
	--ui-color-neutral-500: oklch(0.55 0.013 250);
	/* …every step of every scale */
}
```

`apps/uptime/resources/css/colors.css` is the model, including why `success` moved hue away from `brand`.
To match an outside brand (say a framework's site), open it in the browser and read the real colours from
computed styles; do not guess from memory.

Then use semantic tokens through `@sdxc/u`: `fg("neutral.emphasis")`, `bg("brand.bg-tint")`,
`fg("brand")`. Hover and pressed fills are `<scale>.bg-tint-hover` and `<scale>.bg-tint-pressed`.

## Art direction tokens

Set these on the page root (the layout, or a `raw({...})` on the wrapper):

```ts
// The book demo's editorial direction: serif type, square corners, no lift
const TOKENS = {
	"--ui-font-display": SERIF,
	"--ui-marketing-display-weight": "400",
	"--ui-marketing-display-tracking": "-0.02em",
	"--ui-marketing-cta-radius": "0",
	"--ui-button-radius": "0",
	"--ui-marketing-radius-surface": "0",
	"--ui-marketing-card-radius-outer": "0",
	"--ui-marketing-plan-lift": "0 0 #0000",
	"--ui-marketing-eyebrow-font": SERIF,
};
```

The knobs, grouped (`packages/ui/src/theme.css` is the source of truth):

- **Type**: `--ui-font-display/-sans/-mono`, `--ui-marketing-display-*`, `-chapter-size/-leading/-tracking`,
  `-lead-*`, `-hero-lead-size/-leading`.
- **Shape**: `--ui-marketing-cta-radius/-height/-weight`, `--ui-button-radius`, `-radius-surface`,
  `-radius-frame`, `-card-radius-outer/-inner`, `-band-radius`, `-plan-radius`, `-plan-lift` (use
  `0 0 #0000`, never `none`).
- **Surface**: `--ui-shadow-surface/-stage/-control/-float`, `--ui-marketing-hairline`, `-band-tint`,
  `-band-glow`, `-brand-band`, `-band-gradient`, `--ui-surface-raised`.
- **Eyebrow and accent**: `--ui-marketing-eyebrow-color/-font/-weight/-transform/-tracking`,
  `--ui-marketing-accent-color`.
- **Measure**: `--ui-marketing-measure`, `-gutter`, `-header-space`.

## A palette on part of a page

Re-declaring `--ui-color-brand-*` on a wrapper is not enough: the semantic tokens already resolved on
`:root`. Re-declare the semantic tokens on the wrapper and add `themeScope()`. `DemoTheme` in
`apps/sdxc-site/resources/components/demo-theme.tsx` does exactly this and is the pattern to copy.

## Dark mode

- Raised surfaces are lighter than the page in dark, not darker (`--ui-surface-raised`).
- Hairlines are white at about 10% in dark and ink at about 6% in light.
- Copy on `brand` and `inverse` bands must still clear 4.5:1 in dark; use `var(--ui-brand-fg)`-style tokens.
- Check the page in dark at 375 and 1440 as a separate pass, not as an afterthought.

## Rules

1. Define the full palette in the app's `colors.css`; read an outside brand's colours from its live site.
2. Set art direction once with `--ui-marketing-*` tokens; never restyle components one by one.
3. Use semantic tokens for every colour; never a fixed `--ui-color-*-NNN` step for text.
4. Spell hover fills `<scale>.bg-tint-hover`, and test that every `var()` in your scenes resolves.
5. Scope a partial palette with re-declared semantic tokens and `themeScope()`.
