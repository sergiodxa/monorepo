# Monorepo

Personal projects ecosystem with applications and shared packages.

## Structure

```
.agents/skills/     # AI agent skills
.vscode/            # VSCode Project Configuration
apps/               # Applications
docs/               # Documentation and ADRs
docs/vendor/        # Documentation of third-party dependencies
packages/           # Shared packages
scripts/            # Global scripts
templates/          # Templates for apps and packages
```

## Tech Stack

- **Runtime**: Cloudflare Workers for deployed web apps; Bun for local tooling and selected apps
- **Framework**: React Router v8 and Remix v3
- **Package manager**: Bun
- **Database**: Cloudflare D1, Durable Object SQLite, Drizzle ORM, and Remix Data Table
- **Styling**: Tailwind CSS v4 and Remix UI

## Getting Started

Prerequisites: [Bun](https://bun.sh)

```bash
bun install              # Install dependencies
cd apps/<name>           # Navigate to an app
bun run dev              # Start development server
```

## Commands

Run from the repository root:

| Command                        | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `bun format`                   | Check formatting                                        |
| `bun format:fix`               | Fix formatting                                          |
| `bun lint`                     | Check linting                                           |
| `bun lint:fix`                 | Fix linting issues                                      |
| `bun typecheck`                | TypeScript type checking                                |
| `bun test --isolate`           | Run all tests (`--isolate` is required — see AGENTS.md) |
| `bun upgrade`                  | Upgrade all workspaces                                  |
| `bun upgrade:dry-run`          | Preview all upgrades                                    |
| `bun upgrade:apps`             | Upgrade app workspaces                                  |
| `bun upgrade:apps:dry-run`     | Preview app upgrades                                    |
| `bun upgrade:packages`         | Upgrade package workspaces                              |
| `bun upgrade:packages:dry-run` | Preview package upgrades                                |

## Workspace Imports

- `@pkg/*` - Package imports (e.g., `import { success } from "@pkg/result"`)
- `~/` - App-relative imports (e.g., `import { Button } from "~/components/button"`)

## Documentation

- `docs/` - Technical documentation and Architecture Decision Records (ADRs)
- `docs/adr/` - Global and app-specific ADRs
- `docs/adr/<app>/` - App-specific ADRs (e.g., `docs/adr/uptime/ADR-001-analytics-engine-migration.md`)
- `docs/guides/package-documentation.md` - Guidelines for writing package READMEs
- `docs/guides/app-documentation.md` - Guidelines for writing app READMEs
- Apps may also have user-facing documentation in `apps/<name>/docs/`

## Apps

| App                           | Description                                   | URL                                                 |
| ----------------------------- | --------------------------------------------- | --------------------------------------------------- |
| [auth-saas](apps/auth-saas)   | Multi-tenant OIDC/OAuth2 identity platform    | Not deployed                                        |
| [blog](apps/blog)             | Remix v3 SSR blog and CMS                     | https://sergiodxa.com                               |
| [blog-saas](apps/blog-saas)   | Multi-tenant blog platform                    | Not deployed                                        |
| [books](apps/books)           | Remix v3 book landing page and sales funnel   | https://books.sergiodxa.com                         |
| [pkmn](apps/pkmn)             | Monster-collecting game engine and browser UI | Local app                                           |
| [r3-auth](apps/r3-auth)       | OAuth 2.0 / OIDC authorization server         | https://auth.sergiodxa.com                          |
| [r3-gallery](apps/r3-gallery) | Client-only Remix UI photo gallery SPA        | https://r3-gallery.sergiodxa-cloudflare.workers.dev |
| [uptime](apps/uptime)         | Uptime and infrastructure monitoring service  | https://uptime.sergiodxa.com                        |

## Packages

| Package                                                 | Description                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| [arrays](packages/arrays)                               | Array utility functions                                       |
| [auth-sdk](packages/auth-sdk)                           | OAuth 2.0 client SDK for auth.sergiodxa.com                   |
| [blog-engine](packages/blog-engine)                     | Host-agnostic blog engine                                     |
| [cloudflare-mocks](packages/cloudflare-mocks)           | In-memory Cloudflare binding mocks for tests                  |
| [cn](packages/cn)                                       | Class name utility                                            |
| [cron](packages/cron)                                   | Cron schedules with zone-aware occurrences and descriptors    |
| [crypto](packages/crypto)                               | WebCrypto primitives: hashing, HMAC, passwords, TOTP, AES-GCM |
| [data-table-d1](packages/data-table-d1)                 | Remix Data Table adapter for Cloudflare D1                    |
| [data-table-sqlstorage](packages/data-table-sqlstorage) | Remix Data Table adapter for Durable Object SQL               |
| [dates](packages/dates)                                 | Zone-aware date operations with Intl-only formatting          |
| [duration](packages/duration)                           | Typed duration strings converted to milliseconds or seconds   |
| [get-client-ip](packages/get-client-ip)                 | Extract client IP from requests                               |
| [hooks](packages/hooks)                                 | Shared React hooks                                            |
| [hostname](packages/hostname)                           | Hostname parsing and validation utilities                     |
| [http](packages/http)                                   | HTTP helper utilities                                         |
| [i18n](packages/i18n)                                   | Internationalization utilities                                |
| [iife](packages/iife)                                   | Immediately invoked function helper                           |
| [jobs](packages/jobs)                                   | Job queue utilities                                           |
| [kv-cache](packages/kv-cache)                           | Read-through cache store over Cloudflare KV                   |
| [location](packages/location)                           | URL-like path Location class                                  |
| [logger](packages/logger)                               | Request-scoped logging                                        |
| [lucide-remix](packages/lucide-remix)                   | Lucide icons for Remix UI                                     |
| [mail](packages/mail)                                   | Transactional email with pluggable transports                 |
| [markdown](packages/markdown)                           | Markdown processing utilities                                 |
| [markdown-react](packages/markdown-react)               | React markdown rendering utilities                            |
| [markdown-remix](packages/markdown-remix)               | Remix markdown rendering utilities                            |
| [markdown-server](packages/markdown-server)             | Server-side markdown processing utilities                     |
| [oidc-client](packages/oidc-client)                     | OIDC client utilities                                         |
| [oidc-provider](packages/oidc-provider)                 | OIDC/OAuth2 provider engine                                   |
| [pagination](packages/pagination)                       | Offset and keyset pagination with Link headers                |
| [polar](packages/polar)                                 | Polar billing integration utilities                           |
| [r3-ui](packages/r3-ui)                                 | Remix v3 UI component library                                 |
| [r3-ui-router](packages/r3-ui-router)                   | SPA router for Remix UI apps                                  |
| [rate-limit](packages/rate-limit)                       | Adapter-based rate limiting with standard headers             |
| [response](packages/response)                           | HTTP response utilities                                       |
| [result](packages/result)                               | Result type for error handling                                |
| [rss](packages/rss)                                     | RSS feed utilities                                            |
| [service-container](packages/service-container)         | Dependency injection service container                        |
| [seo](packages/seo)                                     | Canonical URLs, schema.org builders and head metadata         |
| [session-storage-kv](packages/session-storage-kv)       | Session storage adapter for Cloudflare KV                     |
| [sitemap](packages/sitemap)                             | Sitemap generation utilities                                  |
| [strings](packages/strings)                             | Inflection, Chicago title case, slugs and grapheme-safe text  |
| [typeid](packages/typeid)                               | Type-safe prefixed id utilities                               |
| [types](packages/types)                                 | Shared TypeScript types                                       |
| [u](packages/u)                                         | Tailwind-like Remix UI styling utilities                      |
| [ui](packages/ui)                                       | Shared React UI components                                    |
| [uuid](packages/uuid)                                   | UUID utilities                                                |
| [validate](packages/validate)                           | Standard Schema validation utilities                          |
| [webhooks](packages/webhooks)                           | Standard Webhooks signing, verification and replay guards     |
| [workers-cache](packages/workers-cache)                 | Cloudflare cache tags, purging and cache-status reads         |
| [xml](packages/xml)                                     | XML generation utilities                                      |
