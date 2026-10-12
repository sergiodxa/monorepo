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
- MUST define a control-plane table in `database/schema.ts` and its model in `app/models/`, registered in `app/models/index.ts`; tenant state stays in the tenant Durable Object's own SqlStorage stores under `app/models/tenant/` (their schema in `database/tenant-migrations/`), which the control-plane models never reach
- MUST link the hosted document's stylesheets and client entry from `ctx.assets`, which the tenant router's `assets()` middleware (`@sdxc/assets-middleware`) resolves once per request through the resolver in `app/initializers/assets.ts`; every hosted page passes it explicitly as `<HostedDocument assets={ctx.assets} …>`. The resolver reads the asset manifest `@pitlane/vite-plugin-remix` writes: a build hashes every file, so a hand-written `/assets/...` URL or a `?url` stylesheet import names a file the next build renames. A stylesheet joins by a side-effect `import "….css"` in `resources/views/hosted/document.tsx`, in cascade order.
- MUST give the import map, every `modulepreload` and every module script the document writes the response's CSP nonce, which `assets()` reads from `securityHeaders()` (installed before it) into `ctx.assets.nonce`; the policies allow scripts by `'self'` and nonce, and the import map is inline.
- MUST list every module that calls `clientEntry()` in `bootstrap/browser.ts`'s glob, and only those: a view or route module in the client bundle ships a chunk no page asks for and lengthens every page's import map.

## Structure

Organised by kind of code, one home per kind (ADR-129 in the repo's `docs/adr/`): there is
no `src/`, and each top-level directory names a role. Import across them with the
`~/<dir>/*` aliases declared in `tsconfig.json` (e.g. `~/app/http/controllers/...`,
`~/routes/web`); a relative path is only for a sibling inside the same directory.

| Path                                                  | Holds                                                                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap/worker.ts`                                 | The Worker entry: serves assets, picks the router by host (`api.` → management, `/mcp` → MCP, platform → web, otherwise a resolved tenant), cron and queue |
| `bootstrap/browser.ts`                                | The browser entry that hydrates islands                                                                                                                    |
| `app/models/tenant/object.ts`                         | The tenant Durable Object, exported from `bootstrap/worker.ts` as `Tenant`                                                                                 |
| `routes/{web,tenant,management,mcp}.ts`               | The four route contracts                                                                                                                                   |
| `app/initializers/router.ts`                          | `webRouter`, mapping `routes/web.ts` on the bare platform domain                                                                                           |
| `app/initializers/tenant-router.ts`                   | `tenantRouter`, mapping `routes/tenant.ts` for a request resolved to one tenant                                                                            |
| `app/initializers/management-router.ts`               | `managementRouter`, mapping `routes/management.ts` on `api.{PLATFORM_DOMAIN}`                                                                              |
| `app/initializers/mcp-router.ts`, `mcp.ts`            | `mcpRouter` for `routes/mcp.ts`, and the MCP server it imports on first call                                                                               |
| `app/initializers/`                                   | Every other single instance: logger, job dispatcher, database, billing, flags, cookies, hostname client, resource servers, assets                          |
| `app/http/controllers/`, `middleware/`, `validators/` | The HTTP layer; `app/http/openapi/` builds the management API document                                                                                     |
| `app/jobs/`                                           | Background jobs (`index.ts` declares them) and their middleware                                                                                            |
| `app/mcp/`                                            | The MCP tools generated from the management API's operations, and the one handler that forwards each call                                                  |
| `app/emails/`                                         | Email templates and their sender and link helpers                                                                                                          |
| `app/models/`                                         | Control-plane models (`@sdxc/data-model` over `database/schema.ts`, on `PLATFORM_DB`), registered in `index.ts`; KV and R2 stores                          |
| `app/models/tenant/`                                  | The tenant Durable Object's RPC surface (`object.ts`) and the SqlStorage stores it runs on                                                                 |
| `app/services/`, `app/services/tenant/`               | Business logic across models or package instances, and the tenant object's pure rules                                                                      |
| `app/test/`                                           | Test helpers; `app/test/harness/` builds the routers controller tests drive                                                                                |
| `resources/views/`, `resources/locales/`              | Server-rendered views, islands and stylesheets; translations                                                                                               |
| `config/`                                             | Static configuration (security policies, security.txt, connection catalog, job pacing) and ambient `*.d.ts` augmentations                                  |
| `database/schema.ts`, `migrations/`                   | The control plane's table definitions and D1 migrations (`migrations_dir`)                                                                                 |
| `database/tenant-migrations/`, `tenant-migrations.ts` | The tenant object's schema registry and the runner that applies it on boot                                                                                 |

## Key principle

The Worker resolves **identity** only (which tenant a request is for, by platform
domain, `cf.hostMetadata`, or a control-plane hostname lookup); the tenant Durable
Object holds that tenant's subjects, clients, signing keys and sessions in its own
SqlStorage database and runs the OIDC/OAuth2 provider surface directly. The control
plane (`customers`, `tenants`, `memberships`, `domains` in D1) never holds tenant
state itself, so the request path never waits on a control-plane read once a tenant
is resolved.
