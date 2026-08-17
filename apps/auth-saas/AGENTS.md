# Auth SaaS Platform

The multi-tenant identity platform: each tenant is an OIDC/OAuth2 provider running
isolated in its own Cloudflare Durable Object. The provider engine itself lives in
[`@pkg/oidc-provider`](../../packages/oidc-provider); this app is the thin host +
control plane (routing, tenant provisioning, custom domains, billing). See
[ADR-006](../../docs/adr/ADR-006-auth-saas-platform.md) and
[ADR-010](../../docs/adr/ADR-010-auth-saas-completion-and-tenant-migration.md).

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
- MUST follow MVC, use models for business logic, use controllers for handling requests and responses, use `remix/ui` for UI
- MUST keep the OIDC/OAuth2 provider logic in `@pkg/oidc-provider`; this app is a thin host (the tenant Durable Object wraps the engine) plus the control plane

## Structure

Laravel-style top-level layout: there is no `src/`, and each top-level directory names a
role — `bootstrap/` for runtime entry points, `routes/` for the route table, `app/` for
application logic, `resources/` for anything that renders, `config/` for ambient `*.d.ts`,
`database/` for schema and migrations. Import across them with the `~/<dir>/*` aliases
declared in `tsconfig.json` (e.g. `~/app/http/controllers/...`, `~/routes/web`); a
relative path is only for a sibling inside the same directory.

- `bootstrap/` — runtime entry points: `worker.ts` (Cloudflare `fetch`/`scheduled`
  handler, the only place Cloudflare APIs are used), `app.ts` (router assembly +
  global middleware + route mapping), `tenant.ts` (the per-tenant Durable Object,
  a thin wrapper over `@pkg/oidc-provider`).
- `routes/web.ts` — the route registry mapped in `bootstrap/app.ts`.
- `app/http/controllers/` and `app/http/middleware/` — the HTTP layer.
- `app/models/` — data + business-logic models (`remix/data-table` tables).
- `app/services/` — service classes (Polar, hostname, email, analytics, tenant API).
- `app/jobs/` — scheduled jobs (e.g. daily MAU reporting).
- `app/lib/` — app-internal helpers (fetch-router action/middleware/form wrappers,
  crypto, sessions, rate limiting).
- `resources/layouts/` — server-rendered HTML layouts.
- `database/migrations/` — D1 control-plane migrations (`migrations_dir`).
- `config/` — ambient `*.d.ts` (env + router-context augmentations).

## Key principle

The worker resolves **identity** only (which tenant a request is for, by platform
domain / `cf.hostMetadata` / same-zone hostname lookup); the tenant Durable Object
runs `@pkg/oidc-provider` against its own SqlStorage-backed database. Tenant config
is pushed into the DO, so the request path never waits on a control-plane read.
