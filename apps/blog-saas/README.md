# Blog SaaS

A multi-tenant blog platform: an account creates blogs, each running isolated in its
own Cloudflare Durable Object over the host-agnostic [`@sdxc/blog-engine`](../../packages/blog-engine).

Production URL: https://blog.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development.
2. Run `bun run db:local:migrate` to create the local control-plane D1 schema.
3. Run `bun run dev` to start the development server at http://localhost:3005

## Cloudflare Services

| Service          | Binding       | Purpose                                                         |
| ---------------- | ------------- | --------------------------------------------------------------- |
| Durable Objects  | `BLOG`        | One per blog; runs `@sdxc/blog-engine` over embedded SQLite     |
| D1 Database      | `PLATFORM_DB` | Control plane: accounts, blogs, hostnames, subscriptions, usage |
| KV               | `SLUG_CACHE`  | Subdomain slug → blog id resolution (write-through)             |
| Analytics Engine | `ANALYTICS`   | Billable page-view metering                                     |
| Static Assets    | `ASSETS`      | Platform dashboard/marketing static files                       |
| Queue            | `QUEUE`       | `blog-saas-jobs`: the background jobs the cron triggers enqueue |

Observability is enabled.

### Background Jobs

A cron trigger enqueues the jobs declared on its schedule and returns; each one runs
when the queue delivers it, so a job gets its own invocation, its own retries, and one
log entry per run.

| Schedule    | Job                 | Purpose                                                       |
| ----------- | ------------------- | ------------------------------------------------------------- |
| `0 1 * * *` | `reportUsage`       | Aggregate Analytics Engine page views → `usage_daily` → Polar |
| `0 2 * * *` | `purgeDeletedBlogs` | Hard-delete blogs past the 30-day retention window            |
| `0 2 * * *` | `pollHostnames`     | Refresh pending custom hostnames and activate live ones       |

## Features

- One Durable Object per blog with an embedded SQLite database (true isolation)
- Automatic `{slug}.blog.sergiodxa.com` subdomains + custom domains via Cloudflare for SaaS
- Per-blog OIDC client provisioned on the sso tenant at blog creation
- Account-level Polar subscription: base fee + pooled page-view allowance with metered overage
- Soft-delete with a 30-day restore window; suspension/reactivation driven by billing

## Integrations

- **auth-saas** (`sso.blog.sergiodxa.com`) — OIDC login for the dashboard and each blog's admin
- **Cloudflare for SaaS** — custom hostname lifecycle + TLS
- **Polar.sh** — subscriptions, metering, and the customer portal

## Routes

| Route                           | Description                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| `/`                             | Marketing landing page                                            |
| `/health`                       | Liveness probe                                                    |
| `/auth/{login,callback,logout}` | OIDC login against the sso tenant                                 |
| `/dashboard`                    | Blog list + subscription status                                   |
| `/dashboard/blogs/*`            | Create, view, rename, delete, restore blogs; custom domain; usage |
| `/dashboard/billing`            | Checkout + customer portal                                        |
| `/api/webhooks/polar`           | Polar webhook (subscription lifecycle)                            |

Tenant traffic (`{slug}.blog.sergiodxa.com`, custom domains) is routed by the
worker entry to the blog's Durable Object, which serves the engine.

## Database

Control-plane migrations live in `database/migrations/`.

```bash
bun run db:local:migrate  # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
```

Each blog's own content schema is owned and migrated by `@sdxc/blog-engine` inside its DO.

## Scripts

| Script              | Description                             |
| ------------------- | --------------------------------------- |
| `dev`               | Start the development server            |
| `build`             | Build for production                    |
| `start`             | Preview the production build            |
| `cf:deploy`         | Deploy to Cloudflare Workers            |
| `cf:typegen`        | Generate Cloudflare binding types       |
| `db:local:migrate`  | Apply control-plane migrations locally  |
| `db:remote:migrate` | Apply control-plane migrations remotely |
| `typecheck`         | Type-check                              |

## Deployment

First-time setup (D1/KV/Analytics, DNS, secrets, Polar) is documented in
[DEPLOYMENT.md](./DEPLOYMENT.md). Once configured:

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required secrets and variables.
