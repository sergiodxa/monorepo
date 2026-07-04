# ADR-010: Auth SaaS Completion and Tenant Migration

## Status

**Proposed** - 2026-07-04

## Background

[ADR-006](./ADR-006-auth-saas-platform.md) designed `apps/auth-saas`, a multi-tenant authentication platform built on Durable Objects. The implementation is substantially complete (~22,700 lines, tenant DO with full OIDC flows, dashboard, Polar billing, CF for SaaS hostnames) but was never deployed. Meanwhile `apps/auth` — the original single-tenant IdP — still serves production at `auth.sergiodxa.com`, and every authenticated app in the monorepo is an OAuth client of it.

Two forces make finishing this now worthwhile. First, [ADR-009](./ADR-009-blog-saas-platform.md) (blog SaaS platform) hard-depends on auth-saas being live: its dashboard authenticates against an auth-saas tenant and it provisions per-blog OIDC clients through the tenant Management API. Second, running two IdP codebases indefinitely means double maintenance of security-critical code; the plan was always for `auth.sergiodxa.com` to become the auth-saas platform domain.

This ADR covers: the work needed to make auth-saas production-ready (including defects found by auditing the code against its intended behavior), and the migration of all client apps from `apps/auth` to auth-saas tenants, ending with the decommissioning of `apps/auth`.

## Context

### Current State: apps/auth (production IdP)

| Aspect       | Implementation                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Issuer       | `auth.sergiodxa.com` (no scheme in `iss` claim)                                                                                       |
| Framework    | React Router v7 on Cloudflare Workers                                                                                                 |
| Storage      | D1 (7 tables: subjects, credentials, connections, sessions, clients, grants), KV (authz codes), R2 (ES256 keys)                       |
| Auth methods | GitHub OAuth + email/password credentials                                                                                             |
| Endpoints    | authorize, token (code/refresh/client_credentials), userinfo, introspect, revoke, discovery, jwks, RP-initiated logout, check-session |
| Logout       | RP-initiated with `id_token_hint`; sends back-channel logout tokens and front-channel iframes                                         |
| Clients      | D1 `clients` table, plaintext secrets, one redirect URI each                                                                          |
| Jobs         | Queue-based session cleanup (Cloudflare Queues, daily cron)                                                                           |

### Client Inventory (the migration surface)

Exactly three apps are clients of `auth.sergiodxa.com`; four others were verified as non-clients (`apps/books`, `apps/pkmn`, `apps/r3-gallery`, `apps/r3-uptime` — the last is a placeholder).

| App            | Domain               | Flow                                                 | Hardcoded auth endpoints in                                                                                                                      | Local user link                              |
| -------------- | -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `apps/blog`    | sergiodxa.com        | OIDC code + PKCE                                     | `app/modules/auth.ts`, `app/entities/id-token.ts`, `app/middleware/session.ts`                                                                   | `users.subject_id` (unique) + email fallback |
| `apps/uptime`  | uptime.sergiodxa.com | OIDC code + PKCE, `@pkg/auth-sdk` for subject lookup | `app/modules/auth.ts`, `app/entities/id-token.ts`                                                                                                | `memberships.subject_id` + email fallback    |
| `apps/r3-blog` | r3.sergiodxa.com     | OIDC code + PKCE (Remix v3)                          | `app/auth/services/oauth.ts`, `app/services/id-token-verification-key.ts`, `app/auth/value-objects/id-token.ts`, `app/http/controllers/auth.tsx` | `users.subject_id` (unique) + email fallback |

Shared contracts (all three): scopes `openid profile email`, ES256 ID tokens verified against the JWKS, raw ID token stored in session for RP-initiated logout with `id_token_hint` + `Clear-Site-Data`, and `findOrCreateFromAuthProfile`-style provisioning (subject_id lookup, email fallback). No custom scopes or claims are used anywhere.

### Current State: apps/auth-saas (built, not deployed)

Complete: tenant DO with all core OIDC endpoints, WebAuthn registration/authentication, Management API (clients/secrets/URIs/subjects/resources/branding/stats/signing-keys), 6 tenant migrations, cleanup alarms, dashboard (tenant/client/user/resource/branding/hostname/billing CRUD), onboarding against a special `platform` tenant, PolarService + webhooks + subscription enforcement, MAU tracking + daily report cron, CF for SaaS HostnameService (metadata casing fixed in this session).

### Verified Defects and Gaps

Auditing the code against intended behavior surfaced these (several were unknown before this ADR):

| #   | Defect / gap                                                                                                                                                                                                                                                     | Location                                                     | Severity                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | No silent SSO: every `/authorize` visit runs a full passkey ceremony; no IdP browser session exists                                                                                                                                                              | `src/tenant/controllers/oauth/authorize.tsx`                 | Blocks the shared-tenant SSO goal                                |
| 2   | Account takeover: passkey registration attaches a new passkey to an existing subject matched by email, without proving email ownership, and auto-verifies the email                                                                                              | `src/tenant/controllers/webauthn/register-verify.ts:128-159` | Critical — fatal for imported passkey-less subjects              |
| 3   | `EmailService` is dead code: imported nowhere, verification emails are never sent                                                                                                                                                                                | `src/app/services/email.ts`                                  | High                                                             |
| 4   | Migration 0005 re-seeds the dashboard client and resets every tenant's issuer to `localhost:3004` on every DO cold start (`ON CONFLICT DO UPDATE`); `TenantMeta.setIssuer`/`setTenantId` are never called by provisioning                                        | `src/tenant/migrations/0005-seed-dashboard-client.sql`       | Critical                                                         |
| 5   | Platform-domain OIDC endpoints 404 in production: `/authorize` etc. reach the platform DO only through a dev-mode shim, so dashboard onboarding cannot work as deployed                                                                                          | `src/entry.worker.ts`                                        | Critical                                                         |
| 6   | No hostname→tenant routing besides `cf.hostMetadata` — and both launch tenants are same-zone hostnames where CF for SaaS metadata does not apply                                                                                                                 | `src/entry.worker.ts`                                        | Blocks launch                                                    |
| 7   | Magic-link login/recovery does not exist (passkey only)                                                                                                                                                                                                          | —                                                            | Product requirement                                              |
| 8   | Back/front-channel logout: models and token class exist, no sending implementation                                                                                                                                                                               | `src/tenant/controllers/oidc/logout.ts`                      | Parity gap (no client receives them today; not cutover-critical) |
| 9   | `POST /api/subjects` (create) does not exist — there is no import path                                                                                                                                                                                           | `src/tenant/routes.ts`                                       | Blocks subject import                                            |
| 10  | Billing exemption covers only the special `platform` tenant; internal tenants would require Polar subscriptions                                                                                                                                                  | `src/app/middleware/subscription.ts`                         | Blocks internal tenants                                          |
| 11  | Deploy config incomplete: placeholder D1 id, no routes, no email binding; typecheck broken (TS5101 `baseUrl` + ~552 errors, dominated by remix-beta route-param inference)                                                                                       | `wrangler.jsonc`, `tsconfig.json`                            | Blocks deploy                                                    |
| 12  | Minor: rate-limit path list says `/oauth/authorize` but the route is `/authorize`; logout validates `post_logout_redirect_uri` against all logout-URI types instead of `post_logout` only; tenant SQLite declares INTEGER timestamps while models write ISO TEXT | various                                                      | Low                                                              |

Also verified: `apps/uptime` uses `@pkg/auth-sdk` at runtime (two routes), and auth-saas breaks it twice — subject lookup requires a management client (uptime's login client cannot call it), and the response shape changed. The SDK also hardcodes `https://auth.sergiodxa.com` ([ADR-005](./ADR-005-auth-package-redesign.md) planned a redesign that has not happened).

### Decisions Made

1. **One shared personal tenant.** `sso.sergiodxa.com` is a single tenant; blog, uptime, and r3-blog become OAuth clients inside it, preserving SSO across the personal apps. Separate products get their own tenants: `sso.blog.sergiodxa.com` for the blog SaaS platform (ADR-009).
2. **Subjects are exported/imported with preserved ids.** The OIDC `sub` stays stable, so every `subject_id` link in client apps keeps working with zero re-linking. Users re-enroll passkeys on first login (their verified-email status carries over).
3. **Big-bang cutover.** One coordinated window: deploy auth-saas, create tenants, register clients, import subjects, deploy all three client apps, and move `auth.sergiodxa.com` — with a config-only rollback path per app and `apps/auth` kept intact through a soak period.
4. **Auth methods**: email + passkey, with magic link as both recovery and first-login path; **Cloudflare Email Sending** is the sole email transport (Resend removed entirely).

## Decision

Complete `apps/auth-saas` through eleven work packages, migrate the three client apps to the `sso.sergiodxa.com` tenant in one cutover window, take over `auth.sergiodxa.com` as the platform domain, and decommission `apps/auth` after a 30-day soak.

### Target Topology

```
 auth.sergiodxa.com            sso.sergiodxa.com              sso.blog.sergiodxa.com
 (platform domain)             (internal tenant)              (internal tenant)
        |                             |                              |
        v                             v                              v
+------------------+        +--------------------+        +--------------------+
| Dashboard        |        | Tenant DO "sso"    |        | Tenant DO          |
| (control plane)  |        |                    |        | "blog-sso"         |
|                  |        | Clients:           |        |                    |
| Platform tenant  |        |  - blog            |        | Clients:           |
| DO ("platform")  |        |  - uptime          |        |  - blog-saas       |
| for dashboard    |        |  - r3-blog         |        |    dashboard       |
| login only       |        |  - uptime-mgmt M2M |        |  - one per hosted  |
+------------------+        |                    |        |    blog (via M2M   |
                            | Subjects imported  |        |    mgmt client,    |
                            | from apps/auth     |        |    ADR-009)        |
                            | (sub preserved)    |        +--------------------+
                            +--------------------+
```

### Key Design Decisions

| Decision                                      | Choice                                                                                      | Rationale                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tenant granularity                            | Shared `sso` tenant for personal apps; tenant per product                                   | SSO across personal apps requires one subject store                                       |
| Same-zone hostname routing                    | Explicit worker routes + D1 `hostnames` lookup (KV-cached)                                  | CF for SaaS custom metadata does not apply to own-zone hostnames                          |
| Silent SSO                                    | IdP browser-session cookie + `/authorize` short-circuit                                     | Without it, "SSO" is a passkey ceremony per app                                           |
| Subject import                                | New `POST /api/subjects` Management API endpoint, id preserved                              | `sub` stability keeps every client app's local links intact                               |
| Grants / connections / sessions / credentials | Not migrated (archived with the final D1 export)                                            | Grants are auto-created bookkeeping; GitHub + passwords are being retired                 |
| Email                                         | Cloudflare Email Sending (`send_email` binding), sole transport                             | Cloudflare-native; no external email dependency or API key                                |
| Client endpoint config                        | `AUTH_ISSUER` var + static path derivation (no runtime discovery)                           | We own both sides; discovery adds a network dependency per isolate                        |
| `@pkg/auth-sdk`                               | Minimal patch (configurable base URL + new response shape); ADR-005 redesign stays deferred | Only uptime consumes it at runtime                                                        |
| Dashboard identity                            | Separate `platform` tenant subject store (two accounts for the same human)                  | Breaks the circular dependency of administering the sso tenant with an identity inside it |
| Internal tenants                              | `tenants.internal` flag (D1 column) bypassing billing                                       | Visible in dashboard, survives config drift, no Polar objects for own tenants             |
| Tenant members/invites                        | Deferred (models exist, no controllers; single-admin platform)                              | Cut from launch scope                                                                     |

### WP1: Worker Entry Routing (same-zone hostnames + platform OIDC)

The worker entry gains a complete dispatch order:

1. Static assets; dashboard/onboarding paths on the platform domain → platform router (existing).
2. Platform domain OIDC paths (`/authorize`, `/oauth/*`, `/.well-known/*`, `/webauthn/*`, `/oidc/*`, `/verify-email`, `/magic-link/*`) → platform tenant DO — fixes defect 5; today this only works behind a dev shim.
3. `cf.hostMetadata.tenant_id` → tenant DO (existing path, for future CF for SaaS custom hostnames).
4. **Hostname→tenant resolution for everything else** — covers `sso.sergiodxa.com` and `sso.blog.sergiodxa.com`, which are same-zone hostnames with no `hostMetadata`:

```typescript
/** KV-cached D1 lookup mapping a hostname to its tenant. */
async function resolveHostname(hostname: string): Promise<ResolvedTenant | null> {
	let cached = await env.HOSTNAMES_KV.get<ResolvedTenant>(`host:${hostname}`, "json");
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		`SELECT h.tenant_id AS tenantId, t.region AS region
		 FROM hostnames h JOIN tenants t ON t.id = h.tenant_id
		 WHERE h.hostname = ?1 AND h.status = 'active' AND t.status = 'active'`,
	)
		.bind(hostname)
		.first<ResolvedTenant>();

	if (!row) return null;
	await env.HOSTNAMES_KV.put(`host:${hostname}`, JSON.stringify(row), { expirationTtl: 300 });
	return row;
}
```

5. No match → 404. (Default `{slug}.auth.sergiodxa.com` subdomains need no special branch: `Hostname.createDefault` already stores them in the `hostnames` table, so the same lookup serves them.)

`wrangler.jsonc` additions:

```jsonc
"routes": [
	{ "pattern": "auth.sergiodxa.com", "custom_domain": true },
	{ "pattern": "sso.sergiodxa.com/*", "zone_name": "sergiodxa.com" },
	{ "pattern": "sso.blog.sergiodxa.com/*", "zone_name": "sergiodxa.com" }
],
"kv_namespaces": [{ "binding": "HOSTNAMES_KV", "id": "<created in runbook>" }]
```

TLS: `sso.sergiodxa.com` is covered by the universal `*.sergiodxa.com` certificate — explicit routes suffice, no CF for SaaS needed. **`sso.blog.sergiodxa.com` is a second-level subdomain and is NOT covered by the universal cert**; it needs an Advanced Certificate Manager cert for `*.blog.sergiodxa.com` (or Total TLS), issued and verified before cutover.

The dashboard hostname flow gains a same-zone path: when a hostname ends with the zone apex, insert the D1 row directly (status `active`) instead of calling the CF for SaaS API.

### WP2: Tenant Provisioning Fixes (deploy blockers)

- Remove the issuer seed from migration `0005-seed-dashboard-client.sql` (defect 4) — it force-resets every tenant's issuer to `localhost:3004` on every cold start. Dev seeding moves to a dev-only bootstrap; the `dashboard` client is seeded only into the platform tenant.
- Replace the error-swallowing re-run-everything migration loop in `Tenant.migrate()` with `PRAGMA user_version`-based tracking.
- Add an internal setup endpoint on the tenant DO, called by the dashboard on tenant creation and hostname changes (authenticated with the existing `x-internal-token` mechanism): `POST /internal/setup { tenant_id, issuer, region }` → writes `TenantMeta`. Today `TenantMeta.setIssuer`/`setTenantId` are never called at all.

### WP3: IdP Browser Session + Silent SSO

Required by the shared-tenant decision — without it, "SSO" means a passkey prompt in every app.

```sql
-- src/tenant/migrations/0007-browser-sessions.sql (shared with WP4)
CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  ip TEXT, user_agent TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
ALTER TABLE sessions ADD COLUMN browser_session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_browser ON sessions(browser_session_id);
```

- Passkey verify, registration verify, and magic-link verify create a browser session (30-day TTL) and set `__sso_session` (HttpOnly, Secure, SameSite=Lax) on their responses; client `sessions` rows record their `browser_session_id`.
- `GET /authorize`: after client/redirect validation, a valid browser session with `prompt !== "login"` mints the client session + authorization code directly and 302s back with `code` + `state` — no UI. `prompt=none` without a session returns `error=login_required`. This restores `apps/auth` parity.
- Logout destroys the whole browser-session group and clears the cookie (WP6).

### WP4: Magic Link (login + recovery) and the Takeover Fix

**Security fix first (blocker for the import):** passkey registration currently attaches a new passkey to an existing subject matched by email without any proof of email ownership, then auto-verifies the email (defect 2). Since imported subjects have zero passkeys, anyone knowing a user's email could take over the account. Fix: WebAuthn registration is only offered for emails with **no existing subject**; existing subjects without passkeys are routed to the magic-link flow (which proves email ownership). New registrations no longer auto-verify email — the existing (never-wired) verification email is actually sent, and `email_verified` stays false until confirmed. Imported subjects are unaffected: their verified timestamps carry over.

```sql
CREATE TABLE IF NOT EXISTS login_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of the raw token
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  client_id TEXT, redirect_uri TEXT,      -- captured /authorize context
  scope TEXT, state TEXT, nonce TEXT,
  pkce_challenge TEXT, pkce_method TEXT,
  consumed_at INTEGER,
  expires_at INTEGER NOT NULL,            -- 15 minutes
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_tokens_expires ON login_tokens(expires_at);
```

Flow, composed with `/authorize`:

1. Email check: subject with usable passkeys → passkey form plus an "Email me a sign-in link" button; subject without passkeys → link sent automatically ("Check your email", enumeration-safe copy either way); unknown email → registration form.
2. `POST /magic-link/request` creates a `login_tokens` row carrying the full authorization context and sends the link (`https://{issuer}/magic-link/verify?token=...`).
3. `GET /magic-link/verify`: consume (single-use, hashed, 15-minute expiry) → create browser session → if the subject has no passkeys, offer an "Add a passkey" interstitial (skippable — the email is now proven) → mint the client session + authorization code from the stored context → 302 back to the app.
4. Expired-token cleanup joins the tenant's daily alarm.

Rate limiting: `/magic-link/request` joins the strict per-IP limiter (and the existing `"/oauth/authorize"` path entry is fixed to `"/authorize"`, defect 12), plus a per-email limit of 3 per 15 minutes (per-DO in-memory is acceptable: one DO per tenant).

### WP5: Cloudflare Email Sending

`EmailService` sends solely through the Cloudflare `send_email` binding, wired into the flows (defect 3):

```jsonc
// wrangler.jsonc
"send_email": [{ "name": "SEND_EMAIL" }],
"vars": { "EMAIL_FROM": "SSO <sso@sergiodxa.com>" }
```

```typescript
import { EmailMessage } from "cloudflare:email";

static async send(options: { to: string; subject: string; html: string; text?: string }) {
	let from = env.EMAIL_FROM ?? "Auth SaaS <noreply@auth.sergiodxa.com>";
	let fromAddress = parseAddress(from); // bare addr out of "Name <addr>"
	let raw = buildMimeMessage({ from, fromAddress, ...options }); // multipart/alternative, base64 bodies
	await env.SEND_EMAIL.send(new EmailMessage(fromAddress, options.to, raw));
}
```

The MIME message is built by hand (no `mimetext` dependency): a `multipart/alternative` body with base64-encoded text and HTML parts, `Message-ID`/`Date`/RFC-2047 subject headers. Add `sendMagicLinkEmail`, wire `sendVerificationEmail` into registration, delete `sendPasswordResetEmail` (no password auth exists). Resend is removed entirely — the `resend` dependency, the `RESEND_API_KEY` secret, and the `EMAIL_PROVIDER` switch are all gone. Caveat to verify in soak: classic Email Routing `send_email` only delivers to verified destination addresses, which is fine for the personal tenant but must be confirmed for arbitrary recipients before external tenants exist.

### WP6: Back-Channel + Front-Channel Logout Fan-Out

`apps/auth` sends both today; auth-saas has the models and the `logout_token` value class but no sending implementation (defect 8). In the tenant logout controller:

1. Resolve the logout scope: `id_token_hint`'s `sid` → session → its `browser_session_id` → all sessions in that browser-session group (fallback: all subject sessions).
2. For each distinct client in the group except the initiator: fetch its `backchannel` logout URIs, generate a signed logout token (`iss`/`aud`/`sid`/`events`/`jti`, 2-minute expiry), and `POST logout_token=<jwt>` form-encoded with a 5s timeout, `Promise.allSettled`.
3. Collect `frontchannel` URIs (append `iss`/`sid` when `session_required`) and render the hidden-iframe page with a 2s redirect — ported from `apps/auth`.
4. Fix: validate `post_logout_redirect_uri` against `post_logout`-type URIs only (defect 12).

Priority note: **no current client app implements a receiver** (verified) — this is parity/future-tenant work and must not block the cutover. RP-initiated logout + `Clear-Site-Data` is what the apps actually use.

### WP7: Subject Import with Preserved IDs

The Management API has no create endpoint (defect 9). Add one:

- `src/tenant/routes.ts`: add `create` to the subjects resources.
- `Subject.import(db, data)`: inserts with the **caller-provided id**, verified-email timestamp carried over, 409 on id or email conflict.
- `POST /api/subjects` controller guarded by the existing management-auth middleware.
- Timestamps written as ISO strings to match the model convention (the SQLite columns declare INTEGER but every model reads/writes ISO TEXT — imports must match the models, not the DDL).

Export + import script (`scripts/import-subjects.ts`, bun):

```sh
wrangler d1 execute auth --remote --json --command \
	"SELECT id, email_address, email_verified_at, display_name, avatar, username, created_at FROM subjects" \
	> /tmp/auth-subjects.json
```

The script obtains a `client_credentials` token from `https://sso.sergiodxa.com/oauth/token` using the sso tenant's auto-created management client, maps columns (`email_address→email`, `avatar→avatar_url`, epoch→ISO), and POSTs each subject. Idempotent: skip on 409, so delta re-runs are safe. Verification: count parity via `GET /api/subjects`, then `sub` equality on a real login before/after cutover.

**Not migrated** (archived with the final D1 export instead): `grants` (auto-created bookkeeping in apps/auth — `Grant.findOrCreate` on every login, no consent screen; nothing in auth-saas reads them at login time), `connections` (no GitHub provider exists in auth-saas; GitHub login is retired), `sessions` and `credentials` (everyone re-logs in; passwords are retired).

### WP8: Internal Tenant Flag

```sql
-- src/app/migrations/0003-internal-tenants.sql
ALTER TABLE tenants ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;
```

Subscription middleware bypasses billing when the tenant is `platform` or `internal`; tenant creation skips Polar objects for internal tenants; the dashboard shows an "Internal" badge. `sso` and `blog-sso` are created with `internal = 1`. A column beats a config allowlist: visible in the dashboard and immune to config drift.

### WP9: Deployment Readiness

"Deployable" means:

1. Real D1 (`wrangler d1 create auth-saas-platform`) + migrations applied (0001-0003).
2. KV namespace for `HOSTNAMES_KV`; routes block (WP1); `send_email` binding (WP5); crons already correct.
3. Secrets set: `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET`, `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_ACCOUNT_ID`, `INTERNAL_SECRET`, `SESSION_SECRET`. (No email secret — Cloudflare Email Sending uses the `SEND_EMAIL` binding.)
4. **Typecheck green**: remove `baseUrl` from `tsconfig.json` (TS6 allows relative `paths` without it), fix `src/lib/d1-adapter.ts`/`db-errors.ts` against current `remix/data-table` exports, and resolve the ~400 route-param inference errors from the remix beta (upgrade the beta or regenerate route typings). 552 errors today.
5. `bun test` green, including WP10 additions.

### WP10: Migration-Critical Tests

| Path             | Tests                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Subject import   | id preserved verbatim; verified email carried; duplicate id/email → 409; count parity                                   |
| Magic link       | enumeration-safe responses; per-email limit; single-use + expiry; PKCE context round-trip; passkey-enrollment gate      |
| Logout fan-out   | logout-token claims; backchannel POST body; frontchannel URL building; post_logout type filter; browser-session scoping |
| Hostname routing | resolver (D1 hit, KV hit, unknown host, inactive tenant); platform-domain OIDC → platform DO dispatch                   |
| Silent SSO       | valid cookie issues code with no UI; `prompt=login` forces ceremony; `prompt=none` without session → `login_required`   |
| End-to-end       | authorize → webauthn (stubbed) → token (PKCE + Basic) → userinfo → logout against a DO test fixture                     |

### WP11: Client App Changes

One consistent approach for all three apps: an `AUTH_ISSUER` var (full origin, `https://sso.sergiodxa.com`) plus static endpoint derivation by fixed paths — **not** runtime OIDC discovery (we own both sides; discovery adds a per-isolate network fetch and failure mode). Note the issuer claim now includes the scheme (`https://sso.sergiodxa.com`), unlike apps/auth's `auth.sergiodxa.com` — verification code updates in lockstep.

```typescript
// the same three substitutions in each app:
authorizationEndpoint: new URL("/authorize", env.AUTH_ISSUER),
tokenEndpoint: new URL("/oauth/token", env.AUTH_ISSUER),
// verification:
await JWK.importRemote(new URL("/.well-known/jwks.json", env.AUTH_ISSUER), { alg: JWK.Algoritm.ES256 }),
{ audience: env.CLIENT_ID, issuer: env.AUTH_ISSUER },
// logout:
let logoutUrl = new URL("/oidc/logout", env.AUTH_ISSUER);
```

Touched files — apps/blog: `app/modules/auth.ts`, `app/entities/id-token.ts`, `app/middleware/session.ts`. apps/uptime: `app/modules/auth.ts`, `app/entities/id-token.ts`. apps/r3-blog: `app/auth/services/oauth.ts` (metadata + token exchange), `app/services/id-token-verification-key.ts`, `app/auth/value-objects/id-token.ts`, `app/http/controllers/auth.tsx` (logout URL).

`@pkg/auth-sdk` (uptime's subject lookup): patch the constructor to require a base URL and parse the new response shape (bare snake_case subject vs the old camelCase wrapper). Because `/api/subjects/:id` requires a management client, uptime gets a dedicated `uptime-management` M2M client. The management client grants full tenant admin — an accepted single-user risk, revisited under ADR-005.

Client registrations in the `sso` tenant:

| Client            | Type             | Redirect URI                             | post_logout URI                 |
| ----------------- | ---------------- | ---------------------------------------- | ------------------------------- |
| Blog              | confidential     | `https://sergiodxa.com/auth/callback`    | `https://sergiodxa.com/`        |
| Uptime            | confidential     | `https://uptime.sergiodxa.com/auth`      | `https://uptime.sergiodxa.com`  |
| R3 Blog           | confidential     | `https://r3.sergiodxa.com/auth/callback` | `https://r3.sergiodxa.com/feed` |
| uptime-management | m2m (management) | —                                        | —                               |

New CLIENT_ID/CLIENT_SECRET per app (auth-saas hashes secrets; the old plaintext ones remain recoverable from apps/auth's D1 for rollback). Blog/uptime via `wrangler secret put`; r3-blog via the Secrets Store values `BLOG_CLIENT_ID`/`BLOG_CLIENT_SECRET` (record old values first).

### Dashboard Identity: Two Subject Stores, Accepted

The dashboard admin authenticates against the **platform** tenant (onboarding flow, PKCE against the seeded `dashboard` client); app logins live in the **sso** tenant. The same human has two subjects. This is deliberate: the platform tenant is the control plane's trust domain, and it breaks the circular dependency of administering the sso tenant with an identity stored inside it.

## Migration Runbook

### Phase 0: Pre-Cutover (days before, no user impact)

1. Land WP1-WP10; `bun test` and typecheck green.
2. Cloudflare setup: D1 + migrations, KV, secrets, Email Routing/Email Service sender on `sergiodxa.com`, **ACM/Total TLS cert covering `sso.blog.sergiodxa.com` verified issued**, DNS records for both sso hostnames (proxied, so the worker routes receive traffic).
3. Deploy auth-saas with the `sso.*` routes only — **not** the `auth.sergiodxa.com` custom domain yet (apps/auth still owns it).
4. Via the dashboard on workers.dev: bootstrap the platform tenant login; create tenants `sso` and `blog-sso` (both `internal = 1`, hostnames attached); verify `https://sso.sergiodxa.com/.well-known/openid-configuration` reports `issuer: "https://sso.sergiodxa.com"`.
5. Register the four clients + logout URIs; store secrets; create the ADR-009 M2M management client in `blog-sso` (this unblocks ADR-009).
6. Run the subject import; verify count parity and spot-check subjects (id, email, `email_verified_at`).
7. Prepare (not deploy) the three client-app branches with WP11 changes.

### Phase 1: Cutover Window (~1 hour)

1. Freeze deploys to the three apps.
2. Final delta subject import (idempotent re-run).
3. Deploy the client apps with `AUTH_ISSUER` + new secrets, lowest-traffic first: r3-blog → uptime → blog.
4. Smoke each app: login (magic link first, passkey enrollment), silent SSO into the second app with no ceremony, logout clears sessions, and the session's `sub` matches the pre-migration `subject_id` (e.g. an uptime team membership renders).
5. Move the platform domain: detach `auth.sergiodxa.com` from the `auth` worker (a Cloudflare dashboard operation — apps/auth has no routes block in wrangler.jsonc), attach it to auth-saas. apps/auth stays deployed, reachable only via workers.dev.
6. Verify `https://auth.sergiodxa.com/dashboard` login and that `/authorize` on the platform domain reaches the platform DO.
7. Unfreeze.

### Phase 2: Rollback (any point during soak; config-only)

Per app: redeploy the previous release, or revert `AUTH_ISSUER` + restore the old CLIENT_ID/CLIENT_SECRET (plaintext, recoverable from apps/auth's D1). Full rollback additionally moves `auth.sergiodxa.com` back to the `auth` worker. Nothing was deleted during cutover — apps/auth retains all subjects, clients, and credentials — so rollback is pure routing and configuration. Users who enrolled passkeys on auth-saas simply fall back to their old GitHub/password login.

### Phase 3: Soak and Decommission (30 days)

1. Watch observability logs, magic-link deliverability, and the MAU cron.
2. Archive: `wrangler d1 export auth --remote` → upload to R2 (subjects, grants, connections, clients preserved indefinitely).
3. Decommission apps/auth: confirm zero workers.dev traffic, `wrangler delete`, remove its D1/KV/R2/queue after the export is verified.
4. Repo: delete `apps/auth` (git history preserves it; a routeless worker and dead directory invite drift); update ADR statuses.

## Consequences

### Positive

- **One IdP codebase**: apps/auth retires; all future auth work happens in one place, and auth-saas finally gets a production-hardening user (its own author).
- **ADR-009 unblocked**: the `blog-sso` tenant plus its M2M management client are created in Phase 0.
- **Stable `sub`**: zero re-linking anywhere — blog users, uptime memberships, and r3-blog users keep working untouched.
- **Better auth**: passkeys with magic-link recovery are phishing-resistant and self-recovering; the account-takeover hole is closed before any import happens.
- **Same-zone routing needs no plan-gated features**: explicit routes + D1 lookup replace the CF for SaaS metadata dependency for own-zone tenants.

### Negative

- **Every user re-enrolls a passkey** (the magic link is the safety net; verified email carries over).
- **Big-bang risk window** across three apps — accepted deliberately, mitigated by config-only rollback and apps/auth remaining intact through soak.
- **GitHub and password login disappear**; connections and grants are archived, not migrated.
- **Silent SSO adds real complexity** (browser-session grouping, cookie semantics) that ADR-006's design did not have.

### Neutral

- Two subject stores for the same human (platform tenant for the dashboard, sso tenant for apps).
- Back/front-channel logout ships server-side with no client receivers — parity with what apps/auth actually exercised in practice (none).
- The ID-token `iss` gains a scheme; clients update in lockstep.
- ADR-005's SDK redesign stays deferred; only a minimal compatibility patch lands.

## Implementation Plan

### Phase A: Correctness Blockers

**Priority:** High — **Estimated Effort:** 3-4 days

WP2 (provisioning fixes), WP4 takeover fix, WP1 (routing + platform OIDC), WP9 typecheck/deploy config.

### Phase B: Product Features

**Priority:** High — **Estimated Effort:** 1 week

WP3 (browser sessions + silent SSO), WP4 (magic link), WP5 (Cloudflare Email Sending), WP8 (internal flag).

### Phase C: Migration Machinery

**Priority:** High — **Estimated Effort:** 3-4 days

WP7 (subject import endpoint + script), WP11 (client app branches + auth-sdk patch), WP10 (tests).

### Phase D: Parity and Polish

**Priority:** Medium — **Estimated Effort:** 2-3 days

WP6 (logout fan-out) — explicitly not cutover-blocking.

### Phase E: Execute the Runbook

**Priority:** High — **Estimated Effort:** Phase 0 half a day; Phase 1 one hour; Phase 3 spread over 30 days

## Alternatives Considered

### 1. Per-App Tenants

Each of blog/uptime/r3-blog gets its own tenant.

**Rejected because**: DO-per-tenant isolation kills SSO across the personal apps — three subject stores, three passkey enrollments, three logins for one person.

### 2. Fresh-Start User Store

No import; tenants start empty and users re-register, client apps re-link by email.

**Rejected because** (user decision): breaks `subject_id` links in uptime memberships and both blog apps' users tables; re-linking every local table costs more than one import endpoint.

### 3. Parallel-Run / Phased Cutover

Migrate one app at a time while others stay on apps/auth.

**Rejected because** (user decision): two live IdPs means split SSO sessions and double passkey enrollment during the overlap; three low-traffic personal apps do not justify the extended migration state.

### 4. Keep Resend

**Rejected**: Cloudflare Email Sending is the sole transport. Resend (SDK dependency + `RESEND_API_KEY`) is removed, dropping an external dependency and API key. If Cloudflare sending proves insufficient for arbitrary recipients, a driver abstraction can be reintroduced then.

### 5. Keep apps/auth as the Personal IdP Forever

Use auth-saas only for external tenants.

**Rejected because**: permanent double maintenance of two security-critical OIDC implementations, and auth-saas never gets a production user — dogfooding is the point.

### 6. Runtime OIDC Discovery in Client Apps

**Rejected because**: adds a per-isolate network fetch and failure mode for endpoints we own on both sides; static derivation from `AUTH_ISSUER` matches ADR-009's engine approach (static metadata with discovery optional).

## References

- [ADR-002: SSO Logout With id_token_hint](./ADR-002-sso-logout-with-id-token-hint.md) — behavior preserved
- [ADR-003: OIDC Backchannel Logout](./ADR-003-oidc-backchannel-logout.md) — server-side sending implemented (WP6), receivers still deferred
- [ADR-005: Auth Package Redesign](./ADR-005-auth-package-redesign.md) — stays deferred; minimal SDK patch only
- [ADR-006: Auth SaaS Platform](./ADR-006-auth-saas-platform.md) — the architecture this ADR completes; its Phase 6 "migration from apps/auth" item is superseded by the shared-tenant model here
- [ADR-009: Blog SaaS Platform](./ADR-009-blog-saas-platform.md) — downstream dependency unblocked in Phase 0
- [ADR-011: OIDC Provider Engine Package](./ADR-011-oidc-provider-engine-package.md) — extracts the tenant provider stabilized here into `@pkg/oidc-provider` (self-hostable, like `@pkg/blog-engine`)
- [OIDC Back-Channel Logout 1.0](https://openid.net/specs/openid-connect-backchannel-1_0.html)
- [Cloudflare Email Routing - Send emails from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)
- docs/adr/auth/\*.md — historical record of apps/auth (unchanged)

## Current Progress

As of 2026-07-04, `apps/auth-saas` typechecks clean (was 552 errors), passes 254 tests, lints clean, and builds to deployable artifacts. Fixing the pre-existing breakage that blocked deploy (a runtime router crash on nested `router.map`, `context.formData` never populated, JSX components using the wrong factory shape, `remix/data-table` adapter API drift, and `@simplewebauthn` API drift) was a prerequisite for all feature work and is included below.

- [x] Phase A: Correctness blockers
  - [x] WP9: typecheck to green + wrangler config (routes, KV, `send_email`, `ignoreDeprecations`)
  - [x] WP2: provisioning fixes (issuer-reset migration removed; `PRAGMA user_version` migration tracking; `POST /api/setup` internal endpoint + `TenantApiService.setup` + wired into tenant creation)
  - [x] WP1: worker entry routing (platform-domain OIDC → platform DO; same-zone hostname → KV-cached D1 lookup)
  - [x] WP4-fix: passkey-registration takeover guard (registration rejects existing subjects; API drift fixed)
  - [x] Pre-existing runtime blockers: router refactored to per-group `map()`; `formData` context augmentation; JSX components → `Handle<Props>` pattern; D1/SqlStorage adapters + webauthn controllers realigned to current APIs
- [~] Phase B: Product features
  - [x] WP5: Cloudflare Email Sending (`EmailService` over the `send_email` binding, hand-built MIME; magic-link + verification templates; Resend removed entirely — dependency, secret, and provider switch all gone)
  - [x] WP8: internal-tenant billing flag (D1 migration, model, middleware bypass, create-form checkbox)
  - [ ] WP3: IdP browser session + silent SSO — migration 0007 (`browser_sessions`) is in place; model + `/authorize` short-circuit not yet implemented
  - [ ] WP4: magic-link login/recovery — migration 0007 (`login_tokens`) + email template in place; `/magic-link/*` controllers + `/authorize` branch not yet implemented
- [~] Phase C: Migration machinery
  - [x] WP7: subject import (`Subject.import` preserving id/verified-email; `POST /api/subjects`; `scripts/import-subjects.ts`; tests)
  - [~] WP10: added `Subject.import` tests; magic-link/silent-SSO/logout tests pending their features
  - [ ] WP11: client-app changes (blog, uptime, r3-blog) + `@pkg/auth-sdk` patch — not started (separate apps)
- [ ] Phase D: WP6 logout fan-out (back/front-channel) — not started; explicitly non-cutover-blocking
- [ ] Phase E: Runbook (operational: create tenants, import users, cutover) — not started

### Remaining before the migration can run

- **WP4 (magic link) is required to import existing users.** The takeover guard makes registration new-accounts-only, so imported subjects (which have no passkey) can only sign in via magic link. A fresh deploy serving only new passkey users is fully functional without it; importing apps/auth users is not.
- **WP3 (silent SSO)** is required for one-login-across-apps within the shared tenant; without it each app triggers its own passkey/magic-link ceremony.
- **WP11** updates the three client apps to point at `AUTH_ISSUER`.
- Deploy prerequisites (WP9 config): replace the placeholder D1 and `HOSTNAMES_KV` ids with real ones, set secrets, and provision DNS/TLS per the runbook.

## Notes

- **Defects discovered during this design** (see Context table): the most important are the account-takeover vector in passkey registration (must land before any subject import), the issuer-resetting migration 0005, and the platform-domain OIDC 404 — none were known before auditing.
- The premise "clients receive front-channel iframes" turned out false: apps/auth _sends_ front/back-channel logout, but no client app ever implemented a receiver (ADR-003 is Deferred). WP6 is parity work for future external tenants, not cutover-critical.
- `POST /api/subjects` did not exist at all (the question was whether it accepted explicit ids — there was nothing to check).
- apps/uptime is the only runtime consumer of `@pkg/auth-sdk`; both the grant-type gating and the response shape of auth-saas break it, hence the `uptime-management` client and the SDK patch.
- Tenant SQLite declares INTEGER timestamp columns but every model writes ISO TEXT strings (SQLite type affinity tolerates this); the import script must follow the models, not the DDL.
- blog and r3-blog share the `AUTH` KV session namespace — both must deploy inside the same cutover window so mixed old/new sessions don't linger; `Clear-Site-Data` on logout clears stragglers.
- The `auth.sergiodxa.com` custom domain lives in the Cloudflare dashboard, not in apps/auth's wrangler.jsonc — the "route move" in Phase 1 is a dashboard operation.
- Cloudflare Email Sending caveat: classic Email Routing `send_email` delivers only to verified destination addresses; fine for the personal tenant, must be re-verified before external tenants rely on it. Resend was removed rather than kept as a fallback (user decision); reintroduce a driver only if this proves insufficient.
- Tenant members/invites (models exist, no controllers) are cut from launch scope; revisit if auth-saas gets external customers.
