---
title: Rooftree
headline: A consumer app page whose phones are live markup, one household's day told across every screen
summary: A landing for an invented household list app, with three fanned phones of live markup, a tour of four screens and six small app scenes.
tagline: A household list app in fanned phones
cover: hero
shots:
  - id: hero
    page: ""
    alt: The Rooftree landing, a centered headline over store badges and a rating, three fanned phones on a sunny yellow block below.
  - id: phones
    page: ""
    highlight: "[data-slot=landing-hero-media]"
    alt: Three phones fanned on a yellow block, the chore rota, tonight at home with dinner and groceries, and the week's meals, with notifications for ticked-off oat milk and a recycling handover beside them.
  - id: tour
    page: ""
    highlight: "#features [data-slot=tabbed-stage]"
    alt: The tour, four steps in a rail beside a phone showing the shared Groceries list with Jonah shopping at Corner Market and items ticked by aisle.
  - id: small-things
    page: ""
    highlight: "#small-things [data-slot=bento-cell]"
    alt: A lavender bento cell titled Works without signal, led by a small grocery list marked Offline with two items to sync.
  - id: stories
    page: ""
    highlight: "[data-slot=testimonial-quotes]"
    alt: A row of household story cards, each a short quote with initials, a name and a line about the household, the next card peeking at the edge.
  - id: pricing
    page: ""
    highlight: "#pricing [data-slot=pricing-plans]"
    alt: Two plans, Free at $0 forever and Plus at $4 a month billed yearly on a deep grape card marked Most households.
  - id: phone
    page: ""
    viewport: phone
    alt: The Rooftree hero on a phone, the headline, store badges and rating above the fanned phones.
---

Rooftree is an invented app that keeps a household's groceries, chores, calendar and meals on one encrypted list, synced across iPhone, Android, Mac and Windows. The app does not exist. The page is a downloadable-app landing built from [@sdxc/ui](/api/ui) landing patterns, [@sdxc/u](/api/u) and [@sdxc/icons](/api/icons).

It is the demo to read for a warm consumer product page, and for product screenshots that are not screenshots. Every phone on the page is HTML and CSS, rendered on the server in the page's own type and colours, and one household (Maya, Jonah, Ari and Leo) runs through all of them, so the tour reads as one day. The art direction is grape and sunshine: a grape-violet brand with a sunny yellow secondary, a heavy rounded display face, 24px cards and 32px bands, soft layered shadows, lavender tinted bands and pill calls to action everywhere.

## The brief

An app landing exists to get a download. It has to show the app on a phone in the first screen, make the features feel like things that happen in a real home, carry the social proof app stores have trained people to expect, and answer the privacy question for an app that holds a family's schedule. Most app pages answer the first need with exported screenshots, which go stale with every release, blur on high-density screens and say nothing to a screen reader.

Rooftree draws its screens as markup. They stay sharp at any density, inherit the theme, translate with the copy and can be read aloud. The rest of the page follows a consumer register: a tour, household stories, small things on colour blocks, privacy, platforms with figures, pricing per household and questions.

## Three phones on a colour block

The hero is centered: the claim, the store badges and a rating, then three phones fanned on a sunny yellow block. The middle phone is "Tonight at home", with dinner, who is cooking and the groceries still to buy; the two behind it are the chore rota and the week's meals. Notifications drift beside them: Jonah ticked off oat milk, Leo passed on the recycling.

![Three phones fanned on a yellow block, the chore rota, tonight at home with dinner and groceries, and the week's meals, with notifications for ticked-off oat milk and a recycling handover beside them](/showcase/rooftree/phones.webp "All three phones are live markup in the page's own type; the notifications drift inside a pausable loop.")

The phone frame lives in `phone.tsx`: a device [ProductFrame](/api/ui/product-frame) with an ink bezel, a status bar, the camera pill and the app's tab bar, plus the small parts the screens are built from (cards, list rows, people). The screens themselves are in `screens.tsx`, each a component the hero, the tour and the bento reuse. The drifting notifications sit inside a [MotionLoop](/api/ui/motion-loop), which adds a pause toggle that freezes every animation inside it, and they move only when the visitor allows motion; under reduced motion they hold their place beside the phones. They appear only from the stage's extra-large container size up, so they never crowd the phones on a narrower screen.

The household initials in the hero rating and on the phones are deep ink on pastel discs, which keeps their contrast above 6:1. The press mastheads close the band, scrolling past in a [LogoCloud](/api/ui/logo-cloud) set to its marquee layout.

## A tour through four screens

The tour is a [TabbedStage](/api/ui/tabbed-stage) of four steps in a rail beside a sticky stage: lists that know who is at the shop, chores that rotate themselves, one calendar with a colour each, and meal plans that fill the list. Each step's stage is the phone on that screen.

![The tour, four steps in a rail beside a phone showing the shared Groceries list with Jonah shopping at Corner Market and items ticked by aisle](/showcase/rooftree/tour.webp "Each tour step swaps the phone's screen; the selection is a radio group, so it switches without script.")

The step labels are radios styled with CSS, and every panel shares one stage cell, so the stage holds its height on every step and switches without JavaScript. Because the screens are live markup, the groceries the hero's phone lists are the same groceries the tour's list ticks off, in the same household.

## The small things, each with a scene

"The small things" is a three-column [Bento](/api/ui/bento) of six pastel colour blocks. Each opens with a small scene of the app: a grocery list ticked off without signal, a barcode landing on the list, an item added by voice, a nudge near the shop, a child's chore list and the evening summary.

![A lavender bento cell titled Works without signal, led by a small grocery list marked Offline with two items to sync](/showcase/rooftree/small-things.webp "Each cell leads with a scene of the app doing one small thing, here ticking items off offline.")

Scenes in a row share one height, so the titles under them line up across the row, and the scenes stay visible on phones inside their cells. `features.browser.test.tsx` holds both: every scene matches its row's height at desktop width, and each stays inside its cell on a phone.

## Stories, privacy and platforms

Household stories open with one featured quote, then continue in a [TestimonialBand](/api/ui/testimonial-band) carousel: a row that scrolls and snaps sideways, the way a store's reviews read, with the next card peeking at the edge.

![A row of household story cards, each a short quote with initials, a name and a line about the household, the next card peeking at the edge](/showcase/rooftree/stories.webp "The stories scroll and snap sideways, with the next card showing at the edge.")

The privacy band is an inset panel in deep grape that explains end-to-end encryption in household terms: lists, rotas and plans are encrypted on the household's devices with a key only the household holds, beside three plain promises (encrypted on every device; no ads, trackers or data brokers; export or delete everything in one tap). The platforms band lists each device with what it is used for, from the lock-screen list on an iPhone to the family PC calendar on Windows, over a display [StatStrip](/api/ui/stat-strip) of the app's figures.

## Priced per household

Pricing is a [PricingBand](/api/ui/pricing-band) of two plans. Free covers a couple or a small flat for good; Plus is priced per household, so a family of six pays the same as a couple, and sits on a deep grape card where other demos would use near-black.

![Two plans, Free at $0 forever and Plus at $4 a month billed yearly on a deep grape card marked Most households](/showcase/rooftree/pricing.webp "Two plans, the household plan inverted in deep grape, both with pill actions.")

The questions are soft cards in a two-column [FaqBand](/api/ui/faq-band), spaced evenly on a phone through the band's gap token, and the closing band repeats the store badges at the calls to action's height and radius, so no two shapes sit side by side. Below-the-fold bands use `content-visibility: auto` with sizes measured at 1440px and 375px, so the browser renders each as it nears the viewport without moving anything as the visitor scrolls.

On a phone, the floating [SiteHeader](/api/ui/site-header) folds its sections into a sheet that closes when a section link is followed, and the hero stacks the claim, the badges and the rating above the phones.

![The Rooftree hero on a phone, the headline, store badges and rating above the fanned phones](/showcase/rooftree/phone.webp "On a phone the badges come first and the fanned phones follow.")

## Takes after

- [Cozi](https://www.cozi.com) — one family organizer for shared lists, chores, a colour-coded calendar and meal plans; Rooftree tells it as one household's day.
- [AnyList](https://www.anylist.com) — a grocery list shared across a household that syncs as someone shops, shown here as "Jonah is shopping".
- [Duolingo](https://www.duolingo.com) — a rounded, playful consumer brand with heavy type and bright colour blocks.
