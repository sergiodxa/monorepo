# ADR-009: Blog SaaS Platform

## Status

**Implemented (partial)** - 2026-07-04

The blog engine (`@pkg/blog-engine`) is complete for v1 (public site, CMS, roles,
theming, OIDC login), and `apps/blog-saas` is built end-to-end: worker routing, the
Blog Durable Object, control-plane schema/models, dashboard (OIDC login, blog CRUD,
provisioning), and scaffolded services/crons for custom domains and billing. The
external-integration surfaces (Polar webhook signature verification, Cloudflare for
SaaS hostname activation UX) are wired but need real credentials and hardening
before GA. Note: `apps/blog-saas` uses the Laravel-style `templates/app` layout
(bootstrap/, routes/, app/http/…) rather than the `src/`-based layout sketched below,
matching the repo's current app convention. The self-hosted D1 example is documented
in the engine README rather than shipped as a separate app.

## Background

The monorepo contains `apps/r3-blog`, a single-author Remix v3 blog running on Cloudflare Workers behind `r3.sergiodxa.com`. Spinning up another blog today means copying the whole app, provisioning its bindings, and deploying a new worker.

There is an opportunity to build a multi-tenant blog platform — the WordPress.com model — where creating a blog is a dashboard action: an account can own multiple blogs, each blog runs isolated in its own Cloudflare Durable Object with embedded SQLite, gets a default subdomain, can attach a custom domain, and pays through Polar. Critically, the blog application itself must remain completely independent of Durable Objects — the way WordPress core is independent of WordPress.com — so the same blog app can be self-hosted on a plain Worker with D1 (or any Fetch runtime with a SQL database).

## Context

### Current State

`apps/r3-blog` is the architectural blueprint:

| Aspect    | Implementation                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Remix v3 (`remix@3.0.0-beta.4`), `remix/fetch-router`, SSR-only via `remix/ui/server`                                                 |
| Bootstrap | `bootstrap/worker.ts` (Worker entry + service providers) and `bootstrap/app.tsx` (`createApplication(env)` returns a router)          |
| DI        | `@pkg/service-container` per [ADR-008](./ADR-008-service-container-for-remix-v3.md); controllers use `inject([Database] as const, …)` |
| Data      | `remix/data-table` over D1 through a hand-written `D1DataTableAdapter` (`app/infrastructure/database/d1-data-table-adapter.ts`)       |
| Schema    | `posts` (id, author_id, type enum, published_at) + `post_meta` (key-value) + `users`; typed per-type MetaCodecs in repositories       |
| Admin     | `/cms` routes guarded by session auth + admin role; OIDC login against `auth.sergiodxa.com`                                           |
| Styling   | No Tailwind; OKLCH palette + semantic `--ui-*` tokens in `resources/css/colors.css`; `remix/ui` `css()` mixins                        |

`apps/auth-saas` ([ADR-006](./ADR-006-auth-saas-platform.md)) already implements the platform architecture this ADR needs: one Durable Object per tenant with embedded SQLite, Cloudflare for SaaS custom hostnames routed via `request.cf.hostMetadata`, a D1 control plane, Polar billing with meters, Analytics Engine usage tracking, and daily reporting crons. Two pieces of it are directly reusable:

| Prior art                                  | Location                                        |
| ------------------------------------------ | ----------------------------------------------- |
| `SqlStorage` → `remix/data-table` adapter  | `apps/auth-saas/src/lib/sql-storage-adapter.ts` |
| CF for SaaS custom hostname lifecycle      | `apps/auth-saas/src/app/services/hostname.ts`   |
| Polar service + webhook handling           | `apps/auth-saas/src/app/services/polar.ts`      |
| Analytics Engine tracking + reporting cron | `apps/auth-saas/src/app/services/analytics.ts`  |

### Requirements

1. **Platform**: a SaaS on a platform domain (working name `blog.sergiodxa.com`; final product domain TBD) where a user creates an account and creates blogs; an account owns any number of blogs.
2. **Tenant isolation**: each blog is one Durable Object with its own embedded SQLite database.
3. **Engine isolation**: the blog application must not depend on Durable Objects or any Cloudflare-specific API; it must be self-hostable, like WordPress.
4. **Domains**: each blog gets `{slug}.blog.sergiodxa.com` on creation; the owner can attach any custom domain or subdomain via Cloudflare for SaaS; once the custom domain is active the default subdomain stops working (a plain 404, not a redirect — deliberate product decision).
5. **Billing**: Polar subscription per account — a base monthly fee that includes a usage allowance sized for most users, plus metered overage.
6. **Content model**: WordPress-style `posts` + `post_meta` schema, matching r3-blog's approach. Core post columns: `id`, `slug`, `type`, `author_id`, `published_at`, `created_at`, `updated_at`. Everything else is per-type metadata. A built-in `article` type defines title, excerpt, content. Users can define custom post types with their own attribute sets from the admin panel.
7. **Users, roles, and permissions**: every post has an author (`author_id` references `users`). Blogs are multi-user with four built-in roles — admin (at least one must always exist; the first user becomes admin), editor (edit and publish anything, including scheduling), writer (write drafts, cannot publish), reader (no capabilities; the default role for every user after the first). Owners can define custom roles, so roles and their permissions are stored in the database.
8. **Theming**: CSS variables with deliberately few knobs — one spacing variable, one border-radius variable, a handful of colors and typography presets.
9. **Routing**: the Worker detects tenant traffic (custom hostname or subdomain) and forwards to the tenant DO; everything else is the SaaS itself.
10. **Admin split**: each blog's admin panel (CMS) lives inside the DO as part of the engine; the SaaS dashboard manages accounts, blogs, domains, and subscriptions.
11. **Auth**: the platform dashboard authenticates via OIDC against an auth-saas tenant (`sso.blog.sergiodxa.com`). The engine's admin auth is a configurable OIDC client so hosted blogs use the platform IdP and self-hosted blogs can point at any OIDC provider.

### Technology Choices

| Requirement      | Technology                           | Rationale                                                                  |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Tenant isolation | Cloudflare Durable Objects           | Embedded SQLite per instance; true data isolation; proven in ADR-006       |
| Engine isolation | `remix/data-table` `DatabaseAdapter` | The engine sees only the adapter interface; hosts inject D1 or SqlStorage  |
| Custom domains   | Cloudflare for SaaS                  | Managed TLS + custom hostname metadata routing; service already written    |
| Usage tracking   | Cloudflare Analytics Engine          | High-cardinality, cheap writes at the request path                         |
| Billing          | Polar                                | Subscriptions + meters + credits; SDK and webhook handling already in repo |
| Identity         | auth-saas tenant (OIDC)              | Dogfoods ADR-006; one account for dashboard and every blog admin           |
| Email            | (none in this app)                   | Email flows live in auth-saas, which will use Cloudflare Email Sending     |

### Dependencies

| Dependency                                                                 | Status                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| auth-saas deployed with a `sso.blog.sergiodxa.com` tenant                  | Blocking for dashboard login and per-blog admin OIDC clients    |
| auth-saas Management API M2M client for the platform                       | Blocking for automatic per-blog OIDC client provisioning        |
| Remix v3 stable enough for a shared package (`3.0.0-beta.4` today)         | Accepted risk; r3-blog already ships on the beta                |
| Cloudflare for SaaS custom hostname `custom_metadata` availability on plan | Mitigated: unknown-host D1 fallback path works without metadata |

## Decision

Build three things:

1. **`@pkg/blog-engine`** (`packages/blog-engine`) — the complete, host-agnostic blog application: public site, admin CMS, schema, migrations, theming. Zero Cloudflare-specific imports. This is "WordPress core".
2. **Two adapter extractions** — `@pkg/data-table-d1` (from `apps/r3-blog/app/infrastructure/database/d1-data-table-adapter.ts`) and `@pkg/data-table-sqlstorage` (from `apps/auth-saas/src/lib/sql-storage-adapter.ts`), per [ADR-001](./ADR-001-new-package-extraction.md). The engine depends on neither; it only sees `DatabaseAdapter` from `remix/data-table`.
3. **`apps/blog-saas`** — the platform Worker: request routing, tenant Durable Object (a thin wrapper around the engine), control-plane D1, dashboard (Remix v3 + service container), custom domains, billing, usage metering.

### Core Architecture

```
 blog.acme.com                {slug}.blog.sergiodxa.com        blog.sergiodxa.com
 (custom hostname,             (default subdomain,              (platform domain)
  CF for SaaS)                  wildcard route)
      |                              |                                |
      | cf.hostMetadata.blog_id      | slug -> blog id                |
      |                              | (KV cache, D1 fallback)        |
      v                              v                                v
+---------------------------------------------------------+  +------------------+
|                     Worker entry                         |  |  Dashboard       |
|  forwardToBlog(blogId) + page-view metering (AE)         |  |  (Remix v3,      |
+---------------------------------------------------------+  |  service         |
      |                                                       |  container)      |
      v                                                       |                  |
+------------------+     +------------------+                 |  - accounts      |
|  Blog DO (uuid)  |     |  Blog DO (uuid)  |   ...           |  - blogs CRUD    |
|  ~150-line       |     |                  |                 |  - domains       |
|  wrapper         |     |                  |                 |  - billing       |
|                  |     |                  |                 +------------------+
|  @pkg/blog-engine|     |  @pkg/blog-engine|                        |
|  + SqlStorage    |     |  + SqlStorage    |                 +------------------+
|    adapter       |     |    adapter       |                 |  Control plane   |
+------------------+     +------------------+                 |  D1 + KV + AE    |
                                                               +------------------+

 Self-hosted (no platform involved):

+------------------+
|  Plain Worker    |
|  @pkg/blog-engine|
|  + D1 adapter    |
+------------------+
```

### Key Design Decisions

| Decision              | Choice                                                                                 | Rationale                                                                          |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Engine packaging      | Workspace package `@pkg/blog-engine`                                                   | One engine version fleet-wide; self-hosted and SaaS consume the same code          |
| Engine/host boundary  | Config object (`createBlogEngine(config)`)                                             | Container stays internal; adapters injected; "wp-config.php" analogy               |
| DO identifier         | Blog UUID (`env.BLOG.getByName(blogId)`)                                               | Hostname and slug changes never require data migration (ADR-006 parity)            |
| Subdomain routing     | KV cache in front of D1 slug lookup                                                    | Slug→id is immutable; avoids a D1 round trip per request                           |
| Tenant config         | Pushed into DO SQLite (`platform_meta`) via RPC                                        | DO never reads D1 at request time; no staleness window                             |
| State enforcement     | Inside the DO, from its own meta                                                       | Worker resolves identity only; identical enforcement for all hostnames             |
| Subscription scope    | Per account, pooled allowance                                                          | Requirement: many blogs per account under one base fee                             |
| Metered event         | Billable page views                                                                    | See Billing section                                                                |
| Post schema           | `posts` core: id, slug, type, author_id, published_at, timestamps; rest in `post_meta` | User decision; publish semantics and authorship uniform across all types           |
| Publish states        | `published_at`: NULL = draft, past = published, future = scheduled                     | One column, three states; drafts are required by the writer role                   |
| Custom post types     | `post_types` table with JSON field definitions                                         | Runtime-defined types drive forms, validation, rendering, feeds                    |
| Roles and permissions | `roles` table with JSON permission-key arrays; four built-ins + custom roles           | Runtime-defined like post types; code checks permissions, never role names         |
| Theming               | ~9 theme knobs derived into r3-blog's semantic tokens                                  | Few variables by requirement; components stay on `--ui-*` tokens                   |
| Platform auth         | OIDC RP against `sso.blog.sergiodxa.com`                                               | Dogfoods auth-saas; r3-blog's login flow ports directly                            |
| Engine admin auth     | Configurable OIDC client per blog                                                      | Hosted blogs get a provisioned client on the platform IdP; self-hosted use any IdP |

---

## Part 1: The Blog Engine (`@pkg/blog-engine`)

### Package Structure

```
packages/blog-engine/
|-- package.json
|-- tsconfig.json                    # extends ../../tsconfig.json
|-- README.md
+-- src/
    |-- index.ts                     # createBlogEngine + config types (only public entry)
    |-- engine.ts                    # container bootstrap + router assembly
    |-- routes.ts                    # route map (fetch-router route helpers)
    |-- http/
    |   |-- context.ts               # BlogContext type (explicit generic, see Notes)
    |   |-- middleware/              # session, auth, require-permission, no-trailing-slash
    |   |-- controllers/             # public/, cms/, auth.tsx, rss.tsx, sitemap.tsx, assets.ts
    |   +-- view-models/
    |-- domain/
    |   |-- post.ts                  # generalized Post repository (from r3-blog post.ts)
    |   |-- post-meta.ts
    |   |-- post-type.ts             # PostType repository + FieldDefinition
    |   |-- article.ts               # typed built-in article repository
    |   |-- meta-codec.ts            # createMetaCodec(definition) - runtime codec factory
    |   |-- settings.ts              # settings repository + typed accessors
    |   |-- permissions.ts           # permission-key catalog + hasPermissions()
    |   |-- role.ts                  # Role repository (builtin protection, custom roles)
    |   +-- user.ts
    |-- database/
    |   |-- schema/                  # remix/data-table table() definitions
    |   |-- migrations.ts            # programmatic migration registry (SQL as TS strings)
    |   +-- sql-session-storage.ts   # SessionStorage impl over the engine's own DB
    |-- theme/
    |   |-- theme.ts                 # ThemeSettings + renderThemeStyle()
    |   +-- presets.ts               # font stacks, radius/spacing scales
    |-- views/                       # SSR views: public/, cms/, auth/
    |-- components/                  # layout, input, button, select (ported from r3-blog)
    +-- assets/
        +-- prism-css.ts             # static CSS as string constants (self-served)
```

Exports map and dependencies:

```json
{
	"name": "@pkg/blog-engine",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts",
		"./migrations": "./src/database/migrations.ts",
		"./schema": "./src/database/schema/index.ts"
	},
	"dependencies": {
		"@pkg/http": "workspace:*",
		"@pkg/logger": "workspace:*",
		"@pkg/markdown": "workspace:*",
		"@pkg/result": "workspace:*",
		"@pkg/rss": "workspace:*",
		"@pkg/service-container": "workspace:*",
		"@pkg/sitemap": "workspace:*",
		"@pkg/validate": "workspace:*"
	},
	"peerDependencies": {
		"remix": "3.0.0-beta.4"
	}
}
```

`remix` is a **peer dependency** on purpose: the engine and its host must share one copy of `remix/fetch-router`, `remix/data-table`, and `remix/session`, because container keys and context keys are class-identity-based (`container.get(Database)` only resolves when both sides load the same `Database` class). Bun workspace hoisting makes this true implicitly; the peer dependency makes it a contract.

Schema validation uses `remix/data-schema` (riding the same `remix` peer dependency) rather than a third-party library — the same choice r3-blog's CMS schemas already made (`apps/r3-blog/app/schemas/`).

### Public API

The boundary follows the WordPress split: environment and secret material is injected by the host ("wp-config.php"); everything a blog owner edits lives in the blog's own database ("wp_options").

| Injected by host                                     | Stored in the blog's DB            |
| ---------------------------------------------------- | ---------------------------------- |
| `DatabaseAdapter`                                    | site title, description, language  |
| OIDC issuer + client id/secret (+ optional metadata) | theme settings (all CSS variables) |
| session cookie secret                                | post types + field definitions     |
| logger, `waitUntil`, `isProd`                        | posts, post_meta, users/roles      |
| optional `SessionStorage` override                   | custom CSS                         |

```typescript
// packages/blog-engine/src/index.ts
import type { DatabaseAdapter } from "remix/data-table";
import type { SessionStorage } from "remix/session";
import type { Logger } from "@pkg/logger";

/** OIDC provider endpoints, mirroring remix/auth's createOIDCAuthProvider metadata. */
export interface OIDCMetadata {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint?: string;
	jwks_uri: string;
	end_session_endpoint?: string;
}

export interface BlogEngineConfig {
	/** SQL access. Self-hosted: @pkg/data-table-d1. DO host: @pkg/data-table-sqlstorage. */
	database: DatabaseAdapter;

	/** OIDC relying-party configuration for the admin panel. */
	auth: {
		issuer: string;
		clientId: string;
		clientSecret: string;
		/**
		 * Static endpoints; when omitted the engine discovers
		 * `${issuer}/.well-known/openid-configuration` once per isolate and caches it.
		 */
		metadata?: OIDCMetadata;
		scopes?: string[]; // default ["openid", "profile", "email"]
		/** Emails or subject ids always mapped to role=admin on login (platform bootstrap). */
		admins?: string[];
	};

	session: {
		/** Cookie signing secret. Never persisted by the engine. */
		secret: string;
		/**
		 * Default: engine-owned SqlSessionStorage over the `sessions` table.
		 * Hosts may inject KV-backed storage instead.
		 */
		storage?: SessionStorage;
		cookieName?: string; // default "blog:session"
	};

	/**
	 * "auto" (default): run pending migrations lazily before the first request.
	 * "manual": host calls engine.migrate() itself (DO host, in blockConcurrencyWhile).
	 */
	migrations?: "auto" | "manual";

	/** Controls Secure cookies. Default: hostname heuristic (r3-blog resolveIsProd). */
	isProd?: boolean;

	logger?: Logger;
	waitUntil?: (promise: Promise<unknown>) => void;
}

export interface BlogEngine {
	/** Handles every request for one blog. Pure Fetch: Workers, DOs, Bun, Node. */
	fetch(request: Request): Promise<Response>;
	/** Applies pending engine-owned migrations. Idempotent (journaled). */
	migrate(): Promise<{ applied: string[] }>;
}

export function createBlogEngine(config: BlogEngineConfig): BlogEngine;
```

Key API decisions:

- **Adapter, not `Database` instance**: the engine needs the raw adapter twice — `createDatabase(adapter)` for queries and `createMigrationRunner(adapter, registry)` for migrations. A `Database` does not expose its adapter.
- **No `baseUrl` config**: all absolute URLs (OAuth `redirect_uri`, RSS, sitemap, canonical links) derive from `ctx.request.url` per request, exactly as r3-blog already does. This is what lets one engine build serve any tenant hostname, and what makes custom-domain activation a zero-config event from the engine's perspective.
- **The service container is engine-internal**: `createBlogEngine` builds a private `ServiceContainer` (ADR-008), registers providers derived from the config, and wraps each request in `container.scope()`. Controllers keep the r3-blog idiom `inject([Database] as const, …)`. Hosts never see the container — the config object is the entire public boundary.

```typescript
// packages/blog-engine/src/engine.ts (sketch)
export function createBlogEngine(config: BlogEngineConfig): BlogEngine {
	let container = new ServiceContainer();
	let providers: ServiceProvider[] = [
		{ register: (c) => c.instance(BlogConfig, new BlogConfig(config)) },
		{ register: (c) => c.singleton(Database, () => createDatabase(config.database)) },
		new LoggerProvider(config.logger),
		new OAuthProviderProvider(config.auth), // discovery cached per isolate
		new SettingsProvider(), // scoped: settings read once per request
	];
	for (let provider of providers) provider.register(container);

	let router = createBlogRouter(); // middleware stack adapted from apps/r3-blog/bootstrap/app.tsx
	let migrated: Promise<{ applied: string[] }> | null = null;

	async function migrate() {
		let runner = createMigrationRunner(config.database, migrationRegistry, {
			journalTable: "blog_engine_migrations",
		});
		let result = await runner.up();
		return { applied: result.applied.map((entry) => entry.id) };
	}

	return {
		migrate,
		fetch(request) {
			return container.scope(async () => {
				if (config.migrations !== "manual") await (migrated ??= migrate());
				return router.fetch(request);
			});
		},
	};
}
```

### Self-Hosted Bootstrap (the "WordPress on your own server" case)

```typescript
// bootstrap/worker.ts of a self-hosted blog (candidate for templates/)
import { createBlogEngine, type BlogEngine } from "@pkg/blog-engine";
import { createD1DataTableAdapter } from "@pkg/data-table-d1";

let engine: BlogEngine | null = null;

export default {
	async fetch(request, env, ctx) {
		engine ??= createBlogEngine({
			database: createD1DataTableAdapter(env.DB),
			auth: {
				issuer: env.OIDC_ISSUER, // any IdP: auth.sergiodxa.com, Auth0, Keycloak...
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

The DO host (Part 2) differs only in the adapter (`createSQLStorageDatabaseAdapter(this.ctx.storage.sql)`), `migrations: "manual"` run inside `blockConcurrencyWhile`, and config values sourced from the control plane. The engine cannot tell the difference.

### Database Schema

```sql
CREATE TABLE posts (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL,
	type TEXT NOT NULL,
	author_id TEXT NOT NULL REFERENCES users (id),  -- no cascade: deleting a user requires reassigning posts first
	published_at TEXT,               -- NULL = draft; past = published; future = scheduled
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_posts_type_slug ON posts (type, slug);
CREATE INDEX idx_posts_type_published_at ON posts (type, published_at);
CREATE INDEX idx_posts_author_id ON posts (author_id);

CREATE TABLE post_meta (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
	key TEXT NOT NULL,
	value TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_post_meta_post_id_key ON post_meta (post_id, key);

CREATE TABLE post_types (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,              -- machine name, singular: "article" (== posts.type)
	path TEXT NOT NULL,              -- public URL segment, plural: "articles"
	label TEXT NOT NULL,             -- display label: "Articles"
	description TEXT NOT NULL DEFAULT '',
	fields TEXT NOT NULL,            -- JSON array of FieldDefinition
	builtin INTEGER NOT NULL DEFAULT 0,
	visible INTEGER NOT NULL DEFAULT 1,  -- participates in public routes/feed/rss/sitemap
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_post_types_name ON post_types (name);
CREATE UNIQUE INDEX idx_post_types_path ON post_types (path);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,            -- "site_title", "site_description", "theme", "custom_css"
	value TEXT NOT NULL,             -- JSON-encoded
	updated_at TEXT NOT NULL
);

CREATE TABLE roles (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,              -- machine name: "admin", "editor", "writer", "reader", or custom
	label TEXT NOT NULL,             -- display label: "Administrator"
	description TEXT NOT NULL DEFAULT '',
	permissions TEXT NOT NULL,       -- JSON array of permission keys from the engine catalog
	builtin INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_roles_name ON roles (name);

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	subject_id TEXT,                 -- OIDC sub; nullable pre-link
	email TEXT NOT NULL,
	role_id TEXT NOT NULL REFERENCES roles (id),
	username TEXT NOT NULL DEFAULT '',
	display_name TEXT NOT NULL DEFAULT '',
	avatar TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_users_subject_id ON users (subject_id);
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role_id ON users (role_id);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	data TEXT NOT NULL,              -- JSON payload (userId, idToken, auth transaction)
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
```

Seed migration:

```sql
INSERT INTO post_types (id, name, path, label, description, fields, builtin, visible, created_at, updated_at)
VALUES (
	'pt_article', 'article', 'articles', 'Articles', 'Long-form posts.',
	'[{"key":"excerpt","label":"Excerpt","kind":"textarea","required":false},
	  {"key":"content","label":"Content","kind":"markdown","required":true}]',
	1, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
);
INSERT INTO roles (id, name, label, description, permissions, builtin, created_at, updated_at) VALUES
	('role_admin', 'admin', 'Administrator', 'Full control over content, users, and settings.',
	 '["posts.create","posts.edit_own","posts.edit_any","posts.delete_own","posts.delete_any","posts.publish","post_types.manage","settings.manage","appearance.manage","users.manage","roles.manage"]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('role_editor', 'editor', 'Editor', 'Can edit and publish any post, including scheduling.',
	 '["posts.create","posts.edit_own","posts.edit_any","posts.delete_own","posts.delete_any","posts.publish"]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('role_writer', 'writer', 'Writer', 'Can write and edit own drafts, but not publish.',
	 '["posts.create","posts.edit_own","posts.delete_own"]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('role_reader', 'reader', 'Reader', 'No capabilities. Default role for new users.',
	 '[]',
	 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT INTO settings (key, value, updated_at) VALUES
	('site_title', '"My Blog"', strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	('theme', '{}', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
```

Deliberate deviations from r3-blog's schema (all conscious decisions, not omissions):

| Deviation                           | r3-blog today                                                | Engine                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `slug` is a core column             | slug lives in `post_meta`; lookup needs collision resolution | `UNIQUE(type, slug)`; lookup is one indexed query                                                         |
| `published_at` NULL means draft     | NULL means published (legacy backward compatibility)         | Three states: NULL = draft, past = published, future = scheduled — drafts are required by the writer role |
| `author_id` has no delete cascade   | `ON DELETE CASCADE`                                          | Deleting a user requires reassigning or deleting their posts first (WordPress-style prompt)               |
| `posts.type` is plain TEXT          | `c.enum(["like","tutorial","article","comment","glossary"])` | Types are runtime-defined; validity enforced against `post_types`                                         |
| `users.role_id` references `roles`  | `role` is a `c.enum(["guest","admin"])` column               | Roles are runtime-defined rows with permission sets                                                       |
| `UNIQUE(post_id, key)` on post_meta | Duplicate keys tolerated; codec resolves latest-wins         | Upserts; the ambiguity class is deleted                                                                   |
| Sessions in SQL, not KV             | `KVSessionStorage`                                           | The engine's only hard dependency stays one SQL database                                                  |

Publish semantics: `published_at` NULL means draft (visible only in the CMS), a past date means published, a future date means scheduled (public at that time; previewable in the CMS). This deliberately breaks with r3-blog, where NULL means published for legacy reasons — a fresh engine with a writer role needs a real draft state.

The local `users` table is kept despite OIDC auth (same conclusion r3-blog reached): it provides role mapping for CMS permissions, a stable local id for sessions and `author_id`, and byline data. Role assignment: the first login while the table has no admin becomes admin (WordPress-install semantics); `config.auth.admins` acts as an allowlist override (used by the platform to pre-authorize the blog owner); everyone else lands as `reader`.

### Migrations

Migrations are engine-owned SQL strings registered in a programmatic registry (`createMigrationRegistry()` from `remix/data-table`), because a Durable Object has no filesystem:

```typescript
// packages/blog-engine/src/database/migrations.ts
import { createMigrationRegistry } from "remix/data-table/migrations";

export const migrationRegistry = createMigrationRegistry();

migrationRegistry.register({
	id: "20260701000000",
	name: "create_engine_tables",
	up: /* sql */ `CREATE TABLE posts (...); CREATE TABLE post_meta (...); ...`,
});
migrationRegistry.register({
	id: "20260701000001",
	name: "seed_defaults",
	up: /* sql */ `INSERT INTO post_types ...`,
});
```

Two consumption modes:

1. **Runtime (default)**: `engine.migrate()` runs the registry through `createMigrationRunner`, journaled in `blog_engine_migrations`, so `migrations: "auto"` is safe on every cold start.
2. **wrangler-style**: a script emits the registry entries as `.sql` files in wrangler's migrations format for self-hosters who prefer `wrangler d1 migrations apply`. The TypeScript registry stays the single source of truth.

### Custom Post Types

Field definitions are deliberately minimal — seven input kinds, no nesting, no repeaters, no relational fields:

```typescript
// packages/blog-engine/src/domain/post-type.ts
export type FieldKind = "text" | "textarea" | "markdown" | "date" | "url" | "boolean" | "tags";

export interface FieldDefinition {
	key: string; // ^[a-z][a-z0-9_]*$, unique per type, not in RESERVED_FIELD_KEYS
	label: string;
	kind: FieldKind;
	required: boolean;
	description?: string; // help text rendered under the input
}

/** Core columns + implicit fields that user definitions may not shadow. */
export const RESERVED_FIELD_KEYS = new Set([
	"id",
	"slug",
	"type",
	"author_id",
	"title",
	"published_at",
	"created_at",
	"updated_at",
]);
```

Every post type has an implicit required `title` text field (stored in `post_meta` like any other meta) so list views, RSS, and the sitemap always have something to show without inspecting definitions. Storage encodings on `post_meta.value` (TEXT): text/textarea/markdown/url/date raw; boolean `"1"`/`"0"`; tags as a JSON string array.

**The MetaCodec generalizes from compile time to runtime.** r3-blog hand-writes one codec per post type; the engine derives codecs from definitions:

```typescript
// packages/blog-engine/src/domain/meta-codec.ts
export function createMetaCodec(definition: PostTypeDefinition): Post.MetaCodec<PostMetaValues> {
	return {
		serialize(meta) {
			let rows = meta.title !== undefined ? [{ key: "title", value: meta.title }] : [];
			for (let field of definition.fields) {
				let value = meta[field.key];
				if (value === undefined) continue;
				rows.push({ key: field.key, value: encodeFieldValue(field.kind, value) });
			}
			return rows;
		},
		deserialize(rows) {
			let byKey = new Map(rows.map((row) => [row.key, row.value]));
			let meta: PostMetaValues = { title: byKey.get("title") ?? "" };
			for (let field of definition.fields) {
				let raw = byKey.get(field.key);
				if (raw !== undefined) meta[field.key] = decodeFieldValue(field.kind, raw);
			}
			return meta;
		},
	};
}
```

The generic `Post` repository ports from `apps/r3-blog/app/repositories/post.ts` nearly verbatim (including its joined-rows batching and `author_id` handling), minus the slug-in-meta logic (slug is a core column now). The built-in `article` type additionally gets a typed wrapper (`interface ArticleMeta { title: string; excerpt?: string; content: string }`) around `createMetaCodec(ARTICLE_DEFINITION)`, with a unit test asserting the interface matches the seeded definition.

**Admin forms are generated from definitions** — one CMS post form for all types, with inputs namespaced `meta_<key>` so user-defined keys can never collide with core inputs (`title`, `slug`, `published_at`). **Validation schemas are generated with `remix/data-schema`** — built dynamically from field definitions using the same library r3-blog's CMS schemas already use (`apps/r3-blog/app/schemas/cms/`) — and run through `@pkg/validate`, whose Standard Schema interface accepts `FormData` directly:

```typescript
// packages/blog-engine/src/domain/post-form-schema.ts
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { maxLength, url } from "remix/data-schema/checks";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Maps a field definition to the schema validating its form input. */
function fieldSchema(field: FieldDefinition) {
	let base = {
		text: s.string().pipe(maxLength(500)),
		textarea: s.string(),
		markdown: s.string(),
		date: s.string().refine((value) => !Number.isNaN(Date.parse(value)), "Expected a valid date"),
		url: s.string().pipe(url()),
		boolean: s.defaulted(s.string(), "").transform((value) => value === "on"), // HTML checkbox
		tags: s.string().transform((value) =>
			value
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	}[field.kind];
	return field.required && field.kind !== "boolean" ? base : s.optional(base);
}

export function buildPostFormSchema(definition: PostTypeDefinition) {
	let shape = {
		title: f.field(s.string().refine((value) => value.trim().length > 0, "Title is required")),
		// Derived from title when absent.
		slug: f.field(
			s.optional(s.string().refine((value) => SLUG_PATTERN.test(value), "Invalid slug")),
		),
		published_at: f.field(
			s.optional(s.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")),
		),
	};
	for (let field of definition.fields) shape[`meta_${field.key}`] = f.field(fieldSchema(field));
	return f.object(shape);
}
```

The post-type editor itself is validated the same way with a static `data-schema` schema for `{ name, path, label, description, fields[] }`, plus the extra rules from this section (slug-shaped `name`/`path`, reserved-path and reserved-key checks, unique field keys).

**Public rendering is definition-driven, not template-per-type.** One `GenericPostView` pair renders every visible type; `article` goes through the same machinery (it is special only at the repository level, never at render time):

- List (`/:typePath`): title + published date + excerpt (the first `textarea`/`text` field value in definition order, if any).
- Detail (`/:typePath/:slug`): title, date, then each defined field through a field-kind renderer (markdown via `@pkg/markdown/server` — repo rule: never bypass it; url as link; tags as pills; boolean as badge; date as `<time>`; text as paragraph).

**RSS and sitemap participation** is driven by `post_types.visible`: `/rss.xml` aggregates all published posts of all visible types (r3-blog's `Feed` repository, generalized to iterate visible types instead of hardcoding four); `/:typePath.rss` is the per-type feed; `/sitemap.xml` lists home, each visible type index, and each published post, via `@pkg/rss` and `@pkg/sitemap`.

**The built-in `article` type is protected** in the repository layer (not just the UI): it cannot be deleted; `name` cannot change (it is the referential link to `posts.type`); its seeded fields cannot be removed or re-kinded; new fields may be appended (additive evolution is safe because codecs skip unknown keys). Deleting a non-builtin type with existing posts requires explicit confirmation and cascades post deletion.

### Users, Roles, and Permissions

The same philosophy as custom post types applies to roles: the engine defines a fixed catalog of **permission keys** (capabilities), and roles are database rows that bundle keys. Code checks permissions, never role names — a role is nothing more than a named permission set (the WordPress roles/capabilities model). This is what makes owner-defined custom roles possible without touching code.

Permission catalog (engine-defined, append-only):

| Permission          | Grants                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `posts.create`      | Create drafts of any visible post type                            |
| `posts.edit_own`    | Edit posts where `author_id` is the current user                  |
| `posts.edit_any`    | Edit any post, including reassigning its author                   |
| `posts.delete_own`  | Delete own posts                                                  |
| `posts.delete_any`  | Delete any post                                                   |
| `posts.publish`     | Set or change `published_at`: publish now, schedule, or unpublish |
| `post_types.manage` | Create, edit, and delete custom post types                        |
| `settings.manage`   | Edit site settings (title, description, language)                 |
| `appearance.manage` | Edit theme variables and custom CSS                               |
| `users.manage`      | Assign roles to users, delete users                               |
| `roles.manage`      | Create, edit, and delete custom roles                             |

Built-in roles (seeded by migration, `builtin = 1`):

| Role     | Permissions                                          | Notes                                                                                |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `admin`  | All                                                  | At least one admin user must always exist                                            |
| `editor` | All `posts.*` including `posts.publish`              | Can edit, publish, schedule, and delete anything; no site/user management            |
| `writer` | `posts.create`, `posts.edit_own`, `posts.delete_own` | Writes and edits own drafts; cannot publish or schedule                              |
| `reader` | None                                                 | Default role for every user after the first; reserved for future membership features |

Assignment and invariants (enforced in the repository layer, not just the UI):

- Each user has exactly one role (`users.role_id`).
- The first user to log in while the blog has no admin becomes `admin` (WordPress-install semantics); the `config.auth.admins` allowlist also maps to `admin` (how the platform pre-authorizes the blog owner); everyone else starts as `reader`.
- **Last-admin invariant**: the last user holding a role with `users.manage` + `roles.manage` (in practice, the last admin) cannot be demoted or deleted.
- Built-in roles cannot be deleted and their permission sets cannot be edited (labels/descriptions can). Custom roles are freely created from the permission catalog (a checkbox list in `/cms/roles`); deleting a custom role requires reassigning its users first.
- Unknown permission keys stored on a role are ignored at check time, so the catalog can grow in future engine versions without breaking existing custom roles.

Enforcement replaces r3-blog's single admin gate with a permission helper used as controller middleware and inside repositories:

```typescript
// packages/blog-engine/src/http/middleware/require-permission.ts (sketch)
export function requirePermission(...keys: Permission[]): Middleware {
	return async (ctx, next) => {
		let user = getAuthUser();
		if (!user) return redirect(routes.auth.login.index.href());
		if (!(await hasPermissions(user, keys))) return forbidden();
		return next();
	};
}
```

- Entering `/cms` requires being authenticated; users whose role grants no permissions (readers) get a "no access — ask an administrator for a role" page.
- Own-vs-any checks happen in the post repository: `posts.edit_own` compares `author_id` to the current user; `posts.edit_any` bypasses the comparison.
- **Publishing is a permission, not a form field**: the post form hides publish/schedule controls without `posts.publish`, and the action validates server-side — a writer's submission can never set or change `published_at`. Writers save drafts; editors and admins find them in the CMS post list (filterable by state and author) and publish or schedule them. `author_id` defaults to the creator; users with `posts.edit_any` may reassign it.
- Deleting a user requires choosing what happens to their posts — reassign to another user or delete them (the `author_id` foreign key has no cascade, so the database enforces that this decision is made).

CMS additions for this system: `/cms/users` (list users, change role, delete with post reassignment) and `/cms/roles` (list, create, edit, delete custom roles). There is no invite flow in the engine — users exist in the IdP; whoever logs in via OIDC gets a local user row with the `reader` role until an admin promotes them.

### Route Map

```typescript
// packages/blog-engine/src/routes.ts
import { form, get, resources, route } from "remix/fetch-router/routes";

export const routes = route({
	feed: get("/"),

	sitemap: get("/sitemap.xml"),
	robots: get("/robots.txt"),
	rss: get("/rss.xml"),
	typeRss: get("/:typePath.rss"),

	assets: get("/assets/:file"),

	auth: route({
		login: form("/auth/login"),
		logout: form("/auth/logout"),
		callback: get("/auth/callback"),
	}),

	cms: route("/cms", {
		dashboard: get("/"),
		posts: resources("/types/:typeName/posts", { exclude: ["show"] }),
		postTypes: resources("/post-types", { exclude: ["show"] }),
		users: resources("/users", { only: ["index", "edit", "update", "destroy"] }),
		roles: resources("/roles", { exclude: ["show"] }),
		settings: form("/settings"),
		appearance: form("/appearance"),
	}),

	// Dynamic public routes registered last so fixed routes win.
	typeIndex: get("/:typePath"),
	post: get("/:typePath/:slug"),
});
```

- Posts CRUD is **one controller for all types**: the `:typeName` param loads the definition, which drives the form, schema, and codec. This replaces r3-blog's five parallel CMS controllers with one.
- `/:typePath` resolves against `post_types.path WHERE visible=1`; no match falls through to the 404 view. Reserved segments (`cms`, `auth`, `assets`, `rss.xml`, `sitemap.xml`, `robots.txt`) are rejected at post-type creation and treated as an append-only compatibility surface.
- The `/cms` guard keeps r3-blog's redirect-to-login middleware, but the `requireAdmin` half becomes `requirePermission(...)` per route group: posts CRUD needs `posts.create`/`posts.edit_*`, post-types needs `post_types.manage`, users/roles need `users.manage`/`roles.manage`, settings and appearance need their respective permissions. Authenticated users with no permissions (readers) get a "no access" page.
- `/cms/users` has no `new`/`create` actions: users come into existence by logging in through OIDC, never by admin creation.
- The engine assumes it owns the origin root (like WordPress); subdirectory mounting is out of scope for v1.
- The OIDC flow ports from r3-blog with its three hardcodings parameterized (issuer metadata, token endpoint, logout URL — today they are fixed to `auth.sergiodxa.com` in `app/auth/services/oauth.ts` and `app/http/controllers/auth.tsx`). The flow logic itself (PKCE transaction, state checks, ID-token verification against JWKS, user upsert) is reused as-is.

### Theming

Nine knobs, edited in `/cms/appearance`, stored in the `settings` row `theme`:

```typescript
// packages/blog-engine/src/theme/theme.ts
export interface ThemeSettings {
	accent: string; // --blog-accent  (color input; converted to oklch)
	background: string; // --blog-bg
	foreground: string; // --blog-fg
	radius: "square" | "soft" | "rounded" | "round"; // --blog-radius: 0 | .375rem | .75rem | 1.25rem
	spacing: "compact" | "comfortable" | "spacious"; // --blog-spacing: .75rem | 1rem | 1.25rem
	fontHeading: FontPreset; // --blog-font-heading (system stacks: serif|sans|mono|slab)
	fontBody: FontPreset; // --blog-font-body
	fontSize: "small" | "medium" | "large"; // --blog-font-size: .9375rem | 1rem | 1.125rem
	measure?: string; // --blog-measure, default "65ch"
}
```

There is exactly **one spacing variable** and **one radius variable**, per requirement: every component padding/margin/gap is `calc(var(--blog-spacing) * k)` and every corner is `var(--blog-radius)` (or a multiple). "Squircle" folds into the `round` preset for now; `corner-shape: squircle` can be layered in later behind `@supports` as a pure CSS enhancement.

The knobs sit **above** r3-blog's proven two-layer token system rather than replacing it:

```
--blog-accent / --blog-bg / --blog-fg            (3 user inputs)
        |  TS derivation at render time (oklch lightness ladder,
        |  hue/chroma held from the input colors)
        v
--color-accent-50...950, --color-neutral-50...950  (generated palette stops)
        v  (same static mapping as r3-blog colors.css)
--ui-accent-*, --ui-neutral-*                      (semantic tokens; components unchanged)
```

Derivation happens in TypeScript (`renderThemeStyle(theme): string`) — a pure, bun:test-testable function that parses the inputs to OKLCH, holds hue/chroma, and maps lightness onto the ladder `colors.css` uses today. The output is a complete `:root { … }` block injected as a `<style>` element in the layout head. No static `colors.css` ships at all; the stylesheet becomes a runtime artifact of settings.

**Custom CSS escape hatch: included** (settings key `custom_css`). It is the WordPress "Additional CSS" pressure valve that prevents endless knob-creep — exactly what a deliberately-few-knobs design needs. Guardrails: admin-only, 32KB cap, `</style` sequences escaped, emitted unlayered after the theme block so it outranks the `rmx` layer that `remix/ui` `css()` emits into.

### Assets and Rendering

**SSR-only, zero client JavaScript in v1.** This is the engine's superpower for host-agnosticism:

- All component styling is `remix/ui` `css()` mixins generated at render time — no static component stylesheet exists (this matches r3-blog, whose only static CSS files are `colors.css` and `prism.css`).
- Theme tokens are a runtime `<style>` block (above).
- The one remaining static asset — Prism syntax-highlighting CSS for markdown code blocks — ships as a **TypeScript string constant** served by an engine route (`/assets/:file`) with a content-hash `?v=` param for immutable caching. The engine fingerprints its own assets; hosts need no build-pipeline cooperation.

`remix/assets` was evaluated and rejected for production use here: it is a Node filesystem-based on-demand compiler, unusable inside a Worker or DO at request time. Requiring hosts to copy files out of `node_modules` into their own assets pipeline is exactly the coupling the engine must avoid.

CMS editing works without JavaScript (markdown fields are textareas, as in r3-blog's CMS today). A future enhanced editor is one more self-served JS string asset progressively enhancing the textarea.

### Engine v1 Feature Set

| In v1                                                                       | Explicitly not in v1                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Public feed, per-type list/detail, RSS (global + per type), sitemap, robots | Media uploads / file storage (future `fileStorage?` config)                                                  |
| Admin dashboard, posts CRUD for every type, post-types CRUD                 | Comments, search, webmentions/webfinger                                                                      |
| Multi-user roles/permissions, users + custom roles management, bylines      | Review workflow (submission queues, notifications) — writers save drafts, editors find them in the post list |
| Settings (title/description/language), appearance (theme + custom CSS)      | Redirects manager, importers, per-type template overrides                                                    |
| OIDC admin login, first-admin bootstrap, auto-migrations                    | Client-side editor, i18n of the admin UI                                                                     |
| LIMIT/OFFSET pagination                                                     |                                                                                                              |

r3-blog features that stay personal and do not port: profile config, webfinger/avatar, sponsor page, bookmarks/glossary/tutorials/likes as built-ins (they become just post type definitions a user could recreate), KV redirects manager, `/colors` page, R2 backups.

---

## Part 2: The Platform (`apps/blog-saas`)

### App Structure

Named `apps/blog-saas` (`@apps/blog-saas`), following the `auth-saas` convention — the `r3-` prefix marks Remix v3 rewrites of pre-existing apps, which this is not. The layout mirrors the shipped auth-saas code (`src/`-based):

```
apps/blog-saas/
|-- src/
|   |-- entry.worker.ts            # fetch + scheduled entry (routing, metering, crons)
|   |-- env.d.ts
|   |-- app/                       # Control plane dashboard (Remix v3 fetch-router)
|   |   |-- router.ts              # createRouter + middleware tree
|   |   |-- routes.ts
|   |   |-- controllers/
|   |   |   |-- index.tsx          # marketing landing
|   |   |   |-- health.ts
|   |   |   |-- auth/              # OIDC login/callback/logout vs sso.blog.sergiodxa.com
|   |   |   |-- dashboard/
|   |   |   |   |-- index.tsx      # blog list
|   |   |   |   |-- blogs.ts       # resources controller (new/create/show/edit/update/destroy)
|   |   |   |   |-- blogs/domain.ts    # custom domain form
|   |   |   |   |-- blogs/usage.ts     # per-blog usage view
|   |   |   |   +-- billing.ts     # account-level billing (portal link, checkout)
|   |   |   +-- api/webhooks/polar.ts
|   |   |-- middleware/            # session, csrf, account, blogOwner, subscription
|   |   |-- models/                # Account, Blog, Hostname, Subscription, UsageDaily
|   |   |-- services/              # hostname.ts, polar.ts, analytics.ts, blog-provisioner.ts
|   |   |-- jobs/                  # report-usage.ts, purge-deleted-blogs.ts, poll-hostnames.ts
|   |   +-- migrations/            # D1 SQL migrations
|   |-- tenant/
|   |   +-- index.ts               # Blog DO class (~150-line wrapper around @pkg/blog-engine)
|   +-- lib/                       # rate-limit, form helpers (ported from auth-saas)
|-- wrangler.jsonc
|-- vite.config.ts
|-- package.json
+-- AGENTS.md
```

Deliberate differences from auth-saas:

| Aspect             | auth-saas                                     | blog-saas                               | Why                                                          |
| ------------------ | --------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `src/tenant/` size | Full OIDC provider (controllers, models, ...) | Thin DO wrapper                         | The engine lives in `@pkg/blog-engine`                       |
| Platform auth      | WebAuthn proxy against a "platform" DO        | Standard OIDC RP against the sso tenant | Reuse r3-blog's proven login flow; no special-case DO        |
| "platform" DO      | Yes (dogfooding)                              | None                                    | Dashboard auth is external; owner blogs are ordinary tenants |
| Subscription scope | Per tenant                                    | Per **account**                         | Base fee covers N blogs with pooled allowance                |
| DI                 | Context middleware only                       | `@pkg/service-container` per ADR-008    | ADR-008 is the going-forward pattern                         |

### Worker Entry Routing

Hostname classes:

| Host                            | Detection                                       | Target                                  |
| ------------------------------- | ----------------------------------------------- | --------------------------------------- |
| `blog.sergiodxa.com`            | `hostname === env.PLATFORM_DOMAIN`              | Assets, then dashboard/marketing router |
| Custom domain (`blog.acme.com`) | `request.cf.hostMetadata.blog_id` (CF for SaaS) | Blog DO by id                           |
| `{slug}.blog.sergiodxa.com`     | Suffix match on `.${PLATFORM_DOMAIN}`           | Slug → blog id resolution, then Blog DO |
| Anything else                   | Fallthrough                                     | D1 hostnames lookup, else 404           |

Slug → blog id resolution uses **KV in front of D1**: slug→id is effectively immutable (set at creation, renames out of scope for v1), which is the ideal KV workload — write-through on creation, explicit delete on blog deletion, no TTL. A per-request D1 lookup would add a cross-region round trip to every hosted blog request (D1 is single-primary while DOs sit near their audience); it remains only as the cache-miss path.

The key routing principle: **the worker resolves identity only; the DO enforces state.** Suspension, deletion, and the subdomain-disabled-after-custom-domain rule are all enforced inside the DO from its own pushed metadata. The KV value is just `{ blogId, region }`, so there is no per-request state read that can go stale, and enforcement is identical for both hostname classes.

```typescript
// apps/blog-saas/src/entry.worker.ts (sketch)
import { env } from "cloudflare:workers";
import { router } from "./app/router";
import Blog from "./tenant";

export { Blog };

/** Shared with services/hostname.ts - single source of truth for the metadata shape. */
interface HostMetadata {
	blog_id?: string;
	region?: string;
}

const RESERVED_SLUGS = new Set([
	"sso",
	"www",
	"api",
	"cdn",
	"assets",
	"mail",
	"status",
	"fallback",
]);

export default {
	async fetch(request) {
		let url = new URL(request.url);
		let hostname = url.hostname;

		// 1. Custom domain via CF for SaaS custom metadata
		let metadata = request.cf?.hostMetadata as HostMetadata | undefined;
		if (metadata?.blog_id) {
			return forwardToBlog(request, metadata.blog_id, metadata.region);
		}

		// 2. Platform domain -> static assets, then dashboard router
		if (hostname === env.PLATFORM_DOMAIN) {
			let asset = await env.ASSETS.fetch(assetRequest(request));
			if (asset.ok) return asset;
			return router.fetch(request);
		}

		// 3. Wildcard subdomain {slug}.blog.sergiodxa.com
		if (hostname.endsWith(`.${env.PLATFORM_DOMAIN}`)) {
			let slug = hostname.slice(0, -(env.PLATFORM_DOMAIN.length + 1));
			if (slug.includes(".") || RESERVED_SLUGS.has(slug)) return notFound();

			let entry = await resolveSlug(slug);
			if (!entry) return notFound();
			return forwardToBlog(request, entry.blogId, entry.region);
		}

		// 4. Unknown host: same-zone/explicit-route custom domains carry no hostMetadata,
		// so attempt a D1 hostnames lookup before giving up (also the fallback if
		// custom_metadata is unavailable on the current CF plan).
		let custom = await resolveCustomHostname(hostname);
		if (custom) return forwardToBlog(request, custom.blogId, custom.region);

		return notFound();
	},

	async scheduled(controller) {
		if (controller.cron === "0 1 * * *") await reportUsage(controller);
		if (controller.cron === "0 2 * * *") await purgeDeletedBlogs(controller);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

/** Routes to the tenant DO and meters billable page views off the response. */
async function forwardToBlog(request: Request, blogId: string, region?: string) {
	let stub = env.BLOG.getByName(blogId, region ? { locationHint: region } : undefined);
	let response = await stub.fetch(request);
	trackPageView(request, response, blogId); // non-blocking Analytics Engine write
	return response;
}

/** KV-first slug resolution. Cache misses fall back to D1 and repopulate KV. */
async function resolveSlug(slug: string) {
	let cached = await env.SLUG_CACHE.get<{ blogId: string; region: string }>(`slug:${slug}`, "json");
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		"SELECT id, region FROM blogs WHERE slug = ?1 AND status != 'deleted'",
	)
		.bind(slug)
		.first<{ id: string; region: string }>();
	if (!row) return null;

	let entry = { blogId: row.id, region: row.region };
	await env.SLUG_CACHE.put(`slug:${slug}`, JSON.stringify(entry)); // no TTL; deleted on blog delete
	return entry;
}
```

Notes:

- The `custom_metadata` schema (`blog_id`, `region`) is a single shared TypeScript type used by both the hostname service (writer) and the entry worker (reader). auth-saas has a latent casing mismatch here (`tenant_id` written, `tenantId` read) that this design explicitly avoids.
- `sso.blog.sergiodxa.com` matches the wildcard route; it gets an explicit worker route to the auth-saas worker (more-specific pattern wins) and sits in `RESERVED_SLUGS` as defense in depth. Reserved slugs are also rejected at blog creation.
- No negative caching for unknown slugs (creation would need invalidation); unknown-host requests pay one D1 read and are rare.

### Tenant Durable Object

The DO is a thin host, not an application (target: ~150 lines):

```typescript
// apps/blog-saas/src/tenant/index.ts (sketch)
import { DurableObject } from "cloudflare:workers";
import { createBlogEngine, type BlogEngine } from "@pkg/blog-engine";
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";

/** Control-plane-pushed tenant configuration, stored in the DO's own SQLite. */
interface PlatformMeta {
	blog_id: string;
	title: string;
	subdomain_host: string; // {slug}.blog.sergiodxa.com
	canonical_host: string; // subdomain_host or the active custom domain
	custom_hostname_active: 0 | 1;
	status: "active" | "suspended" | "deleted";
	oidc_issuer: string;
	oidc_client_id: string;
	oidc_client_secret: string;
	cookie_secret: string;
}

export default class Blog extends DurableObject<Cloudflare.Env> {
	#meta: PlatformMeta | null = null;
	#app: BlogEngine | null = null;

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ensureMetaTable();
			this.#meta = this.readMeta();
			if (this.#meta) await this.bootEngine(this.#meta);
			await this.scheduleAlarm();
		});
	}

	private async bootEngine(meta: PlatformMeta) {
		this.#app = createBlogEngine({
			database: createSQLStorageDatabaseAdapter(this.ctx.storage.sql),
			migrations: "manual",
			session: { secret: meta.cookie_secret },
			auth: {
				issuer: meta.oidc_issuer,
				clientId: meta.oidc_client_id,
				clientSecret: meta.oidc_client_secret,
			},
		});
		await this.#app.migrate(); // engine-owned migrations, inside blockConcurrencyWhile on boot
	}

	// ---- RPC surface (control plane only) ----

	/** One-time provisioning before the hostname goes live. Idempotent. */
	async initialize(meta: PlatformMeta) {
		/* writeMeta + bootEngine */
	}

	/** Push-based config sync: suspension, custom-domain activation, title changes. */
	async updateMeta(patch: Partial<PlatformMeta>) {
		/* merge + writeMeta + bootEngine */
	}

	/** Dashboard stats without exposing engine internals. */
	async getStats() {
		return { databaseSize: this.ctx.storage.sql.databaseSize };
	}

	/** Hard delete: wipes SQLite + alarm so the DO stops billing and ceases to exist. */
	async destroy() {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
	}

	// ---- Request path ----

	override async fetch(request: Request): Promise<Response> {
		if (!this.#meta || !this.#app) return new Response("Not found", { status: 404 });

		let meta = this.#meta;
		let host = new URL(request.url).hostname;

		// Deleted blogs answer 410 during the retention window (before purge).
		if (meta.status === "deleted") return new Response("Gone", { status: 410 });

		// Subdomain stops working once the custom domain is active (requirement, no redirect).
		if (meta.custom_hostname_active && host === meta.subdomain_host) {
			return new Response("Not found", { status: 404 });
		}

		// Suspension: public traffic blocked; admin reachable so the owner can export/fix billing.
		let isAdmin = new URL(request.url).pathname.startsWith("/cms");
		if (meta.status === "suspended" && !isAdmin) {
			return suspendedPage(); // minimal static HTML, 402 Payment Required
		}

		return this.#app.fetch(request);
	}

	override async alarm() {
		// Daily housekeeping (expired sessions etc. via engine hook); reschedule.
		await this.scheduleAlarm();
	}
}
```

Design points:

- **Config lives in the DO's SQLite (`platform_meta` table), pushed by the control plane** via `initialize`/`updateMeta` RPC — the DO never needs a D1 binding, requests never wait on control-plane reads, and there is no cache-staleness window. The trade-off (the control plane must push on every change) is contained in one service, `BlogProvisioner`.
- Engine migrations run inside `blockConcurrencyWhile` on boot, matching the auth-saas tenant DO.
- Page-view metering is **not** in the DO — it happens at the worker entry so counting is uniform across hostname classes and stays out of the engine.
- The subdomain-disabled check returns 404 (not 410/421) so the slug's existence is not advertised.

### Control Plane D1 Schema

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,                          -- UUID
  oidc_subject TEXT NOT NULL UNIQUE,            -- sub claim from the IdP tenant
  email TEXT NOT NULL,
  display_name TEXT,
  polar_customer_id TEXT UNIQUE,                -- created lazily at first checkout
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_accounts_subject ON accounts(oidc_subject);

CREATE TABLE blogs (
  id TEXT PRIMARY KEY,                          -- UUID; also the DO name
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,                    -- {slug}.blog.sergiodxa.com
  region TEXT NOT NULL DEFAULT 'wnam',          -- immutable; DO locationHint
  status TEXT NOT NULL DEFAULT 'provisioning',  -- provisioning|active|suspended|deleted
  custom_hostname_active INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,                              -- soft-delete timestamp; purge after 30 days
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_blogs_account ON blogs(account_id);
CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_blogs_status ON blogs(status);

CREATE TABLE hostnames (
  id TEXT PRIMARY KEY,                          -- CF custom hostname id
  blog_id TEXT NOT NULL UNIQUE REFERENCES blogs(id) ON DELETE CASCADE,  -- one per blog
  hostname TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_validation',
  ssl_status TEXT,
  validation_txt_name TEXT,
  validation_txt_value TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_hostnames_status ON hostnames(status);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  polar_subscription_id TEXT UNIQUE,
  polar_product_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete',    -- incomplete|active|trialing|past_due|canceled|unpaid
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE TABLE usage_daily (
  id TEXT PRIMARY KEY,
  blog_id TEXT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                           -- YYYY-MM-DD (UTC)
  page_views INTEGER NOT NULL DEFAULT 0,
  reported_at TEXT,                             -- set once ingested into Polar (idempotency guard)
  created_at TEXT NOT NULL,
  UNIQUE(blog_id, date)
);
CREATE INDEX idx_usage_blog_date ON usage_daily(blog_id, date);
CREATE INDEX idx_usage_unreported ON usage_daily(date) WHERE reported_at IS NULL;
```

Deviations from ADR-006's control plane, with reasons:

| Deviation                                                   | Reason                                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `accounts` table exists (auth-saas stores subject ids only) | Accounts carry billing identity (`polar_customer_id`) and profile                                           |
| Subscription keyed to account, not blog                     | Base fee covers N blogs with pooled allowance; per-blog would multiply the fee                              |
| Default subdomain not stored in `hostnames`                 | Derivable from `slug`; storing it duplicates state with no CF object behind it                              |
| `usage_daily` replaces `mau_tracking`                       | Different meter (page views, summed daily); idempotent reporting; history beyond Analytics Engine retention |

### Blog Lifecycle

**Create** (requires authenticated session; subscription `active`/`trialing`, with first-blog creation chaining checkout → return → create):

1. Validate name; generate slug (lowercased, `[^a-z0-9]+` → `-`, truncated, plus random suffix on collision); reject reserved slugs.
2. Pick region: auto-detect from `request.cf` continent with user override; immutable afterwards (DO `locationHint` only applies at first instantiation — ADR-006 rule).
3. `INSERT INTO blogs (status='provisioning')`.
4. Provision the blog's admin OIDC client on the `sso.blog.sergiodxa.com` tenant via the auth-saas Management API (`POST /api/clients`, secret, redirect URI `https://{slug}.blog.sergiodxa.com/auth/callback`). One client **per blog** (isolation, revocability) rather than one shared client with thousands of redirect URIs. The platform authenticates to the Management API with an M2M client stored in worker secrets.
5. `env.BLOG.getByName(blogId, { locationHint: region })` → `stub.initialize({...})` with title, hosts, OIDC config, cookie secret, `status: "active"`. The owner is pre-authorized as admin via the engine's `auth.admins` allowlist.
6. Write-through `SLUG_CACHE.put("slug:{slug}", ...)`.
7. `UPDATE blogs SET status='active'`.

Steps 4-7 are retryable; the `provisioning` status makes half-created blogs visible and re-runnable (a "retry provisioning" action beats distributed transactions).

**Delete** (soft, then purge):

1. Dashboard destroy action (slug re-typing confirmation): `status='deleted'`, `deleted_at=now`.
2. `SLUG_CACHE.delete`; delete the CF custom hostname if any; `stub.updateMeta({status:'deleted'})` → DO serves 410.
3. Daily cron: blogs with `deleted_at` older than 30 days get `stub.destroy()` (`storage.deleteAll()` removes all DO storage; the object stops incurring cost and effectively ceases to exist), the OIDC client deleted via Management API, and the D1 row hard-deleted (cascades hostnames/usage).
4. The retention window doubles as an undo window; a restore action flips status back and re-puts the KV key.

**Suspend on non-payment** (driven by Polar webhooks): fan out per blog — `UPDATE blogs SET status='suspended'` + `stub.updateMeta({status:'suspended'})`.

Enforcement matrix:

| State                             | Public traffic              | Blog admin (`/cms`)                            | Platform dashboard           |
| --------------------------------- | --------------------------- | ---------------------------------------------- | ---------------------------- |
| `active` / `trialing`             | Served                      | Served                                         | Full                         |
| `past_due`                        | Served (grace)              | Served                                         | Warning banner               |
| `canceled` / `unpaid` → suspended | 402 static "suspended" page | Served (owner can export content, fix billing) | Blocked except billing pages |
| `deleted` (retention window)      | 410 Gone                    | 410 Gone                                       | Restore action only          |

### Custom Domain Flow

Reuses `apps/auth-saas/src/app/services/hostname.ts` nearly verbatim (metadata key renamed to `blog_id`). One custom hostname per blog (`UNIQUE(hostnames.blog_id)`), consistent with ADR-006.

1. Owner submits `blog.acme.com` on the blog's domain page. Validation: syntactically a hostname, not under `.${PLATFORM_DOMAIN}`, not already registered.
2. CF for SaaS `POST /custom_hostnames` with `ssl.method: "txt"` and `custom_metadata: { blog_id, region }`.
3. Store the pending row; show the owner two DNS instructions: the `_cf-custom-hostname` TXT record (validation) and a CNAME to the fallback origin (traffic).
4. Status refresh: manual "Check status" button plus a cron poll of `pending_validation` rows so activation is hands-off.
5. On active (hostname and SSL both active):
   - `UPDATE hostnames SET status='active'`; `UPDATE blogs SET custom_hostname_active=1`.
   - `stub.updateMeta({ canonical_host: "blog.acme.com", custom_hostname_active: 1 })`.
   - From this moment custom-domain requests carry `cf.hostMetadata.blog_id` and route directly; subdomain requests still resolve via KV but the DO answers 404 (the required stops-working behavior). The engine's canonical URLs, feeds, and sitemap flip automatically because they derive from the request URL.
6. Removal reverses the steps; the subdomain resumes.

Migrating `r3.sergiodxa.com` (a same-zone hostname) later: remove the custom-domain route from `apps/r3-blog/wrangler.jsonc`, add `r3.sergiodxa.com/*` as an explicit route on the blog-saas worker, and rely on the unknown-host D1 lookup path (explicit-route hostnames carry no `hostMetadata`).

### Billing

**Metered event: billable page views.** Candidates considered:

| Candidate                   | Verdict  | Rationale                                                                                                              |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Raw requests                | Rejected | Inflated by assets, feeds, bots, probes; means nothing to a blogger; theme-dependent                                   |
| Bandwidth (GB)              | Rejected | Infra-normal (Netlify/Vercel) but opaque to bloggers and hard to measure on streamed bodies                            |
| Unique visitors (MAU-style) | Rejected | Requires identifying anonymous readers — privacy-hostile and gameable                                                  |
| **Page views**              | Chosen   | Bloggers already think in page views; correlates with actual platform cost; pools naturally across any number of blogs |

The concern that "charging for visits is strange" is addressed by the hybrid structure rather than the meter choice: the base fee makes visits free up to a generous allowance — overage only ever means the blog is succeeding. This is how WordPress.com sizes plans by traffic capacity.

One billable page view is precisely defined (implementable at the worker):

- Response from the tenant DO with status `200` and `Content-Type: text/html`;
- Request method `GET`; path not under `/cms`;
- `Sec-Fetch-Dest: document` when present (browsers), else `Accept` contains `text/html` (most bots send `*/*` and drop out naturally). A curated bot User-Agent denylist is a later tuning knob.

Measurement happens at the worker entry (uniform across hostname classes, zero engine coupling), written to Analytics Engine:

```typescript
env.ANALYTICS.writeDataPoint({
	blobs: [blogId, "page_view", url.hostname, new Date().toISOString().slice(0, 10)],
	doubles: [1],
	indexes: [blogId],
});
```

**Daily reporting cron** (01:00 UTC, mirrors auth-saas `report-mau`):

1. Query the Analytics Engine SQL API for yesterday's per-blog sums.
2. Upsert into `usage_daily` (`UNIQUE(blog_id, date)` makes re-runs safe).
3. For rows with `reported_at IS NULL`: resolve blog → account → `polar_customer_id`, ingest a Polar event `page_views` with the day's count, set `reported_at`. Per-row failures retry next run; the guard gives at-most-once ingestion per blog-day.

**Polar configuration:**

| Object                 | Configuration                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Meter `page_views`     | Event name `page_views`; aggregation: sum over `metadata.views`                                                                  |
| Product "Blog"         | Recurring monthly. Base price TBD (working figure $5/month). Metered price TBD per 1,000 views overage (working figure $0.50/1k) |
| Included allowance     | Polar meter-credits benefit on the product: TBD views/month (working figure 100,000 — a personal blog rarely exceeds 10k/month)  |
| Blogs per subscription | Unlimited; usage pools into one meter per customer                                                                               |

Checkout uses Polar hosted checkout (customer created lazily with `account_id` metadata); payment method, cancellation, and invoices go through the Polar customer portal — no custom billing UI.

Webhooks (`/api/webhooks/polar`, HMAC-verified as in auth-saas):

| Event                             | Handling                                                              |
| --------------------------------- | --------------------------------------------------------------------- |
| `checkout.completed`              | Link `polar_subscription_id` to the account via `metadata.account_id` |
| `subscription.active`             | Status → `active`; reactivate suspended blogs (fan-out `updateMeta`)  |
| `subscription.updated`            | Sync status + period; `past_due` enters grace (no fan-out)            |
| `subscription.canceled` / revoked | Status → `canceled`; fan out suspension to all account blogs          |

### Platform Dashboard

```typescript
// apps/blog-saas/src/app/routes.ts
import { form, get, post, resources, route } from "remix/fetch-router/routes";

export default route({
	index: get("/"), // marketing landing
	health: get("/health"),

	auth: {
		login: form("/auth/login"), // GET renders, POST starts OIDC PKCE flow
		callback: get("/auth/callback"),
		logout: form("/auth/logout"),
	},

	api: {
		webhooks: { polar: post("/api/webhooks/polar") },
	},

	dashboard: {
		index: get("/dashboard"), // blog list + usage summary
		billing: form("/dashboard/billing"), // subscription status, checkout, portal link

		blogs: {
			...resources("/dashboard/blogs", {
				only: ["new", "create", "show", "edit", "update", "destroy"],
			}),
			domain: form("/dashboard/blogs/:blogId/domain"),
			usage: get("/dashboard/blogs/:blogId/usage"),
			restore: post("/dashboard/blogs/:blogId/restore"),
		},
	},
});
```

Middleware tree: global `[trailingSlash, logger, formData(), methodOverride()]`; `dashboard.*` adds `[session, csrf, account]`; `dashboard.blogs.*` adds `[blogOwner, subscription]`. Webhooks stay middleware-free. Providers registered at module scope per ADR-008: `DatabaseService` (D1 adapter), `LoggerServiceProvider`, `PolarService`, `HostnameService`, `AnalyticsService`, `BlogProvisioner` (owns create/delete/suspend fan-out, KV writes, DO RPCs), plus the OAuth provider/verification-key providers portable from r3-blog.

**OIDC login** is a direct port of r3-blog's `auth.tsx` flow: PKCE + state in the cookie session, code exchange, ID-token verification against the tenant JWKS, then `Account.findOrCreateFromIdToken`. Logout redirects through the IdP's `end_session_endpoint` with `id_token_hint` ([ADR-002](./ADR-002-sso-logout-with-id-token-hint.md) behavior).

Single-account story: owners authenticate to the dashboard and to each blog's `/cms` against the same IdP tenant with different OIDC clients; the IdP session gives SSO across all of them.

### Wrangler Configuration

```jsonc
{
	"$schema": "https://unpkg.com/wrangler@latest/config-schema.json",
	"name": "blog-saas",
	"main": "./src/entry.worker.ts",
	"compatibility_date": "2026-06-01",
	"compatibility_flags": ["nodejs_compat"],
	"workers_dev": true,
	"dev": { "port": 3005 },
	"observability": { "enabled": true },

	"assets": { "directory": "./assets", "binding": "ASSETS" },

	"routes": [
		// Platform dashboard + marketing
		{ "pattern": "blog.sergiodxa.com", "custom_domain": true },
		// Tenant default subdomains (requires a proxied wildcard DNS record)
		{ "pattern": "*.blog.sergiodxa.com/*", "zone_name": "sergiodxa.com" },
		// CF for SaaS fallback origin (custom hostname traffic lands here)
		{ "pattern": "fallback.blog.sergiodxa.com/*", "zone_name": "sergiodxa.com" },
	],

	"triggers": {
		// 01:00 UTC: aggregate AE page views -> usage_daily -> Polar ingestion
		// 02:00 UTC: purge soft-deleted blogs past retention; poll pending hostnames
		"crons": ["0 1 * * *", "0 2 * * *"],
	},

	"durable_objects": { "bindings": [{ "name": "BLOG", "class_name": "Blog" }] },
	"migrations": [{ "tag": "add-blog-do", "new_sqlite_classes": ["Blog"] }],

	"d1_databases": [
		{
			"binding": "PLATFORM_DB",
			"database_name": "blog-saas-platform",
			"database_id": "<id>",
			"migrations_dir": "./src/app/migrations",
		},
	],

	"kv_namespaces": [{ "binding": "SLUG_CACHE", "id": "<id>" }],

	"analytics_engine_datasets": [{ "binding": "ANALYTICS", "dataset": "blog-saas-analytics" }],

	"vars": {
		"PLATFORM_DOMAIN": "blog.sergiodxa.com",
		"OIDC_ISSUER": "https://sso.blog.sergiodxa.com",
	},

	// Secrets (wrangler secret put / Secrets Store):
	//   COOKIE_SESSION_SECRET                                   dashboard session cookie
	//   OIDC_CLIENT_ID / OIDC_CLIENT_SECRET                     dashboard client on the sso tenant
	//   SSO_MANAGEMENT_CLIENT_ID / SSO_MANAGEMENT_CLIENT_SECRET per-blog client provisioning
	//   CF_API_TOKEN / CF_ZONE_ID / CF_ACCOUNT_ID               CF for SaaS + AE SQL API
	//   POLAR_ACCESS_TOKEN / POLAR_WEBHOOK_SECRET / POLAR_PRODUCT_ID
}
```

One-time zone setup (not automatable via wrangler): proxied wildcard DNS record `*.blog.sergiodxa.com`; proxied fallback-origin record `fallback.blog.sergiodxa.com`; set the zone's CF for SaaS fallback origin to it; explicit route `sso.blog.sergiodxa.com/*` to the auth-saas worker (more-specific pattern wins over the wildcard).

## Consequences

### Positive

- **Blogs become a dashboard action**: creating a blog provisions a DO, a subdomain, an OIDC client, and billing in one flow — no new worker deploys.
- **True tenant isolation**: each blog's content, users, sessions, and settings live in a separate SQLite database inside its own DO, placed near its audience via `locationHint`.
- **The engine is genuinely portable**: one package serves the SaaS, self-hosted Workers with D1, and (via `node:sqlite`/`bun:sqlite` adapters) any Fetch runtime — the WordPress-core property the product requires.
- **Fleet-wide upgrades**: deploying `apps/blog-saas` upgrades every hosted blog to the same engine version at once; engine migrations self-apply per tenant on next boot.
- **Reuses proven pieces**: ADR-006's architecture, the SqlStorage adapter, the hostname service, and the Polar service are lifted rather than reinvented; the engine's internals are a generalization of r3-blog code that already runs in production.
- **Custom post types without schema changes**: the WordPress-style EAV model plus runtime codecs means user-defined types never touch DDL.
- **Custom roles without code changes**: the same runtime-definition philosophy applied to authorization — the engine ships a permission catalog and four built-in roles, and owners compose their own roles in the admin panel.
- **Billing matches cost**: page views scale with actual serving cost; pooled account-level allowance supports "any number of blogs" cleanly.

### Negative

- **Beta framework as a package contract**: `remix@3.0.0-beta.4` becomes a peer dependency of a shared package; breaking beta changes ripple through engine, platform, and self-hosted consumers at once.
- **Push-based config must be complete**: every control-plane change that affects a tenant must remember to RPC the DO; a missed push means drift (contained in `BlogProvisioner`, but still a discipline).
- **EAV read amplification**: list pages join `post_meta` per post; fine at single-blog scale but structurally more expensive than dedicated columns.
- **Region immutability**: a blog's DO region is fixed at creation (locationHint rule); moving a blog means data export/import.
- **Operational surface**: CF for SaaS hostnames, Analytics Engine queries, Polar meters/credits, KV cache invalidation, and DO fleet management all become production responsibilities.
- **auth-saas becomes load-bearing**: dashboard login and every blog's admin login depend on auth-saas being finished, deployed, and stable.

### Neutral

- **`apps/r3-blog` continues unchanged**: it keeps its own worker and D1; migrating `r3.sergiodxa.com` into the platform is a possible follow-up, not part of this decision.
- **Suspended blogs keep admin access**: deliberate — owners can always export content and fix billing; the engine gains a `readOnly` config flag later if publishing-while-suspended needs closing.
- **404 on disabled subdomains**: SEO-hostile compared to a redirect, but an explicit product decision.
- **Roles without workflow**: v1 ships roles and permissions but no editorial workflow on top (no submission queues or notifications); writers and editors coordinate through the shared post list.

## Implementation Plan

### Phase 0: Adapter Extractions

**Priority:** High
**Estimated Effort:** 2-3 days

1. Extract `@pkg/data-table-sqlstorage` from `apps/auth-saas/src/lib/sql-storage-adapter.ts`; refactor auth-saas to consume it.
2. Extract `@pkg/data-table-d1` from `apps/r3-blog/app/infrastructure/database/d1-data-table-adapter.ts`; refactor r3-blog to consume it.
3. Tests for both against the same data-table conformance suite.

### Phase 1: Engine Core

**Priority:** High
**Estimated Effort:** 2 weeks

1. Scaffold `packages/blog-engine`; port router assembly, middleware stack, renderer from r3-blog.
2. Schema, programmatic migration registry, seed migration (article type + built-in roles), `SqlSessionStorage`.
3. Generic `Post` repository + `createMetaCodec`; typed `article` wrapper; author handling.
4. Permission catalog, `Role` repository with builtin protection, `requirePermission` middleware, last-admin invariant.
5. Public routes: feed, type index, post detail, RSS, sitemap, robots; markdown rendering.
6. Parameterized OIDC auth (login/callback/logout, first-admin bootstrap, `admins` allowlist, reader default).
7. Self-hosted example worker validating the D1 path end-to-end.

### Phase 2: Engine CMS

**Priority:** High
**Estimated Effort:** 1-2 weeks

1. CMS dashboard, generic posts CRUD driven by definitions (form generation + `remix/data-schema` validation), permission-gated publish/schedule controls.
2. Post-types CRUD with builtin protection and reserved-path checks.
3. Users management (role assignment, delete with post reassignment) and roles management (custom roles from the permission catalog).
4. Settings and appearance pages; `renderThemeStyle` with OKLCH derivation; custom CSS.
5. Self-served string assets route with content-hash caching.

### Phase 3: Platform Scaffold and Routing

**Priority:** High
**Estimated Effort:** 1 week

1. Scaffold `apps/blog-saas`; control-plane D1 schema and models.
2. Entry worker: hostname classes, KV slug cache, reserved slugs, unknown-host fallback.
3. Blog DO wrapper: `platform_meta`, engine boot, RPC surface, enforcement, alarms.
4. Provisioning flow against a stub OIDC config; end-to-end request path working locally.

### Phase 4: Dashboard

**Priority:** High
**Estimated Effort:** 1 week

1. OIDC login against `sso.blog.sergiodxa.com`; account upsert; session middleware.
2. Blog CRUD (create with region pick + slug generation, show, edit, destroy with confirmation, restore).
3. Per-blog OIDC client provisioning through the auth-saas Management API.

### Phase 5: Custom Domains

**Priority:** Medium
**Estimated Effort:** 1 week

1. Port `HostnameService` with `blog_id` metadata; domain form UI with TXT/CNAME instructions.
2. Activation push (`canonical_host`, `custom_hostname_active`) and subdomain-disable behavior.
3. Hostname polling cron; removal flow.

### Phase 6: Billing and Lifecycle

**Priority:** Medium
**Estimated Effort:** 1-2 weeks

1. Page-view metering at the worker entry; Analytics Engine dataset.
2. Polar product/meter/credits setup; checkout + portal; webhook handler.
3. Reporting cron (`usage_daily` + Polar ingestion); usage dashboard views.
4. Suspension/reactivation fan-out; purge cron; enforcement matrix verification.

### Phase 7: Production Setup and Polish

**Priority:** Medium
**Estimated Effort:** 1 week

1. Zone setup (wildcard DNS, fallback origin, sso route); secrets; deploy.
2. Rate limiting on auth and provisioning endpoints; logging; AGENTS.md files.
3. Decide final product domain; optionally a dedicated zone.

## Alternatives Considered

### 1. Workers for Platforms (one worker per blog)

Deploy a complete worker per tenant via dispatch namespaces.

**Rejected because**: all blogs share identical code, so per-tenant deploys buy nothing; deploy fan-out, cost, and operational overhead are unjustified; storage would still need solving separately. (Same conclusion as ADR-006.)

### 2. Shared multi-tenant D1 with `blog_id` columns

One database, tenant discriminator on every table.

**Rejected because**: no isolation story, single-region latency for a global product, shared size ceilings, and it discards the engine/adapter contract that makes self-hosting work.

### 3. One D1 database per blog

Better isolation than option 2, keeps the engine's adapter contract.

**Rejected because**: no request-time compute affinity, an API-managed fleet of databases to provision and track, and no alarms/RPC. DO+SQLite gives storage and compute in one addressable, region-pinned object.

### 4. Subscription per blog (ADR-006 parity)

**Rejected because**: multiplies the base fee per blog and contradicts the requirement that an account owns many blogs under one fee with pooled allowance.

### 5. Metering raw requests, bandwidth, or unique visitors

**Rejected because**: requests and bandwidth are opaque and theme-dependent from a blogger's perspective; unique visitors require identifying anonymous readers. Page views are the unit bloggers already reason about and correlate with cost.

### 6. Redirect (301) from subdomain to custom domain

**Rejected because**: the product explicitly wants the subdomain to stop working. Recorded as a deliberate trade-off against SEO continuity.

### 7. Pull-based tenant config (DO reads D1 on boot)

**Rejected because**: adds a D1 dependency and a cold-start read to every DO plus a staleness window; push RPC into DO-local `platform_meta` keeps the request path self-contained.

### 8. JSON meta column on posts instead of `post_meta` EAV

**Rejected because**: departs from the decided WordPress-style schema and r3-blog's proven repository layer; EAV allows per-key indexed queries; the storage decision is contained behind the repository API either way.

### 9. Physical table per post type

Runtime `CREATE TABLE` when a user defines a type.

**Rejected because**: dynamic DDL on user action is operationally risky (migrations interplay, SQLite limits) for zero query-model benefit at blog scale.

### 10. Code-defined post types (config passed to `createBlogEngine`)

**Rejected because**: the requirement is defining types from the admin panel. The runtime codec design keeps a future hybrid (host-supplied builtin definitions) cheap.

### 11. Host-supplied service container instead of a config object

**Rejected because**: it makes engine internals (service keys, provider ordering) a public API surface; the config object keeps the WordPress-core boundary crisp (ADR-008 container stays an implementation detail).

### 12. Template repository instead of a package ("download the WordPress zip")

**Rejected because**: no shared upgrades; the entire point of the SaaS is one engine version fleet-wide.

### 13. Separate `status` column for drafts

Model publish state as `status TEXT` (`draft` | `published`) alongside `published_at`, as WordPress does with `post_status`.

**Rejected because**: two fields can disagree (a `published` status with a NULL date, a `draft` with a past date); the three-state `published_at` — NULL draft, past published, future scheduled — encodes the same states in one column with no invalid combinations. The trade-off (unpublishing a post loses its original publish date) is acceptable for v1.

### 14. Hardcoded roles instead of DB-stored roles

Ship admin/editor/writer/reader as a TypeScript enum with fixed permission checks.

**Rejected because**: owner-defined custom roles are a product requirement, and the runtime-definition approach already proved itself for post types. Storing roles as permission-key sets costs one table and makes the built-ins just seeded rows.

## References

- [ADR-001: New Package Extraction](./ADR-001-new-package-extraction.md)
- [ADR-002: SSO Logout With id_token_hint](./ADR-002-sso-logout-with-id-token-hint.md)
- [ADR-006: Auth SaaS Platform](./ADR-006-auth-saas-platform.md)
- [ADR-008: Service Container For Remix V3](./ADR-008-service-container-for-remix-v3.md)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare for SaaS - Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Polar Documentation](https://docs.polar.sh/)
- [WordPress database description](https://codex.wordpress.org/Database_Description) (posts/postmeta prior art)

## Current Progress

- [x] Phase 0: Adapter extractions (`@pkg/data-table-d1`, `@pkg/data-table-sqlstorage`)
- [x] Phase 1: Engine core (schema, migrations, domain, theme, OIDC, public site)
- [x] Phase 2: Engine CMS (posts/post-types/users/roles/settings/appearance)
- [x] Phase 3: Platform scaffold and routing (worker, Blog DO, control-plane D1)
- [x] Phase 4: Dashboard (OIDC login, account, blog CRUD, provisioning)
- [~] Phase 5: Custom domains (HostnameService + form + poll cron wired; needs live CF for SaaS)
- [~] Phase 6: Billing and lifecycle (metering, PolarService, webhook, crons wired; needs Polar setup + webhook HMAC)
- [ ] Phase 7: Production setup (zone/DNS, secrets, deploy)

## Notes

- **auth-saas is the critical-path dependency**: it must be deployed with the `sso.blog.sergiodxa.com` tenant, a dashboard client, and an M2M management client before Phases 4+ can ship. The plan is for `auth.sergiodxa.com` itself to become the auth-saas platform, using email + passkey with magic-link recovery and Cloudflare Email Sending instead of Resend — that work is tracked in [ADR-010](./ADR-010-auth-saas-completion-and-tenant-migration.md), whose Phase 0 explicitly creates the `blog-sso` tenant and management client this ADR needs. (The `custom_metadata` casing mismatch mentioned in earlier drafts was already fixed.)
- **CF for SaaS `custom_metadata` is documented as plan-gated (Enterprise)**: the unknown-host D1 lookup path doubles as the fallback if metadata turns out to be unavailable — custom hostnames then cost one cacheable D1 read instead.
- **Shared-zone hazards**: the wildcard route and fallback origin live on `sergiodxa.com`, which hosts unrelated apps. A dedicated zone for the final product domain removes route-precedence footguns; decide before GA. The final domain is TBD; `blog.sergiodxa.com` is a working name throughout.
- **Bot inflation of billable page views**: the `Sec-Fetch-Dest`/`Accept` filter removes most non-browser traffic, but headless crawlers with browser-like headers still count. Document the definition to customers; keep a UA denylist as a tuning knob; consider anomaly alerts before overage charges.
- **Analytics Engine retention (~90 days) and sampling**: mitigated by materializing into `usage_daily` within 24 hours; AE sampling at blog-scale volumes is negligible.
- **Engine migration races**: the D1 adapter reports `migrationLock: false`, so two cold isolates could race `migrate()` in `"auto"` mode on a fresh self-hosted deploy — the journal plus idempotent DDL keep the window tolerable; the DO host avoids it entirely via `blockConcurrencyWhile`. Cautious self-hosters can use `"manual"`.
- **Slug immutability in v1**: the KV cache assumes slugs never change. Renames would need KV delete + DO meta push; deferred.
- **Field definition evolution**: removing or re-kinding a field on a type with existing posts leaves stale meta rows (harmless — codecs skip unknown keys) or mis-decoded values (kind change). v1 policy: allow add/remove, warn on kind change, no data migration.
- **Custom CSS risk**: CSS cannot execute script; `url()` beacons/defacement by a malicious admin are accepted (admins own their blog). The platform can disable the escape hatch via a future engine config flag if needed.
- **Packaging constraint discovered during design**: r3-blog types its router context by globally augmenting `remix/fetch-router` (`declare module`); a shared package must not do this (the augmentation would leak into every host). The engine threads an explicit `BlogContext` generic instead.
- **`published_at` placement**: the original product sketch listed `published_at` as an `article` field; it was deliberately promoted to a core `posts` column so publish/draft/scheduled semantics work uniformly for every custom type and public queries sort without joining `post_meta`.
- **OIDC credentials in DO storage**: stored in the tenant's private SQLite, same trust level as auth-saas signing keys. Encrypting with a worker-held key is a possible hardening step.
- **Polar meter credits**: the included allowance uses Polar's meter-credits benefit; verify reset/rollover semantics against the current Polar API before committing pricing copy. All prices are TBD (working figures: $5/month base, 100k views included, $0.50 per additional 1k).
