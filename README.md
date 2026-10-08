# sergiodxa/monorepo

**The products, sites and open-source toolkit of [Sergio Xalambrí](https://sergiodxa.com), in one
repository.**

This is everything I build and run: a monitoring service, a feed reader, a book storefront, an
identity provider, my personal site, and the 100+ TypeScript packages they're made of. Every
app runs on Cloudflare Workers with Remix v3, every package is published to npm under `@sdxc`,
and all of it shares one toolchain, one set of conventions and one test suite.

Use the apps, borrow the packages, or read the code to see how a full product is put together
on the edge.

- 🌐 **Products**: [Uptime](https://uptime.sergiodxa.com) ·
  [Reader](https://reader.sergiodxa.com) · [Books](https://books.sergiodxa.com)
- 📦 **Packages**: [sdxc.sergiodxa.com](https://sdxc.sergiodxa.com)
- ✍️ **Blog**: [sergiodxa.com](https://sergiodxa.com)

## Products

### [Uptime](apps/uptime) — [uptime.sergiodxa.com](https://uptime.sergiodxa.com)

Know your site is down before your customers do. Uptime watches HTTP endpoints, DNS records,
TCP ports, SSL certificates and scheduled jobs, runs multi-step flow checks, and alerts your
team through the channels it already uses. It includes public status pages, maintenance
windows, response-time analytics, team access and a REST API. Try it on any URL from the
landing page, no account needed.

### [Reader](apps/reader) — [reader.sergiodxa.com](https://reader.sergiodxa.com)

Follow any site that publishes RSS or Atom and read everything in one place. Each feed is
refreshed at the pace it actually publishes, posts are searchable with a real query syntax,
and posts you want to come back to stay on a saved shelf. Paid plans add labels, filter
rules, the full article fetched into the app, and an MCP endpoint so your agent can read
along too.

### [Books](apps/books) — [books.sergiodxa.com](https://books.sergiodxa.com)

The home of the _React Router OAuth2 Handbook_: a free sample chapter, live pricing, and an
upgrade path for readers who started with an earlier edition.

## Sites and Services

| App                     | What it does                                                                                                                    | Live at                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [blog](apps/blog)       | My personal site and CMS: articles, tutorials and bookmarks, with Webmentions and ActivityPub so the fediverse can follow along | [sergiodxa.com](https://sergiodxa.com)           |
| [r3-auth](apps/r3-auth) | The OAuth 2.0 and OpenID Connect provider every app here signs in with: GitHub or email and password                            | [auth.sergiodxa.com](https://auth.sergiodxa.com) |
| [sdxc](apps/sdxc)       | Documentation, guides and changelog for the `@sdxc` packages                                                                    | [sdxc.sergiodxa.com](https://sdxc.sergiodxa.com) |

## In the Workshop

Projects under active development, published here as they take shape.

- **[auth-saas](apps/auth-saas)**: a multi-tenant identity platform where every customer gets
  their own isolated OpenID Connect provider on their own domain.
- **[pkmn](apps/pkmn)**: a monster-collecting game engine that keeps content, rules and
  presentation apart, so anyone can build their own game by writing data.
- **[demo](apps/demo)**: a job board built for a Remix v3 conference talk, runnable fully
  offline.

## Packages

The packages are the building blocks the apps above are made of, extracted so anyone can use
them. They are small, focused and written to the spec they implement, built on `fetch`,
`Request`/`Response` and Web Crypto so most run unchanged on Cloudflare Workers, Bun, Deno and
Node. Fallible operations return a typed `Result` instead of throwing.

A few of them, in the shape they share: declare something once as typed data, then map
behavior onto it.

**[@sdxc/authz](packages/authz)**: permissions as a typed catalog of abilities, granted by
roles and checked synchronously.

```typescript
import { abilities, ability, allow, context, definePolicy, fact } from "@sdxc/authz";
import { isSuccess } from "@sdxc/result";

let catalog = abilities({
	article: {
		read: ability({ context: context<{ article: Article }>("article"), deniedAs: "notFound" }),
		update: ability({ context: context<{ article: Article }>("article") }),
	},
});

let policy = definePolicy(catalog, {
	facts: { actor: fact<{ id: string }>() },
	everyone: [
		allow("article.read", { when: { op: "eq", field: "article.published", value: true } }),
	],
	roles: {
		author: [
			allow("article.update", { when: { op: "eq", field: "article.authorId", path: "actor.id" } }),
		],
		admin: { inherits: ["author"], grants: [allow("*")] },
	},
});

let access = policy.for({ roles: ["author"], facts: { actor: user } });
if (isSuccess(access)) access.data.can(catalog.article.update, { article }); // true for their own
```

**[@sdxc/jobs](packages/jobs)**: background jobs declared in one map, with typed payloads,
cron schedules, retries and a pluggable queue.

```typescript
import { createJobDispatcher, createJobHandler, job, jobs } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import * as s from "remix/data-schema";

let catalog = jobs({
	sendWelcome: job({ input: s.object({ userId: s.string() }) }),
	digests: { daily: job({ cron: "0 8 * * *" }) },
});

export default createJobHandler(catalog.sendWelcome, async (ctx) => {
	await sendWelcomeEmail(ctx.input.userId); // ctx.input is typed from the schema
});

let dispatcher = createJobDispatcher({ logger, queue: cloudflare.queue(() => env.QUEUE) });
dispatcher.map(catalog.sendWelcome, () => import("./jobs/send-welcome"));

await dispatcher.enqueue(catalog.sendWelcome, { userId: user.id });
```

**[@sdxc/mcp](packages/mcp)**: an MCP server for your agent-facing API, served over stateless
Streamable HTTP from any `fetch` handler.

```typescript
import * as s from "@sdxc/json-schema";
import { createHandler, tool, tools, ToolError } from "@sdxc/mcp";

let toolset = tools({
	search: tool("search_documents", {
		description: "Searches published documents by title, excerpt and tags.",
		input: s.object({ query: s.string() }),
		annotations: { readOnlyHint: true },
	}),
});

let mcp = createHandler({ name: "documents", version: "1.0.0" });

mcp.tools.map(toolset.search, async (ctx) => {
	let documents = await search(ctx.input.query);
	if (documents.length === 0) throw new ToolError("Nothing matched. Try a broader query.");
	return documents;
});

export default { fetch: mcp.fetch };
```

Versions are calendar dates (`2026.9.4`), released daily from whatever changed, and packages
released together are pinned to each other so they always work together. Guides and API
references live at [sdxc.sergiodxa.com](https://sdxc.sergiodxa.com).

### Authentication and Identity

| Package                                           | Description                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [@sdxc/auth](packages/auth)                       | OAuth 2.0 and OpenID Connect client for any runtime that speaks `Request` and `Response`                       |
| [@sdxc/authz](packages/authz)                     | Authorization from a typed catalog of abilities, additive roles and guards, answered from loaded facts         |
| [@sdxc/crypto](packages/crypto)                   | Web Crypto primitives — hashing, HMAC, tokens, TOTP, AES-GCM — plus scrypt passwords                           |
| [@sdxc/jwt](packages/jwt)                         | JWT payload classes and the keys that sign them                                                                |
| [@sdxc/passkey](packages/passkey)                 | Passkeys on both sides: a one-call WebAuthn browser API and a relying party for it                             |
| [@sdxc/password-policy](packages/password-policy) | Password acceptance checks: length, common and breached passwords, similarity to the account, and reuse        |
| [@sdxc/saml](packages/saml)                       | SAML 2.0 service provider: verify a signed assertion and the metadata around it                                |
| [@sdxc/scim](packages/scim)                       | SCIM 2.0 resources, filters, PATCH operations and discovery documents                                          |
| [@sdxc/well-known](packages/well-known)           | Typed documents for well-known URIs: security.txt, WebFinger, NodeInfo, OAuth and OIDC metadata, JWKS and more |

### Security and Abuse Prevention

| Package                                             | Description                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [@sdxc/captcha](packages/captcha)                   | CAPTCHA verification for Turnstile, hCaptcha and reCAPTCHA, with router middleware, widgets and a test provider |
| [@sdxc/email-address](packages/email-address)       | Email address parsing and normalization, disposable-domain detection and mail-server checks                     |
| [@sdxc/honeypot](packages/honeypot)                 | Honeypot form fields with a signed render timestamp, router middleware and a `remix/component` component        |
| [@sdxc/outbound](packages/outbound)                 | Check, follow and read URLs a stranger chose: public hosts on every redirect, one deadline, bounded bodies      |
| [@sdxc/rate-limit](packages/rate-limit)             | Adapter-based rate limiting with standard response headers                                                      |
| [@sdxc/security-headers](packages/security-headers) | Typed Content-Security-Policy, Permissions-Policy and response security headers, with middleware                |
| [@sdxc/spam](packages/spam)                         | Spam scoring for user-generated content, with local rules, reputation checks and a trainable classifier         |

### HTTP, APIs and Routing

| Package                                                               | Description                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [@sdxc/api-client](packages/api-client)                               | Base class for clients of a remote HTTP API                                                                       |
| [@sdxc/bracket-params](packages/bracket-params)                       | Read and write nested query strings and form data with bracket syntax, validated by a Standard Schema             |
| [@sdxc/catch-response-middleware](packages/catch-response-middleware) | Router middleware that turns a thrown `Response` into the request's response                                      |
| [@sdxc/digest-fields](packages/digest-fields)                         | RFC 9530 Content-Digest and Repr-Digest, plus the RFC 3230 Digest header                                          |
| [@sdxc/doh](packages/doh)                                             | Typed DNS over HTTPS lookups                                                                                      |
| [@sdxc/get-client-ip](packages/get-client-ip)                         | Read the client IP from a Cloudflare Workers request                                                              |
| [@sdxc/http](packages/http)                                           | Response builders, content negotiation and HTTP caching                                                           |
| [@sdxc/http-signatures](packages/http-signatures)                     | Sign and verify HTTP requests with RFC 9421 message signatures or draft-cavage-12                                 |
| [@sdxc/idempotency](packages/idempotency)                             | Idempotency-Key requests: replay the first response, refuse conflicting reuse                                     |
| [@sdxc/ip](packages/ip)                                               | IPv4 and IPv6 addresses and ranges as value objects that classify against the IANA special-purpose registries     |
| [@sdxc/lazy-route](packages/lazy-route)                               | Maps a route to a module imported on the first request that reaches it                                            |
| [@sdxc/location](packages/location)                                   | URL-like `Location` class for URL paths without an origin                                                         |
| [@sdxc/mcp](packages/mcp)                                             | MCP servers over stateless Streamable HTTP                                                                        |
| [@sdxc/merge-patch](packages/merge-patch)                             | Apply, diff and read RFC 7396 JSON Merge Patch documents                                                          |
| [@sdxc/no-www-middleware](packages/no-www-middleware)                 | Router middleware that permanently redirects a `www.` hostname to the apex domain                                 |
| [@sdxc/openapi](packages/openapi)                                     | Build, serve and check OpenAPI 3.1 documents from typed operations                                                |
| [@sdxc/pagination](packages/pagination)                               | Offset and keyset pagination with Link headers                                                                    |
| [@sdxc/problem](packages/problem)                                     | RFC 9457 problem details and catalogs of an API's problem types                                                   |
| [@sdxc/response](packages/response)                                   | Response builders for JSON APIs and redirects                                                                     |
| [@sdxc/server-timing](packages/server-timing)                         | Server-Timing measurements written to a response header                                                           |
| [@sdxc/structured-fields](packages/structured-fields)                 | Parse and serialize RFC 9651 structured HTTP field values                                                         |
| [@sdxc/trace-context](packages/trace-context)                         | W3C Trace Context: traceparent and tracestate, one trace per invocation, propagated to jobs and outbound requests |
| [@sdxc/trailing-slash-middleware](packages/trailing-slash-middleware) | Router middleware that redirects every path to one canonical trailing-slash form                                  |
| [@sdxc/user-agent](packages/user-agent)                               | Read a User-Agent string into its browser, engine, operating system and device                                    |
| [@sdxc/webhooks](packages/webhooks)                                   | Standard Webhooks signing, verification and replay guards                                                         |

### Jobs, Messaging and Product Infrastructure

| Package                                     | Description                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [@sdxc/attribution](packages/attribution)   | Campaign parameters, click identifiers and referrers, kept as a visitor's first and last touch               |
| [@sdxc/backoff](packages/backoff)           | Retry delay schedules with growth, a ceiling, free attempts and seedable jitter                              |
| [@sdxc/billing](packages/billing)           | Vendor-neutral billing with pluggable providers and a webhook endpoint                                       |
| [@sdxc/cron](packages/cron)                 | Cron schedules with zone-aware occurrences and descriptors                                                   |
| [@sdxc/expression](packages/expression)     | Boolean conditions over a context, stored as typed JSON or written as text, with operators you add           |
| [@sdxc/flags](packages/flags)               | Feature flag evaluation implementing the OpenFeature specification                                           |
| [@sdxc/flags-engine](packages/flags-engine) | Flag evaluation engine: typed targeting rules, percentage splits and pluggable stores                        |
| [@sdxc/jobs](packages/jobs)                 | Declared background jobs dispatched over a pluggable queue backend                                           |
| [@sdxc/logger](packages/logger)             | One wide event per Worker invocation, attached at the router and the job dispatcher                          |
| [@sdxc/mail](packages/mail)                 | Transactional email with pluggable transports                                                                |
| [@sdxc/messaging](packages/messaging)       | Send one portable message to Slack, Discord, Teams, Google Chat, Telegram, WhatsApp, ntfy, Pushover and more |
| [@sdxc/newsletter](packages/newsletter)     | Vendor-neutral newsletter subscriber lists with Buttondown and Kit providers                                 |

### Content, Feeds and the Social Web

| Package                                     | Description                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [@sdxc/activitypub](packages/activitypub)   | ActivityPub protocol logic: vocabulary, actors, discovery, a verified inbox and signed delivery        |
| [@sdxc/atom](packages/atom)                 | Atom 1.0 feed parser and builder                                                                       |
| [@sdxc/distill](packages/distill)           | Distill the article out of a web page: fetch under bounds, score, sanitize                             |
| [@sdxc/feed](packages/feed)                 | One feed API over RSS, Atom and JSON Feed, with conditional fetching and autodiscovery                 |
| [@sdxc/highlight](packages/highlight)       | Syntax highlighting as tokens, with a markdown visitor that paints code blocks                         |
| [@sdxc/html](packages/html)                 | Read a served page: fetch or parse HTML, then query it by role and accessible name                     |
| [@sdxc/json-feed](packages/json-feed)       | JSON Feed 1.1 builder and parser                                                                       |
| [@sdxc/markdown](packages/markdown)         | GitHub Flavored Markdown: parse to a typed AST, transform it, write it back                            |
| [@sdxc/microformats](packages/microformats) | Parse, read and write microformats2                                                                    |
| [@sdxc/micropub](packages/micropub)         | Read Micropub requests into typed operations and build the spec's responses                            |
| [@sdxc/opml](packages/opml)                 | Read and write OPML subscription lists                                                                 |
| [@sdxc/robots](packages/robots)             | Read, write and evaluate robots.txt and robots directives                                              |
| [@sdxc/rss](packages/rss)                   | RSS 2.0 feed builder and parser                                                                        |
| [@sdxc/search](packages/search)             | Full-text search over SQLite tables: safe query parsing, FTS5 and LIKE matching, ranking, highlighting |
| [@sdxc/seo](packages/seo)                   | Canonical URLs, schema.org builders and head metadata                                                  |
| [@sdxc/sitemap](packages/sitemap)           | Sitemap generation and parsing                                                                         |
| [@sdxc/webmention](packages/webmention)     | Receive, verify, discover and send Webmentions                                                         |
| [@sdxc/websub](packages/websub)             | WebSub subscriber and publisher: subscribe, verify intent and signatures, notify hubs                  |

### Formats and Parsers

| Package                                       | Description                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [@sdxc/csv](packages/csv)                     | Read and write RFC 4180 CSV, with a streaming writer and formula neutralization                     |
| [@sdxc/icalendar](packages/icalendar)         | Read and write iCalendar documents, with recurrence rules and time zones                            |
| [@sdxc/jsdoc](packages/jsdoc)                 | Read JSDoc out of source text into a JSON documentation model                                       |
| [@sdxc/json-schema](packages/json-schema)     | Schema builders that validate like remix/data-schema and describe themselves as JSON Schema 2020-12 |
| [@sdxc/messageformat](packages/messageformat) | Unicode MessageFormat 2 parser and formatter shaped like Intl.MessageFormat                         |
| [@sdxc/qr](packages/qr)                       | QR Code Model 2 encoder with optimal segmentation, SVG path data and a remix/component renderer     |
| [@sdxc/semver](packages/semver)               | SemVer 2.0.0 parsing, precedence ordering and range-free version comparisons                        |
| [@sdxc/xml](packages/xml)                     | XML parser and serializer for RSS-style feeds                                                       |
| [@sdxc/yaml](packages/yaml)                   | YAML reading and writing over a documented subset                                                   |

### Cloudflare

| Package                                                       | Description                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [@sdxc/cache](packages/cache)                                 | Cache contract with adapters for memory and Cloudflare KV                              |
| [@sdxc/cloudflare-mocks](packages/cloudflare-mocks)           | In-memory Cloudflare binding mocks for tests                                           |
| [@sdxc/cloudflare-pricing](packages/cloudflare-pricing)       | Cloudflare Developer Platform list prices, one module per service                      |
| [@sdxc/data-table-d1](packages/data-table-d1)                 | Remix Data Table adapter for Cloudflare D1                                             |
| [@sdxc/data-table-sqlstorage](packages/data-table-sqlstorage) | Remix Data Table adapter for Durable Object SQL                                        |
| [@sdxc/hostname](packages/hostname)                           | Cloudflare for SaaS custom-hostname client: register, poll and delete customer domains |
| [@sdxc/session-storage-kv](packages/session-storage-kv)       | Session storage adapter for Cloudflare KV                                              |
| [@sdxc/workers-cache](packages/workers-cache)                 | Cloudflare cache tags, purging and cache-status reads                                  |

### UI and Internationalization

| Package                                 | Description                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| [@sdxc/i18n](packages/i18n)             | Language detection and MessageFormat 2 translators for Remix routers and remix/component |
| [@sdxc/icons](packages/icons)           | Lucide icons for Remix UI                                                                |
| [@sdxc/lazy-frame](packages/lazy-frame) | A remix/component frame that loads once the reader scrolls near it or opens its dialog   |
| [@sdxc/u](packages/u)                   | Tailwind-like Remix UI styling utilities                                                 |
| [@sdxc/ui](packages/ui)                 | Remix v3 UI component library                                                            |

### Foundations

| Package                             | Description                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| [@sdxc/dates](packages/dates)       | Zone-aware date operations with Intl-only formatting                                              |
| [@sdxc/duration](packages/duration) | Typed duration strings converted to milliseconds or seconds                                       |
| [@sdxc/random](packages/random)     | Seeded and system random streams with integer, float, pick and shuffle draws, and resumable state |
| [@sdxc/result](packages/result)     | Result type for error handling                                                                    |
| [@sdxc/sample](packages/sample)     | Seeded generation of believable people, places, prose, numbers and identifiers                    |
| [@sdxc/spec](packages/spec)         | Executable specification runner for `.spec` files                                                 |
| [@sdxc/strings](packages/strings)   | Inflection, Chicago title case, slugs and grapheme-safe text                                      |
| [@sdxc/typeid](packages/typeid)     | TypeID values: a UUID and the prefix naming it                                                    |
| [@sdxc/types](packages/types)       | Shared TypeScript types                                                                           |
| [@sdxc/uuid](packages/uuid)         | Branded UUID type with validation and generation                                                  |
| [@sdxc/validate](packages/validate) | Standard Schema validation utilities                                                              |

## How It's Built

- **One stack everywhere.** Remix v3 for routing and server-rendered UI, Cloudflare Workers
  for hosting, D1 and Durable Object SQLite for data, Queues for background jobs.
- **Packages first.** When two apps need the same thing, it becomes a package with its own
  README, tests and npm release. The apps stay thin and product-focused.
- **Tested against the real platform.** Tests run under Vitest, and tests that touch KV, D1
  or R2 run inside workerd with real Cloudflare bindings instead of hand-written stubs.
- **Decisions on the record.** Significant architectural choices are written up as
  [Architecture Decision Records](docs/adr), so the reasoning travels with the code.
- **The platform does the work.** Dialogs, popovers and disclosures use native HTML, and
  JavaScript is reserved for what the browser can't do on its own.

## Working on the Repository

You need [Bun](https://bun.sh) and [Node.js](https://nodejs.org) 22.5 or newer.

```bash
bun install
bun check
bun run test
```

`bun check` formats, lints and type checks everything in one pass, and `bun run test` runs
every test. To run an app locally, `cd apps/<name>` and `bun run dev`; each app's README
lists its setup. The conventions the codebase follows are written down in
[AGENTS.md](AGENTS.md).

## License

The packages are [MIT licensed](LICENSE.md). The applications are licensed under the O'Saasy
License: you can self-host them for personal or internal use, but not offer them as a
competing hosted service. Names, logos and site content are not covered by either license.
See [LICENSE.md](LICENSE.md) for the details.
