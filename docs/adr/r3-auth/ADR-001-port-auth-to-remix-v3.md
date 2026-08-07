# ADR-001: Port apps/auth to Remix v3 (apps/r3-auth)

## Status

**Proposed** - 2026-07-30

## How To Use This Document

This ADR is the implementation spec for porting the auth app to Remix v3. It was written after a full exploration of the app so an implementation session can start coding without re-deriving anything.

Instructions for the implementer:

1. Read this whole document once before writing any code.
2. Work phase by phase, in order, following the Implementation Plan section. Do not skip phases, and do not start a phase before the previous one's checklist passes.
3. Tick the checkboxes in the Current Progress section as you complete work, and commit the updated ADR together with the code.
4. Terminology used everywhere below:
   - **OLD APP** = `apps/auth` (React Router v8, deployed as the Cloudflare Worker named `auth` serving `auth.sergiodxa.com`). It keeps serving production until Phase 8.
   - **NEW APP** = `apps/r3-auth` (Remix v3, Cloudflare Worker named `r3-auth`). All new code goes here.
5. **Never import from the OLD APP.** The NEW APP must not contain any path reaching into `apps/auth`. When the OLD APP has logic you need, copy the file into the NEW APP and adapt it (Decision §0).
6. When this document says "port `<file>`", it means: open that file in the OLD APP, copy its logic into the stated NEW APP location, then apply the standard adaptations in Decision §0.1.
7. If a file referenced here does not exist or looks different from what is described, do not guess: open the OLD APP source and re-verify. The repository is worked on by other sessions.
8. This app is an identity provider with live relying parties. Section "Frozen Contracts" lists the things that **cannot change**; treat every item there as a test case before cutover.

## Background

`apps/auth` is the OAuth 2.0 / OpenID Connect authorization server at `auth.sergiodxa.com`. It is the last React (React Router v8) application left in the monorepo that is actively serving production: `apps/blog` and `apps/uptime` were replaced by their Remix v3 ports in commit `38d79a03`, following [r3-uptime ADR-001](../r3-uptime/ADR-001-port-uptime-to-remix-v3.md). Keeping one React app alive means keeping React, Tailwind, Drizzle, Zod, `remix-auth`, `remix-i18next`, `remix-utils`, and the React-only `@pkg/ui` / `@pkg/hooks` / `@pkg/db-helpers` packages alive for a single worker, and every monorepo-wide convention (`remix/ui` views, `remix/data-table` persistence, `remix/data-schema` validation, `@pkg/service-container` services) has to be applied twice or skipped here.

This ADR ports the app onto the same stack as the rest of the monorepo, reusing the same Cloudflare resources, the same database, and the same URLs, so no relying party has to change anything.

**Relationship to [ADR-010](../ADR-010-auth-saas-completion-and-tenant-migration.md).** ADR-010 (Proposed, not executed) plans to replace this app with `apps/auth-saas` tenants and decommission `apps/auth` after a migration window. That plan is a product migration — new auth methods (passkeys, magic links), a different schema, subject export/import, and a coordinated cutover of every client app. This ADR is a stack port with zero product change, and the two are not mutually exclusive: whichever ships first, the other's work shrinks. If ADR-010 executes later, it decommissions the NEW APP instead of the OLD APP, and it inherits a codebase already speaking Remix v3 and `@pkg/oidc-provider`-adjacent idioms. Nothing in this ADR blocks ADR-010; nothing in ADR-010 needs to happen before this port. The one thing that would be wasted work is porting the UI twice, which is accepted (see Alternatives Considered §2).

## Context

### Current State: the OLD APP (apps/auth)

| Aspect         | Current implementation                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework      | React Router v8 (`react-router` 8.3, `@react-router/fs-routes`), React 19                                                                                                                                      |
| Worker entry   | `app/entry.worker.ts` — `fetch` (React Router request handler + `CloudflareContext`), `scheduled` (one cron), `queue` (one message type)                                                                       |
| Routing        | `app/routes.ts` — `flatRoutes()` over seven directories, mounted under `/`, `/auth`, `/oauth`, `/oidc`, `/.well-known`, `/account`, `/admin`, `/api`                                                           |
| OIDC engine    | `app/modules/oauth2.ts` (959 lines) — framework-agnostic `OIDC` class over a `Repository` interface; `app/services/oidc.ts` binds it to Drizzle + KV; `app/entities/{access-token,id-token,logout-token}.ts`   |
| Styling        | Tailwind CSS v4 + `@pkg/ui` React components (Card, Button, Form, TextField, Table, Toolbar, Breadcrumbs, ConfirmDialog, Logo, Separator), dark mode via `dark:` variants, OKLCH `@theme` palette              |
| ORM            | Drizzle (`db/schema.ts`, 222 lines; 8 SQL migrations in `db/migrations/`, applied with `wrangler d1 migrations apply`)                                                                                         |
| Validation     | Zod v4 through `@pkg/validate`                                                                                                                                                                                 |
| Signing        | ES256 key pair stored in R2, loaded via `@edgefirst-dev/jwt`'s `JWK.signingKeys(new R2FileStorage(env.R2))`                                                                                                    |
| Sessions (IdP) | `createWorkersKVSessionStorage` from `@react-router/cloudflare` over `env.KV`, cookie `sid`, 30 days, `domain: .sergiodxa.com` in production; holds `accessToken`, `refreshToken`, and in-flight `authz` state |
| Passwords      | `bcryptjs` hashes in `credentials.password_hash`                                                                                                                                                               |
| Social login   | GitHub only, via `remix-auth-oauth2` (`app/strategies/github.ts`). The README also claims Google; there is no Google strategy                                                                                  |
| Billing        | Polar (`@polar-sh/sdk` used directly in `app/models/customer.ts` + `app/clients/polar.ts`) — subjects are mirrored as Polar customers at signup only                                                           |
| Rate limiting  | Five Cloudflare rate limiter bindings via `app/modules/rate-limit.ts`                                                                                                                                          |
| i18n           | i18next + react-i18next + remix-i18next, one locale (`app/locales/en.ts`, 352 lines), client-side catalog fetched from `/api/locales/:lng/:ns`                                                                 |
| Jobs           | `app/jobs/clean-expired-sessions.ts` (`@pkg/jobs`), enqueued daily by cron                                                                                                                                     |
| Tests          | `app/modules/oauth2.test.ts` (665 lines) — exercises the engine against a fake repository. Nothing else is tested                                                                                              |

### Cloudflare Resources and Bindings

Source of truth: `apps/auth/wrangler.jsonc`. The NEW APP must use the **same binding names and the same resource ids** so it operates on the same production data.

| Binding                   | Type           | Value                                                                    |
| ------------------------- | -------------- | ------------------------------------------------------------------------ |
| `DB`                      | D1             | database_name `auth`, database_id `1549b30f-b4ba-48b0-b08a-76b8003a37db` |
| `KV`                      | KV namespace   | id `848d0b8592b64956999bc9769bee6c8e`                                    |
| `R2`                      | R2 bucket      | bucket_name `auth` — **holds the ES256 signing keys**                    |
| `QUEUE`                   | Queue producer | queue name `auth` (the worker is also the sole consumer)                 |
| `TOKEN_RATE_LIMITER`      | Rate limiter   | namespace_id `1001`, 20 requests / 60s                                   |
| `INTROSPECT_RATE_LIMITER` | Rate limiter   | namespace_id `1002`, 100 requests / 60s                                  |
| `REVOKE_RATE_LIMITER`     | Rate limiter   | namespace_id `1003`, 50 requests / 60s                                   |
| `AUTHORIZE_RATE_LIMITER`  | Rate limiter   | namespace_id `1004`, 30 requests / 60s                                   |
| `LOGIN_RATE_LIMITER`      | Rate limiter   | namespace_id `1005`, 10 requests / 60s                                   |
| routes                    | Custom domain  | `auth.sergiodxa.com` (stays on the OLD APP until Phase 8)                |
| triggers.crons            | Cron           | `0 0 * * *` — enqueues `{ type: "cleanExpiredSessions" }`                |

Secrets / vars (from `.dev.vars` / `.env.example`; all are needed by the NEW APP too):

| Name                                                                           | Used for                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `COOKIE_SESSION_SECRET`                                                        | Signing the IdP session cookie (plain secret, read via `env`)         |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                     | GitHub social login                                                   |
| `POLAR_ACCESS_TOKEN`                                                           | Mirroring subjects into Polar customers                               |
| `UPTIME_CRON_API_KEY`                                                          | Self-monitoring ping from the queue job                               |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AUTH_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` | Drizzle Kit migration generation only — **not needed** in the NEW APP |

### KV and R2 Key Layout (shared at runtime — do not collide)

Both workers bind the same KV namespace and R2 bucket during development and the soak window, so key spaces must not overlap except where sharing is intended:

| Key                                        | Owner              | NEW APP behavior                                                                       |
| ------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------- |
| `authz-code:<code>`                        | OIDC engine        | **Share unchanged.** Same prefix, same JSON shape, same 10-minute TTL                  |
| `clients:<clientId>:subjects:<subjectId>`  | `/api/subjects`    | **Share unchanged.** Same key, same 7-day TTL                                          |
| bare session ids (no prefix)               | OLD APP KV session | Leave alone. The NEW APP writes `session:<id>` instead (see Decision §7)               |
| R2 signing key file (`@edgefirst-dev/jwt`) | JWKS               | **Share unchanged.** Both workers must sign with the same key or tokens stop verifying |

### Database Schema (frozen — do not change it)

The NEW APP reuses the live production D1 database, so this port makes **zero schema changes**. Source of truth: `apps/auth/db/schema.ts`. All timestamps are SQLite `INTEGER` holding **epoch milliseconds** (Drizzle `timestamp_ms` mode), not ISO text.

| Table         | Columns of note                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `subjects`    | `id` (uuid text pk), `created_at`, `updated_at`, `email_verified_at`, `display_name`, `avatar`, `role` (`user` \| `admin`, default `user`), `username` (unique), `email_address` (unique)                                                                                                                                                                     |
| `credentials` | `id`, timestamps, `verified_at`, `subject_id` (unique fk), `password_hash` (PBKDF2; the table holds zero rows in production); index `credentials_subject_verified_idx`                                                                                                                                                                                        |
| `connections` | `id`, timestamps, `subject_id` fk, `external_id`, `provider`; unique index on (`provider`, `external_id`)                                                                                                                                                                                                                                                     |
| `sessions`    | `id` (**this value is the refresh token**), timestamps, `expires_at` (default now + 30 days), `subject_id` fk, `client_id` fk, `user_agent`, `ip_address`; indexes on `expires_at`, `subject_id`, `client_id`                                                                                                                                                 |
| `clients`     | `id`, timestamps, `name`, `description`, `logo_url`, `secret` (**plaintext**), `redirect_uri` (unique, exactly one per client), `logout_uri`, `backchannel_logout_uri`, `backchannel_logout_session_required`, `frontchannel_logout_uri`, `frontchannel_logout_session_required` (the two `*_session_required` columns are `text` holding `"true"`/`"false"`) |
| `grants`      | `id`, timestamps, `subject_id`, `client_id`; unique index on (`subject_id`, `client_id`), index on `client_id`                                                                                                                                                                                                                                                |

### Frozen Contracts (breaking any of these breaks production clients)

Three apps authenticate against this server: `apps/blog` (sergiodxa.com), `apps/uptime` (uptime.sergiodxa.com), and `apps/uptime` again through `@pkg/auth-sdk`. Their expectations, verified in their source:

| Contract                                                                                                                         | Where clients depend on it                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ID token `iss` is the **scheme-less** string `auth.sergiodxa.com`                                                                | `apps/blog/app/auth/value-objects/id-token.ts`, `apps/uptime/app/auth/value-objects/id-token.ts` (`issuer:` check)  |
| Endpoints `/authorize`, `/oauth/token`, `/userinfo`, `/.well-known/jwks.json`, `/oidc/logout` at those exact paths               | `apps/blog/app/auth/services/oauth.ts`, `apps/uptime/app/auth/services/oauth.ts` (hardcoded metadata, no discovery) |
| ES256 signing keys and the published JWKS (same key ids)                                                                         | Both clients verify ID tokens against the live JWKS URL                                                             |
| `/oauth/token` accepts client credentials **in the body** as well as HTTP Basic                                                  | `remix/auth`'s OIDC provider defaults to body auth; a regression here 400s every login (fixed once already)         |
| Scopes `openid profile email`; userinfo claims `sub`, `email`, `email_verified`, `name`, `preferred_username`, `picture`         | Both clients                                                                                                        |
| RP-initiated logout with `id_token_hint` + `post_logout_redirect_uri`                                                            | Both clients' logout controllers                                                                                    |
| `POST /oauth/token` with `grant_type=client_credentials` (Basic auth) and `GET /api/subjects/:subjectId` returning `{ subject }` | `packages/auth-sdk/src/index.ts`, used by `apps/uptime`                                                             |
| Refresh-token rotation semantics (session id **is** the refresh token)                                                           | Any client refreshing an access token                                                                               |

### URL Surface (parity required)

Every URL below must exist on the NEW APP with the same methods. Method annotations come from the OLD APP's `loader`/`action` exports.

**Root**

| URL            | Methods | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | GET     | Redirect to `/authorize`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/authorize`   | GET     | Rate-limit by IP; decode the session access token; validate OAuth params. **No/invalid params:** logged in → redirect `/account/sessions`; else ensure the auth server's own client row exists and self-redirect with its own OAuth params. **Valid params:** validate client + exact `redirect_uri` match; honor `prompt` (`none` → `login_required` error redirect; `login` → force re-auth; `create` → show registration form); if already signed in and not forcing login, issue an authz code and redirect (SSO); otherwise store the authz request in the session and render the sign-in page (or redirect to `/auth/:provider` when `provider` is in the query) |
| `/authorize`   | POST    | Credential login/registration (`email`, `password` min 8, `name`, `username`), then redirect or `form_post` back to the RP                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `/userinfo`    | GET     | Bearer access token → OIDC claims, scope-gated; 401 with `WWW-Authenticate` otherwise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/healthcheck` | GET     | D1 count + `KV.list()`; `OK` or 500 naming the failed dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/*`           | GET     | Localized 404 page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Auth flow (`/auth`)**

| URL                        | Methods | Behavior                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/:provider`          | POST    | Rate-limit by IP (`LOGIN_RATE_LIMITER`); start the GitHub OAuth flow; unknown provider → redirect `/authorize`                                                                                                                                                                                |
| `/auth/:provider/callback` | GET     | Rate-limit by IP; resolve the GitHub identity to a subject (create subject + connection + Polar customer on first login); issue the authz code; set the `op_browser_state` cookie; redirect or `form_post` back to the RP; on failure redirect with `error`/`error_description`/`state`/`iss` |
| `/auth/callback`           | GET     | The server's own client callback: validate `code`/`state` against the session authz, exchange the code, store `accessToken`/`refreshToken` in the session, redirect `/account/sessions`                                                                                                       |

**OAuth endpoints (`/oauth`)**

| URL                 | Methods | Behavior                                                                                                                                                                                                                     |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/oauth/token`      | POST    | Grants `authorization_code`, `refresh_token`, `client_credentials`; Basic **or** body client auth; rate-limit by client id (client credentials) or IP; `Cache-Control: no-store` + `Pragma: no-cache`; OAuth error envelopes |
| `/oauth/revoke`     | POST    | Token revocation, rate-limited                                                                                                                                                                                               |
| `/oauth/introspect` | POST    | Token introspection, rate-limited                                                                                                                                                                                            |

**OIDC endpoints (`/oidc`)**

| URL                   | Methods | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/oidc/logout`        | GET     | RP-initiated logout: validate params (`id_token_hint`, `post_logout_redirect_uri`, `client_id`, `logout_hint`, `ui_locales`, `state`); resolve the subject from the hint or the session; send back-channel logout tokens (excluding the initiating client); collect front-channel logout URLs; delete the session row; unset session tokens; then render the front-channel iframe page or redirect with `Clear-Site-Data: "*"` and a destroyed cookie |
| `/oidc/logout`        | POST    | Interactive logout button: back-channel tokens, delete the session row, destroy the cookie, redirect `/authorize`                                                                                                                                                                                                                                                                                                                                     |
| `/oidc/check-session` | GET     | The OIDC Session Management check-session iframe (HTML + inline script), `X-Frame-Options: ALLOWALL`, `Cache-Control: public, max-age=3600`                                                                                                                                                                                                                                                                                                           |

**Discovery (`/.well-known`)**

| URL                                       | Methods | Behavior                                       |
| ----------------------------------------- | ------- | ---------------------------------------------- |
| `/.well-known/openid-configuration`       | GET     | The `WELL_KNOWN` document from `app/config.ts` |
| `/.well-known/oauth-authorization-server` | GET     | Same document (RFC 8414)                       |
| `/.well-known/jwks.json`                  | GET     | Public JWKS from the R2-backed signing keys    |

**Account area (`/account`, session-guarded with silent access-token refresh)**

| URL                     | Methods | Behavior                                                                                                                                          |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/account/profile`      | GET     | Profile view (display name, username, email, avatar, role)                                                                                        |
| `/account/profile/edit` | GET     | Edit form                                                                                                                                         |
| `/account/profile/edit` | POST    | Update `displayName`, `username`, `avatar` (URL); redirect to `/account/profile`                                                                  |
| `/account/sessions`     | GET     | Active sessions with parsed user-agent labels (browser / OS / device), IP, created/expiry                                                         |
| `/account/sessions`     | POST    | `intent=revoke` (one session id) or `intent=revoke-all`; revoking the current session redirects to `/authorize` with `Clear-Site-Data: "cookies"` |
| `/account/grants`       | GET     | Authorized clients (consent grants) with client details                                                                                           |
| `/account/grants`       | POST    | `intent=revoke` for a client id — deletes the grant and that client's sessions                                                                    |

**Admin area (`/admin`, admin-role-guarded)**

| URL                               | Methods | Behavior                                                                                                   |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `/admin`                          | GET     | Dashboard: client count, subject count, active-session count                                               |
| `/admin/clients`                  | GET     | Paginated client list                                                                                      |
| `/admin/clients`                  | POST    | `intent=delete` with `clientId`                                                                            |
| `/admin/clients/new`              | GET     | Create form                                                                                                |
| `/admin/clients/new`              | POST    | Create (`name`, `description` ≤280, `logoUrl`, `redirectUri`, `logoutUri`) and reveal the generated secret |
| `/admin/clients/:clientId`        | GET     | Client detail (incl. grant count)                                                                          |
| `/admin/clients/:clientId`        | POST    | `intent=delete`                                                                                            |
| `/admin/clients/:clientId/edit`   | GET     | Edit form (incl. back-/front-channel logout fields)                                                        |
| `/admin/clients/:clientId/edit`   | POST    | Update; redirect to the detail page                                                                        |
| `/admin/subjects`                 | GET     | Paginated subject list (page size 10)                                                                      |
| `/admin/subjects/:subjectId`      | GET     | Subject detail with sessions and connections                                                               |
| `/admin/subjects/:subjectId`      | POST    | `intent=delete` \| `revoke-session` \| `revoke-all-sessions`                                               |
| `/admin/subjects/:subjectId/edit` | GET     | Edit form                                                                                                  |
| `/admin/subjects/:subjectId/edit` | POST    | Update; redirect to the detail page                                                                        |

**API (`/api`)**

| URL                        | Methods | Behavior                                                                                                                                                                             |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/subjects/:subjectId` | GET     | Client-credentials Bearer auth (JWT verified against the local JWKS, client resolved and KV-cached for 7 days); per-client subject cache; `Server-Timing` headers; 401/404 envelopes |
| `/api/locales/:lng/:ns`    | GET     | **Dropped** in the NEW APP — nothing loads translations client-side any more (Decision §11)                                                                                          |

### Verified Defects and Gaps

Found while reading the OLD APP for this ADR. Each has a decision attached in Decision §16; do not silently replicate the bugs.

| #   | Defect                                                                                                                                                                                                                                                                                                                                                                                            | Location                                                       | Severity                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| 1   | **PKCE is advertised but never enforced.** `/authorize` never reads `code_challenge`/`code_challenge_method`, and `generateAuthzCode` always stores `pkce: null`, so the (correctly implemented) `code_verifier` check in the authorization-code grant is dead code                                                                                                                               | `app/routes/authorize/route.tsx`, `app/modules/oauth2.ts:536`  | High — discovery claims S256 support  |
| 2   | Client secrets are stored in plaintext in D1 and compared with a timing-safe compare of raw values                                                                                                                                                                                                                                                                                                | `db/schema.ts`, `app/modules/oauth2.ts`                        | Medium                                |
| 3   | Discovery `issuer` has no scheme (`auth.sergiodxa.com`), which OIDC Discovery requires; the authorization response `iss` parameter uses `https://auth.sergiodxa.com`, so the two disagree                                                                                                                                                                                                         | `app/config.ts`, `app/modules/oauth2.ts`                       | Low, but **frozen** (clients pin it)  |
| 4   | Discovery advertises only `client_secret_basic` for token auth while the endpoint also accepts body credentials                                                                                                                                                                                                                                                                                   | `app/config.ts`                                                | Low                                   |
| 5   | README claims Google and email/password "multi-provider" support; only GitHub and credentials exist                                                                                                                                                                                                                                                                                               | `apps/auth/README.md`                                          | Docs                                  |
| 6   | `Credential.create` returns an unawaited insert builder and its `if (credential)` check can never fail                                                                                                                                                                                                                                                                                            | `app/models/credential.ts`                                     | Low                                   |
| 7   | Nothing outside the OIDC engine is tested — no controller, model, or route coverage                                                                                                                                                                                                                                                                                                               | —                                                              | Medium                                |
| 8   | `/oidc/check-session` sets `X-Frame-Options: ALLOWALL`, which is not a real header value (the effective behavior is "no header"); the intent is correct but should be expressed by omitting the header                                                                                                                                                                                            | `app/routes/oidc/check-session/route.ts`                       | Low                                   |
| 9   | **Credential registration creates an account that can never sign in.** Registration stores `credentials.verified_at = null` and the sign-in path refuses a credential with no `verified_at` (`MissingValidationError`, "Verify your email address."). Nothing in either app ever writes that column and no verification email exists, so every account created with a password is dead on arrival | `app/modules/oauth2.ts:635` and the same file's sign-up branch | High — the feature cannot work at all |

## Decision

Port the OLD APP endpoint-for-endpoint into a new `apps/r3-auth` on Remix v3, reusing the same Cloudflare resources, database, keys, and URLs; then swap the custom domain and retire the OLD APP. The OIDC engine itself is copied nearly verbatim — it is already framework-agnostic — so the real work is the HTTP layer, the persistence layer, and the UI.

### 0. Ground Rules (apply to every file you write)

These restate the monorepo rules (root `AGENTS.md`) that matter most for this port. When in doubt, that file wins.

1. **Standard adaptations when porting a file:**
   - Replace Drizzle queries with `remix/data-table` queries.
   - Replace Zod schemas with `remix/data-schema` schemas, validated through `@pkg/validate`.
   - Replace `react-router` imports (`redirect`, `data`, `href`, `redirectDocument`) with fetch-router equivalents: `ctx.redirect(...)` / an explicit `Response`, and `routes.<name>.href(...)` for URLs.
   - Replace React JSX and `@pkg/ui` with `remix/ui` JSX and `@pkg/r3-ui` components (different component model — §4).
   - Delete comments naming another app or package as the source of a pattern; describe the code on its own terms.
   - Keep the module JSDoc header but rewrite it for the new module.
2. **Error handling:** `@pkg/result` (`success`/`failure`/`isFailure`), as the engine already does. The engine's `throw`-based token path stays as-is (it is part of its tested contract) but controllers must catch and map to OAuth error envelopes.
3. **Logging:** `@pkg/logger`. Never `console.log`. Request-scoped logger in HTTP handlers, `BatchedLogger` in jobs. **Never log tokens, codes, secrets, or password material** — keep the OLD APP's habit of logging event names plus ids only.
4. **Every file** starts with the module JSDoc header (what/why in ~3 lines, then `@author` / `@copyright`), and every exported symbol — plus controller/middleware callbacks — gets JSDoc.
5. **TypeScript style:** `const` only at module level (`ALL_UPPER_SNAKE_CASE` for constant values); `let` inside functions; `interface` over `type`; `namespace` for types only; never `as any`.
6. **Environment:** `import { env } from "cloudflare:workers"`. Never `process.env` (the OLD APP has three `process.env.NODE_ENV` reads to replace).
7. **Commands:** Bun and `bunx` only. Tests run from the repo root. `bun format:fix` at the root before every commit. Commit directly on `main` with Conventional Commits.
8. **DB-facing field names are snake_case**, and timestamp columns are epoch-ms integers (Notes).
9. **D1 has no transactions.** Multi-step writes (subject + connection + grant + session) need compensation on failure, or a single statement. The OLD APP uses `db.batch(...)` in the GitHub strategy — `remix/data-table` has no batch equivalent, so write those steps sequentially and delete what you created if a later step fails.
10. **Prefer what Remix v3 ships:** `remix/session-middleware`, `remix/cop-middleware`, `remix/form-data-middleware`, `remix/method-override-middleware`, `remix/render-middleware`, `createAction`/`createController`, `remix/data-schema`. Check `docs/vendor/@remix-run/<package>/README.md` before hand-rolling anything.

### 1. Where Files Go

Scaffold the NEW APP by copying `templates/app` to `apps/r3-auth`, then fill it in:

| Kind of code                | Location in NEW APP                                       | OLD APP source                                                            |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| Route map                   | `routes/web.ts`                                           | `app/routes.ts` + the seven `app/routes/*` directories                    |
| Composition root            | `bootstrap/app.tsx`                                       | `app/root.tsx` middleware array                                           |
| Worker entry                | `bootstrap/worker.ts`                                     | `app/entry.worker.ts`                                                     |
| Client entry (islands only) | `bootstrap/browser.ts`                                    | `app/entry.client.tsx` (mostly deleted)                                   |
| Controllers                 | `app/http/controllers/<area>/*.tsx`                       | `app/routes/**/route.tsx` loaders/actions                                 |
| Middleware                  | `app/http/middleware/*.ts`                                | `app/middleware/*.ts` + the two route-level `middleware` arrays           |
| View models                 | `app/http/view-models/*.ts`                               | data shaping inline in OLD APP loaders                                    |
| Validators                  | `app/http/validators/*.ts`                                | the Zod schemas inline in OLD APP routes                                  |
| OIDC engine                 | `app/auth/oidc-provider.ts`                               | `app/modules/oauth2.ts`                                                   |
| Token value objects         | `app/auth/values/{access-token,id-token,logout-token}.ts` | `app/entities/*.ts`                                                       |
| Engine ↔ storage binding    | `app/auth/repository.ts`                                  | `app/services/oidc.ts`                                                    |
| Signing keys                | `app/services/signing-keys.ts`                            | `app/modules/jwks.ts`                                                     |
| Models / repositories       | `app/data/*.ts`                                           | `app/models/*.ts`                                                         |
| Domain services             | `app/services/*.ts`                                       | `app/helpers/api.ts`, `app/strategies/github.ts`, `app/clients/github.ts` |
| Jobs                        | `app/jobs/clean-expired-sessions.ts`                      | same                                                                      |
| Config                      | `app/config.ts`                                           | same (port unchanged apart from typing)                                   |
| Locales                     | `app/locales/en.ts`                                       | same (copy)                                                               |
| Views (pages)               | `resources/views/<area>/*.tsx`                            | OLD APP route components                                                  |
| Layouts                     | `resources/layouts/{document,account,admin}.tsx`          | `app/root.tsx`, `app/routes/{account,admin}/_/route.tsx`                  |
| Shared components           | `resources/components/*.tsx`                              | `app/components/*.tsx`                                                    |
| Style mixins                | `resources/styles.ts`                                     | translation of `app/styles.css`'s `@theme` palette                        |
| DB schema                   | `database/schema.ts`                                      | `db/schema.ts`                                                            |
| DB migrations               | `database/migrations/*.sql`                               | `db/migrations/*.sql` (copy the 8 files unchanged)                        |
| Service container           | `app/lib/container.ts`                                    | n/a (new; §2)                                                             |
| Context augmentations       | `config/router-context.d.ts`                              | n/a (new; §2)                                                             |

### 2. Composition Root, Services, and Middleware

`bootstrap/app.tsx` builds the router; `bootstrap/worker.ts` keeps `fetch` + `scheduled` + `queue`.

Global middleware order in `createRouter({ middleware: [...] })`:

1. `asyncContext()` — enables `getContext()` outside controllers.
2. Request logger — `ctx.logger` (a `RequestLogger` from `@pkg/logger`).
3. `formData()` — parses form bodies into `ctx.formData`.
4. `methodOverride()` — turns `_method=DELETE` posts into DELETE requests.
5. `session(cookie, storage)` from `remix/session-middleware` — see §7.
6. `i18n` from `@pkg/i18n/middleware` — see §11.
7. `cop()` from `remix/cop-middleware` — cross-origin protection for browser form posts. **Must bypass** `/oauth/{path...}`, `/api/{path...}`, and `/oidc/logout`: those are cross-origin POSTs from relying parties and server-to-server callers by design. Get this list right or every client login breaks.
8. `renderWith(createHtmlRenderer)` — HTML rendering for `ctx.render(...)`.

Type the array as `Middleware[]` (non-tuple) and declare every context property in the owning middleware module (or `config/router-context.d.ts` for `render`/`formData`):

```ts
declare module "remix/fetch-router" {
	interface RequestContext {
		logger: RequestLogger;
		formData: FormData;
	}
}
```

**Application services** go in `@pkg/service-container` (ADR-008), registered in `app/lib/container.ts`: the `remix/data-table` `Database` (over `@pkg/data-table-d1`), the `OIDC` provider instance, the signing-key loader, `PolarClient` from `@pkg/polar`, and the five rate limiters. `bootstrap/worker.ts` wraps `fetch`, `scheduled`, and `queue` in `container.scope(...)`.

**Request-scoped values** (session, current subject, request logger, locale) never go in the container — they live in request context via middleware.

The `Database`'s `now` option must be `() => Date.now()` so `touch` writes epoch-ms integers, matching the frozen schema.

### 3. Routing and Controllers

#### 3.1 Route map

`routes/web.ts` declares every URL from the URL Surface section using the route helpers, so `.href(...)` is typed everywhere:

```ts
import { form, get, post, route } from "remix/fetch-router/routes";

export default route({
	home: get("/"),
	healthcheck: get("/healthcheck"),
	userinfo: get("/userinfo"),
	/** GET renders the sign-in UI (or performs SSO); POST logs in with credentials. */
	authorize: form("/authorize"),

	auth: {
		provider: post("/auth/:provider"),
		providerCallback: get("/auth/:provider/callback"),
		callback: get("/auth/callback"),
	},

	oauth: {
		token: post("/oauth/token"),
		revoke: post("/oauth/revoke"),
		introspect: post("/oauth/introspect"),
	},

	oidc: {
		/** GET = RP-initiated logout; POST = the interactive logout button. */
		logout: form("/oidc/logout"),
		checkSession: get("/oidc/check-session"),
	},

	wellKnown: {
		openidConfiguration: get("/.well-known/openid-configuration"),
		oauthAuthorizationServer: get("/.well-known/oauth-authorization-server"),
		jwks: get("/.well-known/jwks.json"),
	},

	account: {
		profile: get("/account/profile"),
		profileEdit: form("/account/profile/edit"),
		sessions: form("/account/sessions"),
		grants: form("/account/grants"),
	},

	admin: {
		dashboard: get("/admin"),
		clients: form("/admin/clients"),
		clientNew: form("/admin/clients/new"),
		client: form("/admin/clients/:clientId"),
		clientEdit: form("/admin/clients/:clientId/edit"),
		subjects: get("/admin/subjects"),
		subject: form("/admin/subjects/:subjectId"),
		subjectEdit: form("/admin/subjects/:subjectId/edit"),
	},

	api: {
		subject: get("/api/subjects/:subjectId"),
	},
});
```

The 404 page is the router's `defaultHandler`, not a splat route.

#### 3.2 Registering controllers

`router.map()` accepts actions only for the direct leaves of the map you pass, and middleware does **not** cascade between `router.map()` calls. Register one call per group and repeat the middleware chain:

```ts
router.map(routes.home, home);
router.map(routes.authorize, authorizeController);
router.map(routes.oauth.token, tokenController);
router.map(routes.account.sessions, sessionsController); // controller bakes in requireSubject()
```

Prefer baking guards into each controller's own `createAction(route, ...)` chain (so `router.map()` takes the default export with no cast) over passing `middleware` at the map call.

#### 3.3 Controller shape

One file per endpoint (or per small group) under `app/http/controllers/<area>/`:

```tsx
/** GET /account/sessions — lists the signed-in subject's active sessions. */
export default createAction(
	routes.account.sessions,
	inject([Database] as const, async (db, ctx) => {
		let subject = ctx.subject; // provided by requireSubject()
		let sessions = await Session.findBySubjectId(db, subject.id);
		return ctx.render(<SessionsView sessions={sessions.map(toSessionRow)} />);
	}),
);
```

Machine endpoints (`/oauth/*`, `/userinfo`, `/api/*`, `/.well-known/*`) return JSON or text `Response`s via `@pkg/http`, never rendered views. Browser form actions follow validate → mutate → flash → redirect.

The OLD APP's `intent` form field pattern (`revoke`, `revoke-all`, `delete`, `revoke-session`, `revoke-all-sessions`) stays: one POST route per page, discriminating on `intent` with a `remix/data-schema` variant.

#### 3.4 Middleware to build (`app/http/middleware/`)

| Middleware           | Behavior (port from the OLD APP)                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireSubject()`   | Port `app/routes/account/_/route.tsx`: session must hold `accessToken` + `refreshToken`; if the access token is expiring soon, refresh it through the OIDC engine and write both tokens back; on any failure unset both and redirect to `/authorize`. Exposes `ctx.subject` (resolved from the token's `sub`) |
| `requireAdmin()`     | Port `app/routes/admin/_/route.tsx`: `requireSubject()` plus `subject.role === "admin"`, else redirect `/account/sessions`                                                                                                                                                                                    |
| `requireApiClient()` | Port `app/helpers/api.ts`: verify the Bearer JWT against the local JWKS, resolve the client, KV-cache the client for 7 days, expose `ctx.apiClient`; 401 otherwise                                                                                                                                            |
| `rateLimit(...)`     | `@pkg/rate-limit` — see §8                                                                                                                                                                                                                                                                                    |

### 4. Views and UI

#### 4.1 Rendering model

All pages are server-rendered `remix/ui` JSX returned via `ctx.render(...)`. `remix/ui` components are not React components:

```tsx
import type { Handle } from "remix/ui";

function Badge(handle: Handle<{ label: string }>) {
	return () => <span>{handle.props.label}</span>;
}
```

Always use the Handle pattern and JSX — never call a component as a plain function. Never pass `key=` to a `remix/ui` or `@pkg/r3-ui` component (keys on plain HTML elements inside `.map()` are fine).

#### 4.2 Component library and styling

Use `@pkg/r3-ui` for UI (it covers every `@pkg/ui` component this app uses: `card`, `button`, `form`, `input`, `text-field`, `separator`, `logo`, `heading`, `text`, `table`, `toolbar`, `breadcrumbs`, `badge`, `avatar`, `pagination`, `dialog`, `confirm`, `link-button`, `nav`), `@pkg/u` for utility mixins, and inline `css()` mixins for anything specific. No Tailwind.

**Components first, mixins only for the gaps.** Build every view out of `@pkg/r3-ui` components as far as they reach, and use `@pkg/u` only for what a component cannot express — page-level layout and spacing between components, responsive behavior, one-off adjustments. Read `packages/r3-ui/src/components/` before hand-rolling anything; a view carrying a long list of `@pkg/u` imports doing what a component already does is the smell. When a component is close but not sufficient, use it with a small inline `mix={css({...})}` adjustment rather than abandoning it, and record which component fell short. This applies to _every_ user-facing page: a page may skip the component layer only for a reason that belongs to that page (the front-channel logout page must ship zero JS), never because a neighbouring page had such a reason.

Translate `app/styles.css`'s `@theme` block into `resources/styles.ts` mixins, keeping the exact OKLCH values: neutral (hue 0), blue (hue 250), danger (25), warning (85), success (155), each with the 50–950 ramp, plus the Inter-first font stack and the `bg-white` / `dark:bg-neutral-950` document background with `color-scheme: dark` under `prefers-color-scheme: dark`. Write mixins inline at their use site (`mix={css({...})}`); do not create module-level `const` mixin variables outside `resources/styles.ts`.

**The hue-250 ramp is named `brand`, not `primary`.** The shared token layer resolves exactly five palette names — `neutral`, `brand`, `success`, `warning`, `danger` — so `--ui-color-primary-*` would resolve against nothing and fail to typecheck at every call site. The OKLCH values are the OLD APP's unchanged; only the name differs. Views must say `brand`. Tailwind's `--color-*: initial` palette reset has no analogue and is dropped; white and black are written as literals rather than tokens.

Keep the current visual design: the `/authorize` page's two-column layout (client panel with logo, name, description, and the concentric-rings SVG on the left; sign-in card on the right, collapsing to a single column below `lg`), and the account/admin pages' sticky header + breadcrumbs + toolbar-tab navigation.

#### 4.3 Native HTML instead of JavaScript

| OLD APP UI                                              | NEW APP                                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ConfirmDialog` + `useSubmit()` for destructive actions | Native `<dialog>` opened with command invokers (`commandfor` + `command="show-modal"`), containing a real form that posts the `intent` |
| Toolbar tabs / nav links                                | Plain links styled via `aria-current`                                                                                                  |
| Registration form toggled by a CSS class                | Server-rendered: render the registration form only when `prompt=create`, or wrap it in `<details>` with `open` bound to the prompt     |
| React re-render on validation errors                    | Re-render the page server-side with the submitted values and error text                                                                |

#### 4.4 Client-side islands (the only places that ship JS)

Islands are `clientEntry(...)` components. Approved list — do not add more without a reason the platform cannot cover:

1. `CopyButton` — revealing a newly created client secret on `/admin/clients/new`.
2. Nothing else. The account and admin pages are plain forms and links.

Three server-rendered pages contain script or markup that is part of an external contract, and they are **not** islands:

- **`form_post` response mode** (`app/helpers/form-post.ts`): render a `remix/ui` view with hidden inputs, an inline `<script>` that submits the form on load, and a `<noscript>` submit button. Keep `Cache-Control: no-store`, and keep HTML-escaping every parameter value.
- **Front-channel logout page**: render the hidden RP iframes, then use `<meta http-equiv="refresh" content="2;url=...">` for the follow-up redirect instead of the OLD APP's `setTimeout` script — same behavior, zero JS — plus the existing `<noscript>` link.
- **`/oidc/check-session`**: this endpoint's whole purpose is to serve a browser-side script page to relying parties, defined by OIDC Session Management 1.0. Serve it as a `text/html` `Response` whose body is a template literal, and document in the file why it is exempt from the "no HTML strings" rule. Do not try to express it as `remix/ui` JSX.

### 5. The OIDC Engine

`app/modules/oauth2.ts` imports only `node:crypto`, `@edgefirst-dev/jwt`, `@pkg/result`, `bcryptjs`, `date-fns`, `jose`, and the three token entities — no React Router, no Drizzle, no Zod. **Port it and its tests essentially verbatim** into `app/auth/oidc-provider.ts`, changing only:

1. `date-fns`'s `isBefore` → a plain comparison or `@pkg/dates` (the monorepo has retired ad-hoc date libraries elsewhere; a `<` on two `Date`s is enough here).
2. Import paths for the token value objects.
3. The `Nullable<T>` helper and `OIDC` namespace stay as they are; the class keeps its static error classes, since controllers match on them.

`app/services/oidc.ts` becomes `app/auth/repository.ts`, implementing the same `OIDC.Repository` interface with `remix/data-table` queries and KV for authorization codes. Its `AuthzCodeSchema` moves from Zod to `remix/data-schema`, keeping the exact stored JSON shape (`clientId`, `subjectId`, `sessionId`, `pkce`, `nonce`, `scope`, `authTime`) so codes issued by either worker are readable by both during the soak.

**Passwords are PBKDF2 through `@pkg/crypto`, and `bcryptjs` is gone.** This paragraph originally kept `bcryptjs` on the grounds that existing `credentials.password_hash` values were bcrypt and that re-hashing them would be a data migration with a login-failure blast radius. That premise was checked and is false: a read-only `SELECT count(*) FROM credentials` against the production database returns **0**. There is no stored bcrypt hash, so there is nothing to verify with the legacy verifier, no user to lock out, and no migration to perform — every production subject signs in through GitHub. `@pkg/crypto`'s `password` module is therefore the only implementation: it hashes at registration, verifies at sign-in, and `needsRehash` still drives upgrade-on-login, now for a stored hash written under an outdated iteration count rather than under another algorithm. Credential login and registration remain fully supported for anyone who signs up later.

**Signing keys stay on R2** (`@edgefirst-dev/jwt` + `@edgefirst-dev/r2-file-storage`, same bucket, same file), because both workers must issue tokens verifiable against the same published JWKS. Port `app/modules/jwks.ts` minus its unused `_KVFileStorage` class. The `// @ts-expect-error` on `JWK.signingKeys(...)` should be re-examined; if the types now line up, drop it.

### 6. Persistence

`database/schema.ts` mirrors the frozen D1 schema as `remix/data-table` tables: `subjects`, `credentials`, `connections`, `sessions`, `clients`, `grants` — snake_case column names, `c.text()` ids, `c.integer()` timestamps. Copy the 8 SQL migrations into `database/migrations/` unchanged so `wrangler d1 migrations apply` treats them as already applied in production.

Port the six models from `app/models/` into `app/data/`, keeping method names and semantics: `Client` (incl. `ensureAuthServerClient`, secret generation/regeneration, counts), `Subject`, `Credential` (fixing defect #6), `Connection`, `Session` (incl. `findExpiredSessions`, `deleteExpiredSessions`, `countActive`), `Grant`. `Customer` moves to `app/services/customer.ts` on `@pkg/polar`'s `PolarClient` (`createCustomer`, `findCustomerByEmail`, `updateCustomer`) instead of the raw `@polar-sh/sdk`.

Drop `@pkg/db-helpers` (`pk`, `fk`, `url`, `timestamp` are Drizzle column helpers) and `drizzle-orm`.

### 7. Sessions and Login State

The IdP's own browser session moves to `remix/session-middleware` + `@pkg/session-storage-kv` over the same `KV` namespace:

- Cookie name: **`auth:session`**, not `sid`. The record format differs from `createWorkersKVSessionStorage`, and a distinct name means a rollback to the OLD APP finds its own untouched `sid` cookie instead of one it cannot parse.
- KV prefix `session:`, TTL 30 days, matching the cookie's `maxAge`.
- Cookie options otherwise unchanged: `path: "/"`, `httpOnly`, `sameSite: "Lax"`, `secure` in production, `domain: ".sergiodxa.com"` in production, signed with `COOKIE_SESSION_SECRET`.
- Session data keeps the same shape: `accessToken`, `refreshToken`, and the in-flight `authz` object (`clientId`, `state`, `redirectUri`, `nonce`, `scope`, `responseMode`, `prompt`) — now with `codeChallenge` / `codeChallengeMethod` added (§16).

**Consequence:** at cutover, everyone signed in to the IdP is signed out of the IdP once. Client app sessions are unaffected (they live in each client's own store), but a user whose client session expires next will be prompted to sign in instead of getting silent SSO. This is a one-time, user-visible event; it belongs in the cutover checklist.

The `op_browser_state` cookie (OIDC Session Management) keeps its exact name, value derivation, and attributes (`Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000`), since `/oidc/check-session` reads it from the browser.

### 8. Rate Limiting

Keep the five Cloudflare rate limiter bindings and their ids/limits. Replace `app/modules/rate-limit.ts` with `@pkg/rate-limit`: a `CloudflareAdapter` per binding (declaring the same `limit` and `window` so the response headers are accurate), applied through the package's `rateLimit()` middleware where a whole route is limited, or called directly where the key depends on the parsed body (the token endpoint keys on `client_id` for client-credentials grants and on the client IP otherwise).

The 429 body must stay `{ error: "too_many_requests", error_description: "Rate limit exceeded. Please try again later." }` with `Retry-After: 60`, since relying parties may parse it.

Keep `@pkg/get-client-ip` for IP extraction.

### 9. Validation

Every external input is validated with `remix/data-schema` through `@pkg/validate`, one validator module per endpoint under `app/http/validators/`:

- `/authorize` query: `response_type` literal `code`, `client_id` uuid, `redirect_uri` url, `state`, optional `scope` (space-separated, filtered to `openid email profile`), optional `nonce`, `response_mode` enum defaulting to `query`, optional multi-valued `prompt` filtered to the five supported values, optional `provider`, plus the new `code_challenge` / `code_challenge_method`.
- `/authorize` POST: `email` email, `password` min 8, `name` min 1, `username` min 1.
- `/oauth/token`: a `variant("grant_type", ...)` over `authorization_code` (`code`, optional `code_verifier`, `redirect_uri`, optional `client_id`/`client_secret`), `refresh_token`, and `client_credentials` (optional `resource`, string or array normalized to an array).
- `/oidc/logout`: `id_token_hint`, `post_logout_redirect_uri`, `client_id` uuid, `logout_hint`, `ui_locales`, `state` — all optional.
- Admin forms: client create/update (`name`, `description` ≤280, `logoUrl` url-or-empty, `redirectUri` url, `logoutUri` url, back-/front-channel logout fields), subject update, and the `intent` variants.
- Account forms: profile update (`displayName`, `username`, `avatar` url) and the `intent` variants.
- Queue messages: `variant("type", { cleanExpiredSessions: object({ type: literal("cleanExpiredSessions") }) })`.

Remove `zod` from the app's dependencies once nothing imports it.

### 10. Background Job, Cron, and Queue

`bootstrap/worker.ts` keeps all three handlers:

- `fetch` — open a container scope, build the router, forward the request.
- `scheduled` — on `0 0 * * *`, `waitUntil(env.QUEUE.send({ type: "cleanExpiredSessions" }))`.
- `queue` — validate `message.body` with the variant schema above; invalid messages are logged and acked (not retried); valid ones lazily import and run `CleanExpiredSessionsJob` with `uptime: env.UPTIME_CRON_API_KEY`.

`CleanExpiredSessionsJob` keeps its `monitorId` (`74f508a2-e6e9-4f01-8c25-2884330e7870`) so the self-monitoring cron-job monitor keeps receiving pings, and keeps extending `Job` from `@pkg/jobs`.

**Cutover constraint:** a Cloudflare queue has exactly one consumer worker. The NEW APP declares only `queues.producers` until Phase 8; the OLD APP keeps consuming and keeps its cron until then.

### 11. i18n

One language (English) today, and all copy already lives in `app/locales/en.ts` under the keys `layout`, `scopes`, `authorize`, `sessions`, `logout`, `splat`, `admin`, `account`, `profile`, `grants`.

1. Copy `app/locales/en.ts` unchanged into `app/locales/en.ts`.
2. Use `@pkg/i18n/middleware`'s `i18next({ detection, i18next })` factory, keeping the existing cookie name `sdx:i18n`, detection order cookie → header, fallback `en`, and `interpolation: { escapeValue: false }` (JSX escapes text nodes already).
3. Views translate through `ctx.i18next.t(...)` during server render.
4. Drop `i18next-browser-languagedetector`, `i18next-fetch-backend`, `react-i18next`, `remix-i18next`, and the `/api/locales/:lng/:ns` route.
5. Do not hardcode English strings in views — every user-facing string goes through a key, adding new keys as needed.

### 12. Package Reuse

Use: `@pkg/data-table-d1`, `@pkg/service-container`, `@pkg/session-storage-kv`, `@pkg/r3-ui`, `@pkg/u`, `@pkg/i18n`, `@pkg/rate-limit`, `@pkg/validate`, `@pkg/result`, `@pkg/logger`, `@pkg/jobs`, `@pkg/http`, `@pkg/response`, `@pkg/get-client-ip`, `@pkg/polar`, `@pkg/duration`, `@pkg/uuid`, `@pkg/iife` (only if a remaining inline script needs it).

Keep (not replaceable): `@edgefirst-dev/jwt`, `@edgefirst-dev/r2-file-storage`, `@edgefirst-dev/server-timing`, `@oslojs/crypto`, `@oslojs/encoding`, `jose`. (`@octokit/core` was on this list for the GitHub profile fetch; Phase 3 dropped it — see below. `bcryptjs` was on it too; it is dropped as well — see below.)

Drop: `@pkg/ui`, `@pkg/cn`, `@pkg/db-helpers`, `bcryptjs` (the production `credentials` table is empty, so no stored bcrypt hash exists and there is no migration risk — see §5; `@pkg/crypto`, listed here originally as not adopted, **is** adopted and is the only password implementation), `react`, `react-dom`, `react-router`, `@react-router/*`, `drizzle-orm`, `drizzle-kit`, `zod`, `tailwindcss`, `@tailwindcss/vite`, `tailwindcss-animate`, `lucide-react`, `remix-auth`, `remix-auth-oauth2`, `remix-i18next`, `remix-utils`, `react-i18next`, `i18next-*`, `isbot`, `dequal`, `date-fns`, `pretty-cache-header`, `@mjackson/file-storage` (transitively used by the R2 storage — keep only if still imported), `@pkg/api-client` if unused after the port.

**GitHub login uses `remix/auth`** (decided and implemented in Phase 3). `createGitHubAuthProvider` plus `startExternalAuth` / `finishExternalAuth` replaces `remix-auth-oauth2` and the hand-rolled alternative is not built. It fits an IdP acting as a downstream client exactly: the provider's default scopes are already `read:user user:email`, the in-flight transaction (state and PKCE verifier) is stored in the session this app already has rather than in a second cookie, and `finishExternalAuth` returns the identity as a plain result without writing any app-owned auth record — so the server is free to resolve it to a subject and issue its own authorization code. `completeAuth()` and `remix/auth-middleware` are deliberately not used: this app's own session is a pair of tokens it issued itself, not a provider identity. The flow also gains PKCE against GitHub for free, which the previous strategy did not send.

`@octokit/core` is dropped with it — the provider fetches the profile and, when the profile carries no public address, the primary verified email itself. `app/services/github-login.ts` therefore holds only the provider construction (built per request, so the callback URL matches the origin the person is actually on) and the subject/connection/customer provisioning.

Two consequences worth carrying forward:

1. **`account.providerAccountId` is GitHub's numeric id, not the `node_id` every existing `connections.external_id` row holds.** Recording the numeric id would make every returning GitHub user look new, and their sign-in would then be refused by the email check below. The identity is therefore recorded under `node_id`, read off the profile the provider returns, and lookup tries `node_id` first and the numeric id second, so a row written either way resolves.
2. **A first GitHub sign-in whose email already belongs to a subject is refused, not linked.** The source app attempted the insert and hit the unique index on `subjects.email_address`, which is a 500; silently adopting the existing account instead would be an account takeover whenever the address was not proven. The refusal is delivered as `access_denied` with an explanation.

No new package extraction is expected from this port. If the front-channel logout page, the `form_post` view, or the JWKS-verified API-client middleware turn out to be genuinely reusable, propose a package in a follow-up ADR rather than extracting mid-port.

### 13. Wrangler Config

Final shape of `apps/r3-auth/wrangler.jsonc`:

1. `name: "r3-auth"`, `main: "./bootstrap/worker.ts"`, current compatibility date, `nodejs_compat` (required — the engine imports `node:crypto`), `workers_dev: true`, `dev: { port: 3002 }` (3001 is the OLD APP, 3004/3005 are the SaaS apps), `observability` on, `placement: { mode: "off" }`.
2. `assets.directory` pointing at the Vite client output, matching how the `@cloudflare/vite-plugin` build lays it out.
3. `d1_databases`: `DB` → `auth` / `1549b30f-b4ba-48b0-b08a-76b8003a37db`, `migrations_dir: "./database/migrations"`.
4. `kv_namespaces`: `KV` → `848d0b8592b64956999bc9769bee6c8e`.
5. `r2_buckets`: `R2` → `auth`.
6. `queues.producers`: `[{ binding: "QUEUE", queue: "auth" }]`. **No `queues.consumers` and no `triggers.crons` until Phase 8.**
7. `ratelimits`: all five bindings with the same namespace ids, limits, and periods.
8. **No `routes` entry until Phase 8.**
9. Secrets: `.dev.vars` locally, `bunx wrangler secret put` in production. Do not use Secrets Store — the OLD APP reads `env.COOKIE_SESSION_SECRET` as a plain var, and a Secrets Store binding has no local value.
10. After every change: `bun cf:typegen`, then `bun run build` followed by `bunx wrangler deploy --dry-run`.

Also update: `.oxfmtrc.json` (add an `apps/r3-auth` entry; note the OLD APP's Tailwind override is not needed for the NEW APP, and remove the `apps/auth` override at cutover), `.claude/launch.json` (add an `r3-auth` entry on port 3002), and the root `README.md` app list at cutover.

### 14. Testing

- Runner: `bun:test` only, run from the repo root (`bun run test`, or `bun test apps/r3-auth/... --isolate`). Test files must pass `bun typecheck`.
- **Port `app/modules/oauth2.test.ts` first** (Phase 1). It is the app's only existing safety net and it exercises the engine against a fake repository, so it should port with import-path changes only. Treat any behavior difference it reports as a port bug, not a test bug.
- Database-backed tests: use `createSqliteDatabaseAdapter` from `remix/data-table/sqlite` over `bun:sqlite` (verified to resolve on the pinned beta; it exposes `executeScript()` for multi-statement migration files). Wrap it in `app/lib/test/db.ts` with a helper that applies every file in `database/migrations/` to a fresh in-memory database, so models, jobs, middleware, and controllers run against a real SQL engine. Do not mock the query layer. Give the test `Database` the same epoch-ms `now` override as the container (§2), or timestamps silently diverge from production. If the shipped adapter turns out not to match the D1 adapter's semantics on something this app depends on, fall back to a hand-rolled `bun:sqlite` adapter in the same file and say so here.
- Outbound HTTP (GitHub, Polar): MSW `setupServer` from `msw/node`. Never stub `globalThis.fetch`, never add injectable fetch parameters.
- Cloudflare bindings: `mock.module("cloudflare:workers", ...)` for `env`; `@pkg/cloudflare-mocks` for KV/D1/R2/rate-limiter doubles where it fits.
- Router-level tests via `router.fetch(new Request(...))`, covering at minimum: the full authorization-code flow with PKCE end to end; refresh-token rotation; client-credentials + `/api/subjects`; `/userinfo` claim gating by scope; `prompt=none` without a session; `redirect_uri` mismatch; expired/replayed authorization code; unauthenticated `/account/*` redirect; non-admin `/admin/*` redirect; each rate limiter returning 429; `/oidc/logout` back-channel dispatch and front-channel URL collection.
- Backfill coverage for the layers the OLD APP never tested (defect #7): validators, models, middleware, and each controller.

### 15. Documentation

- `apps/r3-auth/README.md` per `docs/guides/app-documentation.md`, correcting defect #5 (GitHub + credentials only).
- `apps/r3-auth/AGENTS.md` with the app's own rules (Remix v3 conventions, the frozen contracts, the security rules from the OLD APP's `AGENTS.md` — which are worth keeping nearly whole, minus the React Router and Zod references).
- Keep the OLD APP's security guidance intact: OAuth/OIDC spec compliance, ES256, exact-match redirect and logout URI validation, token TTLs, no secrets in logs.

### 16. Defect Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Fix in Phase 2.** Read `code_challenge` / `code_challenge_method` (default `S256` when a challenge is present, per RFC 7636) in the `/authorize` validator, carry them in the session `authz` object, and pass them into `storeAuthorizationCode` so the engine's existing verifier check runs. A code stored without a challenge still redeems without a verifier, so clients that do not use PKCE keep working. Because all three client apps already send challenges through `remix/auth`, this activates verification for real traffic: it must be exercised end-to-end against each client before the domain moves (Phase 8), and it is the single highest-risk item in this port                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2   | **Out of scope.** Hashing client secrets is a data migration (existing plaintext secrets are the only copy clients hold). Keep the timing-safe comparison, keep them plaintext, and propose a follow-up ADR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | **Do not change.** `iss` in ID tokens and discovery stays the scheme-less `auth.sergiodxa.com`; the `iss` response parameter stays `https://auth.sergiodxa.com`. Both client apps pin the former. Fixing it is a coordinated client change, not a port                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | **Fixed in Phase 4.** `client_secret_post` is added to `token_endpoint_auth_methods_supported` so discovery matches the endpoint's real behavior. Purely additive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5   | **Fix in Phase 7.** Correct the README while writing the NEW APP's docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6   | **Fix while porting** (`await` the insert, drop the impossible check)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | **Fix across all phases** — see §14                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | **Fixed in Phase 4**, alongside the endpoint itself. No `X-Frame-Options` is sent at all instead of `ALLOWALL`, and no `frame-ancestors` CSP is added — cross-origin framing is the endpoint's purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 9   | **Fixed: registration stores the credential verified; the refusal stays for every other way a credential can appear.** What `credentials.verified_at` can mean here was settled by what writes it and what reads it: nothing writes it (no verification email, no token table, no route — in either app), and one place reads it, refusing sign-in when it is `null`. A column no code can ever set is not a "not yet"; it is a permanent refusal, which is why password sign-up in the app being ported was dead code and why the production table holds 0 rows. It is therefore read as **"this password is known to belong to whoever holds this account"**, not as email ownership — `subjects.email_verified_at` is the email question, is untouched by this decision, and stays `null` for a credential registration, so `email_verified` in userinfo keeps telling relying parties the truth. Registration (an address nobody had registered) passes `new Date()`: the person chose the password for an account that did not exist a moment earlier, so there is no other owner to protect it from, and refusing them only reproduces the defect. The other branch — a **known** address with no credential, i.e. somebody who signs in with GitHub — still stores the hash with `null` and still fails with `MissingValidationError`, because there the account belongs to someone else and a stranger who knows their address must not be able to attach a working password to it; marking that credential verified would turn this endpoint into account takeover. That is the reason the gate exists and it is not weakened. Accepted cost: a registration that succeeds is distinguishable from a wrong password, so the endpoint reveals whether an address is registered — inherent to any working sign-up, and the GitHub callback already says so out loud ("An account already exists for this email address"). Alternative rejected: inventing a verification-email flow, which is a product feature with a mail dependency, a token store and a route, not a port decision |

## Consequences

### Positive

- **Single stack.** The monorepo's last React app joins the Remix v3 apps: same routing, views, validation, persistence, and container conventions, so fixes and patterns apply everywhere.
- **Much less client JavaScript.** React, React DOM, react-i18next, the client i18next catalog fetch, and `@pkg/ui`'s client components disappear; the IdP becomes server-rendered HTML with one small island.
- **Dependency cleanup.** ~20 packages drop out, including four `remix-*`/`@react-router/*` compatibility layers, Zod, Drizzle, and Tailwind.
- **PKCE actually enforced**, closing a gap between what discovery advertises and what the server checks.
- **Real test coverage** for an app whose only tests today cover one module.
- **Zero data migration.** Same D1, KV, R2 keys, and queue; sessions, grants, clients, and signing keys all survive.

### Negative

- **Security-critical surface.** This is the monorepo's identity provider: a subtle regression in token issuance, redirect-URI validation, or logout fan-out breaks every app at once, silently. The frozen-contracts list and the router-level test matrix exist to bound that risk, but the risk is real and this port deserves slower, more paranoid verification than the previous two.
- **Enforcing PKCE is a behavior change** in the middle of a port. If any client's verifier handling is subtly wrong, logins fail after cutover. It must be verified per client, and the Phase 8 rollback (move the domain back) is the mitigation.
- **One-time IdP sign-out** at cutover because the session record format changes.
- **Manual Tailwind → `css()` translation** for the sign-in page and the account/admin screens; visual regressions are likely without side-by-side comparison.
- **Two IdP codebases in flight**, given ADR-010's separate plan for `apps/auth-saas`. Some of this port's UI work is thrown away if ADR-010 later executes.
- **Beta dependency.** `remix@3.0.0-beta.x` still moves between betas. Pin the version, and re-read `docs/vendor/@remix-run/*` on upgrade.

### Neutral

- The OLD APP keeps serving production until Phase 8; both workers can bind the same D1, KV, and R2 safely because only the OLD APP consumes the queue and receives crons until then.
- Relying parties need no changes at all: same URLs, same issuer, same keys, same claims.
- The `clients` table's one-redirect-URI-per-client limit, the plaintext secrets, and the scheme-less issuer all survive the port unchanged. They are ADR-010's problems, not this ADR's.

## Implementation Plan

Rules for every phase: work only inside `apps/r3-auth` and this ADR file (plus the repo-level config files named in §13). Definition of done for **every** phase, in addition to its own items: `bun typecheck`, `bun lint`, and `bun run test` pass from the repo root; `bun format:fix` has been run; `bun run build` and `bunx wrangler deploy --dry-run` succeed; the work is committed to `main` with Conventional Commits; the Current Progress checklist is updated with what was and was not verified.

### Phase 0: Scaffold and data layer

**Priority:** High. **Effort:** ~1 day.

1. Copy `templates/app` to `apps/r3-auth`; set the package name `@apps/r3-auth`, `tsconfig.json` (paths + `jsxImportSource: "remix/ui"`), and `vite.config.ts` (Cloudflare plugin, `bootstrap/browser.ts` client entry, port 3002).
2. Fill `wrangler.jsonc` per §13 (no consumer, no crons, no route); run `bun cf:typegen`.
3. Replace the template's `infrastructure/database` adapter with `@pkg/data-table-d1`; delete `resources/components/timer.tsx` and any demo leftovers.
4. Copy the 8 migrations into `database/migrations/`; write `database/schema.ts` for all six tables; `bun db:local:migrate` and verify locally.
5. Port the six models into `app/data/` with tests against `remix/data-table-sqlite`.
6. Create `app/lib/container.ts` (Database with the epoch-ms `now`, PolarClient, rate limiters) and `config/router-context.d.ts`.

### Phase 1: The OIDC engine

**Priority:** High. **Effort:** ~1 day.

1. Port `app/modules/oauth2.ts` → `app/auth/oidc-provider.ts` and the three entities → `app/auth/values/`.
2. Port `app/modules/oauth2.test.ts` and get it green. **Do not proceed until it is.**
3. Port `app/modules/jwks.ts` → `app/services/signing-keys.ts` and `app/config.ts` unchanged (issuer strings frozen).
4. Implement `app/auth/repository.ts` on `remix/data-table` + KV, with tests covering authorization-code single-use consumption, session lookup/deletion, grant find-or-create, and the two logout queries.

### Phase 2: Authorization and token endpoints

**Priority:** High. **Effort:** 2–3 days.

1. `bootstrap/app.tsx` with the full middleware chain (§2), including the `cop()` bypass list, and `bootstrap/worker.ts` `fetch`.
2. Session middleware + `authz` session state (§7); `requireSubject()` / `requireAdmin()`.
3. `GET`/`POST /authorize` including SSO, all five `prompt` values, the no-params self-redirect, `response_mode` handling, and **the PKCE fix (defect #1)**.
4. `POST /oauth/token` (three grants, Basic + body auth), `/oauth/revoke`, `/oauth/introspect`, with rate limiting (§8).
5. `GET /userinfo`, `GET /healthcheck`, `GET /`, and the 404 default handler.
6. Router-level tests for the full code flow with PKCE, refresh rotation, client credentials, scope gating, `prompt=none`, redirect-URI mismatch, and code replay.

### Phase 3: Login flows

**Priority:** High. **Effort:** 2–3 days.

1. The sign-in page: two-column layout, client panel, credential login + registration form (shown for `prompt=create`), GitHub button — `remix/ui` + `@pkg/r3-ui`, palette translated into `resources/styles.ts`.
2. GitHub login without `remix-auth-oauth2` (§12), including subject + connection + Polar customer provisioning with compensation on partial failure.
3. `/auth/:provider`, `/auth/:provider/callback` (incl. the `op_browser_state` cookie), `/auth/callback` (self-login).
4. The `form_post` response-mode view (§4.4).
5. Tests: credential login (new + existing subject), GitHub first login and returning login, provider error redirect, `form_post` output.

### Phase 4: Logout and discovery

**Priority:** High. **Effort:** 1–2 days.

1. `GET`/`POST /oidc/logout`: back-channel token dispatch, front-channel iframe page with the `meta refresh` redirect, session destruction, `Clear-Site-Data`, `state` propagation.
2. `/oidc/check-session` (§4.4, defect #8).
3. The three `.well-known` documents, including defect #4's additive fix.
4. Tests: logout with and without `id_token_hint`, back-channel fan-out excluding the initiating client, front-channel URL collection, post-logout redirect validation.

### Phase 5: Account area

**Priority:** Medium. **Effort:** 1–2 days.

Profile view/edit, sessions list with user-agent parsing and revoke/revoke-all (native `<dialog>` confirmations), grants list with revoke, the account layout and navigation, and the silent access-token refresh in `requireSubject()`. Tests per page and per intent.

### Phase 6: Admin area

**Priority:** Medium. **Effort:** 2 days.

Dashboard stats; client list/create/detail/edit/delete with one-time secret reveal (`CopyButton` island); subject list/detail/edit/delete with session revocation; pagination; `requireAdmin()` enforcement. Tests per page and per intent, plus a non-admin access test.

### Phase 7: API, jobs, i18n sweep, docs

**Priority:** Medium. **Effort:** 1–2 days.

1. `GET /api/subjects/:subjectId` with `requireApiClient()`, the per-client KV cache, and `Server-Timing`.
2. `scheduled` + `queue` handlers and `CleanExpiredSessionsJob` (same monitor id).
3. i18n coverage pass: every view string goes through `ctx.i18next.t(...)`; no hardcoded English.
4. `README.md`, `AGENTS.md`, and `.oxfmtrc.json` / `.claude/launch.json` entries.

### Phase 8: Verification and cutover

**Priority:** High (gating). **Effort:** 1–2 days + soak.

1. Deploy the NEW APP (build → migrate if needed → `bun run cf:deploy`), still without queue consumer, crons, or the custom domain. Exercise it on its `workers.dev` URL against production data and compare every page and endpoint with the live OLD APP.
2. **Point each client app at the NEW APP's `workers.dev` origin in a local dev run** and complete a full login, refresh, subject lookup, and logout for `apps/blog` and `apps/uptime`, including `@pkg/auth-sdk`. This is where the PKCE change gets proven. Do not proceed on inspection alone.

   **Gate: a returning GitHub sign-in with a real account.** Social login resolves an existing subject by the `node_id` every stored `connections.external_id` row holds, because the framework's provider hands back GitHub's numeric account id instead. If that matching is wrong in a case the unit tests miss, the symptom is that every returning user looks new and is then refused by the email check — and since essentially every subject authenticates through GitHub, that is the whole user base locked out. Sign in with a real GitHub account that already has a `connections` row and confirm the _existing_ subject is returned, not a new one. This is the highest-risk item in the port and is verified by hand, not by test.

   **Accepted:** the one-time IdP sign-out at cutover (§7) is expected and needs no mitigation. Client app sessions are unaffected; a user whose client session expires next is prompted to sign in instead of getting silent SSO.

3. Cutover, in this order: deploy the OLD APP with its cron and queue consumer removed → add `queues.consumers` + `triggers.crons` to the NEW APP and deploy → move the `auth.sergiodxa.com` custom domain to the NEW APP → verify a real login, a real refresh, a real logout, and the discovery/JWKS documents.
4. Soak for a week with the OLD APP dormant (rollback = reverse the three steps; both workers share the same data, so rollback is config-only). Then rename `apps/r3-auth` → `apps/auth`, delete the OLD APP worker, remove the Tailwind override from `.oxfmtrc.json`, and mark this ADR **Implemented**.

## Alternatives Considered

### 1. Build the NEW APP on `@pkg/oidc-provider`

`@pkg/oidc-provider` is already a complete Remix v3 OAuth/OIDC provider (authorize, token, userinfo, introspect, revoke, discovery, JWKS, logout, management API) designed to run on a plain Worker with D1.

**Rejected because**: it is a different product. Its schema is its own (its own migrations, hashed client secrets, multiple redirect URIs per client, passkey credentials, tenant metadata, signing keys in the database rather than R2), its authentication model is passkeys plus magic links rather than GitHub plus bcrypt passwords, and adopting it means migrating live subject, client, session, and grant data plus re-enrolling every user's credentials. That is exactly the migration [ADR-010](../ADR-010-auth-saas-completion-and-tenant-migration.md) already specifies, with its own runbook and rollback plan. Doing it under the banner of a stack port would smuggle a product migration into a refactor. This port instead carries the OLD APP's own engine across, which is already storage-agnostic and already tested.

### 2. Skip this port and execute ADR-010 instead

**Rejected because**: ADR-010 is a much larger, riskier, coordinated migration touching three client apps and every user's credentials, and it has been Proposed and unexecuted since 2026-07-04. Meanwhile the monorepo carries a React toolchain for one worker. This port is independently valuable, reversible, and invisible to users; it also leaves ADR-010 strictly easier (a Remix v3 codebase to compare against, and real tests for the OIDC contracts it must preserve). The duplicated UI work is the accepted cost.

### 3. Incremental migration inside `apps/auth`

Port route-by-route in place, mixing React Router and fetch-router.

**Rejected because**: the two stacks share nothing at the view layer, their Vite and worker-entry configurations conflict, and there is no way to serve both routing systems from one worker entry without a bespoke shim. The side-by-side worker approach is also what made the previous two ports reversible.

### 4. Keep Tailwind and `@pkg/ui` for the NEW APP

**Rejected because**: the monorepo rule for Remix v3 apps is `remix/ui` JSX with `css()` mixins, and `@pkg/ui` is React-only. `@pkg/r3-ui` already covers every component this app uses. Visual parity comes from translating the OKLCH palette verbatim.

### 5. Fresh D1 database with a data migration at cutover

**Rejected because**: it adds an export/import with downtime risk for zero product benefit. Sessions, grants, and clients must survive, and the explicit goal is to reuse the same resources. Schema evolution can happen later through normal migrations.

### 6. Deploy the NEW APP over the existing `auth` worker name

Would inherit the domain, queue, and crons automatically.

**Rejected because**: it makes cutover all-or-nothing with no side-by-side verification window, on the one app whose failure takes down every other app's login. The two-worker cutover is reversible in three config steps.

### 7. Also fix the plaintext client secrets and the scheme-less issuer

**Rejected (deferred) because**: both are coordinated changes with external blast radius — client secrets are held only by the clients, and the issuer string is pinned in two client apps' token verification. A stack port should not require every relying party to redeploy. Each deserves its own ADR.

## References

- OLD APP key files: `apps/auth/wrangler.jsonc`, `app/entry.worker.ts`, `app/routes.ts`, `db/schema.ts`, `app/config.ts`, `app/session.ts`, `app/modules/{oauth2,jwks,rate-limit}.ts`, `app/services/oidc.ts`, `app/entities/`, `app/models/`, `app/middleware/`, `app/helpers/`, `app/strategies/github.ts`, `app/jobs/`, `app/routes/`
- Client apps that must keep working: `apps/blog/app/auth/`, `apps/uptime/app/auth/`, `packages/auth-sdk/src/index.ts`
- Scaffold: `templates/app/`
- Remix v3 vendor docs: `docs/vendor/@remix-run/{fetch-router,ui,data-schema,data-table,auth,auth-middleware,session-middleware,cop-middleware,render-middleware,response,session,cookie}/`
- Related ADRs: [r3-uptime ADR-001 (the previous port of this shape)](../r3-uptime/ADR-001-port-uptime-to-remix-v3.md), [ADR-010 auth-saas completion and tenant migration](../ADR-010-auth-saas-completion-and-tenant-migration.md), [ADR-011 OIDC provider engine package](../ADR-011-oidc-provider-engine-package.md), [ADR-008 service container](../ADR-008-service-container-for-remix-v3.md), [ADR-013 Remix UI for application interfaces](../ADR-013-remix-ui-for-application-interfaces.md), [ADR-014 r3-ui component library](../ADR-014-r3-ui-component-library-on-remix-ui.md), [auth ADR-002 self-login OAuth flow](../auth/ADR-002-self-login-oauth-flow.md), [auth ADR-005 OAuth2/OIDC spec compliance](../auth/ADR-005-oauth2-oidc-spec-compliance.md), [ADR-002 SSO logout with id_token_hint](../ADR-002-sso-logout-with-id-token-hint.md), [ADR-003 OIDC back-channel logout](../ADR-003-oidc-backchannel-logout.md)
- Repo rules: root `AGENTS.md`, `apps/auth/AGENTS.md` (security rules to carry over), `docs/guides/{app-documentation,package-documentation,adr-writing}.md`

## Current Progress

- [x] Phase 0: Scaffold and data layer

  **Verified.** `apps/r3-auth` scaffolded from `templates/app` (package `@apps/r3-auth`, port 3002, `jsxImportSource: "remix/ui"`); `wrangler.jsonc` filled per §13 with the same D1/KV/R2/queue-producer/rate-limiter resources and **no** consumer, cron, or route, confirmed by `bunx wrangler deploy --dry-run` listing all nine bindings; `bun cf:typegen` run. The template's `infrastructure/` adapter, `app/contracts/kv-store.ts`, and `resources/components/timer.tsx` are deleted — production uses `@pkg/data-table-d1` through `app/lib/container.ts`. The 8 migrations are copied byte-for-byte and `bun db:local:migrate` applies all 8 and creates the six tables. All six models live in `app/data/` with the same method names, `Customer` moved to `app/services/customer.ts` on `PolarClient`, and defect #6 is fixed (the insert is awaited, the impossible check gone, with a regression test asserting the row exists after `create` resolves). 54 tests across the six models and the customer service pass against the real schema. `bun typecheck`, `bun lint`, `bun run test` (9395 tests, 0 fail), `bun format:fix`, `bun run build`, and `bunx wrangler deploy --dry-run` all pass.

  **Not verified.** Nothing is deployed and no HTTP surface exists yet: `routes/web.ts` is still empty and the router only serves the 404 default handler, so the middleware chain of §2, the `cop()` bypass list, and every endpoint remain Phase 2 work. The container is registered but never resolved by running code, and the rate-limiter adapters have never spent a budget against a real binding. `database/schema.ts` is only proven against the migrations, not against production rows.

  **Deviations from this ADR, all recorded here rather than guessed at:**

  1. §14 asks for `createSqliteDatabaseAdapter` from `remix/data-table/sqlite`; the export path is `remix/data-table-sqlite`. The shipped adapter was tried first and works for everything this app does (relations, counts, scoped deletes, `returning`), so `app/lib/test/db.ts` uses it and no adapter is hand-rolled.
  2. §6 says `Customer` moves onto `@pkg/polar`'s `createCustomer`/`findCustomerByEmail`/`updateCustomer`. `createCustomer` accepts no external id, so `Customer.create` creates and then links with `updateCustomer`. A failure between the two leaves an unlinked customer, which `findOrCreateByEmail` links on the next sign-in — so the two-step write needs no compensation.
  3. `AUTH_SERVER_NAME` and `AUTH_SERVER_CLIENT_ID` are needed by `Client.ensureAuthServerClient`, so `app/config.ts` exists already holding just those two. Phase 1 fills in the rest of the file rather than creating it.
  4. §13's `.oxfmtrc.json` entry is not added: the only override there is a Tailwind stylesheet path, and this app has no Tailwind, so an entry would be a no-op. `.claude/launch.json` is left to Phase 7 with the rest of the developer-facing config.
  5. `Session.deleteExpiredSessions` and the `deleteBy*` methods return the number of rows removed and delete in a single statement, rather than issuing one delete per row. Same effect, and it is the D1-safe shape.
  6. Relations are declared in `database/schema.ts` (`sessionClient`, `grantClient`) so `Session.findBySubjectId` and `Grant.findBySubjectId` keep loading the client alongside the row, as their callers expect.

- [x] Phase 1: The OIDC engine

  **Verified.** `app/modules/oauth2.ts` is ported to `app/auth/oidc-provider.ts` and the three entities to `app/auth/values/{access-token,id-token,logout-token}.ts`, with the `Nullable<T>` helper, the `OIDC` namespace, the static error classes and the `throw`-based token path untouched. Its test suite is ported to `app/auth/oidc-provider.test.ts` and passes **42/42 on the first run** — no behavior difference to chase, so nothing about the engine had to be re-derived. `app/services/signing-keys.ts` loads the ES256 pair from the same R2 bucket and file through `@edgefirst-dev/jwt` + `@edgefirst-dev/r2-file-storage`. `app/config.ts` is filled in from the source app with the issuer strings frozen: discovery `issuer` stays the scheme-less `auth.sergiodxa.com` and the authorization-response `iss` parameter stays `https://auth.sergiodxa.com` (§16 defect #3). `app/auth/repository.ts` implements the same `OIDC.Repository` over `remix/data-table` and KV; its 17 tests cover single-use code consumption (delete-before-return, replay returning `null`, unknown and unreadable codes returning `null` rather than throwing), session lookup/creation/revocation with epoch-ms columns read as dates, grant find-or-create idempotence, and both logout queries including the initiating-client exclusion and the per-channel URI filter. `bun typecheck`, `bun lint`, `bun run test` (9456 tests, 0 fail), `bun format:fix`, `bun run build` and `bunx wrangler deploy --dry-run` all pass.

  **Not verified.** Nothing here has run against a real request, a real R2 bucket, or the real KV namespace: `getSigningKey()` has never been called, so the R2 key file has not been read by this app, and the KV code path is proven only against the in-memory namespace double. No endpoint exists yet, so the engine is exercised only through its own tests and never through HTTP. PKCE is still stored as `null` by `generateAuthzCode` — defect #1 stays open for Phase 2 as planned, and the engine's verifier check remains dead code until then.

  **§12 decision placeholder:** still open. Nothing in Phase 1 touched GitHub login, so `remix/auth` versus a hand-rolled `app/services/github-login.ts` remains a Phase 3 decision. Phase 1 did add `@pkg/crypto`, `@pkg/dates` and `@pkg/validate` to the app's dependencies, and keeps `@edgefirst-dev/jwt` and `@edgefirst-dev/r2-file-storage` as §12 expects. (Phase 1 also kept `bcryptjs`; it was dropped later — see the §5 revision.)

  **Production schema verification (read-only `SELECT`s against remote D1, no writes):**

  1. `email_verified_at` on `subjects` is `typeof = integer` for all 5 rows, and `sessions.created_at` / `sessions.expires_at` are `integer` for all 14 rows. The epoch-ms integer assumption in `database/schema.ts` is confirmed against real data.
  2. **The two `*_session_required` columns do not exist in production.** Querying them fails with `no such column: backchannel_logout_session_required`. `sqlite_master` shows `clients` as `(id, created_at, updated_at, name, secret, redirect_uri, logout_uri, description, logo_url)` — none of `backchannel_logout_uri`, `backchannel_logout_session_required`, `frontchannel_logout_uri`, `frontchannel_logout_session_required`. `d1_migrations` lists only the first **6** of the 8 migrations as applied; `20260225065208_wooden_shadowcat.sql` and `20260225071438_friendly_true_believers.sql`, which add exactly those four columns, have never been applied to the remote database. So the ADR's schema table describes the migrations, not production. Consequences: every `Session.findBySubjectId`/`Grant.findBySubjectId` call loads the client relation and so selects those columns. **Phase 8 must run `bun db:remote:migrate` before the new app serves traffic** — treat step 1 as a gate that exercises a client-loading path on the `workers.dev` origin, not a formality. Verify afterwards that `PRAGMA table_info(clients)` returns 13 columns and `d1_migrations` has 8 rows; because the columns and the migration records are missing consistently, the two `ALTER`s will apply cleanly rather than hitting "duplicate column name". No write was issued: production data is untouched.

  **Unresolved tension — do not treat this as settled.** The prediction that client-loading queries fail in production is _not_ borne out: a live `/authorize` request naming a real client id returns 200 and renders that client's name, which can only come from the `clients` row, so the SELECT is working today. The deployed bundle is dated after commit `f80581ce`, which added the four columns and the discovery flags together, so "the deployed code predates the schema change" does not obviously explain it either. Something about the deployed query shape differs from what the source at HEAD emits, and it was not established what. Two probes that would have decided it were not run. Independently of the outage question: if these columns have never existed in production, the back-/front-channel logout fan-out has likely never actually run there, which bears on what Phase 4 is expected to preserve.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. §5 says to replace `date-fns`'s `isBefore` with a plain `<`. The source module no longer uses `date-fns` at all: it expresses expiry as `elapsed(session.expiresAt) > 0` using `@pkg/dates`. That is already a monorepo package, so it was ported unchanged and no date library was added.
  2. §5 and the Notes say the engine imports `timingSafeEqual` from `node:crypto`. It does not any more — it takes `timingSafeEqual`, `sha256`, `randomBytes`, `Hex`, `Base64Url` and `password` from `@pkg/crypto`. `nodejs_compat` is therefore no longer required _by the engine_; the flag is kept (other dependencies reach for Node built-ins) but its comment in `wrangler.jsonc` now says so honestly. Dropping the flag deserves its own verification, not a drive-by removal.
  3. §5 originally said passwords stay on `bcryptjs`, and Phase 1 shipped that: PBKDF2 through `@pkg/crypto` for new hashes, plus a legacy read path for stored bcrypt values with an upgrade in place on the next successful sign-in. That legacy path has since been removed. A read-only `SELECT count(*) FROM credentials` against production returns 0, so no stored bcrypt hash exists and nothing stops verifying; `@pkg/crypto` is now the only password implementation, and upgrade-on-login survives for hashes written under an outdated iteration count. See the revised §5.
  4. The `export { OIDC as OIDCProvider }` backward-compatibility alias is dropped: the new module has no callers to stay compatible with, and the comment on it named another app. The ported test imports `OIDC` instead — a rename, not a behavior change.
  5. `app/services/signing-keys.ts`'s `// @ts-expect-error` on `JWK.signingKeys(...)` was re-examined as §5 asks and **is still required**. `@edgefirst-dev/r2-file-storage` is typed against its own older copy of `@cloudflare/workers-types`, whose `R2Bucket.get` declares a narrower return type than the generated bindings. The suppression is kept with a comment naming that reason instead of standing bare.
  6. `findAuthorizationCodeData` returns `null` for a _malformed_ stored payload as well as a missing one, where the source threw a validation error. A payload no schema can read is unusable either way, and `invalid_grant` is a better answer than a 500. Delete-before-return and missing-code-returns-`null` are preserved exactly.
  7. The two logout queries are one `Session.findBySubjectId` (which already loads the client relation) filtered in TypeScript, rather than the source's hand-written join. `remix/data-table` has no join builder, and the SQL predicate being replaced — `ne(clients.backchannel_logout_uri, "")` — excludes `NULL` in SQLite, which the `if (!uri) continue;` filter reproduces exactly.
  8. `Credential.updatePasswordHash` was added to `app/data/credential.ts` (Phase 0's file) because the repository's `updateCredentialPasswordHash` needs it. It updates scoped by `subject_id` and never inserts, so a subject with no credential cannot gain a password they never set; a test covers both.
  9. `app/auth/repository.ts` exports `createOidcRepository(db)` and `createOidcProvider(db)` rather than a module-level singleton, because the `Database` now comes from the container. Phase 2 registers `createOidcProvider` as the container's `OIDC` service.

- [x] Phase 2: Authorization and token endpoints

  **Verified.** `bootstrap/app.tsx` builds the router with the §2 chain in order — `asyncContext()`, request logger, `formData()`, `methodOverride()`, `session(...)`, i18n, `cop()`, `renderWith(createHtmlRenderer)` — typed as a non-tuple `Middleware[]`, with each context property declared in its owning middleware module (`logger`, `subject`) and `render`/`formData` in `config/router-context.d.ts`. `bootstrap/worker.ts`'s `fetch` wraps everything in `container.scope(...)`.

  **The `cop()` bypass list has a test per bypassed path.** `/oauth/{path...}`, `/api/{path...}` and `/oidc/logout` each accept a real cross-origin `POST` (`Sec-Fetch-Site: cross-site` plus an `Origin`), `/authorize`'s `POST` is refused with `403`, and `/oidc/logout-everywhere` is refused too — proving the patterns match a path rather than a prefix.

  **PKCE (defect #1) is closed and covered from both sides.** `/authorize` reads `code_challenge` / `code_challenge_method`, defaults the method to `S256` when a challenge is present, carries both through the session `authz` across the sign-in round trip, and passes them to `generateAuthzCode`, which now stores them instead of `pkce: null`. Tests prove: a code issued **with** a challenge redeems only with the matching verifier (no verifier → `invalid_request` "Missing code_verifier"; wrong verifier → `invalid_grant`); a code issued **without** one still redeems with no verifier at all; a `plain` challenge works; and the challenge survives two requests through the session, which is the case that would silently disable enforcement if the session did not carry it.

  Endpoints: `GET`/`POST /authorize` (SSO, all five `prompt` values, no-params self-redirect through `Client.ensureAuthServerClient`, all three response modes, exact `redirect_uri` match), `POST /oauth/token` (all three grants, Basic **and** body client auth), `/oauth/revoke`, `/oauth/introspect`, `GET /userinfo` (scope-gated claims), `GET /healthcheck`, `GET /` and the localized 404 as the router's `defaultHandler`. `routes/web.ts` declares the whole §3.1 surface; controllers are mapped one `router.map()` call per group with guards baked into their own chains. Session middleware is `auth:session` over `@pkg/session-storage-kv` with prefix `session:`, 30-day TTL, `path: "/"`, `httpOnly`, `sameSite: "Lax"`, and `secure` + `domain: ".sergiodxa.com"` only on the production host. `requireSubject()` and `requireAdmin()` are built and tested through the router on the real `/account/*` and `/admin` URLs.

  212 tests in `apps/r3-auth` and 9553 across the monorepo pass; `bun typecheck`, `bun lint`, `bun format:fix`, `bun run build` and `bunx wrangler deploy --dry-run` (all nine bindings listed) all pass.

  **Not verified.** Nothing has run against real infrastructure: no request has touched the production D1, the live KV namespace, or the R2 key file, so every test signs tokens with a key pair generated into an in-memory bucket. The rate limiters are exercised only against `@pkg/cloudflare-mocks`' counters, never a real binding. **The PKCE change is unproven against real clients** — §16 requires exercising it end to end against `apps/blog`, `apps/uptime` and `@pkg/auth-sdk` before the domain moves, and Phase 8 still owns that. `prompt=consent` and `prompt=select_account` are accepted and deliberately change nothing (parity: this server records a grant on first authorization and holds one account per session), which is asserted but is not a claim that consent works. The account and admin pages, the login flows, logout, discovery and the API are still absent; the guards are proven against stub handlers mapped onto those URLs.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. `app/http/middleware/database.ts` (Phase 0) is deleted. §2's chain does not include it, and every controller resolves the `Database` through `inject([Database])` from the container scope the worker opens, so a middleware publishing the same handle on the context was a second way to reach one thing.
  2. §16 defect #1 says to pass the challenge into `storeAuthorizationCode`; that required the engine to accept one. `OIDC.GenerateAuthzCodeInput` and `LoginWithCredentialInput` gained an optional `pkce`, and `OIDC.Pkce` is exported. The engine's verifier check itself is untouched — it was already correct and is now reachable.
  3. Authorization responses redirect with **303**, not 302. The same code path answers the `POST` sign-in form, and `@pkg/http`'s `redirect` defaults to a method-preserving 307, which would make the browser re-POST credentials to the relying party's callback. See Other is the only status that guarantees the callback is fetched with `GET` whichever request produced it.
  4. `response_mode=fragment` now delivers parameters in the URL fragment. The source app advertised the mode and answered every non-`form_post` request with query parameters, so a client asking for it was already receiving something it could not read; nothing can be relying on the old behavior.
  5. HTTP Basic credentials are decoded with `atob` (standard base64, RFC 7617) rather than base64url. Base64url decoding mangles any secret whose encoding contains `+` or `/`, which is a client that can never authenticate and no error saying why. A test covers a secret with both.
  6. Client credentials are accepted in the body for **every** grant, including `client_credentials`, which the source app accepted only over Basic. Purely additive, and it is what the frozen contract in this document describes.
  7. `Retry-After` on a 429 reports the limiter's whole window (60) as §8 requires, rather than `@pkg/rate-limit`'s estimate of the time left in the current window. The `RateLimit` and `RateLimit-Policy` fields still carry the adapter's own numbers. The published body is unchanged and asserted verbatim.
  8. An unsupported `code_challenge_method` becomes an `invalid_request` error redirect rather than failing schema validation, because a validation failure at that point is indistinguishable from a request carrying no OAuth parameters at all — which self-redirects.
  9. The `/authorize` GET renders a minimal functional sign-in page: the client's identity, the credential form, and the GitHub button, all through `ctx.i18next`. The two-column layout, palette and `@pkg/r3-ui` components are Phase 3, as planned; the seam is `resources/views/authorize.tsx`, whose props are already the ones the designed page needs.
  10. The form-post view carries its submit as a one-line `<script>` text node rather than the source app's `<body onload>`, because `remix/ui` types no `onload` attribute. The string contains no character HTML escaping touches, so it survives being rendered as a text node and the page still ships no HTML built from strings.
  11. `app/lib/test/http.ts` loads the application modules lazily instead of through top-level await. A test file's `beforeEach` can run before an imported module's top-level await has settled, which surfaced as the harness's own bindings being uninitialized — only when the whole directory ran, never for a single file.

- [x] Phase 3: Login flows

  **Verified.** The sign-in page is rebuilt on `@pkg/r3-ui` and `@pkg/u` with no Tailwind and no stylesheet of its own: a two-column grid — the client's logo, name and description plus the concentric-rings figure on the left, the sign-in card on the right — collapsing to the card alone below the 64rem step, where the card's heading becomes the client's name so it is never lost. `resources/layouts/document.tsx` declares the palette from `resources/styles.ts` on `<html>`, links the component library's reset and token layers, and carries `class="system"` (which is what makes the token layer's dark rules follow `prefers-color-scheme`) and the container every responsive rule queries. The document layout and the 404 handler moved to the `Handle` pattern and JSX, so no component is called as a plain function any more.

  GitHub login is `remix/auth`'s `createGitHubAuthProvider` + `startExternalAuth` / `finishExternalAuth` (§12, decided here). `/auth/:provider`, `/auth/:provider/callback` and `/auth/callback` are built, the `op_browser_state` cookie is set on a successful provider sign-in with exactly `Path=/; HttpOnly; SameSite=None; Secure; Max-Age=2592000`, and a provider sign-in now carries the session's PKCE challenge into the code exactly as a password sign-in does — without that, PKCE would have been silently unenforced for every GitHub login.

  Provisioning writes subject → connection → Polar customer and compensates in reverse on any failure, which a test proves by failing the billing client and asserting both rows are gone.

  The inherited defect Phase 2 flagged is fixed: `/authorize?provider=github` starts the flow in place rather than redirecting to a `POST`-only route (a redirect is followed with `GET`, so that path could never have worked). An unrecognized provider falls through to the sign-in page.

  27 new tests across three files (GitHub start/first login/returning login/provider error/state mismatch/email conflict/rollback/`form_post`, the self-login callback and its four refusals, credential login for a new and an existing subject); 255 tests in `apps/r3-auth` and the full monorepo suite pass, as do `bun typecheck`, `bun lint`, `bunx oxfmt` on the changed files, and `bun run build`.

  **Visually verified in a browser** against a local dev server on a fresh database, which caught two rules that were rendering wrong and are now fixed (see deviations 6 and 9): the two-column split at 64rem with the client panel and the rings figure, the single-column collapse at 375px with the client's name as the card heading, and both color schemes.

  **Not verified.** Nothing has run against real infrastructure: no request has reached GitHub, Polar, the production database or the live KV namespace — GitHub is intercepted with MSW and the billing client is a stand-in, so the real profile payload, the real token exchange and the real Polar API are all unexercised, and **no real GitHub sign-in has ever completed**. The browser check ran against a local database whose only client is the server's own registration, so a relying party's logo, description and long name have not been seen in the identity panel. No side-by-side comparison with the currently deployed design was made — only a reading of its source (Phase 8 step 1 still owes that). `bunx wrangler deploy --dry-run` was not run. The `op_browser_state` cookie has never been read back by anything, since `/oidc/check-session` belongs to Phase 4.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. §4.3 offers either rendering the registration form only for `prompt=create` or wrapping it in `<details>`. Phase 2 shipped the `<details>` shape; it is replaced by the conditional render, because every field in that form is `required` **and** required by the POST validator — one form both registers and signs in — and a `required` control inside a closed `<details>` makes the whole form unsubmittable in Chromium. So the credential form and its separator render only for `prompt=create`, and the provider button is always offered. This matches the design being ported, where the same form carried a `hidden` class outside `prompt=create`. Three Phase 2 assertions that read the old markup were updated, and a test was added for `prompt=login create`.
  2. The authorization request parked in the session is **not** cleared when the answered client is this server's own registration. `/auth/callback` is the next request in that same flow and still has to check the `state` and the redirect URI, and clearing it made credential self-login impossible. Every other client's request is cleared as before.
  3. The `provider` query parameter is honored only for `github`, rather than being passed through to whatever the query named. There is one provider, and forwarding an arbitrary value only produced a redirect to a route that would refuse it.
  4. The browser-state cookie is set on success only. The source app set it on a `form_post` error response but not on a query-mode error response; there is no session to monitor behind an error either way, so the inconsistency is resolved toward not setting it.
  5. The view takes the client's `logo_url` as a prop, which Phase 2's seam did not pass, and its labels prop carries a placeholder alongside each caption. Both are what the design needs; the controller change is limited to the props it builds.
  6. **The breakpoint is the literal `64rem`, not a named step, and this matters beyond this page.** A named step resolves to `var(--ui-container-lg, 48rem)`, and a container query's condition is evaluated before custom properties are — so `@container (min-width: var(...))` never matches and the rule is inert. The browser check is what caught it: the page rendered one column at 1280px with the `@container` rule present in the stylesheet and unapplied. A literal length passes through the resolver untouched and works. Any other view in this repo styling a breakpoint through a named step is silently not switching; that is a finding about the shared utility layer, not about this app, and it is left for its own change rather than fixed mid-port.
  7. `app/data/connection.ts` gained a `delete`, which provisioning's rollback needs, and `app/lib/test/http.ts` gained a billing client (a stand-in by default, overridable per test) and the two GitHub secrets in its `env` stub.
  8. The provider callback reports a failure that happens **after** the authorization request is known as an OAuth error at the relying party's own redirect URI, where the source app let it become a 500. A callback carrying the provider's own `error` becomes `access_denied` with the provider's description; anything else becomes `server_error` with a fixed description, so no internal detail crosses the boundary.
  9. The rings figure carries its 5% alpha mixed into the fill color rather than as `fill-opacity`, which the mixin layer emits as a property the browser ignores on an SVG. One opacity on the element would have flattened the overlaps that make the figure, so the alpha has to live in the color.
  10. `.claude/launch.json` gained an `r3-auth` entry on port 3002, which §13 assigns to Phase 7. It was needed to render the page in a browser, and leaving it out would only mean writing it twice.

- [x] Phase 4: Logout and discovery

  **Verified.** `GET`/`POST /oidc/logout`, `GET /oidc/check-session` and the three `.well-known` documents are implemented and mapped. `GET` validates the six optional parameters through `app/http/validators/logout.ts`, resolves the subject from `id_token_hint` or the session, delivers back-channel logout tokens to every other relying party, collects the front-channel URLs, deletes the session rows, unsets the session tokens, and then either renders the iframe page or redirects with `Clear-Site-Data: "*"` and a destroyed cookie. `POST` is the interactive button: back-channel tokens for every client, delete this session row, destroy the cookie, redirect `/authorize`. A request with nothing to act on renders the confirmation page instead, as before.

  The front-channel page (`resources/views/logout-frontchannel.tsx`) carries the hidden RP iframes and a `<meta http-equiv="refresh" content="2;url=...">` in place of the `setTimeout` script, plus the `<noscript>` link — asserted by a test that also asserts `setTimeout` is absent. It ships zero JavaScript.

  `/oidc/check-session` is served as a `text/html` `Response` built from a template literal, with the module header documenting why it is exempt from the "no HTML strings" rule (the artifact is a browser-side script page defined by OIDC Session Management 1.0, running in the RP's frame, with no server data interpolated). `Cache-Control: public, max-age=3600` is kept, and **defect #8 is closed**: no `X-Frame-Options` header at all and no `frame-ancestors` policy, with a test asserting the header's absence.

  **Defect #4 is closed**: `token_endpoint_auth_methods_supported` is now `["client_secret_basic", "client_secret_post"]`, matching what the token endpoint has always accepted. Purely additive, with a test pinning both values. The discovery `issuer` stays the scheme-less `auth.sergiodxa.com` (§16 defect #3) and a test pins it.

  **Two defects were found and fixed in `app/auth/oidc-provider.ts`, neither of them on the §16 list:**

  1. **The logout fan-out could never have run.** `logout()` deleted every session the subject held, and the controller then asked for the back-channel and front-channel recipient lists — which are derived from those very session rows. Both lists were therefore always empty: no back-channel token was ever sent by the RP-initiated path, and the front-channel page was never rendered. `logout()` now collects both lists **before** deleting and returns them (`backchannelSessions`, `frontchannelUrls`); a new `deliverBackchannelLogoutTokens(subjectId, sessions)` sends to an already-collected list, and `sendBackchannelLogoutTokens` keeps its old collect-then-send shape for the `POST` path, whose ordering was already correct. Purely additive to the engine's return value, so its ported suite still passes. An engine test drives a repository that stops answering once the sessions are gone, which is exactly what production looks like.
  2. **`post_logout_redirect_uri` was an open redirect** when no client could be identified: the validation ran only `if (args.postLogoutRedirectUri && client)`, so a signed-in browser handed `/oidc/logout?post_logout_redirect_uri=https://evil.example/` with no `id_token_hint` and no `client_id` was redirected there. It is now an `InvalidRequestError`, which the controller answers as `400 {"error":"invalid_request"}`, and nothing is deleted before the refusal. Two tests cover it (unregistered address for a known client; no client at all).

  Tests: **21 new** across three files — 13 for logout, 3 for check-session, 5 for discovery — plus 2 new engine tests, all green. The back-channel fan-out is proven against MSW handlers that record what each relying party received: exactly one delivery, to the other client and not the initiating one, with `sub`, `aud`, the `events` claim, and `sid` present only when `backchannel_logout_session_required` is `"true"` (the column is `text`, so the comparison is against the string, and a test covers both values). A failing relying party (500) does not stop the logout. Front-channel collection is asserted through the rendered page: the iframe URL carries `iss` and `sid`, the initiating client gets no iframe, and a subject with no other front-channel client skips the page entirely.

  `bun typecheck`, `bun lint`, `bunx oxfmt` and `bun run build` pass for these files; 235 tests in `apps/r3-auth` pass.

  **Not verified.** Nothing has run against real infrastructure — no real relying party has received a logout token, the R2 key file is still never read (JWKS is proven only against the in-memory bucket), and `/oidc/check-session` has never been framed by an actual RP. The `op_browser_state` cookie the iframe reads is set by the login callback, which is Phase 3's, so the page is proven to _look_ for the cookie and not to _find a real one_. `logout_hint` and `ui_locales` are accepted and deliberately ignored. Because the two migrations adding the four `clients` logout columns were only just applied to production, the fan-out has never run there under either app: these tests are the only evidence it works, and Phase 8 should exercise a real back-channel delivery against `apps/blog` or `apps/uptime`.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. §4.4 asks for the front-channel page only; the confirmation page (`resources/views/logout.tsx`) is also needed, because a `GET` that cannot be answered as an RP-initiated logout has always rendered the interactive form rather than erroring.
  2. Both logout views render a whole `<html>` document rather than composing `resources/layouts/document.tsx`. That layout loads the client runtime, and the front-channel page must ship no script; rendering standalone is also what keeps this phase off a file another phase owns.
  3. A refused logout is answered as `400 {"error": "invalid_request", "error_description": ...}` rather than as an unhandled throw. The source app let the error reach its error boundary, which is a 500 for what is a client mistake.
  4. `app/locales/en.ts` gained two keys under the existing `logout` section: `documentTitle` and `continue`. The source app hardcoded "Logout" as the page title and "Click here to continue" in the `<noscript>` link.
  5. `msw` is added to the app's `devDependencies`. The back-channel fan-out is outbound HTTP, and the repository rule is to mock it with MSW rather than stub `fetch`.
  6. `destroySession()` was added to `app/http/middleware/session.ts`: `session.destroy()` deletes the KV record and empties the cookie, which is what replaces the source app's `sessionStorage.destroySession(...)`.
  7. `bootstrap/app.test.ts`'s `/oidc/logout` cross-origin bypass test asserted a `404` because no controller was mapped. It now asserts the `303` the controller answers with, which is stronger evidence the bypass works: the request reached a handler rather than a missing route.

- [x] Phase 5: Account area

  **Verified.** All four URLs are built and mapped: `/account/profile`, `/account/profile/edit` (GET + POST), `/account/sessions` (GET + POST) and `/account/grants` (GET + POST), each guarded by `requireSubject()` baked into its own `createAction`/`createController` chain. `resources/layouts/account.tsx` carries the chrome — a sticky translucent header with the page's breadcrumb trail and heading, a `Toolbar` of `NavLink`s marked with `aria-current`, the admin link for an admin only, and the sign-out form posting to `routes.oidc.logout.action` — and `app/http/view-models/account-chrome.ts` builds its props so no page re-derives them. The pages are `@pkg/r3-ui` throughout (`Card`, `Table`, `Toolbar`, `Breadcrumbs`, `NavLink`, `LinkButton`, `Button`, `Form`, `TextField`, `Avatar`, `Logo`, `Badge`, `Heading`, `Text`, `Empty`, `AlertDialog`), with `@pkg/u` only for page layout, spacing and two one-off adjustments.

  Destructive actions are native `<dialog>`s opened with `commandfor` + `command="show-modal"`, each holding a real `<form>` that posts the `intent`. No JavaScript is involved and none is shipped; a test asserts `confirm(` never appears in the markup. **Breakpoints use the named steps** (`at("lg", …)`), which the `@pkg/u` `at()` fix made work — no literal-length workaround anywhere in these files.

  **The silent access-token refresh already existed from Phase 2 and was not rewritten.** It was re-read, corrected and given two more tests. Its JSDoc claimed the refresh grant "rotates both tokens"; it does not — `refreshTokenGrant` touches the session row and returns `session.id` unchanged, which is the only correct behavior when the session id _is_ the refresh token. The comment now says that, and two tests pin it: one proves the new access token is written back (a second request succeeds after the session row is deleted, which only a stored still-valid token can do), the other proves the row the presented token names is touched rather than replaced by a new row under a new id.

  **Tests: 104 new, all green** — 12 for the profile view and edit form (guard redirect, pre-fill, save, the email address and role being unreachable from this form, both validator rejections preserving the typing, the taken-username refusal), 15 for sessions (guard, user-agent parsing rendered, exactly one current row, `no-store`, empty state, dialog markup, plus per intent: revoke another device, revoke the current one signing out with `Clear-Site-Data: "cookies"`, revoke the last one, a session id belonging to another subject deleting nothing, an unknown id, an unknown intent, revoke-all keeping the current session, revoke-all when the current row is already gone, revoke-all never touching another subject), 10 for grants (guard, empty state, client details, the auth-server row rendered with no control, plus per intent: consent and its sessions removed together, the auth-server refusal, another subject's consent untouched, an unknown client id, an unknown intent, unauthenticated), 14 for the session row mapper, and 3 added to the guard's own file. 359 tests in `apps/r3-auth` and 9708 across the monorepo pass; `bun typecheck`, `bun lint`, `bunx oxfmt` on the changed files and `bun run build` all pass.

  **Visually verified in a real browser** against a local dev server on a local database, at 1280x720 and 375x812, in both color schemes, for all four pages. Two things the check caught and fixed: the header rendered the page name twice (last breadcrumb plus heading), so the trail now carries the page's _ancestors_ only; and the current nav tab read as **disabled** in a dark scheme, because the component library's `aria-current` treatment on `NavLink` is a foreground change alone and the emphasis foreground is dark against the toolbar's dark tinted panel — the current tab now also gets a `brand.tint` pill. Three flows were driven end to end in the browser, not just inspected: revoke-all (the other device's row disappeared, the current one stayed, no `Clear-Site-Data`), revoking the current session (landed back on `/authorize` with the session gone), and withdrawing a client's grant (the row disappeared and its session went with it). The validator re-render was driven too: the field is marked invalid, carries "Expected valid URL", and keeps what was typed.

  **Not verified.** Nothing ran against real infrastructure — no production D1 row, no live KV namespace, no real relying party. The local database's only clients are this server's own registration and one row inserted by hand, so a real client logo has never been rendered in the grants list (only the initials fallback), and no page has been seen with more than two sessions or two grants. `bunx wrangler deploy --dry-run` was not run. No side-by-side comparison with the deployed design was made. The `revoke-all` behavior change described below is proven by tests and in a browser, but never against a subject holding many devices.

  **Two defects found outside this phase's scope, neither of them on the §16 list:**

  1. **A subject who registers with email and password can never sign in.** `POST /authorize` with `prompt=create` creates the subject and the credential with `verified_at = null`, and the engine's very next credential sign-in refuses it as `missing_validation`. Reproduced in a browser on a fresh local database: registration succeeded, the immediate sign-in was refused, and setting `verified_at` by hand was the only way to obtain a session. Nobody is affected in production — the `credentials` table holds zero rows and every subject signs in through GitHub — but credential registration is advertised and does not work. It belongs to the registration path (Phase 3), not the account area, so it was not fixed here.
  2. **`@pkg/r3-ui`'s `Form` provides validation issues through component context that no field consumes.** `Form` accepts `issues` and publishes `Form.Context` with `getIssues(name)` / `isFirstInvalid(name)`, and its JSDoc presents the parse-then-re-render pattern as working — but `TextField` never reads that context and renders an error only from an explicit `errorMessage` prop. The profile edit form therefore threads per-field messages through its own props. Worth fixing in the component library rather than in this app.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. **`intent=revoke-all` revokes every session _but_ the current one, where the source app deleted all of them and signed the person out.** Both strings the person actually reads already promised this — the button says "Revoke all other sessions" and the confirmation says "Only your current session will remain active" — and booting every other device is most useful precisely when someone wants to keep their own session and keep reading the list. Revoking the current session explicitly still signs out with `Clear-Site-Data: "cookies"`, and revoke-all still signs out in the one case where nothing was kept, which means the current session's own row had already been deleted.
  2. Every `POST` answers with a `303` back to the page rather than rendering it, so a refresh never re-posts a revocation. The source app returned a rendered result and relied on client-side navigation.
  3. `GET /account/sessions` sends `Cache-Control: no-store, private`. Every row carries a live refresh token as the value its revoke form posts back, and that page has no business in any store. The source app sent no cache directive.
  4. Each row's confirmation dialog is identified by the row's **position**, not the session id. The id is the refresh token, and an `id` attribute is selectable by any stylesheet or extension on the page; the hidden form input remains the only place it appears.
  5. A revocation naming a session or a client the signed-in subject does not own is answered exactly like one naming a row that no longer exists, and the submitted id is neither echoed back nor logged, so nothing is learned from the difference. Every mutation is scoped to the subject the guard resolved, never to an id from the form.
  6. Withdrawing a grant deletes the consent **before** the sessions. D1 has no interactive transactions, so a failure between the two must leave the safer half done: sessions that expire on their own, rather than a consent that would silently re-authorize the app on its next visit.
  7. The breadcrumb trail holds the page's ancestors only, never the page itself — see the visual note above. The admin layout has the same duplication today and may want the same treatment.
  8. Confirmations compose `AlertDialog` directly rather than `@pkg/r3-ui`'s `Confirm`, whose action button carries `command="close"` and therefore cannot submit a form. `Confirm` fits a dialog whose action is client-side; a server-side destructive action needs the panel built from its parts.
  9. `app/locales/en.ts` gained `account.title`, `account.breadcrumbsLabel`, `sessions.tableLabel`, `sessions.columns.*`, `grants.tableLabel`, `grants.columns.*` and `profile.edit.errors.{invalid,usernameTaken}`. The column headers are new because these lists are tables now; the two error strings are new because the source app rendered an untranslated "Validation Error" alert.
  10. `app/http/middleware/require-subject.test.ts` now maps its stub handler onto two test-only URLs instead of onto `/account/sessions` and `/admin`. Real controllers answer those URLs as of this phase and the next, so the guard tests were observing a page rather than the guard. The chain each request passes through is unchanged.
  11. No icon library was added. The source app's nav and session rows carried `lucide` icons; `@pkg/lucide-remix` is not a dependency of this app, and adding one would have meant touching `package.json` and the lockfile while another session was working in the same tree. The device class is a translated text label instead, which the catalog already had keys for.

- [x] Phase 6: Admin area

  **Verified.** All eight admin URLs are built, mapped one `router.map()` call per route map, and every one of them carries `requireAdmin` in its own `createAction`/`createController` chain rather than inheriting a boundary that would not cascade: `/admin` (three counts read in parallel), `/admin/clients` (GET list + POST `intent=delete`), `/admin/clients/new` (GET form + POST create with the one-time secret reveal), `/admin/clients/:clientId` (GET detail with grant count + POST `intent=delete`), `/admin/clients/:clientId/edit` (GET form + POST update, including both logout channels and their `session_required` flags, redirecting to the detail page), `/admin/subjects` (GET, page size 10), `/admin/subjects/:subjectId` (GET detail with sessions and connections + POST `intent=delete` | `revoke-session` | `revoke-all-sessions`), and `/admin/subjects/:subjectId/edit` (GET form + POST update, redirecting to the detail page). Pagination is plain links whose current page is `aria-current`; a missing or nonsense `page` renders page one rather than failing. A missing client or subject renders the localized 404 document with a 404 status by reusing the router's own default handler.

  **The secret boundary is enforced by the render shape, not by discipline.** `toClientDetail` does not read the `secret` column at all, so no detail or edit page can leak an existing secret even by accident; the generated value is rendered exactly once, on the response to the create (and to a rotation), through the `CopyButton` island — the only client-side island in the app. Tests assert the secret is present on the create response and **absent** from the detail page, the edit form, and the client list, and that a rotation shows the new value and not the old one.

  **`sessions.id` is handled as the refresh token it is.** It reaches the page only as a hidden form field to revoke by; the revoke dialog is keyed by row **position** (`revoke-session-0`), never by the id, so it never appears as an element id a stray script could read off the DOM; and the revocation log line carries the subject id and a count, never the value. Two tests pin both.

  **The two `*_session_required` columns round trip as text.** The edit form derives each checkbox's checked state from the string `"true"`, and an unticked box — which a browser omits from the body entirely — is written back as the string `"false"`, not as a boolean or an absent column. A test drives both directions and asserts the stored values are `"true"` / `"false"`, because a boolean here would silently stop the back-channel fan-out sending `sid`.

  **Destructive actions are native `<dialog>` plus a real form.** Each one is an `AlertDialog` (`role="alertdialog"`, `closedby="closerequest"`) opened by a `command="show-modal"` invoker and answered by a `<form method="post">` inside it carrying the page's `intent` — no `confirm()`, no `useSubmit`, no fetch. **Driven in a real browser end to end**: the dialog opens modally, Cancel closes it, and confirming a client deletion and a subject deletion each posted, redirected 303, and removed the row (with its grants and sessions).

  D1 has no transactions, so every multi-row deletion is ordered so an interruption leaves no row pointing at something gone: grants before the client, and sessions plus grants before the subject.

  **54 tests across three files**, all green, and 359 in `apps/r3-auth` / 9711 across the monorepo. The non-admin access test the phase calls for is there and is stronger than one case: a signed-in `user` subject is refused on **all seven** admin URLs with a 303 to `/account/sessions`, an unauthenticated visitor gets `/authorize` instead, and a subject **demoted after signing in** loses access on the very next request (the role is read per request from the database, not from the token). Per page and per intent: every listing (contents, secret absence, pagination at ten with page two, nonsense page number, empty state), create (success, empty logo URL stored as `null`, non-URL refused, over-280 description refused, the offending field showing its own message), detail (grant count, secret withheld, 404), edit (prefilled form, update, secret untouched without a rotation, rotation, invalid re-render leaving the row unchanged, 404), and every intent including each one's unknown-intent and missing-field refusal asserting that nothing was removed.

  `bun typecheck`, `bun lint`, `bun run test`, `bunx oxfmt` on the changed files and `bun run build` all pass.

  **Visually verified in a browser** against a local dev server, at 1280×800 and 375×812, in both color schemes, on the dashboard, both listings, the create form and its secret reveal, the client detail, the client editor and its rotation reveal, the subject detail, and the subject editor. Four things the browser caught that reading the code did not, all fixed: raw ISO timestamps in table cells (now formatted through `Intl.DateTimeFormat` in the request's language, in the view model); the name and `@handle` in a subject row running together because `Text` is inline; a `Badge` stretching to the full column width inside a flex column; and the two below.

  **Three defects found, two of them in `@pkg/r3-ui` — worth acting on outside this app:**

  1. **`AlertDialog.Cancel` / `Dialog.Close` cannot close a dialog when they sit inside a `<form>`.** They render no explicit `type`, so the button is a submit button, and the platform refuses to run an Invoker Command on one — Chrome says so out loud: "Buttons associated with forms that include command or commandfor attributes are ambiguous, and require a type=button attribute. No action will be taken." The cancel control silently did nothing and Escape was the only way out. Worked around by passing `type="button"` explicitly, with a regression test asserting the rendered markup carries it. The components should set it themselves.
  2. **Overriding a component's own type mixin through `mix` is resolved by stylesheet order, not by array position.** `Card.Title mix={[text("sm")]}` rendered at 24px because the component's `fontSize("2xl")` won, while `rounded("md")` over `NavLink`'s `rounded("sm")` did win — same mechanism, opposite outcome. Every admin view therefore uses the component whose defaults already read correctly rather than overriding one (the stat number is a `Card.Title`, the caption is a `Text`), and nothing in this phase depends on winning such a race.
  3. **`Form`'s `issues` prop shows the person nothing on its own.** Its JSDoc advertises a parse-then-re-render pattern, but `TextField` renders only an explicit `errorMessage`. The create and edit pages therefore pass both: the issue list for focus order and a per-field map (`toFieldErrors`) for the visible text.

  **Not verified.** Nothing ran against real infrastructure — no request touched the production D1, the live KV namespace, or the R2 key file. **The `CopyButton` island's copy behavior is unproven**: the dev server answered its module with a 504 "Outdated Optimize Dep" (a Vite dependency-cache staleness, not app code), so the button rendered but never hydrated, and a clipboard write needs a real user gesture besides — the label swap to "Copied" has never been seen. The pages were checked against a local database holding two clients and one subject, so a listing past page one, a long client name, and a client logo in a row have not been seen in a browser; pagination beyond page one is proven by tests only. No side-by-side comparison with the deployed admin screens was made. `bunx wrangler deploy --dry-run` was not run.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. The client editor gains the back-/front-channel logout fields and their `session_required` switches, which the source app's edit form does not have — the brief asks for them and the columns exist. The source's `regenerateSecret` box is kept.
  2. The subject editor deliberately does **not** offer the email address: it is what a provider identity is matched against on first sign-in, so re-pointing it from an admin screen would change who an account belongs to. It renders read-only and unnamed, so the form cannot carry a new one at all.
  3. Both listings' `intent` posts refuse an unknown intent with `400 {"error":"invalid_intent"}` rather than falling through. The schemas are `variant("intent", ...)` even where there is exactly one branch, so a post naming anything else fails validation instead of reaching a deletion.
  4. Breadcrumb trails hold the page's **ancestors only** — the heading beneath is the current page — and no segment carries `aria-current`. A trail ending in the page itself printed its name twice.
  5. The current navigation tab gets a filled pill (`bg("brand.tint")` plus `fg("brand.emphasis")`) on top of the library's `aria-current` treatment, which is a foreground change alone and over the toolbar's tinted panel in a dark scheme reads as muted rather than as selected.
  6. `app/data/connection.ts` gains `findBySubjectId`, which the subject detail's connected-accounts list needs. No existing method was touched.
  7. `resources/views/admin/confirm-action.tsx` and `resources/views/admin/pagination.tsx` are reused pieces living under the admin views rather than in `resources/components/`, which is shared ground; both are used by more than one admin page and by nothing else.
  8. Dates are formatted in the view model through `Intl.DateTimeFormat(ctx.locale, ...)` rather than rendered as ISO strings, so every row mapper takes the request's language.
  9. No icons. The source app's dashboard cards and navigation carry `lucide-react` glyphs; adding `@pkg/lucide-remix` to this app's dependencies for decoration was not worth a shared-file change, and the screens read fine on text alone.
  10. `app/locales/en.ts` gains keys under the existing `admin` section only: `breadcrumbs.label`, `pagination.*`, a `documentTitle` per page, the four logout-channel form fields, `detail.sessionRequired` / `detail.notSet`, `actions.copy` / `actions.copied`, `form.invalid`, `delete.cancel`, `sessions.lastAccessedLabel` / `expiresLabel` / `unknownDevice`, and a `connections` section.

- [ ] Phase 7: API, jobs, i18n sweep, docs

  **All four items now report done — items 1, 2 and 4 above, item 3 (the i18n sweep) below. The checkbox is left to whoever reconciles the phase, since the four items were finished by different sessions.**

  **Verified — item 3, the i18n sweep, plus the two user-facing pages that skipped `@pkg/r3-ui`.**

  **The component layer now reaches every page.** `resources/layouts/document.tsx` gained two props: `clientRuntime` (default `true`) and `head`. `clientRuntime={false}` omits both the module script and the `modulepreload` hint while still declaring the palette on `<html>` and linking the reset and token layers — so styling and script are separable, and the zero-JavaScript contract §4.4 gives the front-channel logout page no longer costs that page the design system. `head` lets a page contribute its own `<head>` content, which is what the front-channel page's `<meta http-equiv="refresh">` needs.

  All three previously standalone pages now compose that layout and are built from components: the logout confirmation (`Card` + `Card.Header` / `Card.Title` + `Form` + `Button color="danger"`), the localized 404 (`Card` + `Card.Title` + `Text`), and the front-channel page (`Card` + `Card.Description` + `Text` + `Link` in the `<noscript>`). Deviation 2 of Phase 4 — "both logout views render a whole `<html>`" — is therefore retired: the reason was real for one page, and the opt-out prop is what separates that reason from giving up the design system. `@pkg/u` appears only for page-level centering and width (`flex`, `flexCol`, `items`, `justify`, `minBs`, `p`, `is`, `maxIs`, `textAlign`), and no new island was added.

  **The front-channel page was converted, and its zero-JavaScript claim is asserted rather than trusted.** A new test drives a real RP-initiated logout and asserts the rendered document contains no `<script` and no `modulepreload`, alongside positive assertions that it _is_ the shared document (`--ui-color-brand-600` declared, `class="system"` on the root, a linked stylesheet). The existing assertions on the meta refresh, the absent `setTimeout`, the iframe URL and the `<noscript>` link are unchanged and still pass. Confirmed independently over HTTP: `curl` on `/oidc/logout` returns a document with zero `<script` and zero `modulepreload` occurrences.

  **The 404 deliberately keeps the client runtime.** It carries no island either and could opt out, but nothing about that page requires it; noted here rather than changed.

  **The sweep found no hardcoded string in `resources/views/**`or`resources/layouts/**`.** Every user-facing string in every view arrives as a prop built by a controller through `ctx.i18next.t(...)`; the only literals left in those files are mixin arguments, ARIA roles, form methods and element attributes. Verified two ways rather than by reading, because a missing key renders as the key itself: every one of the 229 dotted keys any module passes to `t(...)` was resolved against `app/locales/en.ts` by a script and **all 229 resolve to a string**, so no rendered page can be showing a key as its own text; and the rendered output was then read back in a browser for the pages this item touched. No new key was needed — the catalog already covered everything in the views.

  **Verified — the `toFieldErrors` workaround is gone.** `@pkg/r3-ui`'s `Form` now routes its `issues` to fields through `resolveFieldIssue`, with an explicit `errorMessage` still winning, so the prop threading Phase 6 defect 3 describes is obsolete. `toFieldErrors` is deleted from `app/http/view-models/admin.ts`, and the `fieldErrors` prop plus every `errorMessage={fieldErrors?.…}` is removed from `resources/views/admin/{client-new,client-edit,subject-edit}.tsx` and from the three controllers that built it. `issues={…}` alone is what the pages pass now, and the existing per-field assertions pass unchanged — which is the point: nothing about the visible error text was re-specified, only where it comes from.

  **Driven in a browser, because a markup assertion is exactly what missed this defect the first time.** An invalid `POST /admin/clients/new` re-renders with the summary alert and both offending fields carrying their own message under a red outline — "Expected literal value" on Logo URL, "Expected valid URL" on Redirect URI — at 1280×720 in a light scheme and at 375×812 in a dark scheme. The submission had to be made with the form's own client-side validation suppressed: `type="url"` plus `required` means a browser otherwise never lets the invalid body reach the server.

  **Verified — the `CopyButton` island hydrates, and the label swap works.** Phase 6 recorded this as unproven because the dev server answered the island's module with a `504 Outdated Optimize Dep`. That is Vite dependency-cache staleness and nothing else: deleting `node_modules/.vite` (the app's and the root's) and restarting the dev server makes `/resources/components/copy-button.tsx` answer `200`, and a real click then produces, in order, a `click` on the button, a `command` event carrying `--copy` on its hidden value target, a `navigator.clipboard.writeText` of the secret, and a `ui:copy` event with `success: true` — after which the label reads **"Copied"** and reverts to "Copy" two seconds later, observed through a `MutationObserver` with the native clipboard API in place rather than a stub. Those two seconds are why a screenshot taken a moment afterwards shows "Copy", and why this looked broken.

  **Found but not fixed, and why:**

  1. **The OIDC engine's refusal messages are user-facing English that never passes through `ctx.i18next`.** `app/auth/oidc-provider.ts`'s `loginWithCredential` fails with `MissingValidationError("Verify your email address.")` (two call sites) and `AccessDeniedError("Invalid email or password.")`, and `app/http/controllers/authorize.tsx` renders `login.error.description` verbatim as the sign-in page's `error` prop. Threading a translator into the engine is the wrong fix — it is deliberately framework-agnostic and carries a ported test contract — so the mapping belongs in the controller: switch on the error's stable RFC 6749 `code` (`missing_validation`, `access_denied`, `internal_server_error`) to a locale key, leaving the engine's strings as internal diagnostics. It needs three keys under the existing `authorize.errors` section (`missingValidation`, `accessDenied`, `serverError`) and can fall back to `authorize.forms.error` ("Sign in failed") for an unrecognized code — a key the catalog already holds and nothing reads. Not implemented here because `app/http/controllers/authorize.tsx` and `resources/views/authorize.tsx` were held by another session.
  2. **Four catalog keys are dead.** `authorize.forms.error`, `authorize.forms.github.reminder`, `authorize.errors.invalidRequest` and `authorize.errors.unauthorizedClient` are never passed to `t(...)`. The first is the natural fallback for the mapping above; the rest want either a use or a deletion.
  3. **`app/http/view-models/not-found.ts` carries English fallbacks** (`"Not Found"`, `"The page you are looking for does not exist."`) for a missing translation. Both keys exist and resolve, so the literals are unreachable, and the module documents the choice; left alone.
  4. **`resources/views/account/profile-edit.tsx` still threads per-field messages,** through its own `fieldError(issues, name)` helper rather than `toFieldErrors`. It cannot simply become `issues={…}`: the same field slot also carries "that username is taken", which is not a validator issue. Outside this item's scope.
  5. **`/admin/clients/new` does not preserve what was typed** across a validation re-render — the fields come back empty with their placeholders. The messages and the invalid outlines are correct; only the values are lost. Pre-existing (the view never accepted defaults) and unrelated to `toFieldErrors`.
  6. **The dialog-inside-a-form warning is still live.** Chrome logs "Buttons associated with forms that include command or commandfor attributes are ambiguous, and require a type=button attribute" five times on the admin screens, which is Phase 6 defect 1's workaround still being needed rather than the components setting `type="button"` themselves.

  **Not verified for this item.** Nothing ran against real infrastructure. The front-channel page has never been rendered in a browser — reaching it needs a relying party with a registered `frontchannel_logout_uri` plus a live session — so its conversion rests on the test and the `curl` of the response, not on a screenshot, and the `Link` inside its `<noscript>` has never been seen rendered. The browser checks ran against a local database seeded by hand: a subject registered through `prompt=create` and promoted to `admin` in the local D1, so no production row was read or written. `bunx wrangler deploy --dry-run` was not run, and no side-by-side comparison with the deployed design was made.

  **Verified — documentation and repo config (item 4).** `apps/r3-auth/README.md` is written to `docs/guides/app-documentation.md`, from the code rather than from this ADR: defect #5 is corrected (GitHub and email/password credentials only, stated explicitly as the complete list), and it documents the bindings, the secrets, the full URL surface with methods, the rate limits and their keys, the KV key layout, the frozen `sessions.id`-is-the-refresh-token schema note, the scripts and the deploy steps. Two operator traps are called out: the producer-only queue config (so `scheduled`/`queue` exist but are unreachable) and the 7-day client cache that keeps a deleted or rotated client authenticating. `apps/r3-auth/AGENTS.md` carries the source app's security guidance over — spec compliance, ES256, exact-match redirect and logout URI validation, token TTLs, timing-safe comparison, no secrets in logs, OAuth error envelopes — restated for this stack and with its React Router, Zod and bcrypt rules replaced (passwords are PBKDF2 through `@pkg/crypto` only), and it opens with the frozen contracts. `.oxfmtrc.json` gained an `apps/r3-auth` override; it needs no Tailwind stylesheet, and the `apps/auth` override stays until cutover. `.claude/launch.json` already had a correct `r3-auth` entry on port 3002. The root `README.md` app list is deliberately untouched: every row there names the URL an app serves, and this worker serves none until Phase 8.

  **Verified — `GET /api/subjects/:subjectId`.** `app/http/middleware/require-api-client.ts` verifies the bearer token with `AccessToken.verify` against the R2-backed JWKS, requiring **both** `issuer` and `audience` to be `auth.sergiodxa.com`. That audience check is what keeps this endpoint machine-only: a person's access token is issued for the relying party's client id, so it verifies as a token and is still refused here, and a test drives a real end-user token against the endpoint to prove it. The middleware publishes `ctx.apiClient` and `ctx.timing`, and writes the `Server-Timing` header onto whatever response comes back — the 200, the 404 and its own 401 alike — under the same measurement names the source app used (`JWT/getSigningKey`, `cache/authorize.cacheLookup`, `db/authorize.findClientById`, `auth/authorize`, `cache/cacheLookup`, `db/findSubjectById`). `app/http/controllers/api/subject.ts` answers `{ subject }` on success, `404 {"error":"Subject not found"}` for an unknown id, and `401 {"error":"Unauthorized"}` otherwise, with no detail about which check failed.

  **The KV contract is byte-compatible with the app serving production, in both directions.** `clients:<clientId>:subjects:<subjectId>` with a 7-day TTL holds the response payload verbatim: `camelCase` keys (`createdAt`, `updatedAt`, `emailVerifiedAt`, `displayName`, `avatar`, `role`, `username`, `emailAddress`) and ISO-8601 timestamp strings, which is exactly what the other worker's ORM row serializes to — so an entry either worker writes is served unchanged by the other. `app/http/view-models/api-subject.ts` owns that mapping in one place, and reading an entry goes through a schema: an entry no schema can read falls back to the database instead of being handed to a client, which a test covers. This was checked against `packages/auth-sdk/src/index.ts` field by field, and against the deployed app's `SelectSubject` shape (Drizzle `timestamp_ms` columns serialize as ISO strings).

  **The published client library was exercised for real, not imitated.** `app/http/controllers/api/subject-sdk.test.ts` constructs the actual `@pkg/auth-sdk` `AuthSDK` and lets it parse this app's response, with MSW forwarding the requests it aims at the production origin into the router. Its `authenticate()` call could **not** be driven that way — see the caveat below — so the token request's exact wire format is covered separately by a byte-level test.

  **Verified — `scheduled`, `queue` and the job.** `bootstrap/worker.ts` keeps `fetch` and gains `scheduled` (only `0 0 * * *` enqueues `{ type: "cleanExpiredSessions" }`, via `waitUntil`) and `queue` (validates each body with `variant("type", …)` from `app/http/validators/queue.ts`, logs and **acks** anything else, and lazily imports the job for a valid one, inside one `container.scope`). `app/jobs/clean-expired-sessions.ts` extends `Job` from `@pkg/jobs`, keeps `monitorId = 74f508a2-e6e9-4f01-8c25-2884330e7870`, resolves the `Database` from the container, and logs through the `BatchedLogger` the runner gives it. 10 tests: the job against the sqlite adapter (expired rows deleted, live rows kept, empty database, the monitor id pinned) and the handlers through the worker's own exports (the daily trigger enqueues, another trigger enqueues nothing, a valid message runs the sweep and acks, an unknown `type` acks without running anything, non-object bodies ack, and a mixed batch processes only its valid message).

  **`wrangler.jsonc` is deliberately untouched.** Still `queues.producers` only, no `queues.consumers` and no `triggers.crons`: a Cloudflare queue has exactly one consumer worker and the app serving production still holds that slot along with the schedule. Both handlers are therefore written and unreachable until Phase 8 moves them. `bunx wrangler deploy --dry-run` lists the same nine bindings and no consumer.

  **A frozen-contract defect was found and fixed outside this phase's files.** `app/services/client-credentials.ts` decoded HTTP Basic with bare `atob`, which refuses the base64url alphabet — and `@pkg/auth-sdk` encodes its `Authorization: Basic` header with a JOSE `base64url.encode`, dropping the padding and substituting `-`/`_`. The deployed app decodes with JOSE's own lenient `base64url.decode`, so this was a regression introduced by the port, not inherited. It is currently latent rather than live: with a UUID client id and a UUID secret the plaintext alphabet (hex digits, `-`, `:`) provably never produces a `+` or `/` sextet, so today's encodings are identical under both alphabets — but any secret outside that alphabet would have produced a client that could never authenticate, with no error saying why. The decoder now normalizes `-`/`_` and re-pads before `atob`, which is a strict superset of RFC 7617 and unambiguous (standard base64 contains neither character), with a regression test in `client-credentials.test.ts` and a second one at the router level posting the library's exact bytes.

  **Defect #9 was found, reproduced and fixed here (see §16 for the reasoning).** Credential registration wrote `credentials.verified_at = null`, which the sign-in path refuses, so every account created with a password could never authenticate — found while building the account area, where hand-setting the column was the only way to get a local session. `loginWithCredential` now stores the credential verified when it registers a **new** subject and issues the code instead of refusing it, and keeps storing `null` (and refusing) for a known address that has no credential, which is the branch that protects a GitHub-only account from a stranger attaching a password to it. `OIDC.Repository.createCredential` and `Credential.create` therefore take the verification instant explicitly, so no call site can create a credential without stating which of the two it is. `subjects.email_verified_at` is untouched and still `null` after a credential registration. Six tests cover the loop and the gate: the engine's `registers an unknown email and answers with a code instead of refusing it`, `registers the credential verified, so the account it just created can sign in`, `stores that hash unverified, so a stranger cannot password-protect somebody else's account` and the kept `refuses an unverified credential without checking the password`, plus the router-level `an unknown email registers the subject and is answered with a code`, `a freshly registered account signs in again with the same password` and `refuses a registered subject whose credential was never verified`.

  **Verified by hand, in a browser, on the local worker (port 3002).** Registered `nina.newcomer@example.com` at `/authorize?…&prompt=create` and landed straight in the account area with an active session; logged out; signed in again with the same address and password through the same form and reached the account area again, with the profile page showing the registered name, username and email. The local D1 row confirms the shape the decision claims: `credentials.verified_at` is set and `subjects.email_verified_at` is still `null` for that subject.

  **Not verified.** Nothing here has run against real infrastructure: no request has touched the live KV namespace, the production database or the R2 key file, so the shared `clients:*` key space is proven only against an in-memory namespace — **the byte-compatibility claim is a reading of both codebases plus a test, not an observation of one worker reading the other's entry.** Phase 8 should do that directly: call `/api/subjects/:id` on the `workers.dev` origin, then call the same URL on the live app and confirm it serves the entry written by the new one. No queue message has been delivered by the platform, no cron has fired, and the uptime monitor has never received a ping from this app (the job's `uptime()` is skipped in tests because no token is configured). `env.QUEUE.send` is exercised only against a stub, so nothing proves the producer binding works. `Client.findById`'s 7-day cache means a **deleted or rotated client keeps authenticating for up to a week**; that is the source app's behavior, kept deliberately, and it is worth revisiting separately.

  **Deviations from this ADR, recorded rather than guessed at:**

  1. **The client-resolution cache stores `{ id }` only, not the whole client row.** The source app cached the full row under `clients:<clientId>` — including the plaintext `secret` — with a 7-day TTL, while the only field either app reads off it is `id`. Storing just the id keeps the key interoperable (the other worker reads `client.id` and nothing else, and this app's reader strips unknown keys, so an entry written on either side works) and takes a plaintext client secret out of KV. Two tests cover both directions, and one asserts the secret never appears in what this app writes.
  2. `Server-Timing` is written by the middleware after the endpoint answers, rather than by each handler assembling its own `Headers`. Every response under `/api` is constructed by this app, so its headers are mutable, and one place writing them means the 401 and 404 carry measurements too.
  3. The completion log line reports the number of rows the delete statement actually removed, where the source app reported the length of the list it had counted a moment earlier. Same number in practice, and the smaller lie is not worth keeping.
  4. `test/setup.ts` (the monorepo-wide test preload) now also exports `waitUntil` from its virtual `cloudflare:workers` module. A module's export set is fixed at link time, so any source file statically importing `waitUntil` fails to load before a per-file `mock.module` can replace the stub — which broke `require-subject.test.ts` the moment the API controller entered the router's module graph. The stub's `waitUntil` only swallows rejections; a test that needs to observe background work still supplies its own.
  5. `app/lib/test/http.ts` gained the same `waitUntil` in its two `cloudflare:workers` mocks, so a test can assert on a cache entry written in the background after one `await Bun.sleep(0)`.
  6. **`@pkg/auth-sdk`'s `authenticate()` cannot be driven through MSW, and the reason is worth writing down.** It posts a `FormData` body, and with MSW's interception active, `remix/form-data-middleware` yields an **empty** `FormData` for a multipart body — reduced to a minimal case: the same request parses correctly through `parseFormData` directly and through a route added to the same router, but the token endpoint sees nothing, and removing `server.listen()` makes it pass. The failure is silent (an empty body, not an error), which is what makes it worth a note rather than a shrug. Multipart parsing is proven without MSW instead, by a test posting the library's exact bytes — multipart body plus base64url Basic header — so the wire format is covered even though the library's own call is not. This is a test-environment interaction, not an app defect; nothing was changed in the app for it, and it was not established which of MSW's patches causes it.
  7. `app/http/validators/queue.ts` holds the message schema rather than `bootstrap/worker.ts`, matching where every other validator lives.

- [ ] Phase 8: Verification and cutover

## Notes

- **The `sessions.id` column is the refresh token.** Nothing may regenerate or expose it casually: it appears in the account sessions list only as an opaque id to revoke, and it is the value clients send to `/oauth/token`.
- **All timestamp columns are `INTEGER` epoch milliseconds**, written by Drizzle's `timestamp_ms` mode. `database/schema.ts` must use `c.integer()` and every write must pass `Date.now()`-style numbers. Mixing in ISO strings breaks ordering and comparisons against existing rows.
- **Both workers must sign with the same R2 key pair.** If the NEW APP ever generates its own key, tokens it issues stop verifying against the JWKS clients have cached, and vice versa. Never delete or rotate the R2 key file during the port.
- **`nodejs_compat` is kept, but no longer for the engine.** The engine now takes `timingSafeEqual` and its other primitives from `@pkg/crypto`, which needs no Node built-ins (verified in Phase 1). The flag stays because other dependencies reach for them; removing it is a change to verify on its own.
- **Production is two migrations behind.** Only the first 6 of the 8 files in `database/migrations/` are recorded in the remote `d1_migrations` table, so the four back-/front-channel logout columns on `clients` do not exist in production. Every query that loads a client row selects them, so `bun db:remote:migrate` must run before this worker serves any traffic (verified read-only in Phase 1). Production nonetheless serves client-loading requests today; that contradiction is unexplained — see the Phase 1 progress note before relying on either reading.
- **The authorization code is single-use by deletion**: `findAuthorizationCodeData` deletes the KV entry before returning, and returns `null` (never throws) so a missing code maps to `invalid_grant` rather than a 500. Preserve both behaviors.
- **`Client.ensureAuthServerClient`** bootstraps the server's own OAuth client row (id `d12d3901-3cbe-468b-adf5-ac3d3e015728`) on the first `/authorize` visit without params, deriving `redirect_uri` and `logout_uri` from the request origin. It inserts only when the row is missing, so production data is safe — but that also means the row already points at `https://auth.sergiodxa.com/auth/callback`. Visiting `/authorize` without params on the NEW APP's `workers.dev` origin therefore self-redirects into the OLD APP. Test the self-login flow either locally (fresh D1, row created with the localhost origin) or after the domain move, not on `workers.dev` against production data.
- **`router.map()` takes actions only for a map's direct leaves**, and middleware does not cascade between calls. Bake guards into `createAction` chains instead.
- **`ctx.params.x!`** is the accepted idiom for route params when the handler goes through `getContext()` (which erases per-route typing).
- **oxlint's `jsx-key` warning on `remix/ui` component arrays is a known false positive** — do not "fix" it by adding `key` to components.
- **`wrangler deploy` does not build the Vite app.** Run `bun run build` first so the client and SSR outputs exist; a stale `.wrangler/deploy/config.json` pointing at a deleted output directory also fails.
- **`wrangler d1 migrations apply` tracks applied migrations by filename** in the `d1_migrations` table — which is why copying the migrations directory unchanged makes production consider them already applied.
- **Rate limiter bindings answer only `{ success }`.** The limits and windows declared to `@pkg/rate-limit`'s `CloudflareAdapter` are metadata for the response headers and must be kept in step with `wrangler.jsonc`.
