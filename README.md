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
| [sdxc](apps/sdxc)             | Documentation site for the published packages | https://sdxc.sergiodxa.com                          |
| [uptime](apps/uptime)         | Uptime and infrastructure monitoring service  | https://uptime.sergiodxa.com                        |

## Packages

| Package                                                         | Description                                                                                                       |     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --- |
| [api-client](packages/api-client)                               | Base class for clients of a remote HTTP API                                                                       | ✅  |
| [atom](packages/atom)                                           | Atom 1.0 feed parser and builder                                                                                  | ✅  |
| [auth](packages/auth)                                           | OAuth 2.0 and OpenID Connect client for any runtime that speaks `Request` and `Response`                          | ✅  |
| [billing](packages/billing)                                     | Vendor-neutral billing with pluggable providers and a webhook endpoint                                            | ✅  |
| [blog-engine](packages/blog-engine)                             | Host-agnostic blog engine                                                                                         |     |
| [cache](packages/cache)                                         | Cache contract with adapters for memory and Cloudflare KV                                                         | ✅  |
| [catch-response-middleware](packages/catch-response-middleware) | Router middleware that turns a thrown `Response` into the request's response                                      | ✅  |
| [cloudflare-mocks](packages/cloudflare-mocks)                   | In-memory Cloudflare binding mocks for tests                                                                      | ✅  |
| [cron](packages/cron)                                           | Cron schedules with zone-aware occurrences and descriptors                                                        | ✅  |
| [crypto](packages/crypto)                                       | Web Crypto primitives — hashing, HMAC, tokens, TOTP, AES-GCM — plus scrypt passwords                              | ✅  |
| [data-table-d1](packages/data-table-d1)                         | Remix Data Table adapter for Cloudflare D1                                                                        | ✅  |
| [data-table-sqlstorage](packages/data-table-sqlstorage)         | Remix Data Table adapter for Durable Object SQL                                                                   | ✅  |
| [dates](packages/dates)                                         | Zone-aware date operations with Intl-only formatting                                                              | ✅  |
| [distill](packages/distill)                                     | Distill the article out of a web page: fetch under bounds, score, sanitize                                        | ✅  |
| [doh](packages/doh)                                             | Typed DNS over HTTPS lookups                                                                                      | ✅  |
| [duration](packages/duration)                                   | Typed duration strings converted to milliseconds or seconds                                                       | ✅  |
| [feed](packages/feed)                                           | One feed API over RSS, Atom and JSON Feed, with conditional fetching and autodiscovery                            | ✅  |
| [flags](packages/flags)                                         | Feature flag evaluation implementing the OpenFeature specification                                                | ✅  |
| [flags-engine](packages/flags-engine)                           | Flag evaluation engine: typed targeting rules, percentage splits and pluggable stores                             | ✅  |
| [get-client-ip](packages/get-client-ip)                         | Read the client IP from a Cloudflare Workers request                                                              | ✅  |
| [highlight](packages/highlight)                                 | Syntax highlighting as tokens, with a markdown visitor that paints code blocks                                    | ✅  |
| [hostname](packages/hostname)                                   | Cloudflare for SaaS custom-hostname client: register, poll and delete customer domains                            | ✅  |
| [html](packages/html)                                           | Read a served page: fetch or parse HTML, then query it by role and accessible name                                | ✅  |
| [http](packages/http)                                           | Response builders, content negotiation and HTTP caching                                                           | ✅  |
| [i18n](packages/i18n)                                           | Language detection and MessageFormat 2 translators for Remix routers and remix/ui                                 | ✅  |
| [icalendar](packages/icalendar)                                 | Read and write iCalendar documents, with recurrence rules and time zones                                          |     |
| [icons](packages/icons)                                         | Lucide icons for Remix UI                                                                                         | ✅  |
| [idempotency](packages/idempotency)                             | Idempotency-Key requests: replay the first response, refuse conflicting reuse                                     |     |
| [jobs](packages/jobs)                                           | Declared background jobs dispatched over a pluggable queue backend                                                | ✅  |
| [jsdoc](packages/jsdoc)                                         | Read JSDoc out of source text into a JSON documentation model                                                     | ✅  |
| [json-feed](packages/json-feed)                                 | JSON Feed 1.1 builder and parser                                                                                  | ✅  |
| [json-schema](packages/json-schema)                             | Schema builders that validate like remix/data-schema and describe themselves as JSON Schema 2020-12               | ✅  |
| [jwt](packages/jwt)                                             | JWT payload classes and the keys that sign them                                                                   | ✅  |
| [lazy-route](packages/lazy-route)                               | Maps a route to a module imported on the first request that reaches it                                            | ✅  |
| [location](packages/location)                                   | URL-like `Location` class for URL paths without an origin                                                         | ✅  |
| [logger](packages/logger)                                       | One wide event per Worker invocation, attached at the router and the job dispatcher                               | ✅  |
| [mail](packages/mail)                                           | Transactional email with pluggable transports                                                                     | ✅  |
| [markdown](packages/markdown)                                   | GitHub Flavored Markdown: parse to a typed AST, transform it, write it back                                       | ✅  |
| [mcp](packages/mcp)                                             | MCP servers over stateless Streamable HTTP                                                                        | ✅  |
| [merge-patch](packages/merge-patch)                             | Apply, diff and read RFC 7396 JSON Merge Patch documents                                                          |     |
| [messageformat](packages/messageformat)                         | Unicode MessageFormat 2 parser and formatter shaped like Intl.MessageFormat                                       | ✅  |
| [microformats](packages/microformats)                           | Parse, read and write microformats2                                                                               |     |
| [micropub](packages/micropub)                                   | Read Micropub requests into typed operations and build the spec's responses                                       |     |
| [oidc-provider](packages/oidc-provider)                         | OIDC/OAuth2 provider engine                                                                                       |     |
| [openapi](packages/openapi)                                     | Build, serve and check OpenAPI 3.1 documents from typed operations                                                | ✅  |
| [opml](packages/opml)                                           | Read and write OPML subscription lists                                                                            | ✅  |
| [pagination](packages/pagination)                               | Offset and keyset pagination with Link headers                                                                    | ✅  |
| [passkey](packages/passkey)                                     | Passkeys on both sides: a one-call WebAuthn browser API and a relying party for it                                | ✅  |
| [problem](packages/problem)                                     | RFC 9457 problem details and catalogs of an API's problem types                                                   | ✅  |
| [rate-limit](packages/rate-limit)                               | Adapter-based rate limiting with standard response headers                                                        | ✅  |
| [response](packages/response)                                   | Response builders for JSON APIs and redirects                                                                     | ✅  |
| [result](packages/result)                                       | Result type for error handling                                                                                    | ✅  |
| [robots](packages/robots)                                       | Read, write and evaluate robots.txt and robots directives                                                         | ✅  |
| [rss](packages/rss)                                             | RSS 2.0 feed builder and parser                                                                                   | ✅  |
| [saml](packages/saml)                                           | SAML 2.0 service provider: verify a signed assertion and the metadata around it                                   | ✅  |
| [sample](packages/sample)                                       | Seeded generation of believable people, places, prose, numbers and identifiers                                    | ✅  |
| [scim](packages/scim)                                           | SCIM 2.0 resources, filters, PATCH operations and discovery documents                                             |     |
| [security-headers](packages/security-headers)                   | Typed Content-Security-Policy, Permissions-Policy and response security headers, with middleware                  |     |
| [semver](packages/semver)                                       | SemVer 2.0.0 parsing, precedence ordering and range-free version comparisons                                      | ✅  |
| [seo](packages/seo)                                             | Canonical URLs, schema.org builders and head metadata                                                             | ✅  |
| [server-timing](packages/server-timing)                         | Server-Timing measurements written to a response header                                                           | ✅  |
| [session-storage-kv](packages/session-storage-kv)               | Session storage adapter for Cloudflare KV                                                                         | ✅  |
| [sitemap](packages/sitemap)                                     | Sitemap generation and parsing                                                                                    | ✅  |
| [spec](packages/spec)                                           | Executable specification runner for `.spec` files                                                                 | ✅  |
| [strings](packages/strings)                                     | Inflection, Chicago title case, slugs and grapheme-safe text                                                      | ✅  |
| [structured-fields](packages/structured-fields)                 | Parse and serialize RFC 9651 structured HTTP field values                                                         | ✅  |
| [trace-context](packages/trace-context)                         | W3C Trace Context: traceparent and tracestate, one trace per invocation, propagated to jobs and outbound requests | ✅  |
| [typeid](packages/typeid)                                       | TypeID values: a UUID and the prefix naming it                                                                    | ✅  |
| [types](packages/types)                                         | Shared TypeScript types                                                                                           | ✅  |
| [u](packages/u)                                                 | Tailwind-like Remix UI styling utilities                                                                          | ✅  |
| [ui](packages/ui)                                               | Remix v3 UI component library                                                                                     | ✅  |
| [user-agent](packages/user-agent)                               | Read a User-Agent string into its browser, engine, operating system and device                                    | ✅  |
| [uuid](packages/uuid)                                           | Branded UUID type with validation and generation                                                                  | ✅  |
| [validate](packages/validate)                                   | Standard Schema validation utilities                                                                              | ✅  |
| [webhooks](packages/webhooks)                                   | Standard Webhooks signing, verification and replay guards                                                         | ✅  |
| [webmention](packages/webmention)                               | Receive, verify, discover and send Webmentions                                                                    |     |
| [websub](packages/websub)                                       | WebSub subscriber and publisher: subscribe, verify intent and signatures, notify hubs                             |     |
| [well-known](packages/well-known)                               | Typed documents for well-known URIs: security.txt, WebFinger, OAuth and OIDC metadata, JWKS and more              | ✅  |
| [workers-cache](packages/workers-cache)                         | Cloudflare cache tags, purging and cache-status reads                                                             | ✅  |
| [xml](packages/xml)                                             | XML parser and serializer for RSS-style feeds                                                                     | ✅  |
| [yaml](packages/yaml)                                           | YAML reading and writing over a documented subset                                                                 | ✅  |

A ✅ in the last column means the package is published to npm.

## Third-Party Dependencies

Every external dependency in the repo, and the workspace that declares it. Shared
tooling is declared once at the root and resolves from there, so no app or package
repeats it. `@sdxc/*` workspace dependencies are listed under [Packages](#packages).

| Dependency                        | Where                                                                                                                   | Why                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `remix`                           | Every app, and most packages                                                                                            | The framework: router, UI, middleware and data layer.                                           |
| `vite`                            | Root, and every app except `pkmn`                                                                                       | Builds and serves the apps; the root entry is an alias, see below.                              |
| `vite-plus`                       | Root                                                                                                                    | The `vp` toolchain: formatting, linting, type checking and tests.                               |
| `vitest`                          | Root; a peer of `flags` and `jobs`                                                                                      | Test runner for every workspace, and the peer behind the `./conformance` suites those two ship. |
| `typescript`                      | Root                                                                                                                    | The type checker behind every `tsc --noEmit`.                                                   |
| `msw`                             | Root                                                                                                                    | Mocks outbound HTTP in tests.                                                                   |
| `wrangler`                        | Every app except `pkmn`                                                                                                 | Deploys Workers and applies D1 migrations.                                                      |
| `@cloudflare/vite-plugin`         | Every app except `pkmn` and `r3-gallery`                                                                                | Runs the Worker inside Vite dev and build.                                                      |
| `@cloudflare/vitest-pool-workers` | Root                                                                                                                    | Runs tests inside workerd against real bindings.                                                |
| `@cloudflare/workers-types`       | `blog-engine`, `cache`, `cloudflare-mocks`, `data-table-d1`, `data-table-sqlstorage`, `jobs`, `logger`, `oidc-provider` | Workerd runtime types; apps generate theirs with `wrangler types`.                              |
| `@total-typescript/tsconfig`      | Root                                                                                                                    | The base tsconfig every workspace extends.                                                      |
| `@total-typescript/ts-reset`      | Root                                                                                                                    | Tightens the built-in library types.                                                            |
| `@types/bun`                      | Root                                                                                                                    | Bun globals.                                                                                    |
| `@types/node`                     | Root, `pkmn`, `cloudflare-mocks`, `icons`, `logger`, `uuid`                                                             | Node globals at the root, and declared again wherever a tsconfig names `node` in its `types`.   |
| `jose`                            | `jwt`                                                                                                                   | Signs and verifies JWTs and JWKS.                                                               |
| `@simplewebauthn/server`          | `oidc-provider`                                                                                                         | Passkey registration and authentication.                                                        |
| `@remix-run/data-schema`          | `auth`                                                                                                                  | Schema validation, reached by its own name rather than through `remix`.                         |
| `@standard-schema/spec`           | `flags`, `jobs`, `markdown`, `validate`, `webhooks`                                                                     | The `StandardSchemaV1` interface, as types only.                                                |
| `lucide-static`                   | `icons`                                                                                                                 | Icon source data for the icon codegen script.                                                   |
| `cron-parser`                     | `cron`                                                                                                                  | Test-only oracle the package's own schedule maths is checked against.                           |
| `linkedom`                        | `html`                                                                                                                  | Parses HTML into a document tree.                                                               |
| `dom-accessibility-api`           | `html`                                                                                                                  | Computes accessible names the way AccName does.                                                 |

The root `vite` is an alias to `@voidzero-dev/vite-plus-core`, the engine `vp` runs on.
It ships no executable, so each app declares real Vite for its own `vite dev` and
`vite build`.
