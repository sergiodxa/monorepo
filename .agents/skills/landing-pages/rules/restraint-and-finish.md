---
title: Restraint and Finish
impact: HIGH
tags: [taste, restraint, motion, details, polish, a11y, grids, cta]
---

# Restraint and Finish

Taste is as much what you leave out as what you add. Use each flourish once, give motion a job, and then
finish the small details that make a page feel expensive. Every item below was a real defect found in a
review of a page that otherwise looked done.

## Why

- **Flourishes lose force when repeated.** One swash under one word is a signature; three are noise.
- **Details are what readers feel without noticing.** Figures that line up, cards of equal height and
  buttons that do not jiggle make a page feel solid; their absence makes it feel cheap.

## Restraint

- **One of each.** One `AccentText` highlight in the hero title, one marquee, one inverse band, one
  statement band.
- **Motion has a job.** It explains (a flow diagram running), reveals (`LandingHero entrance`,
  `viewReveal()` on bands) or shows that something is live. Never decorative spinning or parallax for its
  own sake. Everything is gated on `prefers-reduced-motion`, and the static render shows the finished state.
- **Colour means something.** Brand marks action and emphasis; status colours mark status.
- **No filler sections.** A shorter honest page beats a longer padded one (@rules/honest-proof.md).

## Details that make it feel expensive

- **Figures**: tabular numerals, amounts right-aligned, columns aligned across rows with one grid and
  `subgrid`.
- **Radii**: inner corners smaller than outer ones (`--ui-marketing-card-radius-inner` vs `-outer`).
- **Lines**: hairlines (`--ui-marketing-hairline`) instead of opaque borders.
- **Text**: card titles `text-wrap: balance`, notes `pretty`, no one-word widows in headings, an 11px floor
  inside mockups.
- **Small signs of life**: a release pin under the hero CTAs, a status dot, a titled code block with a copy
  button.

## The finish

**Hierarchy**: one `h1` from the hero, `h2` per band, `h3` per card; the patterns set levels, so never hand-
place them. Every band has an eyebrow in one style.

**Grids**: pick columns from the item count so no row is short — 3 → 3, 4 → 2 (or a four-column `Bento`), 6 → 3, 9 → 3, never 3
items in 2 columns. Change the content count before reaching for a layout trick. Stat strips carry four
figures. Cards in a row share a height and a title baseline.

**CTAs**: one primary action, repeated in header, hero and close; one shape (`--ui-marketing-cta-radius`)
for every button through `marketingCtaChrome()`; secondaries are `variant="surface"` or an arrow link,
never grey; card actions pinned to the foot with `Feature.Action` + `Feature.Link`; full width at 375.

**Hover**: changes colour, never size, padding or border; arrows nudge 2px by `transform`. Hover fills are
`<scale>.bg-tint-hover` — a misspelled token silently goes transparent.

**Stability**: tabbed panels share one grid cell so switching never changes height; the sticky header never
covers an anchor target (`scroll-margin-block-start` on `main [id]`).

**Phones**: no horizontal scroll at 320, no truncated labels, mockups scaled rather than reflowed, the header
collapses to a sheet before its links wrap, the sheet closes when a link is followed.

**Accessibility**: a framed mockup is one `role="img"` with a label and `aria-hidden="true"` insides;
decorative scenes and icons hidden; 4.5:1 for every text node on every band tone in both themes; focus
rings visible on brand and inverse bands; tap targets of 44px.

## Rules

1. Use each flourish once; give every motion a job; gate it on reduced motion.
2. Cut sections you cannot fill honestly.
3. Align figures, nest radii, use hairlines, balance titles.
4. Size grids from their item count and keep stat strips to four figures.
5. One CTA shape, one primary action, nothing that moves on hover.
