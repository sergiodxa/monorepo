---
title: Reading Experience
impact: HIGH
tags: [typography, measure, rhythm, headings, dark-mode]
---

# Reading Experience

A docs page is read in bursts: a scan for the right section, then close reading of a few paragraphs and
a code block. The type has to support both: headings that stand out at a glance, and body text that is
comfortable for five minutes at a time.

## Why

- **Most docs complaints that sound like "it's confusing" are layout**: lines too long to track, headings
  too close in size to the body, code that scrolls sideways at 375.
- **The best sites agree closely on the numbers.** Measured at 1440 in October 2026 (body size / line
  height / measure):

| Site | Body | Measure | `h1` | `h2` (top margin) |
| --- | --- | --- | --- | --- |
| Cloudflare | 16 / 28px | 64ch (648px) | 35px / 600 | 20.8px / 600 (40px) |
| Next.js | 16 / 28px | 67ch (716px) | 40px / 450, −2px tracking | 24px / 450 (48px) |
| shadcn/ui | 14 / 22.75px | 66ch (614px) | 30px / 600 | 18.75px / 600 (33px) |
| Linear | 15 / 24px | 70ch (650px) | 32px / 590 | 24px / 590 (56px) |
| Starlight | 16 / 28px | 74ch (720px) | 42px / 600 | 35px / 600 |
| Bun | 16.5 / 28.8px | 75ch (752px) | 41.6px / 800 | 25.5px / 700 (56px) |
| Stripe | 16 / 26px | 83ch (814px) | 32px / 700 | 24px / 400 |

## The numbers to aim for

- **Body 16px with a 1.65–1.75 line height**; 15px is the floor for prose. Muted secondary text only for
  descriptions and captions, never for the body.
- **Measure 60–75ch** (roughly 640–760px at 16px). Wider than 80 and the eye loses the next line; the
  column caps, the page doesn't stretch it.
- **`h1` 2–2.6× the body**, tight tracking at large sizes. **`h2` 1.3–1.6×** with **40–56px above** and
  about a third of that below, so a section visibly starts. `h3` is the body size + weight, not a
  smaller `h2`.
- **Heading anchors**: every `h2`/`h3` has an id and a `#` (or link icon) that appears on hover or focus,
  and the jump clears the sticky header (`scroll-margin-block-start`).
- **Inline code** in a tinted chip at ~0.875em, never wrapped mid-token at 375 without `overflow-wrap`.
- **Lists** get the same rhythm as paragraphs; numbered lists for sequences only.
- **Tables** scroll inside their own box at 375; the page never scrolls sideways.

## Dark mode

Designed, not inverted: a near-black background (not pure `#000` unless the brand is, as on Linear), body
text at ~85–90% white, code blocks one step lighter than the page, callout tints re-chosen so they stay
4.5:1. Screenshots and diagrams get a dark variant or a frame that sits on both.

## Rules

1. Body 16px / ~1.7, measure capped at 60–75ch.
2. Headings clearly larger than body, with generous space above; anchors on every `h2`/`h3`.
3. Nothing scrolls the page sideways at 320: code, tables and long tokens scroll or wrap in their box.
4. Check every page in dark; re-pick tints and image frames rather than inverting.
