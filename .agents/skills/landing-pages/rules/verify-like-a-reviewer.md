---
title: Verify Like a Reviewer
impact: HIGH
tags: [verification, testing, browser-tests, responsive, review]
---

# Verify Like a Reviewer

A page is done when you have looked at it the way a demanding reviewer would, at every width and in both
themes, and turned each defect you fixed into a test. Tests and type checks prove the page renders; only
looking proves it is good.

## Why

- **Most defects are only visible at one width**: orphans at 768, truncation at 375, overflow at 320,
  footer labels wrapping at 1280.
- **Dark mode hides its own bugs**: contrast and missing tokens show up only in the dark pass.
- **Fixes regress**: every review round re-found a class of bug a previous round had fixed by hand.

## The pass

1. Run the app's dev server (`preview_start`) and open the page side by side with the reference
   (sdxc.dev/demo/saas for product pages, /demo/book for editorial ones).
2. Check 320, 375, 768, 1024, 1280 and 1440 in light, then again in dark (`resize_window` with
   `colorScheme`).
3. At each width, look for: horizontal scroll, orphan cells, truncated labels, buttons wrapping to two
   lines, heading widows, cards of uneven height, misaligned CTAs, mixed alignment in a band, text within
   12px of the edge at 375.
4. Exercise interactions: tab switches keep their height, the phone sheet opens and closes on a link,
   anchors land below the sticky header, FAQ opens, focus rings show on every band, hover moves nothing.
5. Write findings first (page, width, theme, what is wrong, how the reference does it), then fix them.

A scripted audit catches what eyes miss. Load the page in a same-origin iframe of exact width and check
`scrollWidth > clientWidth` on the document and every box, ellipsis truncation, the last row of every grid,
and the contrast of every text node against its resolved background.

## Tests to copy

Every layout or colour fix gets a regression test that fails on the old code (swap the old file in and
watch it fail). Name layout tests `*.browser.test.tsx` so they measure the real DOM in Chromium.

- **Outline**: one `h1`, first, no skipped levels (the guide's "Test the outline";
  `packages/ui/src/patterns/outline.test.tsx`).
- **Phone sheet**: a plain click on a sheet link closes it; a meta-click keeps it open
  (`apps/uptime/resources/layouts/marketing.browser.test.tsx`).
- **No overflow at 320**: the stat strip (`apps/uptime/resources/views/marketing/solution.browser.test.tsx`)
  and the footer (`apps/uptime/resources/layouts/marketing.browser.test.tsx`) stay inside the viewport.
- **Tokens resolve**: every `var(--…)` inside scenes is defined
  (`apps/uptime/resources/components/marketing/capability-scenes.browser.test.tsx`), and no source names a
  `.tint-hover` token (`apps/sdxc-site/resources/views/demos/hover-tokens.test.ts`).
- **Row alignment**: card titles in a row share one `top` at 1280 (`capability-scenes.browser.test.tsx`);
  scene media in a row share a top and height (`apps/sdxc-site/resources/views/demos/app/features.browser.test.tsx`).
- **No clipped labels**: at 343px no leaf text has `scrollWidth > clientWidth`
  (`apps/sdxc-site/resources/views/demos/saas/product-panels.browser.test.tsx`).
- **Mockups**: every slug maps to a mockup, the frame has `role="img"` with a translated label, and the
  inside is `aria-hidden="true"` (`apps/uptime/resources/components/marketing/product-mockups/index.test.tsx`).
- **Honesty**: the counted figures render and dropped ones stay gone
  (`apps/sdxc-site/app/http/controllers/home.test.ts`), and the home states no price of its own
  (`apps/uptime/app/http/controllers/home.test.ts`).
- **No raw keys**: the render contains no `landing.` key text.

Browser tests need the package theme on the host and `@sdxc/ui/reset.css` imported, or content-box sizing
reports overflow that is not there.

## Rules

1. Look at six widths in both themes before calling a page done.
2. Compare side by side with the reference page and write findings before fixing.
3. Turn every layout or colour fix into a browser test that fails on the old code.
4. Copy the outline, sheet, overflow, token and honesty tests for every new landing.
5. Share proof: screenshots at 375 and 1440 in both themes.
