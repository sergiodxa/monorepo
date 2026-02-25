# Auth App

OAuth 2.0 and OpenID Connect (OIDC) Authorization Server that serves as the central authentication service for the monorepo ecosystem.

Production URL: https://auth.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3001

## Cloudflare Services

| Service       | Binding | Purpose                                                        |
| ------------- | ------- | -------------------------------------------------------------- |
| D1 Database   | `DB`    | Stores users, OAuth clients, sessions, tokens, and credentials |
| KV            | `KV`    | Caching for sessions and tokens                                |
| R2            | `R2`    | File storage for user profile images                           |
| Cron Triggers | -       | Daily at midnight for cleanup of expired sessions and tokens   |

Observability is enabled.

## Features

- OAuth 2.0 Authorization Server (RFC 6749)
- OpenID Connect Provider (Core 1.0)
- Multi-provider authentication (GitHub, Google, email/password)
- PKCE support for enhanced security
- ES256 JWT signing
- Session management with refresh tokens
- i18n support with react-i18next

## Routes

### OAuth 2.0 / OIDC

| Route                                     | Description                  |
| ----------------------------------------- | ---------------------------- |
| `/authorize`                              | OAuth authorization endpoint |
| `/oauth/token`                            | Token exchange endpoint      |
| `/oauth/revoke`                           | Token revocation endpoint    |
| `/oauth/introspect`                       | Token introspection endpoint |
| `/.well-known/oauth-authorization-server` | OAuth discovery document     |
| `/.well-known/jwks.json`                  | JSON Web Key Set             |
| `/oidc/logout`                            | OIDC logout endpoint         |

### Authentication

| Route                      | Description                                   |
| -------------------------- | --------------------------------------------- |
| `/auth/:provider`          | Initiate external OAuth flow (GitHub, Google) |
| `/auth/:provider/callback` | OAuth callback handler                        |
| `/sessions`                | Session management                            |
| `/healthcheck`             | Health check endpoint                         |

## Database

Migrations are located in `db/migrations/`.

```bash
bun run db:local:migrate   # Apply migrations locally
bun run db:remote:migrate  # Apply migrations to production
bun run orm:generate       # Generate Drizzle migrations
```

## Scripts

| Script              | Description                 |
| ------------------- | --------------------------- |
| `dev`               | Start development server    |
| `build`             | Build for production        |
| `start`             | Preview production build    |
| `cf:deploy`         | Deploy to Cloudflare        |
| `cf:typegen`        | Generate Cloudflare types   |
| `rr:routes`         | List React Router routes    |
| `rr:typegen`        | Generate React Router types |
| `db:local:drop`     | Drop local database         |
| `db:local:migrate`  | Apply local migrations      |
| `db:remote:migrate` | Apply remote migrations     |
| `orm:generate`      | Generate Drizzle migrations |

## Deployment

```bash
bun run cf:deploy
```

## Rate Limiting

Rate limiting is implemented using [Cloudflare Workers Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). Each endpoint has its own rate limiter configured in `wrangler.jsonc`.

| Endpoint            | Limit       | Key             | Rationale                           |
| ------------------- | ----------- | --------------- | ----------------------------------- |
| `/oauth/token`      | 20 req/min  | client_id or IP | Prevents credential brute force     |
| `/oauth/introspect` | 100 req/min | client_id       | Higher limit for resource servers   |
| `/oauth/revoke`     | 50 req/min  | client_id       | Moderate limit for token revocation |
| `/authorize`        | 30 req/min  | IP              | Prevents client enumeration         |
| `/auth/*`           | 10 req/min  | IP              | Strict limit for login attempts     |

Rate limits are per Cloudflare location (edge-local) for optimal performance.

## Environment Variables

See `.env.example` for required environment variables.
