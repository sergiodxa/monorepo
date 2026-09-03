# Blog SaaS Platform

The multi-tenant platform for `@pkg/blog-engine`: an account creates blogs, each
running isolated in its own Cloudflare Durable Object; the platform owns routing,
provisioning, custom domains, and billing. See
[ADR-009](../../docs/adr/ADR-009-blog-saas-platform.md).

## Commands

```bash
bun run dev               # Run development server (port 3005)
bun run build             # Build for production
bun run cf:deploy         # Deploy to Cloudflare Workers
bun run cf:typegen        # Generate Cloudflare bindings types
bun run db:local:migrate  # Apply control-plane D1 migrations (local)
bun run db:remote:migrate # Apply control-plane D1 migrations (remote)
bun run typecheck         # Type-check
```

## Rules

- MUST use Bun for installs, scripts, and tests; run linters/formatters/typecheck from the repo root.
- MUST use `bunx wrangler` for Cloudflare commands, never `wrangler` directly.
- MUST use `remix/*` packages, not React or React Router.
- MUST keep the blog application logic in `@pkg/blog-engine`; this app is a thin host.

## Structure

Laravel-style layout: no `src/`, and each top-level directory names a role —
`bootstrap/` (runtime entry points), `routes/` (the route table), `app/` (application
logic), `resources/` (rendering), `config/` (ambient `*.d.ts`), `database/` (schema and
migrations). Import across them with the `~/<dir>/*` aliases declared in `tsconfig.json`;
a relative path is only for a sibling inside the same directory.

- `bootstrap/` — `worker.ts` (fetch/scheduled/queue entry: hostname routing, page-view
  metering, job dispatch), `app.ts` (dashboard router), `tenant.ts` (the Blog Durable
  Object — a thin wrapper over `@pkg/blog-engine`).
- `routes/web.ts` — dashboard + marketing routes.
- `app/http/controllers/` — marketing, health, auth (OIDC vs the sso tenant),
  `dashboard/*`, and the Polar webhook.
- `app/models/` — control-plane rows: Account, Blog, Hostname, Subscription, UsageDaily.
- `app/services/` — BlogProvisioner (lifecycle + DO RPC + KV), HostnameService
  (CF for SaaS), PolarService (billing), analytics (AE SQL rollups).
- `app/jobs/` — the job map (`index.ts`), the dispatcher both worker handlers delegate
  to, the middleware every job runs inside, and one handler per job: report-usage,
  purge-deleted-blogs, poll-hostnames.
- `database/migrations/` — control-plane D1 schema.
- `config/env.d.ts` — binding + secret types.

## Key principle

The worker resolves **identity** only (which blog a request is for); the Blog DO
enforces **state** (suspension, deletion, subdomain-disabled-after-custom-domain)
from its own control-plane-pushed `platform_meta`. There is no per-request
control-plane read that can go stale.
