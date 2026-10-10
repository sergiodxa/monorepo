# Auth SaaS Platform

The multi-tenant identity platform: each tenant is an OIDC/OAuth2 provider running
isolated in its own Cloudflare Durable Object, with its own subjects, clients, signing
keys and sessions. The provider is built into this app rather than reached as an
external package; the Worker owns HTTP, routing and rendering, and a D1 control plane
tracks which tenants exist, who administers each, and what each is billed. See
[ADR-001](../../docs/adr/auth-saas/ADR-001-auth-saas-on-per-tenant-durable-objects.md)
and [ADR-002](../../docs/adr/auth-saas/ADR-002-rebuild-path-and-implementation-order.md).

## Commands

```bash
bun run dev               # Run development server
bun run build             # Build for production
bun run start             # Start production server locally
bun run cf:deploy         # Deploy to Cloudflare Workers
bun run cf:typegen        # Generate TypeScript types for Cloudflare Workers bindings
bun run db:local:drop     # Drop local database
bun run db:local:migrate  # Apply migrations to local database
bun run db:remote:migrate # Apply migrations to remote database
```

## Rules

- MUST use Bun to install dependencies, run scripts, and execute tests
- MUST run linter, formatter, type checker and tests from the root of the repository
- MUST use `bun run` to run scripts defined in `package.json`, never run them
- MUST use `bunx wrangler` when running Cloudflare Workers commands, never use `wrangler` directly
- MUST use `remix/*` packages for the app, not React or React Router
- MUST check Remix docs on https://github.com/remix-run/remix for any questions about how to do things in Remix way
- MUST follow MVC, use models for business logic, use controllers for handling requests and responses, use `remix/component` for UI
- MUST read and write the control plane through `ctx.models` (the `@sdxc/data-model` models in `app/models/`, published by the `models()` middleware after `database()` in every router and in the job dispatcher), never ad-hoc queries on `ctx.db` for a table a model covers. A service that touches the control plane takes the bound registry (`Models` from `~/app/models`) as its first argument. Model writes answer `@sdxc/result` Results; a test binds the same registry with `bindModels(db)` from `app/test/models.ts`, seeds a tenant with `seedTenant`, and publishes models on a hand-built job context with `publishModels(ctx, db)`
- MUST define a control-plane table in `database/schema.ts` and its model in `app/models/`, registered in `app/models/index.ts`; tenant state stays in the tenant Durable Object's own SqlStorage repositories under `database/`, which the control-plane models never reach
- MUST link the hosted document's stylesheets and client entry through `documentAssets()` in `app/services/assets.ts`, which reads the asset manifest `@pitlane/vite-plugin-remix` writes: a build hashes every file, so a hand-written `/assets/...` URL or a `?url` stylesheet import names a file the next build renames. A stylesheet joins by a side-effect `import "….css"` in `app/views/hosted/document.tsx`, in cascade order.
- MUST give the import map, every `modulepreload` and every module script the document writes the response's CSP nonce, which the renderer in `app/http/middleware/render.tsx` hands the document; the policies allow scripts by `'self'` and nonce, and the import map is inline.
- MUST list every module that calls `clientEntry()` in `bootstrap/browser.ts`'s glob, and only those: a view or route module in the client bundle ships a chunk no page asks for and lengthens every page's import map.

## Structure

Laravel-style top-level layout: there is no `src/`, and each top-level directory names a
role — `bootstrap/` for runtime entry points, `routes/` for the route table, `app/` for
application logic, `resources/` for anything that renders, `config/` for ambient `*.d.ts`,
`database/` for schema and migrations. Import across them with the `~/<dir>/*` aliases
declared in `tsconfig.json` (e.g. `~/app/http/controllers/...`, `~/routes/web`); a
relative path is only for a sibling inside the same directory.

- `bootstrap/` — runtime entry points: `worker.ts` (the Cloudflare `fetch` handler,
  the only place Cloudflare APIs are used), `app.ts` (router assembly + global
  middleware + route mapping).
- `routes/web.ts` — the route registry mapped in `bootstrap/app.ts`.
- `app/http/controllers/` and `app/http/middleware/` — the HTTP layer.
- `app/models/` — control-plane models (`@sdxc/data-model` over the tables in
  `database/schema.ts`, on the `PLATFORM_DB` D1 binding), bound per request and job
  as `ctx.models`.
- `app/services/` — service classes (analytics, email, tenant Durable Object API).
- `app/jobs/` — scheduled jobs.
- `app/lib/` — app-internal helpers (fetch-router action/middleware/form wrappers,
  crypto, rate limiting).
- `resources/layouts/` — server-rendered HTML layouts.
- `database/tenant-do.ts` — the per-tenant Durable Object: typed RPC methods only,
  no `fetch` handler, over its own SqlStorage database.
- `database/tenant-migrations/` and `database/tenant-migrations.ts` — the tenant
  object's schema registry and the runner that applies it on boot.
- `database/schema.ts` — the control plane's `remix/data-table` table definitions.
- `database/migrations/` — D1 control-plane migrations (`migrations_dir`).
- `config/` — ambient `*.d.ts` (env + router-context augmentations).

## Key principle

The Worker resolves **identity** only (which tenant a request is for, by platform
domain, `cf.hostMetadata`, or a control-plane hostname lookup); the tenant Durable
Object holds that tenant's subjects, clients, signing keys and sessions in its own
SqlStorage database and runs the OIDC/OAuth2 provider surface directly. The control
plane (`customers`, `tenants`, `memberships`, `domains` in D1) never holds tenant
state itself, so the request path never waits on a control-plane read once a tenant
is resolved.
