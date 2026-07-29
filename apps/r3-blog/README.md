# r3-blog

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
| Secrets     | `CLIENT_ID`, `CLIENT_SECRET`, `COOKIE_SESSION_SECRET` | OIDC and session secrets from Secrets Store |
| Assets      | N/A                                                   | Static assets served from `build/client`    |

Smart Placement and Observability are enabled.

## Features

- Server-rendered public articles, tutorials, bookmarks, feeds, and sitemap.
- CMS layout and authenticated routes for content management.
- Markdown processing through shared markdown utilities.
- Service resolution through the shared service container.

## Routes

| Route              | Description                |
| ------------------ | -------------------------- |
| `/`                | Homepage                   |
| `/articles`        | Articles listing           |
| `/articles/:slug`  | Article detail page        |
| `/tutorials`       | Tutorials listing          |
| `/tutorials/:slug` | Tutorial detail page       |
| `/bookmarks`       | Saved bookmarks            |
| `/rss`             | Main RSS feed              |
| `/articles.rss`    | Articles RSS feed          |
| `/tutorials.rss`   | Tutorials RSS feed         |
| `/bookmarks.rss`   | Bookmarks RSS feed         |
| `/sitemap.xml`     | Sitemap for search engines |

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
