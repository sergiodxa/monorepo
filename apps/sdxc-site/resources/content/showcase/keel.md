---
title: Keel
headline: A billing product page that shows the product, the API and the invoice, and switches between them with radios
summary: A landing for an invented usage-based billing product, set in a precise technical register of slate, sea green, hairline rails and mono.
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Keel landing, a start-aligned headline over a Revenue, Meters and API switcher and a revenue dashboard in a product frame.
  - id: switcher
    page: ""
    click: "#keel-hero-views-segment-api-label"
    highlight: "[data-slot=segmented-stage] [data-slot=code-stage]"
    alt: The hero switcher on its API tab, a dark numbered code slab titled track-usage.ts sending one usage event.
  - id: metering
    page: ""
    click: "label[for=keel-track-usage-tab-1]"
    highlight: "#product [data-slot=code-stage]"
    alt: The metering code card on its worker.py tab, the same usage event sent from Python beside node.ts and curl.sh tabs.
  - id: workflow
    page: ""
    click: "label[for=workflow-stage-tab-invoice]"
    highlight: "#workflow [data-slot=tabbed-stage]"
    alt: The workflow panel on its Send the invoice step, a paid invoice for Orbitkit Inc. itemising a platform fee, API requests and storage.
  - id: platform
    page: ""
    highlight: "#platform [data-slot=bento-cell]"
    alt: A bento cell titled A portal customers run, led by a small Growth plan card with a usage bar and Change plan and Invoices buttons.
  - id: changelog
    page: ""
    highlight: "[data-slot=changelog-strip]"
    alt: A changelog strip of four dated releases on a timeline, from spend alerts to credit notes over the API.
  - id: pricing
    page: ""
    highlight: "#pricing [data-slot=pricing-plans]"
    alt: Three plans, Starter at $0, Growth at 0.5% of billed revenue on a dark card marked Most popular, and Scale at a custom price.
  - id: phone
    page: ""
    viewport: phone
    alt: The Keel hero on a phone, the headline and calls to action over the product switcher, with the header folded into a menu button.
---

Keel is an invented billing product for API companies: it meters every event a product emits, prices it on any plan and sends the invoice on the first of the month. The product does not exist. The page is a full SaaS landing built only from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) utilities and [@sdxc/icons](/api/icons), under its own palette.

It is the flagship of the landing demos and the one to read for a technical product site. Every product claim on the page is backed by a product screen drawn as live markup or a block of real-looking code, and every interactive part of the page (the hero's view switcher, the code tabs, the workflow steps) is a native radio group styled with CSS. The art direction is slate neutrals with almost no chroma, one sea-green accent, a tightly tracked grotesk, mono uppercase eyebrows numbered 01 to 07, square 6px calls to action and hairline rings where other pages use shadows.

## The brief

A developer-facing SaaS page is read by two people at once: the engineer who will integrate it and the person who will pay for it. The engineer wants to see the API before reading a sentence of copy; the buyer wants to see the dashboard, the invoice and the price. Billing adds its own burden, because the product is mostly invisible: it runs on the first of the month and shows up as a line on someone else's invoice.

Keel answers both readers in the first screen, with a switcher that shows a revenue dashboard, a meters screen and the API call. It then walks through a billing month as four product screens, lists what the platform covers, shows recent releases and ends on pricing. All of it is static HTML and CSS once rendered; the one island on the page closes the phone menu when a link is followed.

## Three views of the product in one hero

The hero is start-aligned: headline, lead, two calls to action and a release note, then a [SegmentedStage](/api/ui/segmented-stage) with three tabs. Revenue shows a dashboard in a [ProductFrame](/api/ui/product-frame), with a rail, three figures and a stacked revenue chart. Meters shows four meters with their event names, aggregations and sparklines. API shows the event call as a numbered slab in [CodeStage](/api/ui/code-stage), highlighted as TypeScript on the server. [Crosshair](/api/ui/crosshair) marks pin the stage's lower corners to the page grid.

![The hero switcher on its API tab, a dark numbered code slab titled track-usage.ts sending one usage event](/showcase/keel/switcher.webp "The API tab is the same call the metering chapter shows, set as a slab under the switcher.")

Selection is a native radio group, so the tabs switch with arrow keys and without JavaScript. Every panel sits in one stage cell, which holds the tallest panel's height, so the page below never jumps when a visitor changes tab. The source reads as the markup it renders:

```tsx
<SegmentedStage name="keel-hero-views" aria-label="Keel product views" align="start">
	<SegmentedStage.Item value="revenue" label="Revenue" defaultChecked>
		<ProductFrame lights title="Revenue" url="app.keel.dev">
```

The hero's entrance plays only for a visitor who allows motion. Everything else in the first screen is still.

## One event, three runtimes

The metering chapter is a [Split](/api/ui/split): copy on one side, and on the other a tabbed `CodeStage` sending the same usage event from a Node request handler, a Python worker and plain HTTP with `curl`. Each tab carries an idempotency key, which is the detail an engineer looks for first in a metering API.

![The metering code card on its worker.py tab, the same usage event sent from Python beside node.ts and curl.sh tabs](/showcase/keel/metering.webp "The tabs switch with CSS alone, and each language is highlighted on the server.")

The three snippets are module constants in `sections.tsx`, passed as tabs with their language, so the highlighter runs during the server render. The tab strip is another radio group; the code stays selectable text in every tab. The chapter, like every chapter after it, sits inside [Rails](/api/ui/rails): hairline rules down both sides of the content measure with "+" marks where they meet, so the stacked chapters read as one continuous engineered column.

## A billing month as four screens

Between the chapters, a near-black inset [FeatureBand](/api/ui/feature-band) in its stage layout walks through a month in a [TabbedStage](/api/ui/tabbed-stage): meter the usage, price it on any plan, send the invoice, collect what is owed. Each step is a label in a rail beside a sticky stage, and each stage is a product screen: the meters list, a Scale plan with its tiers, invoice INV-2026-1047 for Orbitkit Inc., and a payment recovery view.

![The workflow panel on its Send the invoice step, a paid invoice for Orbitkit Inc. itemising a platform fee, API requests and storage](/showcase/keel/workflow.webp "Each workflow step opens a product screen; the invoice itemises the usage the first step metered.")

The screens are drawn in `product-panels.tsx` as ordinary markup in product frames, with tabular figures so the invoice's columns stay aligned row to row. The stage keeps its height on every step without JavaScript, because all four panels share one grid cell. On a phone the rail stacks above the stage.

## The platform, the proof and the changelog

The platform chapter is a three-column [Bento](/api/ui/bento) whose cells each lead with a small product scene from `bento-media.tsx`: the customer portal, tax rates, one price in four currencies, webhook deliveries, and revenue recognised against deferred revenue. Each scene fills the cell's media slot, which fades it into the copy under it.

![A bento cell titled A portal customers run, led by a small Growth plan card with a usage bar and Change plan and Invoices buttons](/showcase/keel/platform.webp "Each bento cell opens on a scene of the product, here the portal a customer manages their plan in.")

Around it, the proof is set in the same ruled register: a [LogoCloud](/api/ui/logo-cloud) in its ruled layout under the hero, a display [StatStrip](/api/ui/stat-strip) of four figures, a security chapter as a three-column list of [Feature](/api/ui/feature)s, and testimonials led by one featured quote in a [TestimonialBand](/api/ui/testimonial-band). The changelog is a [ChangelogStrip](/api/ui/changelog-strip): four dated releases on a timeline, each with a title and one sentence, and a link to all releases.

![A changelog strip of four dated releases on a timeline, from spend alerts to credit notes over the API](/showcase/keel/changelog.webp "Recent releases read as a dated timeline, the same note the hero's release badge points at.")

Every heavy chapter below the fold carries `content-visibility: auto` with an intrinsic size measured at 1440px and 375px, so the browser lays it out and paints it only as it nears the viewport. Anchors still land on their section and find-in-page still reaches every word.

## Pricing and the frame around it

Pricing is a [PricingBand](/api/ui/pricing-band) of three plans: a free Starter plan, a Growth plan priced as a share of billed revenue on a dark card marked "Most popular", and a custom Scale plan. Each plan's actions use the page's default call-to-action size, so no button stands taller than the hero's.

![Three plans, Starter at $0, Growth at 0.5% of billed revenue on a dark card marked Most popular, and Scale at a custom price](/showcase/keel/pricing.webp "Three plans, with the featured one inverted on a dark card.")

A two-column [FaqBand](/api/ui/faq-band) and a near-black closing call follow, inside the shared [SiteHeader](/api/ui/site-header) and [SiteFooter](/api/ui/site-footer). On a phone the header folds its sections into a sheet that closes when an in-page link is followed, and anchors clear the sticky bar.

![The Keel hero on a phone, the headline and calls to action over the product switcher, with the header folded into a menu button](/showcase/keel/phone.webp "On a phone the switcher stays under the headline, and the sections move into the menu.")

## Takes after

- [Stripe Billing](https://stripe.com/billing) — usage-based billing sold through product screens and code in several languages; Keel puts the code in the first screen beside the dashboard.
- [Orb](https://www.withorb.com) — a billing product pitched at API companies, with metering as the opening chapter.
- [Vercel](https://vercel.com) — hairline grid rails with crosshair marks at their corners and a restrained, mono-labelled type system; Keel draws them with Rails and Crosshair from the landing kit.
