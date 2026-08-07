# r3-auth

OAuth 2.0 Authorization Server and OpenID Connect Provider: it authenticates people with
a GitHub account or an email and password, and issues the ID, access and refresh tokens
every other app signs in with.

Production URL: https://auth.sergiodxa.com (still served by the `auth` worker; this worker
is reachable on its `workers.dev` subdomain until the custom domain moves)

This is a Remix v3 (fetch-router + `remix/ui`) rebuild of that server. It binds the same
D1 database, KV namespace, R2 signing keys and queue, so both workers can run side by side
while this one is verified endpoint by endpoint. The plan, the contracts relying parties
depend on, and the cutover steps live in
[docs/adr/r3-auth/ADR-001](../../docs/adr/r3-auth/ADR-001-port-auth-to-remix-v3.md).

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run db:local:migrate` to apply migrations to the local D1 database
3. Run `bun run dev` to start the development server at http://localhost:3002

Tests run from the repo root: `bun run test`, or `bun test apps/r3-auth --isolate` for this
app only.

## Cloudflare Services

| Service      | Binding                   | Purpose                                                                    |
| ------------ | ------------------------- | -------------------------------------------------------------------------- |
| D1 Database  | `DB`                      | Subjects, credentials, connections, sessions, clients and grants           |
| KV           | `KV`                      | Browser sessions, authorization codes, and the API's client/subject caches |
| R2           | `R2`                      | The ES256 signing key pair behind every issued token and the JWKS          |
| Queue        | `QUEUE`                   | Producer only — enqueues the daily expired-session sweep                   |
| Rate limiter | `TOKEN_RATE_LIMITER`      | `/oauth/token`, 20 requests / 60s                                          |
| Rate limiter | `INTROSPECT_RATE_LIMITER` | `/oauth/introspect`, 100 requests / 60s                                    |
| Rate limiter | `REVOKE_RATE_LIMITER`     | `/oauth/revoke`, 50 requests / 60s                                         |
| Rate limiter | `AUTHORIZE_RATE_LIMITER`  | `GET /authorize`, 30 requests / 60s                                        |
| Rate limiter | `LOGIN_RATE_LIMITER`      | `POST /authorize` and `/auth/*`, 10 requests / 60s                         |

Observability is enabled. `nodejs_compat` is on, because the JWT and billing dependencies
reach for Node built-ins.

The worker declares **only `queues.producers`** — no `queues.consumers`, no
`triggers.crons`, and no custom-domain `routes` entry. A Cloudflare queue has exactly one
consumer worker, and the worker serving production still holds that slot along with the
daily cron that feeds it. The `scheduled` and `queue` handlers in `bootstrap/worker.ts` are
therefore written but **unreachable** until cutover: nothing sweeps expired sessions from
this worker, and enqueuing from here is consumed by the other one.

### Cron Triggers

| Schedule    | Purpose                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| `0 0 * * *` | Enqueues `{ type: "cleanExpiredSessions" }` — **not declared yet** (see above) |

## Features

- **OAuth 2.0 Authorization Server** (RFC 6749): `authorization_code`, `refresh_token` and
  `client_credentials` grants, plus revocation (RFC 7009) and introspection (RFC 7662).
- **OpenID Connect Provider** (Core 1.0): ID tokens, UserInfo, discovery, and the
  `query`, `fragment` and `form_post` response modes.
- **Two authentication methods, and only two:** a GitHub account (`remix/auth`'s GitHub
  provider) and email/password credentials hashed with PBKDF2-HMAC-SHA256 through
  `@pkg/crypto`. There is no Google provider, no passkey, no magic link, and no other
  social provider — `/auth/:provider` accepts `github` and redirects anything else back to
  `/authorize`.
- **PKCE enforced**: a `code_challenge` on the authorization request is carried through the
  login flow and its `code_verifier` is verified at the token endpoint. A code stored
  without a challenge still redeems without a verifier, so non-PKCE clients keep working.
- **ES256 JWT signing** from a key pair stored in R2 and published at
  `/.well-known/jwks.json`.
- **Single sign-on and session management**: `sessions.id` is the refresh token, the
  account area lists and revokes sessions, and the `op_browser_state` cookie plus
  `/oidc/check-session` implement OIDC Session Management 1.0.
- **RP-initiated, back-channel and front-channel logout** (OIDC Logout 1.0): logout tokens
  are dispatched to every other client with a back-channel URI, and front-channel URIs are
  rendered as hidden iframes.
- **Admin area** for clients and subjects, with a one-time reveal of a newly generated
  client secret.
- **Machine-to-machine API**: `client_credentials` token plus `GET /api/subjects/:id`.
- **Rate limiting** on every token, authorization and login endpoint (see below).
- **Server-rendered HTML.** The only first-party JavaScript is the copy-to-clipboard button
  on the client-create page; dialogs are native `<dialog>` elements driven by command
  invokers.
- **Localized copy** through `@pkg/i18n`; English is the only catalog today
  (`app/locales/en.ts`).

## Integrations

| Service | Purpose                                                                 |
| ------- | ----------------------------------------------------------------------- |
| GitHub  | Social sign-in (OAuth app; `read:user user:email`)                      |
| Polar   | A subject is mirrored as a Polar customer when it is first created      |
| Uptime  | The session-sweep job pings its cron monitor with `UPTIME_CRON_API_KEY` |

## Routes

Endpoint paths are a frozen contract: relying parties hardcode them instead of reading
discovery.

### OAuth 2.0 / OpenID Connect

| Route                                     | Methods | Description                                                                        |
| ----------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `/authorize`                              | GET     | Authorization endpoint: SSO, `prompt` handling, or the sign-in page                |
| `/authorize`                              | POST    | Email/password sign-in and registration                                            |
| `/oauth/token`                            | POST    | Token endpoint; client credentials in an HTTP Basic header **or** in the form body |
| `/oauth/revoke`                           | POST    | Token revocation                                                                   |
| `/oauth/introspect`                       | POST    | Token introspection                                                                |
| `/userinfo`                               | GET     | UserInfo claims for a bearer access token, gated by the granted scopes             |
| `/oidc/logout`                            | GET     | RP-initiated logout with `id_token_hint` and `post_logout_redirect_uri`            |
| `/oidc/logout`                            | POST    | The interactive sign-out button                                                    |
| `/oidc/check-session`                     | GET     | The OIDC Session Management check-session iframe                                   |
| `/.well-known/openid-configuration`       | GET     | OIDC discovery document                                                            |
| `/.well-known/oauth-authorization-server` | GET     | The same document, per RFC 8414                                                    |
| `/.well-known/jwks.json`                  | GET     | Public JSON Web Key Set                                                            |

### Authentication

| Route                      | Methods | Description                                                             |
| -------------------------- | ------- | ----------------------------------------------------------------------- |
| `/auth/:provider`          | POST    | Starts GitHub sign-in; any other provider redirects to `/authorize`     |
| `/auth/:provider/callback` | GET     | GitHub callback: resolves or provisions the subject, then issues a code |
| `/auth/callback`           | GET     | This server's own client callback, for signing in to the account area   |

### Account

| Route                   | Methods | Description                                                  |
| ----------------------- | ------- | ------------------------------------------------------------ |
| `/account/profile`      | GET     | Profile overview                                             |
| `/account/profile/edit` | GET     | Edit form                                                    |
| `/account/profile/edit` | POST    | Updates display name, username and avatar                    |
| `/account/sessions`     | GET     | Active sessions with device, IP and expiry                   |
| `/account/sessions`     | POST    | `intent=revoke` or `intent=revoke-all`                       |
| `/account/grants`       | GET     | Clients this subject has authorized                          |
| `/account/grants`       | POST    | `intent=revoke` — drops the grant and that client's sessions |

### Admin

Every route requires the `admin` role; anyone else is redirected to `/account/sessions`.

| Route                             | Methods | Description                                                |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| `/admin`                          | GET     | Client, subject and active-session counts                  |
| `/admin/clients`                  | GET     | Paginated client list                                      |
| `/admin/clients`                  | POST    | `intent=delete`                                            |
| `/admin/clients/new`              | GET     | Create form                                                |
| `/admin/clients/new`              | POST    | Creates a client and reveals its generated secret once     |
| `/admin/clients/:clientId`        | GET     | Client detail                                              |
| `/admin/clients/:clientId`        | POST    | `intent=delete`                                            |
| `/admin/clients/:clientId/edit`   | GET     | Edit form, including the logout URIs                       |
| `/admin/clients/:clientId/edit`   | POST    | Updates the client                                         |
| `/admin/subjects`                 | GET     | Paginated subject list                                     |
| `/admin/subjects/:subjectId`      | GET     | Subject detail with sessions and connections               |
| `/admin/subjects/:subjectId`      | POST    | `intent=delete`, `revoke-session` or `revoke-all-sessions` |
| `/admin/subjects/:subjectId/edit` | GET     | Edit form                                                  |
| `/admin/subjects/:subjectId/edit` | POST    | Updates the subject                                        |

### API and utility

| Route                      | Methods | Description                                                               |
| -------------------------- | ------- | ------------------------------------------------------------------------- |
| `/`                        | GET     | Redirects to `/authorize`                                                 |
| `/healthcheck`             | GET     | `OK`, or a 500 naming the failed dependency (D1 or KV)                    |
| `/api/subjects/:subjectId` | GET     | `{ subject }` for a `client_credentials` bearer token; `Server-Timing` on |

Anything unmatched renders the localized 404 page.

## Rate Limiting

Implemented with [Cloudflare rate limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
through `@pkg/rate-limit`. Limits are per Cloudflare location (edge-local).

| Endpoint                          | Limit       | Key                                         |
| --------------------------------- | ----------- | ------------------------------------------- |
| `POST /oauth/token`               | 20 req/min  | client id for `client_credentials`, else IP |
| `POST /oauth/introspect`          | 100 req/min | client id                                   |
| `POST /oauth/revoke`              | 50 req/min  | client id                                   |
| `GET /authorize`                  | 30 req/min  | IP                                          |
| `POST /authorize`, `POST /auth/*` | 10 req/min  | IP                                          |

A refused request answers `429` with
`{ "error": "too_many_requests", "error_description": "Rate limit exceeded. Please try again later." }`,
the `RateLimit` / `RateLimit-Policy` fields, and `Retry-After` set to the limiter's full
window. The bindings report no quota state, so `remaining` is omitted rather than guessed,
and the limits declared in `wrangler.jsonc` must stay in step with the adapters in
`app/services/rate-limiters.ts` or the emitted headers go stale. A binding that cannot
answer is logged and the request is allowed through: a limiter outage must not stop token
issuance.

## KV Key Layout

Everything below the session prefix is shared at runtime with the worker still serving
production, so the keys and the stored JSON stay interchangeable between the two. Only
`session:` records belong to this worker alone.

| Key                                       | TTL     | Contents                       |
| ----------------------------------------- | ------- | ------------------------------ |
| `authz-code:<code>`                       | 10 min  | An issued authorization code   |
| `clients:<clientId>`                      | 7 days  | A client resolved for `/api/*` |
| `clients:<clientId>:subjects:<subjectId>` | 7 days  | One client's copy of a subject |
| `session:<id>`                            | 30 days | A browser session record       |

**Operator note:** because the API's client lookup is cached for seven days, a client that
is deleted or whose secret is rotated keeps authenticating against `/api/*` until its entry
expires. Purge the `clients:<clientId>` key when a client must lose access immediately.

## Database

The D1 database is shared with the worker serving production, so the schema is frozen: all
six tables (`subjects`, `credentials`, `connections`, `sessions`, `clients`, `grants`) are
mirrored in `database/schema.ts` and every timestamp column is an integer holding epoch
milliseconds. `sessions.id` **is** the refresh token handed to clients.

Migrations are located in `database/migrations/`.

```bash
bun run db:local:migrate  # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
```

## Scripts

| Script              | Description                            |
| ------------------- | -------------------------------------- |
| `dev`               | Start the dev server on port 3002      |
| `build`             | Build the worker and client bundles    |
| `start`             | Preview the production build           |
| `typecheck`         | Type-check the app                     |
| `cf:typegen`        | Regenerate `worker-configuration.d.ts` |
| `cf:deploy`         | Deploy the worker                      |
| `db:local:migrate`  | Apply migrations to local D1           |
| `db:remote:migrate` | Apply migrations to production D1      |

## Deployment

Run `bun run build` first — `wrangler deploy` does not build the Vite app — then deploy.

```bash
bun run build
bun run cf:deploy
```

Secrets are set with `bunx wrangler secret put <NAME>`.

## Environment Variables

See `.env.example` for required environment variables.
