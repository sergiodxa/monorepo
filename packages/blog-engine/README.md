# @pkg/blog-engine

A complete, host-agnostic blog application — public site, admin CMS, schema, and
theming — packaged so it can be self-hosted on a plain Worker or run per-tenant
inside a Cloudflare Durable Object. This is "WordPress core": zero
Cloudflare-specific imports; the host injects a database adapter and secrets.

## Overview

The engine is one call — `createBlogEngine(config)` — returning `{ fetch, migrate }`.
Everything a blog owner edits (title, theme, post types, posts, users, roles) lives
in the blog's own SQL database; everything environmental (the database adapter, OIDC
client, cookie secret) is injected by the host.

- **WordPress-style content model** — `posts` + `post_meta` (EAV) with runtime-defined
  post types. A built-in `article` type ships seeded; owners define their own types
  (seven field kinds) from the admin panel, and the metadata codec is derived from the
  definition rather than hand-written.
- **Roles and permissions** — a fixed permission catalog plus DB-stored roles that
  bundle permission keys. Four built-in roles (admin/editor/writer/reader); owners
  compose custom roles. Code checks permissions, never role names.
- **OIDC admin login** — a configurable relying-party client, so hosted blogs use the
  platform IdP and self-hosted blogs point at any OIDC provider.
- **Theming** — nine knobs derived to an OKLCH palette + semantic tokens at render
  time (no static stylesheet ships), plus a custom-CSS escape hatch.
- **SSR-only, zero client JS in v1** — the property that makes it run anywhere Fetch runs.

## Usage

### Self-hosted (Cloudflare Worker + D1)

```typescript
import { createBlogEngine, type BlogEngine } from "@pkg/blog-engine";
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";

let engine: BlogEngine | null = null;

export default {
	async fetch(request, env, ctx) {
		engine ??= createBlogEngine({
			database: createD1DatabaseAdapter(env.DB),
			auth: {
				issuer: env.OIDC_ISSUER, // any IdP: Auth0, Keycloak, auth.sergiodxa.com…
				clientId: await env.OIDC_CLIENT_ID.get(),
				clientSecret: await env.OIDC_CLIENT_SECRET.get(),
			},
			session: { secret: await env.COOKIE_SESSION_SECRET.get() },
			waitUntil: (promise) => ctx.waitUntil(promise),
		});
		return engine.fetch(request);
	},
} satisfies ExportedHandler<Env>;
```

### Multi-tenant (Cloudflare Durable Object)

The DO host differs only in the adapter, `migrations: "manual"` (run inside
`blockConcurrencyWhile`), and config sourced from the control plane:

```typescript
import { createBlogEngine } from "@pkg/blog-engine";
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";

this.app = createBlogEngine({
	database: createSQLStorageDatabaseAdapter(this.ctx.storage.sql),
	migrations: "manual",
	isProd: true,
	session: { secret: meta.cookie_secret },
	auth: {
		issuer: meta.oidc_issuer,
		clientId: meta.oidc_client_id,
		clientSecret: meta.oidc_client_secret,
		admins: [meta.owner],
	},
});
await this.app.migrate(); // engine-owned migrations on boot
```

## API

### `createBlogEngine(config: BlogEngineConfig): BlogEngine`

Creates an engine bound to injected storage and secrets. The config object is the
entire public boundary — the internal wiring (router, repositories) stays private.

### `BlogEngine`

- `fetch(request: Request): Promise<Response>` — handles every request for one blog.
- `migrate(): Promise<{ applied: string[] }>` — applies pending migrations (journaled,
  idempotent). Called automatically before the first request unless `migrations: "manual"`.

### `BlogEngineConfig`

| Field        | Description                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------- |
| `database`   | A `remix/data-table` `DatabaseAdapter` (D1 or SqlStorage).                                   |
| `auth`       | OIDC RP config: `issuer`, `clientId`, `clientSecret`, optional `metadata`/`scopes`/`admins`. |
| `session`    | `{ secret, storage?, cookieName? }` — cookie signing secret + optional storage override.     |
| `migrations` | `"auto"` (default) or `"manual"`.                                                            |
| `isProd`     | Controls `Secure` cookies (default `false`).                                                 |
| `waitUntil`  | Optional host hook for background work.                                                      |

The `remix` package is shared with the host (see Tips) so container/context keys
resolve across the boundary.

## Subpath exports

- `@pkg/blog-engine/migrations` — the migration runner + `MIGRATIONS` list.
- `@pkg/blog-engine/schema` — the `remix/data-table` table definitions.

## Related packages

- [`@pkg/data-table-d1`](../data-table-d1) — D1 adapter (self-hosted).
- [`@pkg/data-table-sqlstorage`](../data-table-sqlstorage) — Durable Object adapter.

## Tips

- The engine derives all absolute URLs (OAuth `redirect_uri`, RSS, sitemap, canonical
  links) from `request.url`, so one build serves any hostname — custom-domain
  activation needs no engine reconfiguration.
- The engine's only hard runtime dependency is a single SQL database; sessions are
  stored there by default, so no KV is required.
