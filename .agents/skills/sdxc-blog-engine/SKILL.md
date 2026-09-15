---
name: sdxc-blog-engine
description: "@sdxc/blog-engine is a complete host-agnostic blog application — public site, /cms admin, SQL schema, migrations and theming — behind one `createBlogEngine(config)` returning `fetch` and `migrate`. Use when running a blog on a Worker with D1 or per-tenant in a Durable Object, working on runtime-defined post types or DB-stored roles, or wiring its OIDC admin login, sessions and migrations into a host."
---

# @sdxc/blog-engine

The engine is the blog core: zero Cloudflare-specific imports, one entry point, and a config object as its entire public boundary. The host injects a `remix/data-table` `DatabaseDriver`, OIDC credentials and a cookie secret; everything a blog owner edits — title, theme, post types, posts, users, roles — lives in the blog's own SQL database. A WordPress-style `posts` + `post_meta` (EAV) schema gives runtime-defined post types whose field definitions drive the metadata codec, forms, validation and rendering. Rendering is SSR-only through `remix/ui`, so one build serves any host: Workers, Durable Objects, Bun, Node. Its only hard runtime dependency is a single SQL database — sessions live there too, so no KV is required.

Full API, options and examples: [packages/blog-engine/README.md](packages/blog-engine/README.md)

## When to reach for it

- Standing up a blog behind a plain Worker `fetch` handler over a D1 database.
- Running many blogs, one per Durable Object, each with its own SQL storage and secrets.
- Adding a post type (machine name, path, and field kinds like `text`, `markdown`, `date`, `tags`) without touching DDL.
- Composing a custom role out of permission keys, or debugging why a publish is refused.
- Emitting the engine's `.sql` migrations, or deciding between lazy and manual migration on boot.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/blog-engine": "workspace:*" } }
```

```ts
import type { BlogEngine } from "@sdxc/blog-engine";

import { createBlogEngine } from "@sdxc/blog-engine";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";

let engine: BlogEngine | null = null;

export default {
	async fetch(request, env, ctx) {
		engine ??= createBlogEngine({
			database: createD1DatabaseAdapter(env.DB),
			auth: {
				issuer: env.OIDC_ISSUER,
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

### Entry points

- `@sdxc/blog-engine` — `createBlogEngine`, `BlogEngine` and `BlogEngineConfig`
- `@sdxc/blog-engine/migrations` — the journaled `runMigrations(adapter)` runner and the ordered `MIGRATIONS` list, also usable to emit `.sql` files for `wrangler d1 migrations apply`
- `@sdxc/blog-engine/schema` — the `remix/data-table` `table()` definitions

## Suggestions

- Inside a Durable Object, set `migrations: "manual"` and call `migrate()` in `blockConcurrencyWhile`, so no request is served against an unmigrated schema. On a Worker the default `"auto"` migrates lazily before the first request.
- Every URL derives from `request.url` — OAuth `redirect_uri`, RSS, sitemap and canonical links — so one build serves any hostname and activating a custom domain needs no reconfiguration.
- The engine and its host must resolve the same `remix` copy: request-context keys are identity based, and two copies silently fail to see each other's context.
- Wrap `engine.fetch` in `logger.open("request").run(...)` to give the per-request wide event a `service`; a log with no `service` is the sign the host has not wrapped it.
- Sessions default to a SQL-backed store over the engine's own `sessions` table; pass `session.storage` only to move them to KV. Set `isProd: true` for `Secure` cookies.
- Code checks permission keys, never role names, so owners can compose roles; publishing is the `posts.publish` permission, enforced server-side, and the last admin cannot be demoted or deleted.

## Related

- `@sdxc/data-table-d1` — the D1 `DatabaseDriver` adapter a Worker host injects; skill `sdxc-data-table-d1`
- `@sdxc/data-table-sqlstorage` — the Durable Object storage adapter for the multi-tenant host; skill `sdxc-data-table-sqlstorage`
- `@sdxc/auth` — the OIDC client behind the admin login; skill `sdxc-auth`
