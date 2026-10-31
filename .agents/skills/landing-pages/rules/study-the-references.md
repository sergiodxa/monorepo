---
title: Study the References
impact: HIGH
tags: [taste, references, examples, review]
---

# Study the References

The pages below were reviewed band by band until they held up next to commercial landings. Each entry
says what the band does, why it works, and the file that implements it, so you can open the code behind a
moment you want to match. The weak spots are real too: they are what a review still finds on these pages,
and the cheapest way to learn what to avoid.

Open the live page beside the file. Look at 1440 and 375, in light and dark.

## Why

- **Taste transfers through examples.** "Show the product" is easy to agree with and hard to do; seeing
  that Keel shows "Tax in 60 countries" as a grid of jurisdiction chips makes the move repeatable.
- **The same system made both the strong and the weak bands.** Every page here uses the same components
  and tokens. What separates the good bands from the flat ones is the choice of moment, copy and device,
  which is exactly what this skill teaches.

## sdxc.dev/demo/saas — Keel, the bar

`apps/sdxc-site/resources/views/demos/saas/`

- **The hero is the product, three ways.** A `SegmentedStage` switches between the revenue board, the
  meters and the API call, inside a `ProductFrame` with a sidebar, three stat cards, a stacked bar chart and
  an invoice table (`revenue-board.tsx`, `product-panels.tsx`). It is the tallest thing on the page, and
  it looks like an account mid-month: "$482,190, +8.2% vs Sep". A reader understands the product before
  reading a feature.
- **A small sign of life under the CTAs.** The release pin, `v4.2 · Spend alerts, Oct 28`, says the
  product ships, in one mono line.
- **Chapters numbered like a spec.** `01 / Metering` … `07 / FAQ` in mono, a short sans title ("Send
  events, Keel does the math"), a lead with one bold phrase, three guarantees as checks, and the one API
  call in `node.ts` / `worker.py` / `curl.sh` tabs (`sections.tsx`). The numbering turns a long page into a
  document you can navigate.
- **The bento is six moments, not six icons** (`bento-media.tsx`). "Tax in 60 countries" is a grid of
  jurisdiction chips with rates (`TaxScene`). "Prices in 135 currencies" is one price in four currencies
  (`CurrencyScene`). Webhooks are a delivery log with status and latency (`WebhookScene`). Each scene is
  the claim made visible.
- **Proof right after the hero.** A ruled logo grid ("Billing for API-first companies like"), then the
  first chapter, then four display figures. Allowed here because Keel and its customers are invented and
  the page is `noindex`.

Weak spots:

- **At 375 the bento cells lose their scenes.** Bento and card media are hidden below the `md` container,
  so the phone reader gets six text cards. The hero and the chapter code carry the phone story.
- **The metering split is unbalanced at 1280**: ten lines of code beside a header, a lead and three checks
  leave the code stage ending above the copy.

## uptime.sergiodxa.com — a real product

`apps/uptime`

- **Mockups drawn from the product's own parts** (`resources/components/marketing/product-mockups/`).
  The home hero is the dashboard: the app's icon rail, "Uptime percentage 99.97%", and four `example.com`
  hosts with the real `Sparkline` and `Badge`, one of them `Degraded` at 642 ms. One amber row makes the
  table look like a real Tuesday instead of a brochure.
- **One world per page.** `sample-data.ts` feeds the hero and every card scene, so the same hosts recur.
- **The flow diagram runs the product's own language.** On the home and `/browser-flows`, `FlowDiagram`
  plays "The schedule starts a run · As often as every 15 minutes", then each step with its real DSL line
  (`browser.click button "Sign in"`), and settles on "Run passed" with "A failed step alerts your team"
  beneath (`resources/components/marketing/flow-diagram.tsx`).
- **`/browser-flows` has the best copy on the site** (`resources/content/browser-flows.ts`). The lead opens
  on the problem: "A 200 on the homepage still hides a broken login." Every band title is a claim: "Three
  click-throughs teams run on a schedule", "HTTP can only see the request", "Priced per run, not per
  click", "From a verified domain to a named failure", and the close, "Catch the break your visitors would
  hit".
- **`/features/ssl` has a hero that proves its title**: a monitor page with the SSL panel ("54 days, Let's
  Encrypt") and DNS records, one marked `Changed`.
- **`/vs/*` is honest.** A plain table, Uptime's column in brand ink, and a "When UptimeRobot might be
  better" band (`app/http/controllers/marketing-comparison.tsx`).

Weak spots, each a lesson:

- **Generic shared titles.** All thirteen feature pages read "Deep Dive / Everything you need" and "Get
  started / How it works", because the template takes them from one shared key
  (`landing.marketingPage.everythingTitle`). Compare `/browser-flows`, where every title is written for
  its page.
- **Cards with nothing to show.** `/features/ssl`'s "Everything you need" is four icon cards with one
  sentence each, mostly empty space. Facts without pictures belong in an uncarded list.
- **A companion visual that proves nothing.** `/features/ssl`'s "How it works" sits beside the generic
  monitor screen (uptime bars, latency chart), chosen in `featureCompanion()` in
  `app/http/controllers/marketing-feature.tsx`. Nothing in it is about certificates.
- **The home headline is generic**: "Monitor your services with confidence", then "Powerful monitoring
  made simple" and "Everything you need for reliable monitoring". Swap the product name and any monitoring
  tool could use them.
- **An eyebrow that repeats the `h1`.** `/vs/uptimerobot` reads "Uptime vs UptimeRobot" twice in a row.
- **Title Case left in places**: "Start Monitoring", "Complete Feature Set", "Pricing Calculator".

## sdxc.dev/demo/book — editorial

`apps/sdxc-site/resources/views/demos/book/`

- **The sample page demonstrates the subject.** The book is about the measure, so its sample page
  (`sample-page.tsx`) sets chapter 2 with a drop cap and a ruled "34 ch" dimension line over the paragraph.
  The visual teaches the book's idea while showing the book.
- **Contents you can scan like a real book**: parts, chapter numbers, page numbers in the margin, and a
  "Free" mark on chapter 2 (`contents.tsx`).
- **Every band is plain paper.** No tinted alternation; hairlines, whitespace and the serif carry the
  rhythm. Restraint is the direction.
- **Eyebrows locate, titles claim**: "Contents / Three parts, fourteen chapters", "Reader reviews /
  Readers who now notice everything", "The last page / Your next paragraph could read better".

## sdxc.dev/demo/app — consumer

`apps/sdxc-site/resources/views/demos/app/`

- **Colour-block bento of daily life** (`bento-scenes.tsx`): "Offline · 2 to sync" on a list in the
  basement (`OfflineScene`); a barcode in the viewfinder and "Rolled oats, 1 kg · Added to Groceries"
  under it (`ScanScene`); a waveform of "oat milk and two lemons" above the two rows it became
  (`VoiceScene`); "You're passing Fresh Corner" (`PlaceScene`). Each cell is a cause and its effect.
- **Titles that sound like a person**: "Fewer messages about milk", "Built for the aisle, not the desk",
  "What happens at home stays there".

## sdxc.dev — developer tool

`apps/sdxc-site/resources/content/home.md`, `apps/sdxc-site/resources/components/runtime-showcase.tsx`

- **One handler, four runtimes.** The hero's code tabs are `Workers / Bun / Deno / Node`, and only the
  lines that hand the handler to the runtime change between tabs. The claim "runs unchanged" is the diff
  you see when you switch.
- **Counted figures.** 141 packages and the rest come from the registry at render time.
- **A thesis band**: "Everything between the Request and the Response." states what the project believes
  in one line between dense bands.

Weak spot: the `h1` is the product name, "sdxc". The lead does the promising; on a product without a known
name, put the promise in the `h1`.

## Rules

1. Open the reference and its file before designing a band you have not built before.
2. Copy the move, not the content: the idea of a jurisdiction-chip grid, not Keel's chips.
3. Treat the weak spots as a checklist for your own page.
