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
state the app has lives in Buttondown and Polar.

## Features

- **Email capture** on the homepage, with UTM attribution carried through from the query
  string and stored on the Buttondown subscriber.
- **Live pricing** on the release page, read from Polar products with the currently
  applicable launch discount applied.
- **Gated sample chapter**: an address unlocks the chapter, rendered from Markdown at
  request time and deliberately not persisted across reloads.
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
| `/upgrade`            | GET     | The upgrade email form                                      |
| `/upgrade`            | POST    | Resolves the customer and redirects to the upgrade checkout |
| `/api/subscribe`      | POST    | Subscribes a visitor and redirects to `/release`            |
| `/api/checkout/:type` | GET     | Starts a Polar checkout and redirects to it                 |
| `/webhooks/polar`     | POST    | Verifies and handles `order.paid`                           |
| `/healthcheck`        | GET     | Plain-text `OK`                                             |

## Scripts

| Script              | Purpose                                |
| ------------------- | -------------------------------------- |
| `bun run dev`       | Start the dev server on port 3003      |
| `bun run build`     | Build the worker and client assets     |
| `bun run start`     | Preview the production build           |
| `bun run typecheck` | Type-check the app                     |
| `bun cf:typegen`    | Regenerate `worker-configuration.d.ts` |
| `bun cf:deploy`     | Deploy the worker                      |

## Deployment

Run `bun run build` first — `wrangler deploy` does not build the Vite app — then
`bun cf:deploy`. Secrets are set with `bunx wrangler secret put <NAME>`.

## Environment Variables

See `.env.example`.
