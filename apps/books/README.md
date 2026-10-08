# r3-books

Landing page and sales funnel for the _React Router OAuth2 Handbook_: email capture, a
live-priced release page, a gated sample chapter, an upgrade path, and purchase tagging.

Production URL: https://books.sergiodxa.com (served by the `books` worker until cutover;
this worker is reachable on its `workers.dev` subdomain in the meantime)

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3003

## Cloudflare Services

None. The worker has no D1, KV, R2, queue, cron, or Durable Object binding — the only
state the app has lives in Buttondown and Polar, plus a signed `attribution` cookie in the
visitor's browser.

## Features

- **Email capture** on the homepage and sample-chapter forms, credited to the campaign the
  visitor arrived from and stored on the newsletter subscriber (Buttondown).
- **Campaign attribution**: a signed `attribution` cookie, signed with `COOKIE_SECRET`, keeps
  the first and latest campaign a visitor arrived from for 90 days, so a visitor who browses
  before subscribing or buying is still credited. Polar checkouts carry both touches as
  `first_*`/`last_*` metadata. A visitor sending Global Privacy Control is not tracked.
- **Address screening** on the homepage and sample-chapter forms: addresses on throwaway-inbox
  domains are refused, and a mistyped provider (`gnail.com`) gets a "did you mean" prompt
  that submitting the same address again dismisses.
- **Live pricing** on the release page, read from Polar products with the currently
  applicable launch discount applied.
- **Gated sample chapter**: an address unlocks the chapter, rendered from Markdown at
  request time and deliberately not persisted across reloads.
- **Sample chapter as an EPUB**: the unlocked page links the same chapter as an ebook for
  Kindle, Kobo, Apple Books and other readers. The link is signed with `SAMPLE_LINK_SECRET`
  and expires after an hour, so the file stays behind the email gate without a session.
- **Upgrade path** from the Essentials package to the Complete package, priced with a
  fixed upgrade discount for customers who already own Essentials.
- **Purchase tagging**: a paid Polar order tags the customer in Buttondown with their
  tier, which is what drives newsletter segmentation.
- **Zero first-party JavaScript.** Every page is server-rendered HTML; forms use native
  constraint validation and full-document POSTs.

## Integrations

| Service             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| Buttondown          | Newsletter subscribers and purchase-tier metadata        |
| Polar               | Products, prices, discounts, checkouts, orders, webhooks |
| ParityDeals         | Purchasing-power-parity banner on the release page       |
| Cloudflare Insights | Page analytics beacon                                    |

## Routes

| Route                 | Methods | Purpose                                                     |
| --------------------- | ------- | ----------------------------------------------------------- |
| `/`                   | GET     | Landing page with the early-access subscribe form           |
| `/release`            | GET     | Sales page with live prices, packages, FAQ                  |
| `/sample`             | GET     | The sample-chapter email form                               |
| `/sample`             | POST    | Subscribes, then renders the sample chapter                 |
| `/sample/download`    | GET     | The chapter's EPUB for a signed link; `/sample` otherwise   |
| `/upgrade`            | GET     | The upgrade email form                                      |
| `/upgrade`            | POST    | Resolves the customer and redirects to the upgrade checkout |
| `/api/subscribe`      | POST    | Subscribes a visitor and redirects to `/release`            |
| `/api/checkout/:type` | GET     | Starts a Polar checkout and redirects to it; 404s otherwise |
| `/webhooks/polar`     | POST    | Verifies and handles `order.paid`                           |
| `/healthcheck`        | GET     | Plain-text `OK`                                             |

## Scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `bun run dev`       | Start the dev server on port 3003         |
| `bun run build`     | Build the worker and client assets        |
| `bun run start`     | Preview the production build              |
| `bun run typecheck` | Type-check the app                        |
| `bun cf:typegen`    | Regenerate `.cloudflare/types/index.d.ts` |
| `bun cf:deploy`     | Deploy the worker                         |

## Deployment

The worker is configured in `cloudflare.config.ts` and deployed with the `cf` CLI.
Run `bun run build`, then `bun cf:deploy`, which uploads that build output as-is.
Secrets are set with `cf workers secrets update`.

## Environment Variables

See `.env.example`.
