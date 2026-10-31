---
title: Motion and Finish
impact: HIGH
tags: [motion, animation, micro-interactions, details, polish, a11y]
---

# Motion and Finish

Docs motion is small and functional: a marker that slides to where you are, a dialog that arrives, an
icon that says "copied". None of it is decoration. It is what makes Fumadocs and Cloudflare feel
expensive beside sites with the same features, and its absence is what makes a site feel like a template.

## Why

- **Motion tells the reader what changed.** A TOC marker that slides shows the direction of travel; one
  that snaps just blinks. A copy icon that becomes a check confirms the copy without a toast.
- **Docs are used for hours.** Anything slow, bouncy or repeated becomes irritating by the tenth time;
  keep it at 150–300ms and ease-out.

## The motion worth having

Measured on the references:

| Moment | How the best one does it |
| --- | --- |
| TOC marker | Slides along the rail, 300ms `cubic-bezier(.32,.72,0,1)` (Cloudflare); band via `clip-path`, 300ms ease-out (Fumadocs) |
| Phone TOC bar | Current section rolls in from the scroll direction with a slight blur, 320ms `cubic-bezier(.22,1,.36,1)`; progress ring fills over 300ms (Fumadocs) |
| Search dialog | Scales from 1.06 and fades, 300ms, over a 20% dim + 4px blur backdrop (Fumadocs) |
| Sidebar collapse | `grid-template-columns` transition, 300ms, state kept across reloads (Fumadocs) |
| Sidebar group | Chevron rotates, children reveal in ~150–200ms |
| Copy button | Icon swaps to a check for ~2s, announced through an `aria-live` span ("Copied!", Cloudflare) |
| Tabs | Indicator slides under the chosen tab; the panel area keeps its height |
| Phone menu | Sheet slides in from the side, ☰ morphs to ✕ (~100–200ms) |
| Feedback | Choosing 👍/👎 fills the icon, then a textarea opens (~150ms) |
| Scroll to top | Appears after ~300–450px of scroll, a 44px circle whose ring shows progress (Cloudflare) |
| Hover | Colour only on links and rows; cards tint and arrows nudge 2px by `transform` |

Everything above is instant under `prefers-reduced-motion: reduce` (Cloudflare fades instead of
sliding), and the static render shows the finished state.

## Details a reviewer notices

- `kbd` chips for shortcuts, one key each, in the search trigger and the search footer.
- Heading anchors: a `#` or link icon appears on hover and focus; copying a link confirms.
- Smooth scroll for in-page jumps (instant under reduced motion), headings clearing the sticky header.
- The sidebar opens scrolled to the current page, and keeps its scroll across navigation.
- Focus rings on every control, including tabs, TOC links and pager cards.
- Tabular numbers in tables of figures; hairline borders, not heavy ones; radii nested (inner < outer).
- Long tokens (`@sdxc/http/cache`) wrap or scroll in their box; no horizontal page scroll at 320.
- Labels that change state say so in text, not colour alone ("Copied", "Thanks for the feedback").

## What to leave out

Parallax, page-transition animations, bouncy springs, skeleton shimmer for local content, auto-playing
video with sound, anything that moves on hover beyond colour and a 2px nudge.

## Rules

1. Animate only what changes state: marker, dialog, sheet, tab, copy, feedback.
2. 150–300ms, ease-out; none under reduced motion.
3. Finish the keyboard: shortcuts shown, focus visible, anchors copyable, `Esc` closes.
4. Open the sidebar at the current page.
