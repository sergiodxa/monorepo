# blog

Remix v3 SSR blog for `sergiodxa.com`, rendered with `remix/ui/server` and
served from a Cloudflare Worker.

Production URL: https://sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development.
2. Run `bun run db:local:migrate` to prepare the local D1 database.
3. Run `bun run dev` to start the development server at http://localhost:3000.

## Cloudflare Services

| Service     | Binding                                               | Purpose                                     |
| ----------- | ----------------------------------------------------- | ------------------------------------------- |
| D1 Database | `DB`                                                  | Blog content and CMS data                   |
| KV          | `CACHE`                                               | Response and data caching                   |
| KV          | `AUTH`                                                | Authentication/session state                |
| KV          | `REDIRECTS`                                           | URL redirect mappings                       |
| R2          | `BACKUPS`                                             | Database backup storage                     |
| Queue       | `QUEUE` (`blog-jobs`)                                 | Background jobs (Webmention receive/send)   |
| Rate limit  | `WEBMENTION_RATE_LIMITER`                             | Webmention endpoint budget                  |
| Rate limit  | `SUPPORT_RATE_LIMITER`                                | Encore support form budget per address      |
| Email       | `EMAIL` (`send_email`)                                | Delivers Encore support requests            |
| Secret      | `SUPPORT_INBOX`                                       | Inbox Encore support requests go to         |
| Secrets     | `CLIENT_ID`, `CLIENT_SECRET`, `COOKIE_SESSION_SECRET` | OIDC and session secrets from Secrets Store |
| Assets      | N/A                                                   | Static assets served from `build/client`    |

Smart Placement and Observability are enabled.

## Features

- Server-rendered public articles, tutorials, bookmarks, feeds, and sitemap.
- CMS layout and authenticated routes for content management.
- Markdown processing through shared markdown utilities.
- Request-scoped services published onto the request context by middleware.
- Microformats2 markup (`h-entry`, `h-card`, `h-feed`, `rel="me"`) on public pages.
- Webmention receiving: `POST /webmention` queues verification, verified mentions wait in
  the CMS moderation queue (`/cms/webmentions`), and approved ones render under the post.
  Deleted posts answer 410 Gone.
- Webmention sending: creating, updating or deleting an article or tutorial notifies every
  page it links to (and every page it stopped linking to); a cron every 15 minutes sends
  for posts whose scheduled publish date has arrived.
- Encore support page (`/apps/encore/support`), the Support URL of the Encore App Store
  listings: a public form that mails each request to `SUPPORT_INBOX` from
  `encore@support.sergiodxa.com` with the visitor as Reply-To, behind same-origin checks,
  signed honeypot fields, and a per-address rate limit. An unset inbox makes the form report a failure.

## Routes

| Route                  | Description                                |
| ---------------------- | ------------------------------------------ |
| `/`                    | Homepage                                   |
| `/articles`            | Articles listing                           |
| `/articles/:slug`      | Article detail page                        |
| `/tutorials`           | Tutorials listing                          |
| `/tutorials/:slug`     | Tutorial detail page                       |
| `/bookmarks`           | Saved bookmarks                            |
| `/rss`                 | Main RSS feed                              |
| `/articles.rss`        | Articles RSS feed                          |
| `/tutorials.rss`       | Tutorials RSS feed                         |
| `/bookmarks.rss`       | Bookmarks RSS feed                         |
| `/sitemap.xml`         | Sitemap for search engines                 |
| `/webmention`          | Webmention endpoint (POST)                 |
| `/apps/encore/support` | Encore support page and form               |
| `/apps/encore/privacy` | Encore privacy policy (`.md` for Markdown) |

## Database

Migrations live in `database/migrations/`.

```bash
bun run db:local:migrate  # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
```

## Scripts

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `dev`               | Start the development server      |
| `build`             | Build for production              |
| `start`             | Preview the production build      |
| `cf:deploy`         | Deploy to Cloudflare Workers      |
| `cf:typegen`        | Generate Cloudflare binding types |
| `db:local:migrate`  | Apply local migrations            |
| `db:remote:migrate` | Apply remote migrations           |
| `typecheck`         | Type-check                        |

## Deployment

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required local variables and production secrets.
