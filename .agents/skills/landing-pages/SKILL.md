---
name: landing-pages
description: Design and build a marketing landing page in this monorepo with taste — a product home, feature, audience, comparison or pricing page, a book or app landing, a trial page, a docs hub, or a reading view behind a form. Teaches the judgment that makes a page good: show the product working instead of describing it (inline product mockups, animated flow diagrams, code in the reader's language, small scenes that each capture one moment), pick the right visual device for each claim, commit to one art direction, compose with scale, cropping and pacing, write specific copy, keep proof honest, show restraint, and finish the details a reviewer notices. Use before designing any landing, when reviewing one, or when a page "looks fine but not great".
---

# Landing pages

A landing that only assembles the right components looks like every other template. What makes the
reference pages in this repo good is judgment: each claim is *shown* with the product doing it, each band
picks the visual that proves its point, the page commits to one personality, and the details are finished.
This skill is that judgment. The components are the easy part; @rules/components-map.md covers them.

## The references, and what to steal from each

Open them in the browser and study them before designing. Learn *why* each moment works.

- **sdxc.dev/demo/saas** (`apps/sdxc-site/resources/views/demos/saas/`) — the bar. The hero is the product,
  not a picture of it: a switcher between the revenue dashboard, the meters and the API call, pinned at its
  corners like a technical drawing, with the latest release as a small pin under the CTAs. Each chapter is
  numbered ("01 / Metering"), makes one claim, backs it with three concrete guarantees, and shows the one
  API call in three languages. The bento is six tiny moments: tax rates as jurisdiction chips, one price in
  four currencies, a webhook delivery log, revenue recognised as deferred revenue drains.
- **uptime.sergiodxa.com** (`apps/uptime`) — real product, no fake proof. Every card shows a moment of the
  product: an outage alert followed by its recovery, certificates counting down to expiry, a status page
  with a month of daily bars. Browser flows are explained by an animated diagram that runs the actual spec
  line by line and ends on "passed". Hero and cards use the same sample hosts, so the page feels like one
  product.
- **sdxc.dev/demo/book** (`demos/book/`) — editorial. Serif display, square corners, no shadows, paper
  ground, the flat cover as the hero, a real sample page, a table of contents you can open.
- **sdxc.dev/demo/app** (`demos/app/`) — consumer. A phone in the hero, colour-block bento cells where each
  scene is a moment of daily life: a barcode landing on the list, spoken words becoming two rows, a nudge
  as you pass the shop.
- **sdxc.dev** home (`apps/sdxc-site/resources/content/home.md`) — developer tool. The same handler shown
  running on four runtimes, bleeding off the page edge; every number on the page counted from the registry.

## Principles

### Show, don't claim (CRITICAL) — @rules/show-the-product.md

Every claim on the page is demonstrated by a picture of the product doing it. "Alerts when your site goes
down" is a scene of the alert arriving and the recovery after it. "One call from any language" is that
call, in tabs. "Runs your browser checks every 15 minutes" is the run animating step by step. Draw product
UI inline with the product's own labels and believable data; a text-only band is a band you have not
finished designing.

### Pick the device that proves the claim (CRITICAL) — @rules/choose-the-visual-device.md

A process animates (`FlowDiagram`), an integration shows code in the reader's languages (`CodeStage` tabs),
a product with several faces switches between them (`SegmentedStage`), breadth is a bento of small moments,
a sequence is a timeline beside the screen it produces, scale is four big figures, a physical thing is the
object itself. Never use the same device twice in a row.

### Commit to one art direction (HIGH) — @rules/art-direction.md

Decide the page's personality before building — technical and precise, editorial and quiet, consumer and
warm — and let it decide type, corners, colour, framing and motion everywhere, through tokens set once.
Borrow a brand's real colours from its live site.

### Compose with scale, cropping and pacing (HIGH) — @rules/composition-and-pacing.md

Huge display type against small mono labels. One focal point per band. Splits that lean toward the visual.
Product UI cropped and faded so it suggests more than the frame holds, bleeding off the edge when it is the
star. Dense bands followed by airy ones, devices alternating down the page.

### Specific copy (HIGH) — @rules/copy-with-taste.md

Titles are outcomes, leads say how, card titles are claims rather than nouns, numbers are real, adjectives
are cut. Write the story — promise, proofs, action, objections — before any markup.

### Honest proof (CRITICAL) — @rules/honest-proof.md

Never invent logos, customers, quotes, ratings or metrics for a real product. Figures come from code or
config. No proof means no proof section, which is better than a fake one.

### Restraint and finish (HIGH) — @rules/restraint-and-finish.md

One flourish of each kind, motion only where it explains, colour that means something. Then the details
that make a page feel expensive: tabular figures, aligned columns, nested radii, hairlines, no orphan cells,
one CTA shape, nothing moving on hover, one `h1`.

## Workflow

1. **Study** two references side by side and note the moments you want to match.
2. **Write the story** and pick the section order for the page kind: @rules/story-and-section-order.md.
3. **Plan the visuals** as a table, one row per band: claim → device → the exact moment it shows. Check no
   device repeats in adjacent bands and the hero's visual appears nowhere else.
4. **Set the art direction** in tokens, then build the bands.
5. **Draw the product**: mockups and scenes with realistic sample data shared across the page.
6. **Review like the user would**: six widths, both themes, side by side with the reference, then turn each
   fix into a test: @rules/verify-like-a-reviewer.md. @rules/gotchas.md lists what breaks silently.

## The bar

Put your page beside sdxc.dev/demo/saas. Every band shows the product doing something. Nothing is
invented. Nothing reads as a template: you could not swap the product name and reuse the page. The page
has a personality you can name in two words. And a reviewer finds no orphan cell, no overflow at 320px, no
truncated label, no misaligned button, no hover that shifts anything, no raw translation key, and a dark
mode that looks designed.
