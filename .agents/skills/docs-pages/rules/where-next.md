---
title: Where Next
impact: HIGH
tags: [pager, next-steps, routing, hub, related]
---

# Where Next

The end of a page is where a reader decides to keep going or leave. Sidebar-order prev/next is the floor;
the moves that make a docs site feel like a path are written by hand: "Next steps" that follow from what
the reader just did, a chooser that routes them by situation, and a pager that says where it leads.

## Why

- **The next page in the sidebar is rarely the next thing the reader needs.** After "Install", the next
  step depends on their framework; after "Add a monitor", it is "Choose who gets alerted", not the next
  alphabetical concept.
- **A pager that names its destination gets clicked.** "Next" alone asks the reader to trust it.

## The hand-written path (strongest)

- **A "Next steps" section** ending guides and quickstarts, two to four links each with one line saying
  what it gets the reader (sdxc.dev's "Where to go next", Starlight's "Next steps", Stripe's "See also").
- **A chooser where readers fork.** shadcn's Installation offers three starting-point cards ("Use
  shadcn/create", "Use the CLI", "Existing project") and then a framework logo grid; Stripe opens
  "Accept a payment" with Checkout / Elements / Mobile. The reader picks their situation once and every
  following step fits it.
- **One curated "Up next" card** on product help pages (@rules/product-docs.md).

## The pager (the floor)

- Two cards at the bottom, previous left and next right, each **wholly clickable**, with an arrow, a muted
  label ("Previous" / "Next") and the **destination title** at body size or larger (Starlight shows
  "Next / Manual Setup" at 22px). Show the section name when the destination crosses into another one.
- Hover tints the card and nudges the arrow 2px by `transform`; nothing changes size.
- Only one card? It sits on its own side, never stretched across.
- The order follows the sidebar, and never wraps from one section's end into an unrelated product or
  library (shadcn's previous arrow on Accordion jumps into another library).
- Optional: prev/next arrows in the title row for readers flipping through a catalogue (shadcn).

## Order at the foot of a page

Next steps (content) → "Was this helpful?" → last updated · edit link → pager. Fumadocs and Starlight
follow this; it keeps the editorial path above the mechanical one.

## Rules

1. End guides with hand-written next steps that follow from the task.
2. Route readers by situation with a chooser where the path forks.
3. Make the whole pager card the link, with its destination's title.
4. Never let the pager jump across unrelated sections.
