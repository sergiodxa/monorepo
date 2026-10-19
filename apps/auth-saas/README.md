# Auth SaaS

A multi-tenant identity platform: each tenant is an OIDC/OAuth2 provider running
isolated in its own Cloudflare Durable Object over [`@sdxc/oidc-provider`](../../packages/oidc-provider).

Production URL: https://auth.sergiodxa.com

## Start

```sh
bun install
sdxc run typegen
sdxc run db migrate
bun dev
```

In a fresh clone, copy `.env.example` to `.dev.vars` first. `bun dev` serves the app at
http://localhost:3004. Run `sdxc run typegen` again whenever you change a binding in
`wrangler.jsonc`.

## Everyday commands

```sh
sdxc make controller dashboard/settings    # a page, mapped in routes/web.ts
sdxc make migration add-tenant-notes       # then: sdxc run db migrate
sdxc make migration add-scopes --chain tenant # a tenant Durable Object migration
sdxc make model tenant-note                # then: ctx.models.tenantNotes
sdxc make job reports/daily --cron "0 8 * * *"
sdxc make command tenants/suspend          # then: sdxc run tenants suspend

sdxc run db console                        # SQL prompt over the local control-plane database
sdxc run about                             # the app's name and the versions it runs on
bun check                                  # format, lint and types, from the repo root
```

`sdxc make` writes the file where it belongs with a test beside it, and maps it so it works
right away.

## Cloudflare Services

| Service          | Binding                    | Purpose                                                         |
| ---------------- | -------------------------- | --------------------------------------------------------------- |
| Durable Objects  | `TENANT`                   | One per tenant; runs `@sdxc/oidc-provider` over embedded SQLite |
| D1 Database      | `PLATFORM_DB`              | Control plane: tenants, members, hostnames, subscriptions       |
| KV               | `HOSTNAMES_KV`             | Same-zone hostname → tenant resolution cache                    |
| Analytics Engine | `ANALYTICS`                | Monthly-active-user usage tracking                              |
| Email            | `SEND_EMAIL`               | Cloudflare Email Sending (verification, magic links)            |
| Rate Limiting    | `AUTH_RATE_LIMITER` et al. | Per-IP limits on auth, sensitive, and management routes         |
| Static Assets    | `ASSETS`                   | Hashed client entry, island chunks and stylesheets              |

Observability is enabled.

### Cron Triggers

| Schedule    | Purpose                          |
| ----------- | -------------------------------- |
| `0 1 * * *` | Daily monthly-active-user report |

## Features

- OIDC/OAuth2 provider per tenant (authorization code + PKCE, refresh, userinfo, JWKS)
- WebAuthn passkey registration and authentication; email verification
- Runtime-defined resources/scopes, clients, subjects, roles, and branding per tenant
- Custom domains via Cloudflare for SaaS; same-zone `sso.*` hostnames
- Per-tenant Polar billing with an internal (non-billed) tenant flag

## Integrations

- **Cloudflare for SaaS** — custom hostname lifecycle + TLS
- **Cloudflare Email Sending** — transactional email (the only email transport)
- **Polar.sh** — per-tenant subscriptions and the customer portal

## Routes

| Route                                        | Description                                     |
| -------------------------------------------- | ----------------------------------------------- |
| `auth.sergiodxa.com`                         | Platform dashboard + marketing                  |
| `sso.sergiodxa.com`, `sso.blog.*`            | Same-zone tenant hostnames (OIDC surface)       |
| `/authorize`, `/oauth/*`, `/oidc/*`          | Tenant OIDC/OAuth2 endpoints (served by the DO) |
| `/.well-known/*`, `/userinfo`, `/webauthn/*` | Discovery, userinfo, passkey flows              |
| `/api/*`                                     | Tenant Management API                           |
| `/dashboard/*`                               | Account + tenant management                     |
| `/api/webhooks/polar`                        | Polar webhook                                   |

## Database

Control-plane migrations live in `database/migrations/`, the tables they create are
defined in `database/schema.ts`, and the `@sdxc/data-model` models over them live in
`app/models/`, reached from routes and jobs as `ctx.models`.

```bash
sdxc run db migrate          # Apply migrations to the local database
sdxc run db migrate --remote # Apply migrations to production
```

Each tenant's own schema lives in `database/tenant-migrations/` and is applied by the
tenant Durable Object itself on boot. That object is `app/models/tenant/object.ts`, which `bootstrap/worker.ts` exports as
`Tenant`, over the per-table stores beside it.

## Scripts

| Script      | Description                                                 |
| ----------- | ----------------------------------------------------------- |
| `dev`       | Start the development server                                |
| `build`     | Build for production                                        |
| `start`     | Preview the production build                                |
| `cli`       | Run a command from `app/commands/`, what `sdxc run` invokes |
| `typecheck` | Type-check                                                  |

To start over with an empty local database, delete `.wrangler/` and run
`sdxc run db migrate` again.

## Deployment

First-time setup (D1/KV/Analytics/Email, DNS, secrets, Polar) is documented in
[DEPLOYMENT.md](./DEPLOYMENT.md). Once configured:

```bash
sdxc deploy
```

It builds, applies the pending control-plane migrations to production with
`sdxc run db migrate --remote`, then uploads the Worker with `sdxc run deploy`
(`wrangler deploy`); `sdxc run deploy --dry-run` checks the build without uploading.

## Environment Variables

See `.env.example` for required secrets and variables.
