---
name: landing-pages
description: Design, build, redesign or review a marketing landing page in this monorepo with taste — a product home, feature, audience, comparison or pricing page, a book or app landing, a trial page, a docs hub, or a reading view behind a form. Teaches the judgment that makes a page good: show the product working instead of describing it (inline product mockups, animated flow diagrams, code in the reader's language, small scenes that each capture one moment), pick the right visual for each claim, commit to one art direction, compose with scale, cropping and pacing, write specific copy, keep proof honest, show restraint, and finish the details a reviewer notices. Use before planning or writing any landing, when redesigning one, when reviewing one, or when a page "looks fine but not great".
---

# Landing pages

A landing that only assembles the right components looks like every other template. The reference pages
in this repo are good because of judgment: each claim is shown with the product doing it, each band picks
the visual that proves its point, the page commits to one personality, and the details are finished. This
skill teaches that judgment. The components are the easy part (@rules/components-map.md).

## When to apply

- Planning a new landing, or a family of pages from one template
- Redesigning a page that works but reads as a template
- Reviewing a landing before it ships, or after a reviewer said "it looks fine"

## The references

Open them before designing, at 1440 and 375, light and dark. @rules/study-the-references.md walks each
one band by band, with the file behind every moment and the weak spots a review still finds.

- **sdxc.dev/demo/saas** (`apps/sdxc-site/resources/views/demos/saas/`) — the bar. A hero that is the
  product in three switchable views, numbered chapters, a bento where each cell is one moment.
- **uptime.sergiodxa.com** (`apps/uptime`) — a real product: mockups drawn from its own components,
  shared sample data, a flow diagram that runs its real spec language. `/browser-flows` has the best copy.
- **sdxc.dev/demo/book** (`demos/book/`) — editorial: serif, paper, square corners, a sample page that
  demonstrates the book's subject.
- **sdxc.dev/demo/app** (`demos/app/`) — consumer: a phone hero and colour-block scenes from daily life.
- **sdxc.dev** (`apps/sdxc-site/resources/content/home.md`) — developer tool: one handler in four runtime
  tabs, every number counted.

## Principles

### Show, don't claim (CRITICAL) — @rules/show-the-product.md

Every claim is demonstrated by the product doing it, drawn inline with the product's own labels and
believable data. A scene captures one moment: a before and after, a status change, a cause and effect.

```text
Weak:   an icon of a bell, "Instant alerts"
Strong: the outage alert for api.example.com at 14:02, and the recovery under it at 14:09
```

### Pick the device that proves the claim (CRITICAL) — @rules/choose-the-visual-device.md

A process animates (`FlowDiagram`), an integration is the real call in tabs (`CodeStage`), a product with
several faces switches (`SegmentedStage`), breadth is a bento of moments, scale is four figures, a
physical thing is the object. Never the same device twice in a row.

### Plan before markup (HIGH) — @rules/worked-example.md, @rules/story-and-section-order.md

Write the story (promise, proofs, action, objections), then a band table: claim → device → the exact
moment shown. A row whose moment you cannot name ships as text and icons. Start the order from the
closest page kind.

### Commit to one art direction (HIGH) — @rules/art-direction.md

Name the personality in two or three words — technical and precise, editorial and quiet, consumer and
warm — and set it once through palette and `--ui-*` tokens. Borrow a brand's real colours from its site.

### Compose with scale, cropping and pacing (HIGH) — @rules/composition-and-pacing.md

Huge display type against small mono labels, one focal point per band, product UI cropped and faded so it
implies more, dense bands followed by airy ones.

### Specific copy (HIGH) — @rules/copy-with-taste.md

Titles are claims only this product can make; eyebrows locate, titles argue.

```text
Weak:   Get started / How it works
Strong: How it works / From a verified domain to a named failure
```

### Honest proof (CRITICAL) — @rules/honest-proof.md

Never invent logos, customers, quotes or metrics for a real product. Figures come from code or config. No
proof means no proof section.

### Restraint and finish (HIGH) — @rules/restraint-and-finish.md

One flourish of each kind, motion only where it explains, colour that means something. Then tabular
figures, nested radii, hairlines, no orphan cells, one CTA shape, nothing moving on hover.

## Workflow

1. **Study** two references and note the moments you want to match (@rules/study-the-references.md).
2. **Plan**: the story, the band table, the device check (@rules/worked-example.md).
3. **Set the art direction** in tokens, then build the hero and compare it with Keel's before going on.
4. **Draw the product**: mockups and scenes with specific sample data shared across the page.
5. **Review like the user would**: six widths, both themes, beside the reference, then turn each fix into
   a test (@rules/verify-like-a-reviewer.md). @rules/gotchas.md lists what breaks silently.

## The bar

Put your page beside sdxc.dev/demo/saas. Every band shows the product doing something. Nothing is
invented. No title survives the swap test: replace the product name and it no longer fits. The page has a
personality you can name in two words. A reviewer finds no orphan cell, no overflow at 320px, no truncated
label, no misaligned button, no hover that shifts anything, no raw translation key, and a dark mode that
looks designed.
