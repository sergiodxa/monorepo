---
title: books
headline: Selling a technical book from a Worker with no storage, no session and no first-party JavaScript
summary: The storefront for the React Router OAuth2 Handbook, with live Polar pricing, a gated sample chapter, campaign attribution and no first-party JavaScript.
cover: landing
shots:
  - id: landing
    page: "https://books.sergiodxa.com/react-router-oauth2"
    alt: The React Router OAuth2 Handbook landing page, with the book's cover, its pitch and the calls to buy or read the free chapter.
  - id: flow
    page: "https://books.sergiodxa.com/react-router-oauth2"
    highlight: "[aria-label='One sign-in with the Authorization Code flow and PKCE']"
    alt: A sequence diagram of one sign-in with the Authorization Code flow and PKCE, between the browser, the app and the authorization server.
  - id: contents
    page: "https://books.sergiodxa.com/react-router-oauth2"
    highlight: "[data-slot='curriculum']"
    alt: The book's contents as expandable chapters and appendices, the first chapter marked free.
  - id: pricing
    page: "https://books.sergiodxa.com/react-router-oauth2"
    highlight: "section#pricing"
    alt: The pricing section with the book package and the Complete Package, each with its price and what it includes.
  - id: sample
    page: "https://books.sergiodxa.com/react-router-oauth2"
    highlight: "section#sample"
    alt: The free chapter section, an email field beside the first page of the chapter.
  - id: subscribe
    page: "https://books.sergiodxa.com/"
    highlight: "section#subscribe"
    alt: The home page's newsletter sign-up, an email field beside the book's cover.
  - id: upgrade
    page: "https://books.sergiodxa.com/react-router-oauth2/upgrade"
    highlight: "section#upgrade"
    alt: The upgrade page, asking for the buyer's email and listing what the Complete Package adds.
  - id: phone
    page: "https://books.sergiodxa.com/react-router-oauth2"
    viewport: phone
    alt: The handbook landing page on a phone, the cover and calls to action stacked in one column.
---

books sells the _React Router OAuth2 Handbook_ at [books.sergiodxa.com](https://books.sergiodxa.com): a newsletter sign-up on the home page, a landing page for the book with live prices and packages, a free first chapter behind an email address, an upgrade path from the book alone to the Complete Package, and tagging of each buyer in the newsletter by what they bought.

The Worker binds no storage at all. Its only state lives in Buttondown, in Polar and in a signed cookie in the visitor's browser, and every page is server-rendered HTML with native form validation and full-document posts. That restraint is the reason to read it. Billing through [@sdxc/billing](/api/billing), a newsletter list through [@sdxc/newsletter](/api/newsletter) and campaign attribution through [@sdxc/attribution](/api/attribution) are each wired once in an initializer, and the rest of the app is a handful of controllers that read them.

## The brief

A storefront for a book has to do a few things well and nothing else. Prices must be right, including whichever launch discount applies today. A visitor who arrives from a newsletter, browses, leaves and comes back a week later should still be credited to the campaign that brought them. The free chapter should be behind an email address without a login, and the ebook file behind the same gate. An existing buyer should be able to upgrade and pay only the difference. Every sale should tag the buyer in the newsletter so later emails go to the right people. And the pages should load fast and work on any device, because a technical book's buyers read on phones as often as on laptops.

books takes all of that on with configuration in `config/books.ts`, copy in `resources/content/books/`, and a router whose middleware does the cross-cutting work: request logging and tracing, campaign attribution, form data, cross-origin protection, billing, the newsletter list, security headers, document assets and rendering.

## A page per book from a record

`config/books.ts` keys every book by the slug its pages live under, and the landing, sample and upgrade routes serve any slug listed there; an unknown slug answers 404. A second book is a second record and its copy. The landing in `app/http/controllers/book.tsx` is built from the `@sdxc/ui` landing kit: [LandingHero](/api/ui/landing-hero) with the book's cover, a feature band of what is inside, a [SequenceDiagram](/api/ui/sequence-diagram) of the sign-in the book teaches, a [Curriculum](/api/ui/curriculum) of chapters, a [PricingBand](/api/ui/pricing-band), an [AuthorBand](/api/ui/author-band) and a [FaqBand](/api/ui/faq-band).

The diagram is the book's argument in one picture: one sign-in with the Authorization Code flow and PKCE, stepping between the browser, the app and the authorization server, with the code from the chapter beside it. It plays as an animation with a pause control.

![A sequence diagram of one sign-in](/showcase/books/flow.webp "The landing shows the flow the book teaches, step by step, with a pause control.")

The contents are three chapters and seven appendices as expandable rows, each with what it covers, and the first chapter's lessons marked free. A reader can see exactly what they are buying before they buy it.

![The book's contents](/showcase/books/contents.webp "Chapters open to show what they cover, the free chapter marked as such.")

## Prices read live, with the right discount

The landing reads each package's price from Polar in parallel with the discount that applies right now, and formats them as currency. `app/services/discount.ts` reads the organization's campaigns and keeps the one that fits: on the allow-list, inside its date window, under its redemption limit and scoped to the product. A purchasing-power-parity banner loads only where the controller decides it should.

![The pricing section](/showcase/books/pricing.webp "Packages priced from Polar on every request, with any current discount applied.")

`/api/checkout/:type` starts a Polar checkout and redirects to it. The upgrade page asks for the buyer's email, resolves the customer, and redirects to a checkout priced with the fixed upgrade discount for someone who already owns the book.

![The upgrade page](/showcase/books/upgrade.webp "An existing buyer upgrades by email and pays only the difference.")

A verified `order.paid` webhook from Polar tags the customer in Buttondown with their tier, which is what segments the newsletter.

## Attribution without a session

`app/initializers/cookies.ts` defines a signed `attribution` cookie that keeps the first and the latest campaign a visitor arrived from, for 90 days. Because it is signed with `COOKIE_SECRET`, the campaign a sale is credited to comes from this app. Subscriptions record the campaign on the newsletter subscriber, and Polar checkouts carry both touches as `first_*` and `last_*` metadata. A visitor whose browser sends Global Privacy Control is left untracked.

The home page's sign-up and the sample form both screen the address. `app/http/validators/subscribe.ts` parses it through [@sdxc/email-address](/api/email-address), refuses throwaway-inbox domains outright, and answers a mistyped provider, such as `gnail.com`, with a "did you mean" prompt that submitting the same address again dismisses.

![The newsletter sign-up](/showcase/books/subscribe.webp "The home page is one sign-up, credited to the campaign the visitor came from.")

## A free chapter behind one field

The sample section on the landing asks for an email address and nothing else. Submitting subscribes the reader and renders the chapter right there. The chapter is bundled Markdown, read once per isolate by `app/services/sample-chapter.ts` and turned into two forms: the page the unlocked view renders, through [@sdxc/markdown](/api/markdown) with code highlighted by [@sdxc/highlight](/api/highlight), and an EPUB through [@sdxc/epub](/api/epub) for Kindle, Kobo, Apple Books and other readers. The unlocked page is deliberately not kept across reloads.

![The free chapter section](/showcase/books/sample.webp "One email field unlocks the chapter on the same page, with an EPUB to take away.")

The EPUB link has to stay behind the gate with no session to check. `app/services/sample-link.ts` mints it only on the unlocked page, with its own expiry an hour out and an HMAC over that expiry, so `/sample/download` can verify the link alone and answer with the file, or with the sample form when the link is missing, expired or forged.

## Vendors named in one place

Polar is named only in `app/initializers/billing.ts`, which maps each package slug onto the live product it bills, and Buttondown only in `app/initializers/newsletter.ts`. Routes reach them as `ctx.billing` and `ctx.newsletter`, so a test installs its own. `/health` reports on both and answers 503 when either is down. Legacy addresses (`/release`, `/sample`, `/upgrade`) answer 308 to the same page under the book's slug, keeping the query string, so old campaign links still credit correctly.

The pages carry no first-party JavaScript. The only scripts are the purchasing-power-parity banner and Cloudflare's analytics beacon. On a phone the landing stacks the cover, the pitch and the calls to action in one column, and the section menu folds behind a button.

![The landing on a phone](/showcase/books/phone.webp "On a phone the landing stacks into one column, with the section menu behind a button.")

## Where to start reading

- [`app/initializers/router.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/books/app/initializers/router.tsx) — the middleware stack, from attribution to billing, newsletter and rendering.
- [`app/http/controllers/book.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/books/app/http/controllers/book.tsx) — a landing priced live, with an unknown slug answering 404.
- [`app/services/discount.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/books/app/services/discount.ts) — which campaign applies right now.
- [`app/services/sample-link.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/books/app/services/sample-link.ts) — a signed, expiring link standing in for a session.
