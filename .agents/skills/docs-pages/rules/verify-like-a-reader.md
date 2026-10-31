---
title: Verify Like a Reader
impact: HIGH
tags: [verification, testing, browser-tests, responsive, review]
---

# Verify Like a Reader

A docs page is done when you have used it the way a reader would: found it by search, jumped to a section
from the rail, copied the code, followed the pager, at every width and in both themes. Static review
catches the layout; only using the page catches a marker that never reaches the last section or a sidebar
that opens 3,900px away from the current page.

## The pass

1. Run the dev server and open the page beside a reference (Fumadocs or Cloudflare for developer docs,
   Notion for help pages).
2. At 320, 375, 768, 1024, 1280 and 1440, in light then dark, check: no horizontal page scroll; code and
   tables scroll in their box; the measure stays 60–75ch; sticky header, bar and rail never overlap.
3. **Use it**:
   - Search for a word that only appears in a page's body, then a question, then nonsense. Check the
     empty state, the results, the highlight, no results, `Esc`, and the phone sheet.
   - Scroll a long page slowly, then press End, then Home, then click a rail item: the marker follows
     each time, the last section is marked at the bottom, the marker stays inside the rail, every jump
     clears the sticky header.
   - Open a deep page: the sidebar shows the current link without scrolling it.
   - Copy a code block, switch a package-manager tab and reload, follow the pager both ways.
   - Open the phone menu, follow a link, confirm it closes; open the phone TOC bar, pick a section.
   - Turn on reduced motion and repeat the marker and dialog checks.
4. Write findings first (page, width, theme, what's wrong, how the reference does it), then fix.

## Tests to write

Every fix gets a test that fails on the old code; layout and interaction tests are `*.browser.test.tsx`.

- **TOC**: at the page bottom the last item is current; after `scrollTo` past a heading without crossing
  the observer line the right item is current; the current item lies inside the rail's box.
- **Sidebar**: on load the current link is within the sidebar's visible box.
- **Jumps**: each heading's top after `location.hash = …` is below the sticky header's bottom.
- **Pager**: the whole card is the link (hit-test the card's corner); no neighbour across sections.
- **Tabs**: a choice in one group changes every group with the same key and survives a reload.
- **Search**: a body-only word returns the page; no-results renders its suggestions; highlight marks
  don't overlap neighbouring glyphs (compare rects).
- **No overflow at 320** for code blocks, tables, file trees and long inline tokens.
- **Contrast** of muted text, callout text and code tokens at 4.5:1 in both themes.
- **Outline**: one `h1`, no skipped levels, every `h2`/`h3` with an id.

## Rules

1. Look at six widths in both themes, then use the page as a reader.
2. Exercise search, TOC, sidebar position, copy, tabs and pager on every layout change.
3. Turn every fix into a browser test that fails on the old code.
