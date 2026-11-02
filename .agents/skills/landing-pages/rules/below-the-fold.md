---
title: Below the Fold
impact: MEDIUM
tags: [performance, content-visibility, layout, scroll]
---

# Below the Fold

A landing is read top to bottom by someone deciding whether to stay. The first screen has to paint
at once and nothing may move as they scroll. So the page stays one document, and the browser is
told which parts it may skip until they matter.

## The pattern

- The hero and everything above the fold render normally.
- Each heavy section below the fold (a bento, a long feature grid, pricing, testimonials, a big
  diagram) takes `content-visibility: auto` and `contain-intrinsic-size: auto <height>`.
- The browser skips layout and paint for those sections until they near the viewport. Their text
  stays in the document, so it remains searchable with find-in-page, reachable by anchors, and
  readable with scripts off.

## Choosing the intrinsic size

- Measure the section's rendered block size at 1440 and 375, and use the desktop height. Add a
  `@media` override when the phone height is very different.
- `auto` makes the browser remember the real size once it has rendered the section. So a guess only
  affects the first scroll, and only the scrollbar's length.
- Too small a guess makes the scrollbar jump; too large leaves a gap below the last section until
  it renders. Stay within about 10% of the real height.

## Keep these working

- In-page anchors and the header's section links: `scroll-margin` still applies, and a jump lands
  the target in view. Hold this with a browser test.
- Scroll animations (`viewReveal`, animated diagrams) start when their section comes into view.
  Check one below-fold animation after scrolling.

## What not to do

- Don't split a landing into frames. Remix has no lazy frames today, and a section that streams in
  late or shifts the page costs more trust than it saves bytes.
- Don't put `content-visibility` on the hero or on anything the first screen shows.
