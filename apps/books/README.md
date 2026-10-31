# r3-books

The books site at books.sergiodxa.com: email capture, and for each book a live-priced landing
under its own slug, a gated sample chapter, an upgrade path, and purchase tagging. It sells
the _React Router OAuth2 Handbook_ at `/react-router-oauth2`.

Production URL: https://books.sergiodxa.com (served by the `books` worker until cutover;
this worker is reachable on its `workers.dev` subdomain in the meantime)

## Start

```sh
bun install
sdxc run typegen
bun dev
```

In a fresh clone, copy `.env.example` to `.dev.vars` first. Run `sdxc run typegen` again
whenever you change a binding or a secret in `cloudflare.config.ts`. The dev server listens
on http://localhost:3003.

## Everyday commands

```sh
sdxc make controller about           # a page, mapped in routes/web.ts
sdxc make service pricing            # business logic, in app/services/
sdxc make command catalog/refresh    # then: sdxc run catalog refresh

sdxc run about                       # the app's name and the versions it runs on
sdxc run typegen                     # the Worker's env types from cloudflare.config.ts
bun check                            # format, lint and types, from the repo root
vp test run --project books          # this app's tests, from the repo root
```

`sdxc make` writes the file where it belongs with a test beside it, and maps it so it works
right away. Where `sdxc` is not on your path, `bun run cli <command>` runs the same commands.

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
- **A page per book**: every book in `config/books.ts` gets its landing, sample chapter and
  upgrade page under its slug, written from its copy in `resources/content/books/`. A second
  book is a new record and its copy, not a new controller.
- **Live pricing** on each book's landing, read from Polar products with the currently
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
| ParityDeals         | Purchasing-power-parity banner on a book's landing       |
| Cloudflare Insights | Page analytics beacon                                    |

## Routes

| Route                 | Methods | Purpose                                                                           |
| --------------------- | ------- | --------------------------------------------------------------------------------- |
| `/`                   | GET     | The newsletter sign-up for the featured book                                      |
| `/:book`              | GET     | A book's landing with live prices, packages, FAQ; 404 for an unknown slug         |
| `/:book/sample`       | GET     | The book's sample-chapter email form                                              |
| `/:book/sample`       | POST    | Subscribes, then renders the sample chapter                                       |
| `/sample/download`    | GET     | The chapter's EPUB for a signed link; the sample form otherwise                   |
| `/:book/upgrade`      | GET     | The book's upgrade email form                                                     |
| `/:book/upgrade`      | POST    | Resolves the customer and redirects to the upgrade checkout                       |
| `/release`            | ANY     | 308 to `/react-router-oauth2`, keeping the query                                  |
| `/sample`, `/upgrade` | ANY     | 308 to the same page under `/react-router-oauth2`, keeping the query              |
| `/api/subscribe`      | POST    | Subscribes a visitor and redirects to the featured book                           |
| `/api/checkout/:type` | GET     | Starts a Polar checkout and redirects to it; 404s otherwise                       |
| `/webhooks/polar`     | POST    | Verifies and handles `order.paid`                                                 |
| `/health`             | GET     | `application/health+json` report on Polar and Buttondown; 503 when either is down |

## Scripts

| Script                       | Purpose                                   |
| ---------------------------- | ----------------------------------------- |
| `bun run dev`                | Start the dev server on port 3003         |
| `bun run build`              | Build the worker and client assets        |
| `bun run start`              | Preview the production build              |
| `bun run typecheck`          | Type-check the app                        |
| `bun run cli <command>`      | Run an app command, as `sdxc run` does    |
| `sdxc run typegen`           | Regenerate `.cloudflare/types/index.d.ts` |
| `sdxc deploy --skip migrate` | Build and deploy the worker               |

## Deployment

The worker is configured in `cloudflare.config.ts` and deployed with the `cf` CLI.
Run `sdxc deploy --skip migrate`: it builds, then uploads that build output with
`sdxc run deploy` (`cf deploy --prebuilt`). The app has no D1 database, so there is no
migration step to run. `sdxc run deploy --dry-run` checks the build without uploading.
Secrets are set with `cf workers secrets update`.

## Environment Variables

See `.env.example`.
