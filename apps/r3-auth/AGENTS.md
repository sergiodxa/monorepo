# Agent Guidelines

This app is the OAuth 2.0 / OpenID Connect authorization server every other app signs in
against. A subtle regression in token issuance, redirect-URI validation or logout fan-out
breaks every relying party at once, and usually silently. Read this file before changing
anything under `app/auth/`, `app/http/controllers/{authorize,oauth,oidc,api}` or
`app/config.ts`.

Rules follow RFC 2119: "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY" in uppercase
indicate requirement levels. The root `AGENTS.md` applies too; this file adds to it and
never overrides it.

## Frozen Contracts

These are the things relying parties depend on. Breaking one is a coordinated release of
every client app, not a change to this app. `apps/blog` and `apps/uptime` pin them.

- MUST keep the `iss` claim and the discovery `issuer` as the **scheme-less** string
  `auth.sergiodxa.com` (`ISSUER` in `app/config.ts`). Clients compare that exact string when
  verifying an ID token; adding the scheme rejects every token they receive. The `iss`
  authorization-response parameter stays `https://auth.sergiodxa.com`, and the two
  deliberately disagree.
- MUST keep these paths exactly where they are: `/authorize`, `/oauth/token`,
  `/oauth/revoke`, `/oauth/introspect`, `/userinfo`, `/oidc/logout`,
  `/oidc/check-session`, `/.well-known/jwks.json`,
  `/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`,
  `/api/subjects/:subjectId`. Clients hardcode them instead of reading discovery.
- MUST keep signing the ES256 key pair stored in R2 and publishing the matching JWKS with
  the same key ids. Every worker issuing tokens for this issuer reads the same R2 file; a
  second key pair means clients reject tokens they cannot verify.
- MUST keep `/oauth/token` accepting client credentials **in the form body** as well as in
  an HTTP Basic header. `remix/auth`'s OIDC provider defaults to body auth, so a regression
  here 400s every login. This has broken once already.
- MUST keep the supported scopes `openid profile email` and the UserInfo claim set `sub`,
  `email`, `email_verified`, `name`, `preferred_username`, `picture`, each gated by the
  scope the access token was actually issued with.
- MUST keep RP-initiated logout working with `id_token_hint` and
  `post_logout_redirect_uri`, including back-channel logout tokens to every other client
  and front-channel URI collection.
- MUST keep `grant_type=client_credentials` plus `GET /api/subjects/:subjectId` answering
  the `{ subject }` envelope, with its field names and ISO-8601 timestamps.
- MUST NOT change the refresh-token semantics: **`sessions.id` IS the refresh token**.
  Rotation, revocation and the account area's session list all follow from that.
- MUST keep the D1 schema frozen — the database is shared with the worker serving
  production — and MUST keep timestamp columns as integers holding epoch milliseconds (the
  container's `Database` sets `now: () => Date.now()` for exactly this reason).
- MUST keep the KV key shapes shared with that worker interchangeable: `authz-code:<code>`
  (10 min), `clients:<clientId>` and `clients:<clientId>:subjects:<subjectId>` (7 days).
  Own sessions live under `session:` and are this app's alone.
- MUST keep the `op_browser_state` cookie's name, value derivation and attributes
  (`Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000`); `/oidc/check-session` reads
  it in the browser.

## Stack Rules

- MUST use `remix/router` (`createAction` / `createController`) for HTTP actions, and
  MUST declare every URL in `routes/web.ts` and link through `routes.<name>.href(...)`
  rather than writing a path string.
- MUST render pages as `remix/ui` JSX through `ctx.render(...)`, built from `@pkg/ui`
  components with inline `css()` mixins from `@pkg/u` for the gaps. No React, no Tailwind,
  no HTML strings. The one documented exception is `/oidc/check-session`, whose body is a
  script page defined by OIDC Session Management 1.0.
- MUST use the Handle pattern for components and MUST NOT call a component as a plain
  function; MUST NOT pass `key=` to a `remix/ui` or `@pkg/ui` component.
- MUST validate every external input with `remix/data-schema` through `@pkg/validate`, in a
  validator module under `app/http/validators/`. Zod MUST NOT be added back.
- MUST persist through `remix/data-table` (`@pkg/data-table-d1` in production) from
  `app/data/`; no ORM, no raw SQL in controllers. DB-facing field names stay `snake_case`.
- MUST resolve services (`Database`, `PolarClient`, `RateLimiters`) through
  `@pkg/service-container` with `inject([...])`, and MUST keep request-lifetime values
  (session, current subject, request logger, locale) in middleware and request context
  instead.
- MUST keep Cloudflare-specific code in `bootstrap/worker.ts` and the router wiring in
  `bootstrap/app.tsx`; MUST import `env` from `cloudflare:workers`.
- MUST prefer what Remix v3 ships (`remix/middleware/session`, `remix/middleware/cop`,
  `remix/middleware/form-data`, `remix/middleware/method-override`,
  `remix/middleware/render`, `remix/auth`) over hand-rolled equivalents, and MUST check
  `docs/vendor/@remix-run/<package>/README.md` first.
- MUST use `@pkg/result` for expected failures. The engine's `throw`-based token path stays
  as it is — it is part of its tested contract — and controllers MUST catch and map to OAuth
  error envelopes.
- MUST keep the app server-rendered: native `<dialog>` with command invokers for
  confirmations, `<details>` for disclosure, links styled with `aria-current` for
  navigation. The only client island is the client-secret copy button; adding another needs
  a reason the platform cannot cover.
- MUST route every user-facing string through `ctx.i18next.t(...)` and `app/locales/en.ts`;
  MUST NOT hardcode English copy in a view.
- MUST NOT use `as any`, and MUST NOT call `getContext()` inside a controller when `ctx` is
  available.

## Security

### OAuth 2.0 and OIDC compliance

- MUST implement OAuth 2.0 (RFC 6749) and OpenID Connect Core 1.0 as specified, and MUST
  keep the discovery documents describing what the server actually does — discovery that
  overstates or understates the endpoints is a defect, not cosmetics.
- MUST sign and verify every JWT with ES256, using the keys loaded from R2 via
  `app/services/signing-keys.ts`.
- MUST validate every OAuth parameter before acting on it, through the endpoint's validator.
- MUST enforce PKCE: read `code_challenge` / `code_challenge_method` on `/authorize`, carry
  them in the session `authz` state, and verify the `code_verifier` at the token endpoint. A
  code stored without a challenge redeems without a verifier, and that fallback MUST NOT be
  widened into skipping verification when a challenge was stored.
- MUST validate `redirect_uri` by **exact match** against the client's registered value —
  never a prefix, pattern, wildcard or normalized comparison.
- MUST validate `post_logout_redirect_uri` against the client's registered logout URI by
  exact match too.
- MUST rate-limit the token, introspection, revocation, authorization and login endpoints,
  keeping the published `429` body and headers (`app/services/rate-limit.ts`).
- MUST fail open on a rate-limiter outage: a broken limiter MUST NOT stop token issuance.

### Tokens and sessions

- MUST generate every token, code, salt and secret from a cryptographically secure random
  source (`@pkg/crypto`'s `randomBytes`), never `Math.random`.
- MUST keep the token lifetimes: access token 1 hour, ID token 1 hour, authorization code 10
  minutes, session/refresh token 30 days (`app/config.ts`, `database/schema.ts`).
- MUST treat an authorization code as single-use: consuming it deletes it, and a replay MUST
  fail.
- MUST delete the session row on logout, so the refresh token dies with it, and MUST send
  back-channel logout tokens to every other client with a registered URI.
- MUST compare secrets and hashes with a timing-safe comparison (`timingSafeEqual` from
  `@pkg/crypto`).

### Passwords and client credentials

- MUST hash passwords with PBKDF2-HMAC-SHA256 through `@pkg/crypto`'s `password` module, and
  MUST use `needsRehash` to upgrade a stored hash on a successful sign-in. `bcryptjs` is
  gone and MUST NOT come back: the production `credentials` table holds no rows, so no
  legacy hash exists to verify.
- MUST NOT log, render, or echo back a password, an authorization code, a token, a client
  secret, or a hash.
- Client secrets are stored in plaintext in D1 and compared timing-safely. That is a known,
  deferred defect with an external blast radius (the stored copy is the only one clients
  hold); it MUST NOT be "fixed" opportunistically inside another change — it needs its own
  ADR and a migration.
- MUST authenticate confidential clients on every token, revocation and introspection call,
  accepting HTTP Basic and body credentials on `/oauth/token`.

### Cross-origin protection

- MUST keep the `cop()` bypass list in `bootstrap/app.tsx` (`/oauth/{path...}`,
  `/api/{path...}`, `/oidc/logout`) accurate. Those are cross-origin POSTs by design,
  carrying credentials stronger than an `Origin` header. Getting the list wrong does not
  fail loudly — it fails as every relying party's login breaking at once.
- MUST keep browser-facing form posts inside cross-origin protection.

### Error handling and logging

- MUST answer machine endpoints with OAuth-compliant error envelopes (`error`,
  `error_description`) and the right status, and MUST redirect authorization errors back to
  the validated `redirect_uri` with `error`, `error_description`, `state` and `iss`.
- MUST keep refusals indistinguishable where distinguishing them helps an attacker (missing
  vs. malformed vs. expired token, wrong password vs. unknown address).
- MUST use `@pkg/logger` (`ctx.logger` in HTTP handlers, the job's own `this.logger`), never
  `console.log`, and MUST log event names plus ids only — never token, code, secret or
  password material.
- MUST send `Cache-Control: no-store` (and `Pragma: no-cache`) on token responses and on the
  `form_post` page.

## Operational Notes

- The worker declares only `queues.producers`, with no `queues.consumers`, no
  `triggers.crons` and no custom-domain `routes` entry, because a Cloudflare queue has
  exactly one consumer worker and the worker serving production still holds that slot. The
  `scheduled` and `queue` handlers therefore exist but are unreachable; do not "fix" this by
  adding a consumer before cutover.
- The API caches a resolved client in KV for 7 days, so a deleted client or a rotated secret
  keeps authenticating against `/api/*` until the `clients:<clientId>` key expires.
- The session cookie is `auth:session` — deliberately not the name the previous server used,
  so a rollback finds its own untouched cookie instead of one it cannot parse.
- MUST NOT reach into another app's source. Copy and adapt instead.
- After a `wrangler.jsonc` change: `bun cf:typegen`, then `bun run build`, then
  `bunx wrangler deploy --dry-run`.

## Reference Files

- Bootstrap
  - `bootstrap/worker.ts` <- Worker entry: the only place Cloudflare-specific APIs are used
  - `bootstrap/app.tsx` <- Global middleware chain, `cop()` bypass list, route-to-controller map
- Configuration
  - `routes/web.ts` <- Registry of every URL this server answers
  - `app/config.ts` <- Issuer, token TTLs, scopes, and the discovery document
  - `app/lib/container.ts` <- Service registrations
- Auth core
  - `app/auth/oidc-provider.ts` <- The storage-agnostic OAuth/OIDC engine
  - `app/auth/repository.ts` <- The engine's storage binding (data-table + KV)
  - `app/auth/values/` <- Access, ID and logout token value objects
  - `app/services/signing-keys.ts` <- ES256 keys loaded from R2
- HTTP layer
  - `app/http/controllers/oauth/token.ts` <- Grant handling, client auth, error envelopes
  - `app/http/middleware/require-subject.ts` <- Session guard with silent token refresh
  - `app/http/middleware/require-api-client.ts` <- JWKS-verified machine API guard
  - `app/http/controllers/default-handler.tsx` <- 404 handler for unmapped routes
- Data layer
  - `database/schema.ts` <- The frozen D1 schema
  - `app/data/` <- One repository class per table
