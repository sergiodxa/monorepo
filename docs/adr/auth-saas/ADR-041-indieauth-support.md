# ADR-041: IndieAuth Support

## Status

**Proposed** - 2026-09-26

## Background

The blog's Micropub endpoint ([ADR-095](../ADR-095-micropub-package.md)) is an OAuth 2.0
resource server, and every off-the-shelf Micropub client (Quill, iA Writer, Indigenous, the
micropub.rocks test suite) obtains its token through
[IndieAuth](https://indieauth.spec.indieweb.org/), the OAuth 2.0 profile in which the user
is identified by a URL and so is the client. ADR-095 listed what r3-auth lacks and deferred
the issuing side to a follow-up ADR written against r3-auth.

r3-auth is being deprecated in favor of this app: every tenant of auth-saas is already an
OAuth 2.0 / OIDC provider with its own subjects, clients, keys and sessions. Building
IndieAuth into r3-auth would be work thrown away with it, so the follow-up lands here, and
the blog's Micropub endpoint (and later every blog-saas tenant) takes its tokens from an
auth-saas tenant.

## Context

### What the IndieAuth Living Standard (2024 revision) asks of a server

| Requirement                                                                                                                                                                                                                                                   | Where it lands                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `client_id` is a URL: `http`/`https`, a path, no fragment, no userinfo, no `.`/`..` segments; the host is a domain name or a loopback address                                                                                                                 | `/authorize`, the token endpoint           |
| The server fetches `client_id` for a JSON client metadata document (`client_id`, `client_uri`, `client_name`, `logo_uri`, `redirect_uris`); `client_id` in the document must equal the URL, `client_uri` must be a prefix of it; loopback ids are not fetched | a bounded fetch in the Worker              |
| A `redirect_uri` whose scheme, host or port differs from `client_id` must appear in the metadata's `redirect_uris`                                                                                                                                            | redirect validation for URL clients        |
| Every client is public and uses PKCE with `S256`                                                                                                                                                                                                              | already true of `/authorize`               |
| The user is a profile URL (`me`): `http`/`https`, a path (`/` counts), no fragment, no userinfo, no port, a domain-name host; canonicalized by lowercasing the host and adding `/` to an empty path                                                           | a per-subject profile URL                  |
| Clients discover the server from the profile page's `rel="indieauth-metadata"` (legacy: `rel="authorization_endpoint"` and `rel="token_endpoint"`)                                                                                                            | the blog's `<head>` and `Link` header      |
| The metadata document is RFC 8414 shaped, its `issuer` is an `https` URL that prefixes the metadata URL, and it names the introspection, revocation and userinfo endpoints                                                                                    | the tenant's authorization server metadata |
| The authorization response carries `iss` (RFC 9207) equal to that `issuer`, on success as well as on error                                                                                                                                                    | `database/authorization.ts`                |
| A code may be redeemed at the authorization endpoint for `me` alone (sign-in), or at the token endpoint for an access token; both answers carry `me`, and `profile` when the `profile` scope was granted (`name`, `url`, `photo`, and `email` with `email`)   | a `POST /authorize` and the token response |
| Scopes are free-form: Micropub uses `create`, `update`, `delete`, `undelete`, `media`, `draft`; Microsub uses `read`, `follow`, `channels`, `mute`, `block`                                                                                                   | the tenant's scope catalog                 |
| Introspection (RFC 7662) requires the caller to authorize, and answers `active`, `me`, `client_id`, `scope`, `exp`, `iat`                                                                                                                                     | a new access-token introspection endpoint  |
| Revocation (RFC 7009) is unauthenticated: the token is the credential                                                                                                                                                                                         | a new revocation endpoint                  |
| A userinfo endpoint answers the `profile` object for a token holding `profile`                                                                                                                                                                                | `/userinfo`                                |

### What a tenant already has

| Area               | Current state                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issuer             | `https://` plus the tenant's platform subdomain or a custom domain chosen at creation, fixed for life (ADR-005, `app/services/tenant-provisioning.ts`). It is already an `https` URL with no path, which is what IndieAuth wants, unlike r3-auth's scheme-less issuer                                                         |
| Clients            | Rows in the tenant's `clients` table (`database/clients.ts`), `client_`-prefixed TypeIDs registered from the dashboard or management API; `kind` is `confidential` or `public`; redirect URIs match exactly, loopback ports excepted (`redirectUriMatches`); dynamic registration deferred (ADR-014)                          |
| `/authorize`       | `app/http/controllers/authorize.tsx` hands the query to `beginAuthorization` in `database/authorization.ts`, which `db.find`s the client by id, verifies `redirect_uri`, caps scopes at the client's `scopes`, and already requires `S256`. `iss` is set on redirected errors (`redirectError`) only; `redirectCode` omits it |
| Code rows          | `authorization_requests` and `authorization_codes` store `client_id` as `TEXT`, so a URL fits without a schema change (tenant migration `0009-authorization.sql`)                                                                                                                                                             |
| Token endpoint     | `app/http/controllers/oauth/token.ts` accepts `authorization_code`, `refresh_token`, `client_credentials` and the device code; `resolveClientAuth` already reads a form-only `client_id` as `authScheme: "none"`. `exchangeCode` and `refreshTokens` in `database/tokens.ts` resolve the client row                           |
| Access tokens      | ES256 JWTs from `mintTokens` with `iss`, `sub`, `aud: {issuer}/userinfo`, `client_id`, `scope`, `sid`, `jti`, one hour (`ACCESS_TOKEN_TTL_MS`); RFC 8707 `resource` is honored on `client_credentials` only (`issueClientCredentialsToken`)                                                                                   |
| Scopes and consent | The `scopes` catalog (tenant migration `0008-consent.sql`) seeds `openid`, `profile`, `email`, `address`, `offline_access`; `grants` keys a decision by `(subject_id, client_id)` as text; the consent screen already has `logoUri`, `policyUri`, `tosUri` slots, all `null` today (`database/consent.ts`)                    |
| Discovery          | `publishMetadata` in `database/metadata.ts` hand-builds both documents as snake_case records; neither names an introspection or revocation endpoint, nor `authorization_response_iss_parameter_supported`                                                                                                                     |
| Introspection      | Only `POST /api-keys/introspect` (`app/http/controllers/oauth/introspect.ts`), which resolves API keys (ADR-032), not access tokens                                                                                                                                                                                           |
| Revocation         | `revokeFamily` in `database/tokens.ts` is internal (reuse detection, session end); there is no RFC 7009 endpoint                                                                                                                                                                                                              |
| `/userinfo`        | `app/http/controllers/userinfo.ts` verifies the JWT against the tenant's key set and refuses a token without `openid`                                                                                                                                                                                                         |
| Verified domains   | Organization domains (ADR-030) are proven by a DNS TXT record, looked up in the Worker by `app/services/organization-domains.ts` and confirmed through `confirmOrganizationDomain`; they grant organization membership by email domain                                                                                        |
| Add-on gating      | The device grant is an entitlement (`device_grant`) read by `#isEntitled` in `database/tenant-do.ts` and passed to `publishMetadata` as `hasDeviceGrant` (ADR-039)                                                                                                                                                            |

### What the resource side already has

`@sdxc/auth`'s `ResourceServer` verifies a JWT access token against the issuer's JWKS, falls
back to an `Introspector` for opaque tokens, and holds a token to its configured audiences.
`AccessToken` exposes `scopes`, `clientId` and `has(scope)`; `ResourceServer.Introspection`
has `active`, `subject`, `clientId`, `scopes`, `audience`, `issuer`, `expiresAt`. Neither
knows `me`.

`@sdxc/well-known/oauth-authorization-server` types, parses and writes RFC 8414 documents,
including `introspectionEndpoint`, `revocationEndpoint` and
`authorizationResponseIssParameterSupported`, with an `extensions` record for members the
RFC does not list (`userinfo_endpoint` is an OIDC member, so it rides there).

`@sdxc/outbound` (ADR-108) exposes the bounded fetch Webmention uses: `checkUrl` refuses
private hosts and reserved names, `follow` re-checks every redirect hop under one deadline,
and `readText` caps bytes.

## Decision

Add IndieAuth to every tenant as an entitlement-gated capability, beside the OIDC flows and
through the same endpoints. A request whose `client_id` is a URL takes the IndieAuth path;
every other request keeps today's behavior byte for byte.

### 1. Gating

IndieAuth is a feature slug, `indieauth`, evaluated like `device_grant`: `publishMetadata`
receives `hasIndieAuth`, and `beginAuthorization` refuses a URL `client_id` with
`invalid_client` when the tenant is not entitled. Its plan placement is decided in the
catalog (ADR-019), not here. Turning it on seeds the IndieAuth scopes (section 6) and
records the tenant's IndieAuth settings.

### 2. Profile URLs: how a tenant maps to `me`

A subject may hold **profile URLs**, stored canonical in a new tenant table:

```sql
CREATE TABLE IF NOT EXISTS profile_urls (
	url TEXT PRIMARY KEY,        -- canonical: lowercased host, "/" for an empty path
	subject_id TEXT NOT NULL,
	is_primary INTEGER NOT NULL,
	verified_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_hosts (
	host TEXT PRIMARY KEY,
	verification_value TEXT NOT NULL,
	verified_at INTEGER,
	created_at INTEGER NOT NULL
);
```

The rules:

- **The tenant binds, the subject does not.** A tenant administrator (dashboard or
  management API) binds a profile URL to a subject. A URL is unique within the tenant, so
  two subjects never answer for the same `me`.
- **The host is proven by DNS.** A profile URL is only usable once its host is a verified
  `profile_hosts` row, proven by a TXT record the tenant publishes, looked up in the Worker
  through Cloudflare DNS-over-HTTPS exactly as organization domains are. The lookup in
  `app/services/organization-domains.ts` moves to a shared `app/services/dns-txt.ts` that
  both call; the tables stay separate because an organization domain grants membership by
  email address and a profile host grants the right to assert a URL, and one row meaning
  both would let either decision widen the other.
- **The page is checked at bind time.** Binding fetches the profile URL through
  `@sdxc/outbound` and requires a `rel="indieauth-metadata"` (or legacy
  `rel="authorization_endpoint"`) naming this tenant, the same check a client will make.
  This catches a misconfigured site before a client does; it proves nothing about
  ownership, which is the TXT record's job.
- **One tenant per person is a deployment, not a rule.** `sergiodxa.com` is a tenant with
  one subject, one verified host and one profile URL. A blog-saas tenant is a site with
  many authors, each bound to `https://site.example/authors/{name}` under one verified
  host. Both are the same tables.

`me` on an authorization request is a hint: canonicalized, it selects the subject whose
bound URL it is (as `login_hint` does for an email), and is otherwise ignored. After sign-in
the returned `me` is the signed-in subject's matching URL, else their primary one. A subject
with no verified profile URL cannot complete an IndieAuth authorization: the request
redirects `access_denied` with a description saying so.

### 3. URL client identifiers and client metadata

`beginAuthorization` branches on the shape of `client_id`. A `client_`-prefixed id is a
registered client, as today. Anything that parses as an `http(s)` URL is an IndieAuth client
and never touches the `clients` table.

- **Validation**: the IndieAuth client identifier rules above, in a new
  `database/indieauth.ts` (`parseClientId`, `canonicalProfileUrl`), used by both the
  authorization and the token paths.
- **Fetch in the Worker**: network I/O stays out of the Durable Object, as with
  organization domains. `authorize.tsx` fetches the client id through
  `@sdxc/outbound` (private hosts refused, five redirects, 8 seconds, capped at
  64 KB for this document) with `Accept: application/json`, caches the parsed document with
  `@sdxc/workers-cache` for ten minutes keyed by the canonical id, and passes it to
  `beginAuthorization` as `clientMetadata`. The document is validated with
  `remix/data-schema` via `@sdxc/validate`: `client_id` must equal the URL and
  `client_uri` must prefix it, or the metadata is discarded. A loopback client id is never
  fetched.
- **No metadata is not an error.** A fetch that fails, an HTML page, or a discarded document
  leaves the client with its URL as its only name; the consent screen then shows the host
  alone. Legacy `h-app` markup is not parsed.
- **Redirect URI**: accepted when its scheme, host and port equal the client id's; otherwise
  it must be exactly one of the metadata's `redirect_uris`. A mismatch renders the error
  page, since there is no verified target yet, the same as a registered client.
- **Consent is always shown** for a URL client on its first authorization, with the client
  id's host as the headline and `client_name` and `logo_uri` beneath it as claims the client
  made about itself. The grant is remembered in `grants` under the URL, so a second
  authorization for the same scopes skips the screen as for any client.
- **What the request row keeps**: the name and logo the consent screen used are copied onto
  `authorization_requests` (two nullable columns), so resuming after sign-in never refetches.

The ceiling for a URL client's scopes is the tenant's IndieAuth scope set (section 6), in
place of a client row's `scopes`. `openid`, `offline_access`, `address` and `organization`
are outside it: identity is `me`, not an ID token.

### 4. The authorization response and code redemption

- **`iss` on success**: `redirectCode` in `database/authorization.ts` adds `iss`, for every
  client. RFC 9207 is a mix-up defense for OIDC clients too, and both discovery documents
  gain `authorization_response_iss_parameter_supported: true`. A client that does not know
  the parameter ignores it.
- **Profile-only redemption**: a new `POST /authorize` (`authorizeRedeem` in
  `routes/tenant.ts`, `app/http/controllers/authorize-redeem.ts`) redeems a code with
  `grant_type=authorization_code`, `code`, `client_id`, `redirect_uri`, `code_verifier`,
  answering `{ me }` plus `profile` when granted, and mints no token. It is the IndieAuth
  sign-in flow ("log in with your domain") and exists for URL clients only.
- **Token redemption**: `exchangeCode` takes the IndieAuth branch when the code's
  `client_id` is a URL: no client row, `authScheme` must be `none`, and the code's own
  bindings (client id, redirect URI, PKCE) are the whole check, which is what they already
  are for a public client. The token response gains `me` and, when granted, `profile`. A
  refresh token is issued whenever the grant carries a scope, rotated exactly as ADR-012
  describes; `refreshTokens` takes the same branch.

### 5. Access tokens

For an IndieAuth grant, `mintTokens` adds:

- **`me`**: the canonical profile URL, so a resource server authorizes by the URL it
  already knows as its own.
- **`aud`**: `{issuer}/userinfo` plus the resource the token is for. A client may send RFC
  8707 `resource` on the authorization request; it must be one of the tenant's registered
  IndieAuth resources (a setting listing, for example, `https://sergiodxa.com/micropub`).
  Without `resource`, the token names every registered resource on the profile URL's host.
  IndieAuth clients do not send `resource` today, so the default is what they get, and a
  token for one site's Micropub endpoint is refused by every other site's.

OIDC access tokens are unchanged.

### 6. Scopes

The scopes are rows in the existing `scopes` catalog with `is_standard = 0`, seeded when a
tenant turns IndieAuth on, editable like any custom scope, and advertised in
`scopes_supported` by the existing query:

| Scope      | Title                 | Used by  |
| ---------- | --------------------- | -------- |
| `create`   | Create posts          | Micropub |
| `update`   | Edit your posts       | Micropub |
| `delete`   | Delete posts          | Micropub |
| `undelete` | Restore deleted posts | Micropub |
| `draft`    | Create drafts         | Micropub |
| `media`    | Upload files          | Micropub |
| `read`     | Read your feeds       | Microsub |
| `follow`   | Follow and unfollow   | Microsub |
| `channels` | Manage channels       | Microsub |
| `mute`     | Mute sources          | Microsub |
| `block`    | Block sources         | Microsub |
| `profile`  | Your profile (exists) | both     |
| `email`    | Your email (exists)   | both     |

The IndieAuth scope set is `profile`, `email` and every non-standard scope. `profile` means
`name`, `url` (the `me`), `photo` (the subject's `picture`); `email` adds the primary
verified address.

### 7. Introspection, revocation and userinfo

- **`POST /oauth/introspect`** (`app/http/controllers/oauth/token-introspect.ts`, a new
  `introspectAccessToken` RPC): RFC 7662 for access tokens. The caller authenticates as a
  confidential registered client with `resolveClientAuth` and `authenticateClient`, as
  `/api-keys/introspect` does; IndieAuth only requires "some form of authorization", and a
  registered client for each resource server (the blog registers one) is the form the
  tenant already manages. The answer is `active`, `me`, `client_id`, `scope`, `exp`, `iat`,
  `sub`, `aud`, `iss`; every failure is `{ active: false }`.
- **`POST /oauth/revoke`** (`app/http/controllers/oauth/revoke.ts`, a `revokeToken` RPC):
  RFC 7009, unauthenticated for IndieAuth tokens as the spec asks, always `200`. A refresh
  token revokes its family (`revokeFamily`). An access token's `jti` is written to a new
  `revoked_access_tokens (jti, expires_at)` table that introspection and `/userinfo` read
  and the daily sweep empties past `expires_at`. The legacy `action=revoke` form at the token
  endpoint is answered the same way.
- **`/userinfo`**: a token carrying `me` and `profile` answers the IndieAuth `profile`
  object; a token carrying `openid` answers the OIDC claims as today; anything else is
  `insufficient_scope`.

### 8. Discovery

`publishMetadata` builds both documents with `@sdxc/well-known` instead of literals:
`define` from `@sdxc/well-known/oauth-authorization-server` and
`@sdxc/well-known/openid-configuration`, written with their `stringify`, so the member
names and required fields come from one typed table. When `hasIndieAuth` is true, the
authorization server document adds:

```ts
let oauthMetadata = define({
	issuer,
	authorizationEndpoint: new URL("/authorize", issuer),
	tokenEndpoint: new URL("/oauth/token", issuer),
	introspectionEndpoint: new URL("/oauth/introspect", issuer),
	introspectionEndpointAuthMethodsSupported: ["client_secret_basic", "client_secret_post"],
	revocationEndpoint: new URL("/oauth/revoke", issuer),
	revocationEndpointAuthMethodsSupported: ["none"],
	codeChallengeMethodsSupported: ["S256"],
	authorizationResponseIssParameterSupported: true,
	responseTypesSupported: ["code"],
	grantTypesSupported: ["authorization_code", "refresh_token"],
	scopesSupported,
	serviceDocumentation: new URL("https://indieauth.spec.indieweb.org/"),
	extensions: { userinfo_endpoint: `${issuer}/userinfo` },
});
```

The IndieAuth metadata URL is the existing
`/.well-known/oauth-authorization-server`, so no route is added for it and the `issuer`
prefixes it as the spec requires. Its `ETag`/`Cache-Control` handling in
`app/http/controllers/well-known/oauth-authorization-server.ts` is unchanged.

### 9. How the blog's Micropub endpoint uses it

sergiodxa.com's tenant is created with the custom domain `auth.sergiodxa.com` as its issuer,
`sergiodxa.com` as a verified profile host, `https://sergiodxa.com/` bound to the owner's
subject, and `https://sergiodxa.com/micropub` as its IndieAuth resource.

The blog advertises, in `<head>` and as `Link` headers on the home page and every post:

```html
<link
	rel="indieauth-metadata"
	href="https://auth.sergiodxa.com/.well-known/oauth-authorization-server"
/>
<link rel="authorization_endpoint" href="https://auth.sergiodxa.com/authorize" />
<link rel="token_endpoint" href="https://auth.sergiodxa.com/oauth/token" />
<link rel="micropub" href="https://sergiodxa.com/micropub" />
```

`app/auth/resource-server.ts` in the blog points `ResourceServer` at the tenant:

```ts
import { ResourceServer } from "@sdxc/auth/resource-server";

import { issuer } from "~/app/auth/issuer";

/** Verifies Micropub bearer tokens issued for this site's profile URL. */
export function micropubResource(): ResourceServer {
	return new ResourceServer(issuer(), {
		audience: "https://sergiodxa.com/micropub",
		introspection: tenantIntrospector,
	});
}
```

The blog's `authorize(ctx, token)` (ADR-095) then requires `token.me` to equal
`https://sergiodxa.com/`, and `token.has(scope)` for each of the operation's
`requiredScopes`. Verification is local against the cached JWKS; `tenantIntrospector`,
authenticating as the blog's registered confidential client, is available for a write
that should see a revocation immediately. The subject check ADR-095 describes (the token's
`sub` matches the blog's admin row) keeps working once the CMS login also moves to this
tenant, since both flows then share one subject id.

`@sdxc/auth` gains the members this needs:

| Symbol                             | Change                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `AccessToken.me`                   | the `me` claim as a string, `null` when absent                           |
| `ResourceServer.Introspection.me`  | `me` from the introspection response, `null` when absent                 |
| `ResourceServer` introspected path | carries `me` onto the synthesized `AccessToken` beside `scope` and `aud` |

### Files that change

| File                                                                                     | Change                                                                                                                             |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/auth-saas/database/tenant-migrations/00NN-indieauth.sql` (next free number)        | `profile_urls`, `profile_hosts`, `revoked_access_tokens`; two nullable client-display columns on `authorization_requests`          |
| `apps/auth-saas/database/tenant-migrations.ts`                                           | registers the migration                                                                                                            |
| `apps/auth-saas/database/indieauth.ts` (new)                                             | client id and profile URL parsing, client metadata schema, scope set, profile URL and host operations                              |
| `apps/auth-saas/database/authorization.ts`                                               | URL-client branch in `beginAuthorization`, redirect rules, `me` hint, `iss` in `redirectCode`, profile-only redemption             |
| `apps/auth-saas/database/tokens.ts`                                                      | URL-client branch in `exchangeCode`/`refreshTokens`, `me` and `aud` in `mintTokens`, `introspectAccessToken`, `revokeToken`, sweep |
| `apps/auth-saas/database/consent.ts`                                                     | consent screen fills `logoUri` and host for URL clients                                                                            |
| `apps/auth-saas/database/metadata.ts`                                                    | documents built with `@sdxc/well-known`, `hasIndieAuth`, IndieAuth members, `iss` support flag, IndieAuth `/userinfo` profile      |
| `apps/auth-saas/database/tenant-do.ts`                                                   | new RPCs; `hasIndieAuth` read like `hasDeviceGrant`                                                                                |
| `apps/auth-saas/routes/tenant.ts`, `apps/auth-saas/bootstrap/tenant-app.ts`              | `POST /authorize`, `POST /oauth/introspect`, `POST /oauth/revoke`                                                                  |
| `apps/auth-saas/app/http/controllers/authorize.tsx`                                      | client metadata fetch and cache before `beginAuthorization`                                                                        |
| `apps/auth-saas/app/http/controllers/authorize-redeem.ts` (new)                          | profile-only code redemption                                                                                                       |
| `apps/auth-saas/app/http/controllers/oauth/token.ts`                                     | `me`/`profile` in the response, `action=revoke`                                                                                    |
| `apps/auth-saas/app/http/controllers/oauth/token-introspect.ts`, `oauth/revoke.ts` (new) | RFC 7662 for access tokens, RFC 7009                                                                                               |
| `apps/auth-saas/app/http/controllers/userinfo.ts`                                        | IndieAuth profile answer, revoked `jti` check                                                                                      |
| `apps/auth-saas/app/services/dns-txt.ts` (new), `app/services/organization-domains.ts`   | shared TXT lookup; profile host verification                                                                                       |
| `apps/auth-saas/app/http/controllers/management/tenants/*`                               | IndieAuth settings, profile hosts, profile URL bindings                                                                            |
| `apps/auth-saas/app/services/billing/entitlement-flags.ts`                               | the `indieauth` feature                                                                                                            |
| `apps/auth-saas/package.json`                                                            | `@sdxc/distill`, `@sdxc/well-known`                                                                                                |
| `packages/auth/src/access-token.ts`, `packages/auth/src/resource-server.ts`              | `me`                                                                                                                               |
| `apps/blog/app/auth/resource-server.ts`, `apps/blog/app/auth/issuer.ts`, layout          | the tenant issuer, `rel="indieauth-metadata"`                                                                                      |

## Consequences

### Positive

- **One provider for OIDC and IndieAuth** - the blog's CMS login and its Micropub clients
  sign in against the same subject, sessions, passkeys and second factor
- **Most of the flow already exists** - `S256` is already mandatory, public clients already
  authenticate with `none`, and every client id column is already text
- **The issuer is already right** - an `https` issuer with no path satisfies IndieAuth and
  RFC 9207, which r3-auth's frozen scheme-less issuer could not
- **RFC 9207 for every client** - `iss` on success hardens OIDC clients against mix-up too
- **Introspection and revocation for all access tokens** - OIDC resource servers gain both
  endpoints as well
- **Tenant-scoped audiences** - a token names the site's own resource, so blog-saas tenants
  cannot use each other's tokens
- **Discovery through `@sdxc/well-known`** - two hand-written literals become typed
  documents with one field table

### Negative

- **Unregistered clients** - anyone can present a URL `client_id`; consent on first use and
  showing the host above the self-described name are the defenses, and a phishing client
  with a lookalike host remains possible, as on every IndieAuth server
- **An outbound fetch on `/authorize`** - a cold client id costs up to one bounded fetch in
  the request path; the cache makes it once per ten minutes per client
- **Revocation is not instant for local verifiers** - a resource server verifying JWTs locally
  sees a revoked access token until it expires (one hour); only introspection sees the
  denylist
- **Two response shapes behind `profile` and `/userinfo`** - which one a caller gets depends
  on whether the grant is IndieAuth or OIDC
- **Profile binding is an administrator action** - a subject cannot claim a URL on their own;
  a self-service path would need its own proof beyond the page's `rel` link

### Neutral

- **OIDC clients see one new query parameter** - `iss` on the success redirect; nothing else
  about the OIDC flows changes
- **Custom scopes are catalog rows** - the IndieAuth scopes are data a tenant may rename or
  remove, not constants
- **Dynamic registration stays deferred** - URL client identifiers are the IndieAuth answer
  to registration and do not create rows, so ADR-014's deferral is untouched

## Implementation Plan

### Phase 1: `iss`, introspection, revocation, discovery

**Priority:** High
**Estimated Effort:** 1-2 days

1. `iss` on the success redirect and `authorization_response_iss_parameter_supported`, with
   a regression test on `redirectCode`
2. Build both discovery documents with `@sdxc/well-known`, asserting byte-equivalent member
   sets against today's in `app/http/controllers/well-known/discovery.test.ts`
3. `POST /oauth/introspect` and `POST /oauth/revoke`, `revoked_access_tokens` and its sweep
4. `me` on `AccessToken` and `ResourceServer.Introspection` in `@sdxc/auth`

### Phase 2: Profile URLs and hosts

**Priority:** High
**Estimated Effort:** 2 days

1. The migration, `database/indieauth.ts` URL rules with the spec's examples as tests
2. `app/services/dns-txt.ts` extracted from organization domains, profile host verification
3. Management endpoints to verify hosts and bind profile URLs, with the bind-time `rel` check

### Phase 3: URL clients and the IndieAuth flow

**Priority:** High
**Estimated Effort:** 3 days

1. The `indieauth` entitlement, scope seeding, IndieAuth settings (resources)
2. Client metadata fetch, schema and cache in the Worker, MSW-backed tests for every
   refusal (private host, mismatched `client_id`, `client_uri` not a prefix, oversized)
3. URL-client branches in `beginAuthorization`, consent, `exchangeCode`, `refreshTokens`
4. `me`, `profile` and resource `aud` in `mintTokens`; `POST /authorize`; `/userinfo`
   profile

### Phase 4: The blog

**Priority:** Medium
**Estimated Effort:** 1 day

1. Create the sergiodxa.com tenant with `auth.sergiodxa.com` as issuer, verify
   `sergiodxa.com`, bind the profile URL, register the Micropub resource and the blog's
   introspection client
2. Point the blog's `ResourceServer` at it, check `me`, advertise the `rel` links
   (ADR-095, Phase 3)
3. Run micropub.rocks and sign in from Quill and iA Writer

## Alternatives Considered

### 1. Build IndieAuth into r3-auth

ADR-095's original plan: the gap table there was written against r3-auth.

**Rejected because**: r3-auth is being deprecated in favor of auth-saas. Its issuer is
scheme-less and frozen, so the IndieAuth `issuer`/`iss` rule needs a workaround there that
auth-saas does not, and every line written would be discarded with the app.

### 2. An external IndieAuth server (indieauth.com, a self-hosted Taproot or similar)

The blog would delegate `rel="authorization_endpoint"` to a third-party server, and verify
its tokens by calling that server's token or introspection endpoint.

**Rejected because**: identity would live in a second place with its own sign-in (usually
RelMeAuth through GitHub or email), separate from the passkeys and sessions the CMS already
uses. indieauth.com issues opaque tokens verified by a call per request, has no SLA, and
the blog-saas tenants would each depend on it for writes. It also leaves auth-saas without
the capability its tenants' own sites would want.

### 3. A standalone `@sdxc/indieauth` package

An app-agnostic package implementing the IndieAuth server over storage adapters, which
auth-saas would mount.

**Rejected because**: IndieAuth is a profile of flows auth-saas already implements, and it
touches the authorization request row, the code redemption, token minting, consent and
discovery inside the tenant Durable Object. A package would need hooks into each, which is a
second authorization server shaped around the first. The app-agnostic parts that do exist
belong in packages that already have them: URL client and profile URL validation can move
to a package once a second consumer appears, `me` lives in `@sdxc/auth`, and metadata in
`@sdxc/well-known`.

### 4. A tenant per person as the only mapping

Each tenant would have exactly one `me`, its site's URL, stored as a tenant setting.

**Rejected because**: it fits sergiodxa.com and nothing else. A multi-author blog-saas
tenant needs one profile URL per author, and a per-subject binding covers the single-person
tenant as its smallest case.

### 5. Reuse organization domains as profile hosts

A verified organization domain would also authorize profile URLs on that host.

**Rejected because**: an organization domain grants membership to every subject with an
address at it. Tying the right to assert a URL to the same row means verifying a domain for
one purpose silently grants the other. The TXT lookup is shared; the rows are not.

## References

- [IndieAuth Living Standard](https://indieauth.spec.indieweb.org/)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 9207 - OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [RFC 7636 - Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636)
- [RFC 7662 - OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662)
- [RFC 7009 - OAuth 2.0 Token Revocation](https://www.rfc-editor.org/rfc/rfc7009)
- [RFC 8707 - Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [Micropub](https://www.w3.org/TR/micropub/), [Microsub](https://indieweb.org/Microsub-spec)
- [ADR-095: Micropub Package](../ADR-095-micropub-package.md)
- [ADR-094: Webmention Package](../ADR-094-webmention-package.md) - the bounded fetch
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md)
- [ADR-011: Authorization Endpoint and PKCE](./ADR-011-authorization-endpoint-and-pkce.md)
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md)
- [ADR-013: Discovery and Userinfo](./ADR-013-discovery-and-userinfo.md)
- [ADR-014: Clients and Client Secrets](./ADR-014-clients-and-client-secrets.md)
- [ADR-015: Consent and Scopes](./ADR-015-consent-and-scopes.md)
- [ADR-030: Organizations](./ADR-030-organizations.md)
- [ADR-039: Device Authorization Grant](./ADR-039-device-authorization-grant.md)

## Current Progress

- [ ] Phase 1: `iss`, introspection, revocation, discovery
- [ ] Phase 2: Profile URLs and hosts
- [ ] Phase 3: URL clients and the IndieAuth flow
- [ ] Phase 4: The blog

## Notes

- A URL `client_id` and a registered one cannot collide: registered ids are `client_`
  TypeIDs, which never parse as `http(s)` URLs.
- The client metadata cache is keyed by the canonical id and holds only the validated
  document, so a client changing its `redirect_uris` takes effect within ten minutes.
- `grants` rows for URL clients use the URL as `client_id`; listing a subject's grants
  shows the host, since there is no client name to join.
- The `me` a server returns may differ from the one the user typed (a redirect, a different
  path); clients verify it by discovering that it names the same authorization endpoint,
  which the bind-time `rel` check makes true for every bound URL.
