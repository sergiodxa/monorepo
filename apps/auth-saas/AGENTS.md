# Auth SaaS Platform

This app is an Auth SaaS platform that provides authentication and authorization services for applications.

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

## Structure

Laravel-style top-level layout (see `templates/app`). Import with the `~/<dir>/*`
aliases (e.g. `~/app/http/controllers/...`, `~/routes/web`), not `src/`.

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
