---
title: Composition and Pacing
impact: HIGH
tags: [taste, composition, scale, rhythm, layout]
---

# Composition and Pacing

Within a band, composition decides where the eye lands; across bands, pacing decides whether the reader
keeps scrolling. Good pages use strong contrast of scale, one focal point per band, crops that imply more,
and a rhythm that alternates density, tone and device.

## Why

- **Even pages are dull pages.** When every heading, card and gap is medium-sized, nothing leads. Contrast
  of scale creates hierarchy without decoration.
- **Cropping suggests depth.** A product window that runs off the edge, or fades at the bottom, says
  "there is more" in a way a fully visible thumbnail cannot.

## Within a band

- **Contrast of scale.** A display `h1` around 4.5–5rem on desktop against a 12px mono uppercase eyebrow and
  a 20–24px lead. Chapter titles large and short (32 characters or fewer). Figures in `StatStrip
  size="display"` big enough to read as a statement.
- **One focal point.** Each band has one thing to look at first: the product window, the diagram, the
  code. Copy supports it; it does not compete. Two visuals of equal weight side by side cancel out.
- **Lean toward the visual.** Splits lean to the media (`lean="media"`); the copy column holds a short
  header, a lead with one `<strong>`, and two to four checks — not paragraphs.
- **Bleed when the visual is the star.** `Split.Media bleed="end"` lets a code showcase or product window
  run off the page edge (sdxc.dev's runtime showcase).
- **Crop and fade.** Card and bento scenes keep the story at the top and let the last rows fall into the
  media fade; Rooftree's sheets start below a margin and run past the cell's lower edge.
- **Frame consistently.** Pick one framing system and use it throughout: technical pages pin corners with
  `Crosshair` and run `Rails` down the page; editorial pages rule hairlines; consumer pages float tinted
  stages. Mixing systems looks undecided.
- **Balance a split.** The two columns should end near the same line. Keel's metering chapter at 1280 is
  the mild case: ten lines of code beside a header, a lead and three checks, so the code stage stops above
  the copy. The fix is in the content, not the layout: lengthen the code to the real call with its error
  handling, cut a check, or move the header above the split so the copy column is only the lead and checks.

## Across the page

- **Open strong, close simply.** The hero is the densest band; the closing band is the simplest — one
  sentence, one action, centred, on brand or inverse ground.
- **Alternate density.** A dense band (bento, feature cards, a table) followed by an airy one (a split with
  one visual, a statement band, figures).
- **Alternate tone, or commit to none.** Plain and tinted bands take turns (Uptime, Keel), or every band
  is the same paper and hairlines carry the rhythm (the book demo); a half-alternating page looks like a
  missed band. With alternation, one or two emphasis bands (brand, inverse, gradient, or an inset band
  floating with rounded corners) mark the turns in the story.
- **Alternate device** (@rules/choose-the-visual-device.md): never two code splits or two card grids in a
  row. Splits may keep their media on one side; the device inside them is what has to change.
- **Breathe.** A centred statement band (a thesis in one sentence) between dense chapters gives the reader
  a rest and states what the page believes.
- **Put proof early.** Figures or real logos right after the hero, before any feature explanation.
- **Consistent edges.** Every band's content starts on the same left edge; headers are start-aligned
  everywhere except the hero variant, statement bands and the close.

## Rules

1. Create hierarchy with contrast of scale, not decoration.
2. Give each band one focal point and lean splits toward it.
3. Crop, fade and bleed visuals so they imply more than the frame holds.
4. Use one framing system for the whole page.
5. Alternate density, tone and device down the page; open dense, close simple.
