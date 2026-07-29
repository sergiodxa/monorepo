# Blog App

Personal blog and content management system with support for articles, tutorials, glossary entries, and bookmarks.

Retired: this app no longer serves `sergiodxa.com` and is kept for reference
only. Its Worker is named `blog-legacy` so deploying it cannot take the
production domain back.

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3000

## Cloudflare Services

| Service     | Binding     | Purpose                                                    |
| ----------- | ----------- | ---------------------------------------------------------- |
| D1 Database | `DB`        | Content storage (articles, tutorials, glossary, bookmarks) |
| KV          | `CACHE`     | Response caching for improved performance                  |
| KV          | `AUTH`      | Authentication session storage                             |
| KV          | `REDIRECTS` | URL redirect mappings for legacy URLs                      |
| R2          | `BACKUPS`   | Database backup storage                                    |

Smart Placement and Observability are enabled.

## Features

- Content types: Articles, Tutorials, Glossary, Bookmarks
- Built-in CMS at `/cms/*` routes
- Full-text search with Fuse.js
- Markdoc for content rendering with Prism syntax highlighting
- GitHub Sponsors integration via GitHub App
- i18n support with remix-i18next

## Routes

### Public

| Route        | Description           |
| ------------ | --------------------- |
| `/`          | Homepage              |
| `/articles`  | Articles listing      |
| `/tutorials` | Tutorials listing     |
| `/glossary`  | Glossary terms        |
| `/bookmarks` | Saved bookmarks       |
| `/write`     | Quick write interface |

### Authentication

| Route          | Description                               |
| -------------- | ----------------------------------------- |
| `/auth/login`  | Login                                     |
| `/auth/logout` | Logout                                    |
| `/cms/*`       | Content management system (authenticated) |

### Feeds

| Route            | Description                |
| ---------------- | -------------------------- |
| `/rss`           | Main RSS feed              |
| `/articles.rss`  | Articles RSS feed          |
| `/tutorials.rss` | Tutorials RSS feed         |
| `/bookmarks.rss` | Bookmarks RSS feed         |
| `/atom.xml`      | Atom feed                  |
| `/sitemap.xml`   | Sitemap for search engines |

## Database

Migrations are located in `db/migrations/`.

```bash
bun run db:local:migrate   # Apply migrations locally
bun run db:remote:migrate  # Apply migrations to production
```

## Scripts

| Script              | Description                 |
| ------------------- | --------------------------- |
| `dev`               | Start development server    |
| `build`             | Build for production        |
| `start`             | Preview production build    |
| `cf:deploy`         | Deploy to Cloudflare        |
| `cf:typegen`        | Generate Cloudflare types   |
| `rr:routes`         | List React Router routes    |
| `rr:typegen`        | Generate React Router types |
| `typecheck`         | TypeScript type checking    |
| `db:local:migrate`  | Apply local migrations      |
| `db:remote:migrate` | Apply remote migrations     |

## Deployment

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required environment variables.
