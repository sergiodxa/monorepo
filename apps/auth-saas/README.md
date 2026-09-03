# Auth SaaS

A multi-tenant identity platform: each tenant is an OIDC/OAuth2 provider running
isolated in its own Cloudflare Durable Object over [`@sdxc/oidc-provider`](../../packages/oidc-provider).

Production URL: https://auth.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development.
2. Run `bun run db:local:migrate` to create the local control-plane D1 schema.
3. Run `bun run dev` to start the development server at http://localhost:3004

## Cloudflare Services

| Service          | Binding                    | Purpose                                                         |
| ---------------- | -------------------------- | --------------------------------------------------------------- |
| Durable Objects  | `TENANT`                   | One per tenant; runs `@sdxc/oidc-provider` over embedded SQLite |
| D1 Database      | `PLATFORM_DB`              | Control plane: tenants, members, hostnames, subscriptions       |
| KV               | `HOSTNAMES_KV`             | Same-zone hostname → tenant resolution cache                    |
| Analytics Engine | `ANALYTICS`                | Monthly-active-user usage tracking                              |
| Email            | `SEND_EMAIL`               | Cloudflare Email Sending (verification, magic links)            |
| Rate Limiting    | `AUTH_RATE_LIMITER` et al. | Per-IP limits on auth, sensitive, and management routes         |
| Static Assets    | `ASSETS`                   | Dashboard + tenant client bundles                               |

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

Control-plane migrations live in `database/migrations/`.

```bash
bun run db:local:migrate  # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
```

Each tenant's own OIDC schema is owned and migrated by `@sdxc/oidc-provider` inside its DO.

## Scripts

| Script              | Description                             |
| ------------------- | --------------------------------------- |
| `dev`               | Start the development server            |
| `build`             | Build for production                    |
| `build:client`      | Build browser and client bundles        |
| `start`             | Preview the production build            |
| `cf:deploy`         | Deploy to Cloudflare Workers            |
| `cf:typegen`        | Generate Cloudflare binding types       |
| `db:local:drop`     | Drop the local database                 |
| `db:local:migrate`  | Apply control-plane migrations locally  |
| `db:remote:migrate` | Apply control-plane migrations remotely |
| `typecheck`         | Type-check                              |

## Deployment

First-time setup (D1/KV/Analytics/Email, DNS, secrets, Polar) is documented in
[DEPLOYMENT.md](./DEPLOYMENT.md). Once configured:

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required secrets and variables.
