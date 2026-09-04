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
```

New apps and packages are written from the `create-app` and `create-package` skills in
`.agents/skills/`, which document the structure and point at the workspaces to copy each
concern from.

## Tech Stack

- **Runtime**: Cloudflare Workers for deployed web apps; Bun for local tooling and selected apps
- **Framework**: Remix v3
- **Toolchain**: Vite+ (`vp`) — formatting, linting, type checking and tests, configured in the root `vite.config.ts`
- **Package manager**: Bun
- **Database**: Cloudflare D1, Durable Object SQLite, and Remix Data Table
- **Styling**: Remix UI `css()` mixins

## Getting Started

Prerequisites: [Bun](https://bun.sh) and [Node.js](https://nodejs.org). Bun installs
dependencies and runs scripts; Node runs the Vite+ toolchain (`vp`), which `bun install`
provides — `node:sqlite` means it needs Node 22.5 or newer.

```bash
bun install              # Install dependencies
cd apps/<name>           # Navigate to an app
bun run dev              # Start development server
```

## Commands

Run from the repository root:

| Command                        | Description                             |
| ------------------------------ | --------------------------------------- |
| `bun check`                    | Format, lint and type check in one pass |
| `bun check:fix`                | Same, applying formatting and autofixes |
| `bun format`                   | Check formatting                        |
| `bun format:fix`               | Fix formatting                          |
| `bun lint`                     | Check linting                           |
| `bun lint:fix`                 | Fix linting issues                      |
| `bun typecheck`                | TypeScript type checking                |
| `bun run test`                 | Run every test (Vitest)                 |
| `bun upgrade`                  | Upgrade all workspaces                  |
| `bun upgrade:dry-run`          | Preview all upgrades                    |
| `bun upgrade:apps`             | Upgrade app workspaces                  |
| `bun upgrade:apps:dry-run`     | Preview app upgrades                    |
| `bun upgrade:packages`         | Upgrade package workspaces              |
| `bun upgrade:packages:dry-run` | Preview package upgrades                |

## Workspace Imports

- `@sdxc/*` - Package imports (e.g., `import { success } from "@sdxc/result"`)
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

| Package                                                         | Description                                                                    |     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ | --- |
| [api-client](packages/api-client)                               | Base class for clients of a remote HTTP API                                    |     |
| [arrays](packages/arrays)                                       | Array utility functions                                                        |     |
| [auth](packages/auth)                                           | OAuth 2.0 and OpenID Connect client for Remix on Cloudflare Workers            |     |
| [billing](packages/billing)                                     | Vendor-neutral billing with pluggable providers and a webhook endpoint         |     |
| [blog-engine](packages/blog-engine)                             | Host-agnostic blog engine                                                      |     |
| [catch-response-middleware](packages/catch-response-middleware) | Router middleware that turns a thrown `Response` into the response             |     |
| [cloudflare-mocks](packages/cloudflare-mocks)                   | In-memory Cloudflare binding mocks for tests                                   |     |
| [cron](packages/cron)                                           | Cron schedules with zone-aware occurrences and descriptors                     |     |
| [crypto](packages/crypto)                                       | WebCrypto primitives: hashing, HMAC, passwords, TOTP, AES-GCM                  | ✅  |
| [data-table-d1](packages/data-table-d1)                         | Remix Data Table adapter for Cloudflare D1                                     |     |
| [data-table-sqlstorage](packages/data-table-sqlstorage)         | Remix Data Table adapter for Durable Object SQL                                |     |
| [dates](packages/dates)                                         | Zone-aware date operations with Intl-only formatting                           | ✅  |
| [duration](packages/duration)                                   | Typed duration strings converted to milliseconds or seconds                    | ✅  |
| [get-client-ip](packages/get-client-ip)                         | Extract client IP from requests                                                |     |
| [highlight](packages/highlight)                                 | Syntax highlighting as tokens, with a Markdoc fence node                       |     |
| [hostname](packages/hostname)                                   | Hostname parsing and validation utilities                                      |     |
| [http](packages/http)                                           | HTTP helper utilities                                                          |     |
| [i18n](packages/i18n)                                           | Language detection, i18next instances and translated-markup components         | ✅  |
| [icons](packages/icons)                                         | Lucide icons for Remix UI                                                      |     |
| [iife](packages/iife)                                           | Immediately invoked function helper                                            |     |
| [jobs](packages/jobs)                                           | Job queue utilities                                                            |     |
| [jwt](packages/jwt)                                             | JWT payload classes and the keys that sign them                                | ✅  |
| [kv-cache](packages/kv-cache)                                   | Read-through cache store over Cloudflare KV                                    |     |
| [location](packages/location)                                   | URL-like path Location class                                                   |     |
| [logger](packages/logger)                                       | Request-scoped logging                                                         |     |
| [mail](packages/mail)                                           | Transactional email with pluggable transports                                  |     |
| [markdown](packages/markdown)                                   | Markdown parsing and Remix UI rendering                                        |     |
| [mcp](packages/mcp)                                             | MCP servers over stateless Streamable HTTP                                     |     |
| [oidc-provider](packages/oidc-provider)                         | OIDC/OAuth2 provider engine                                                    |     |
| [pagination](packages/pagination)                               | Offset and keyset pagination with Link headers                                 |     |
| [rate-limit](packages/rate-limit)                               | Adapter-based rate limiting with standard headers                              |     |
| [response](packages/response)                                   | HTTP response utilities                                                        |     |
| [result](packages/result)                                       | Result type for error handling                                                 | ✅  |
| [rss](packages/rss)                                             | RSS feed utilities                                                             |     |
| [sample](packages/sample)                                       | Seeded generation of believable people, places, prose, numbers and identifiers | ✅  |
| [server-timing](packages/server-timing)                         | Server-Timing measurements written to a response header                        |     |
| [service-container](packages/service-container)                 | Dependency injection service container                                         |     |
| [seo](packages/seo)                                             | Canonical URLs, schema.org builders and head metadata                          |     |
| [session-storage-kv](packages/session-storage-kv)               | Session storage adapter for Cloudflare KV                                      |     |
| [sitemap](packages/sitemap)                                     | Sitemap generation utilities                                                   |     |
| [spec](packages/spec)                                           | Executable specification runner for `.spec` files                              | ✅  |
| [strings](packages/strings)                                     | Inflection, Chicago title case, slugs and grapheme-safe text                   |     |
| [typeid](packages/typeid)                                       | Type-safe prefixed id utilities                                                |     |
| [types](packages/types)                                         | Shared TypeScript types                                                        | ✅  |
| [u](packages/u)                                                 | Tailwind-like Remix UI styling utilities                                       |     |
| [ui](packages/ui)                                               | Remix v3 UI component library                                                  |     |
| [ui-router](packages/ui-router)                                 | SPA router for Remix UI apps                                                   |     |
| [uuid](packages/uuid)                                           | UUID utilities                                                                 |     |
| [validate](packages/validate)                                   | Standard Schema validation utilities                                           |     |
| [webhooks](packages/webhooks)                                   | Standard Webhooks signing, verification and replay guards                      |     |
| [workers-cache](packages/workers-cache)                         | Cloudflare cache tags, purging and cache-status reads                          |     |
| [xml](packages/xml)                                             | XML generation utilities                                                       |     |
| [yaml](packages/yaml)                                           | YAML reading and writing over a documented subset                              |     |

## Third-Party Dependencies

Every external dependency in the repo, and the workspace that declares it. Shared
tooling is declared once at the root and resolves from there, so no app or package
repeats it. `@sdxc/*` workspace dependencies are listed under [Packages](#packages).

| Dependency                        | Where                                                                                                                      | Why                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `remix`                           | Every app, and most packages                                                                                               | The framework: router, UI, middleware and data layer.                 |
| `vite`                            | Root, and every app except `pkmn`                                                                                          | Builds and serves the apps; the root entry is an alias, see below.    |
| `vite-plus`                       | Root                                                                                                                       | The `vp` toolchain: formatting, linting, type checking and tests.     |
| `vitest`                          | Root                                                                                                                       | Test runner for every workspace.                                      |
| `typescript`                      | Root                                                                                                                       | The type checker behind every `tsc --noEmit`.                         |
| `msw`                             | Root                                                                                                                       | Mocks outbound HTTP in tests.                                         |
| `wrangler`                        | Every app except `pkmn`                                                                                                    | Deploys Workers and applies D1 migrations.                            |
| `@cloudflare/vite-plugin`         | Every app except `pkmn` and `r3-gallery`                                                                                   | Runs the Worker inside Vite dev and build.                            |
| `@cloudflare/vitest-pool-workers` | Root                                                                                                                       | Runs tests inside workerd against real bindings.                      |
| `@cloudflare/workers-types`       | `blog-engine`, `cloudflare-mocks`, `data-table-d1`, `data-table-sqlstorage`, `jobs`, `kv-cache`, `logger`, `oidc-provider` | Workerd runtime types; apps generate theirs with `wrangler types`.    |
| `@total-typescript/tsconfig`      | Root                                                                                                                       | The base tsconfig every workspace extends.                            |
| `@total-typescript/ts-reset`      | Root                                                                                                                       | Tightens the built-in library types.                                  |
| `@types/bun`                      | Root                                                                                                                       | Bun globals, and it supplies `@types/node` in turn.                   |
| `@types/node`                     | `pkmn`, `cloudflare-mocks`, `icons`, `service-container`, `uuid`                                                           | Declared where a tsconfig names `node` in its `types`.                |
| `jose`                            | `jwt`                                                                                                                      | Signs and verifies JWTs and JWKS.                                     |
| `@simplewebauthn/server`          | `oidc-provider`                                                                                                            | Passkey registration and authentication.                              |
| `@polar-sh/sdk`                   | `polar`                                                                                                                    | Client for the Polar billing API.                                     |
| `@markdoc/markdoc`                | `highlight`, `mail`, `markdown`                                                                                            | Parses Markdown into a renderable tree.                               |
| `@standard-schema/spec`           | `markdown`, `validate`, `webhooks`                                                                                         | The `StandardSchemaV1` interface, as types only.                      |
| `i18next`                         | `i18n`                                                                                                                     | Translation lookup and interpolation.                                 |
| `html-parse-stringify`            | `i18n`                                                                                                                     | Parses the tag AST inside a translation string.                       |
| `lucide-static`                   | `icons`                                                                                                                    | Icon source data for the icon codegen script.                         |
| `cron-parser`                     | `cron`                                                                                                                     | Test-only oracle the package's own schedule maths is checked against. |

The root `vite` is an alias to `@voidzero-dev/vite-plus-core`, the engine `vp` runs on.
It ships no executable, so each app declares real Vite for its own `vite dev` and
`vite build`.
