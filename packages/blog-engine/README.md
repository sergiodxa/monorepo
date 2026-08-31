# @pkg/blog-engine

A complete, host-agnostic blog application — public site, admin CMS, schema, and theming — packaged so it runs on a plain Worker or per-tenant inside a Durable Object.

## Overview

The engine is "WordPress core": zero Cloudflare-specific imports, one entry point
(`createBlogEngine`), and a config object as its entire public boundary. The host
injects a `remix/data-table` `DatabaseDriver`, OIDC credentials, and a cookie
secret; everything a blog owner edits (title, theme, post types, posts, users,
roles) lives in the blog's own SQL database.

It generalizes the production `apps/blog` code: a WordPress-style `posts` +
`post_meta` (EAV) schema with runtime-defined post types whose field definitions
drive a metadata codec, forms, validation, and rendering; a permission catalog with
DB-stored roles; OIDC admin login; and OKLCH-derived theming. Rendering is SSR-only
via `remix/ui` (no client JavaScript in v1), which is what lets one build serve any
host. The engine's only hard runtime dependency is a single SQL database — sessions
are stored there too, so no KV is required.

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

The DO host differs only in the adapter and `migrations: "manual"` (run inside
`blockConcurrencyWhile` on boot):

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
await this.app.migrate();
```

## API

### `createBlogEngine(config: BlogEngineConfig): BlogEngine`

Creates a blog engine bound to injected storage and secrets. The config object is
the entire public boundary — the internal router, container, and repositories stay
private.

**Parameters:**

- `config`: A [`BlogEngineConfig`](#blogengineconfig).

**Returns:**

- A [`BlogEngine`](#blogengine) with `fetch` and `migrate`.

**Example:**

```typescript
let engine = createBlogEngine({ database, auth, session: { secret } });
let response = await engine.fetch(request);
```

### `BlogEngine`

- `fetch(request: Request): Promise<Response>` — handles every request for one blog
  (public site + `/cms` admin). Pure Fetch: Workers, Durable Objects, Bun, Node.
- `migrate(): Promise<{ applied: string[] }>` — applies pending engine-owned
  migrations (journaled, idempotent). Runs automatically before the first request
  unless `migrations: "manual"`.

### `BlogEngineConfig`

| Field         | Type                                                                                    | Description                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database`    | `DatabaseDriver`                                                                        | SQL access (D1 or SqlStorage adapter).                                                                                                                                 |
| `auth`        | `{ issuer, clientId, clientSecret, metadata?, scopes?, admins?, bootstrapFirstAdmin? }` | OIDC relying-party config; `admins` are emails/subjects mapped to the admin role, and `metadata` is an `OIDCMetadata` discovery document served in place of discovery. |
| `session`     | `{ secret, storage?, cookieName? }`                                                     | Cookie signing secret + optional storage override.                                                                                                                     |
| `migrations?` | `"auto" \| "manual"`                                                                    | `"auto"` (default) migrates lazily; `"manual"` for the DO host.                                                                                                        |
| `isProd?`     | `boolean`                                                                               | Controls `Secure` cookies (default `false`).                                                                                                                           |
| `waitUntil?`  | `(p: Promise<unknown>) => void`                                                         | Host hook for background work.                                                                                                                                         |

### Subpath exports

- `@pkg/blog-engine/migrations` — the journaled `runMigrations(adapter)` runner and
  the ordered `MIGRATIONS` list (also usable to emit `.sql` files for
  `wrangler d1 migrations apply`).
- `@pkg/blog-engine/schema` — the `remix/data-table` `table()` definitions.

## Pattern: Custom post types without schema changes

Owners define post types from `/cms/post-types` (machine name, path, and up to
seven field kinds — `text`, `textarea`, `markdown`, `date`, `url`, `boolean`,
`tags`). The engine derives the metadata codec, the CMS form, validation, and the
public renderer from the definition at runtime, so new types never touch DDL. The
built-in `article` type is protected in the repository layer.

## Pattern: Roles and permissions

The engine ships a fixed permission-key catalog and four built-in roles
(admin/editor/writer/reader). Roles are DB rows bundling permission keys; code
checks permissions, never role names, so owners compose custom roles from
`/cms/roles`. Publishing is a permission (`posts.publish`) enforced server-side, and
the last admin cannot be demoted or deleted.

## Related Packages

- [`@pkg/data-table-d1`](/packages/data-table-d1) — D1 adapter for self-hosting
- [`@pkg/data-table-sqlstorage`](/packages/data-table-sqlstorage) — Durable Object adapter
- [`@pkg/auth`](/packages/auth) — the OIDC client behind the admin panel's login
- [`@pkg/markdown/server`](/packages/markdown) — markdown parsing for post content
- [`@pkg/oidc-provider`](/packages/oidc-provider) — the OIDC provider the SaaS authenticates against

## Tips

1. **URLs derive from the request** — OAuth `redirect_uri`, RSS, sitemap, and
   canonical links all come from `request.url`, so one build serves any hostname and
   custom-domain activation needs no engine reconfiguration.
2. **`remix` is shared with the host** — container/context keys are class-identity
   based, so the engine and its host must resolve the same `remix` copy (Bun
   workspace hoisting makes this true).
3. **Sessions need no KV** — they default to a SQL-backed store over the engine's own
   `sessions` table; inject `session.storage` only if you want KV.
4. **Use `migrations: "manual"` inside a Durable Object** and call `migrate()` in
   `blockConcurrencyWhile` so no request is served against an unmigrated schema.
