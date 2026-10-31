---
title: On This Page
impact: CRITICAL
tags: [toc, scroll-spy, rail, phone, motion]
---

# On This Page

The "On this page" rail is a map of the page and a "you are here" dot. Done well, the reader always
knows how far they are and what's left; done badly, the dot lags, gets lost below the fold, or never
reaches the last section. Every reference except Cloudflare and Fumadocs has at least one of those bugs.

## Why

- **It answers "is my answer on this page?" before the reader scrolls.** A scannable list of `h2`s is
  the page's outline.
- **The marker is the most-watched motion on a docs site.** It moves on every scroll, so a jump, a lag or
  a stuck marker is felt constantly.

## The rail (desktop, from ~1200px)

- `h2` and `h3` only, `h3` indented ~12px; 13–14px text in the muted colour; ~28px rows; the column
  ~200–260px wide, sticky under the header, scrolling on its own when long.
- **Mark everything in view, not just one item.** Fumadocs draws one tinted band behind every heading
  whose section is on screen and moves it with `clip-path` over 300ms ease-out, so the band grows and
  shrinks in whole rows. Cloudflare draws the rail as one SVG path that curves into the `h3` indents and
  slides the active segment along it (300ms, `cubic-bezier(.32,.72,0,1)`). Either reads as motion with
  a meaning; a bold item that snaps from row to row (shadcn) reads as flicker.
- **The last section gets marked** when the page bottom is reached, even if its heading never crosses
  the trigger line (Starlight, shadcn and Bun all miss it). Count from scroll position, not only an
  IntersectionObserver, so jumps and restored positions mark correctly.
- **The rail scrolls itself to keep the marker visible.** A 77-item reference whose marker sits below
  the rail's box is the bug both of our sites have today.
- Clicking an item smooth-scrolls (instant under reduced motion), updates the hash, and the heading
  lands clear of the sticky header.
- Under the list, small and quiet: "Was this helpful?", "Edit this page", "Back to top". Not ads.

## Below the rail breakpoint

Keep it. Linear, Notion, Readwise and Bun drop the TOC on phones; the reader then has no map at all.

- A sticky bar under the header: "On this page" plus the **current section's title**, which changes as
  the reader scrolls (Fumadocs rolls it in with a short blur from the scroll direction, 320ms) and a
  progress indicator (Fumadocs: an 18px ring filling `stroke-dashoffset` over 300ms).
- Tapping it expands the full list inline or as a sheet; choosing an item closes it and jumps.
- Cloudflare's native `<select>` is the robust floor: zero JavaScript to open, the OS picker on a phone.

## When to show nothing

A page with fewer than three headings has no TOC; the rail column collapses so the measure doesn't jump.

## Rules

1. Mark the sections in view with a marker that slides, and gate the slide on reduced motion.
2. Always mark the last section at the bottom, and keep the marker inside the rail's visible box.
3. Clear the sticky header on every jump.
4. Keep a current-section bar on phones and tablets.
