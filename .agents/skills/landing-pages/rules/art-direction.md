---
title: Art Direction
impact: HIGH
tags: [taste, art-direction, theme, tokens, typography, color]
---

# Art Direction

Decide what the page feels like before building it, name it in two or three words, and let that decision
set type, corners, colour, surfaces, framing and motion everywhere. The same components become a precise
developer tool, a quiet book or a warm consumer app depending only on this choice, so a page without one
looks like the library's defaults.

## Why

- **Coherence reads as quality.** Serif headings with pill buttons and drop shadows on a book page feel
  assembled; serif, square corners and flat paper feel designed.
- **It answers a hundred small questions at once.** Once the direction is "technical drawing", the eyebrow
  is mono, the frame gets corner crosshairs, the code is the hero's third face, and nobody debates it.

## Three directions in this repo

**Technical and precise** — Keel (`demos/saas/`), sdxc.dev, Uptime.
Grid-paper hero (`tone="grid"`), sans display at 600 with tight tracking, mono uppercase eyebrows, numbered
chapters ("01 / Metering"), `Rails` and `Crosshair` marks like a technical drawing, ruled logo grids, code
as a first-class visual, a release pin, hairlines instead of borders, raised surfaces with soft tinted
shadows, rounded-but-small radii.

**Editorial and quiet** — the book demo (`demos/book/`).
Serif for display and body, display weight 400, square corners everywhere, no shadows or lift, a paper
ground, a generous measure, a flat cover, a real sample page, generous whitespace, very little colour —
one ink accent. Motion barely there.

**Consumer and warm** — Rooftree (`demos/app/`).
Rounded, friendly type, a phone in the hero, colour-block bento cells each in its own hue, playful scenes
from daily life, store badges, a marquee of press marks, soft gradients behind the device.

## Set it once, in tokens

Never style components one by one; set the direction on the page root.

```ts
// Editorial: the book demo
const TOKENS = {
	"--ui-font-display": SERIF,
	"--ui-font-sans": SERIF,
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

The knobs (`packages/ui/src/theme.css` is the source of truth):

- **Type**: `--ui-font-display/-sans/-mono`, `--ui-marketing-display-*`, `-chapter-*`, `-lead-*`, `-hero-lead-*`.
- **Shape**: `--ui-marketing-cta-radius`, `--ui-button-radius`, `-radius-surface`, `-radius-frame`,
  `-card-radius-outer/-inner`, `-band-radius`, `-plan-radius`, `-plan-lift`.
- **Surface**: `--ui-shadow-surface/-stage/-control/-float`, `--ui-marketing-hairline`, `-band-tint`,
  `-band-glow`, `-brand-band`, `-band-gradient`, `--ui-surface-raised`.
- **Labels**: `--ui-marketing-eyebrow-color/-font/-weight/-transform/-tracking`, `--ui-marketing-accent-color`.

`DemoTheme` (`apps/sdxc-site/resources/components/demo-theme.tsx`) shows a complete direction as palette
plus tokens; an app sets the same in its `colors.css` and layout (`apps/uptime/resources/layouts/marketing.tsx`).

## Colour

- **Borrow real colours.** To dress a page in a brand (a framework's red, a product's emerald), open its
  site in the browser and read the values from computed styles. Build an eleven-step oklch ramp around
  them, held inside the sRGB gamut (`apps/uptime/resources/css/colors.css` explains how).
- **One accent.** Brand colour marks the primary action, the highlighted words in the `h1`, your column in a
  comparison, active states. Everything else is neutral. A page where everything is brand has no accent.
- **Status colours mean status.** Keep `success` visibly apart from `brand` (Uptime moved success 20° of
  hue away so an "up" badge never looks like a button).
- **Neutrals carry character.** A cool neutral makes an emerald pop; a warm paper neutral makes a book feel
  printed.
- **Dark mode is designed, not inverted.** Raised surfaces get lighter, hairlines become white at about
  10%, brand bands keep 4.5:1, and the page is reviewed in dark as its own pass.

## Rules

1. Name the direction in two or three words before building, and pick the closest reference.
2. Set it once through palette and `--ui-marketing-*` tokens; never restyle components one by one.
3. Read a brand's real colours from its live site; never guess.
4. Use one accent colour, for meaning; keep status colours distinct from it.
5. Review dark mode as a separate design pass.
