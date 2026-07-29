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

| App                           | Description                                    | URL                                                 |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| [auth](apps/auth)             | OAuth 2.0 / OIDC authorization server          | https://auth.sergiodxa.com                          |
| [auth-saas](apps/auth-saas)   | Multi-tenant OIDC/OAuth2 identity platform     | https://auth.sergiodxa.com                          |
| [blog](apps/blog)             | Personal blog and CMS                          | Retired, not deployed                               |
| [blog-saas](apps/blog-saas)   | Multi-tenant blog platform                     | https://blog.sergiodxa.com                          |
| [books](apps/books)           | Book landing page and sales funnel             | https://books.sergiodxa.com                         |
| [pkmn](apps/pkmn)             | Monster-collecting game engine and browser UI  | Local app                                           |
| [r3-blog](apps/r3-blog)       | Remix v3 SSR blog                              | https://sergiodxa.com                               |
| [r3-gallery](apps/r3-gallery) | Client-only Remix UI photo gallery SPA         | https://r3-gallery.sergiodxa-cloudflare.workers.dev |
| [r3-uptime](apps/r3-uptime)   | Remix v3 port of the uptime monitoring service | https://uptime.sergiodxa.com                        |
| [uptime](apps/uptime)         | Infrastructure monitoring service              | https://uptime.sergiodxa.com                        |

## Packages

| Package                                                 | Description                                     |
| ------------------------------------------------------- | ----------------------------------------------- |
| [arrays](packages/arrays)                               | Array utility functions                         |
| [auth-sdk](packages/auth-sdk)                           | OAuth 2.0 client SDK for auth.sergiodxa.com     |
| [blog-engine](packages/blog-engine)                     | Host-agnostic blog engine                       |
| [cache](packages/cache)                                 | Cache helper utilities                          |
| [cn](packages/cn)                                       | Class name utility                              |
| [data-table-d1](packages/data-table-d1)                 | Remix Data Table adapter for Cloudflare D1      |
| [data-table-sqlstorage](packages/data-table-sqlstorage) | Remix Data Table adapter for Durable Object SQL |
| [db-helpers](packages/db-helpers)                       | Database helper utilities for Drizzle           |
| [get-client-ip](packages/get-client-ip)                 | Extract client IP from requests                 |
| [hooks](packages/hooks)                                 | Shared React hooks                              |
| [hostname](packages/hostname)                           | Hostname parsing and validation utilities       |
| [http](packages/http)                                   | HTTP helper utilities                           |
| [i18n](packages/i18n)                                   | Internationalization utilities                  |
| [iife](packages/iife)                                   | Immediately invoked function helper             |
| [jobs](packages/jobs)                                   | Job queue utilities                             |
| [location](packages/location)                           | URL-like path Location class                    |
| [logger](packages/logger)                               | Request-scoped logging                          |
| [lucide-remix](packages/lucide-remix)                   | Lucide icons for Remix UI                       |
| [markdown](packages/markdown)                           | Markdown processing utilities                   |
| [markdown-react](packages/markdown-react)               | React markdown rendering utilities              |
| [markdown-remix](packages/markdown-remix)               | Remix markdown rendering utilities              |
| [markdown-server](packages/markdown-server)             | Server-side markdown processing utilities       |
| [oidc-client](packages/oidc-client)                     | OIDC client utilities                           |
| [oidc-provider](packages/oidc-provider)                 | OIDC/OAuth2 provider engine                     |
| [polar](packages/polar)                                 | Polar billing integration utilities             |
| [r3-ui](packages/r3-ui)                                 | Remix v3 UI component library                   |
| [r3-ui-router](packages/r3-ui-router)                   | SPA router for Remix UI apps                    |
| [response](packages/response)                           | HTTP response utilities                         |
| [result](packages/result)                               | Result type for error handling                  |
| [rss](packages/rss)                                     | RSS feed utilities                              |
| [service-container](packages/service-container)         | Dependency injection service container          |
| [session-storage-kv](packages/session-storage-kv)       | Session storage adapter for Cloudflare KV       |
| [sitemap](packages/sitemap)                             | Sitemap generation utilities                    |
| [typeid](packages/typeid)                               | Type-safe prefixed id utilities                 |
| [types](packages/types)                                 | Shared TypeScript types                         |
| [u](packages/u)                                         | Tailwind-like Remix UI styling utilities        |
| [ui](packages/ui)                                       | Shared React UI components                      |
| [uuid](packages/uuid)                                   | UUID utilities                                  |
| [validate](packages/validate)                           | Standard Schema validation utilities            |
| [xml](packages/xml)                                     | XML generation utilities                        |
