---
title: auth-saas
headline: A multi-tenant identity provider where every tenant is its own Durable Object and its own SQLite database
summary: A multi-tenant OpenID Connect provider where every tenant runs in its own Durable Object, with passkeys, SAML, SCIM, signed webhooks and a management API.
tagline: An OpenID Connect provider per tenant
cover: readme
shots:
  - id: readme
    page: "https://github.com/sergiodxa/monorepo/tree/main/apps/auth-saas"
    alt: The auth-saas folder on GitHub, listing its folders above the README.
  - id: services
    page: "https://github.com/sergiodxa/monorepo/tree/main/apps/auth-saas"
    highlight: "article.markdown-body table"
    alt: The README's table of Cloudflare services, from the TENANT Durable Object and the control-plane D1 database to KV, Analytics Engine, email, rate limiting and static assets.
  - id: round-trips
    page: "https://github.com/sergiodxa/monorepo/blob/main/docs/adr/auth-saas/ADR-001-auth-saas-on-per-tenant-durable-objects.md"
    highlight: "article.markdown-body table"
    alt: A table from the architecture decision comparing round trips when the tenant object exposes queries against when it exposes one operation per protocol step.
  - id: models
    page: "https://github.com/sergiodxa/monorepo/tree/main/apps/auth-saas/app/models/tenant"
    highlight: "table[aria-labelledby='folders-and-files']"
    alt: The app/models/tenant folder on GitHub, one store per table of a tenant's database, from account linking and API keys to sessions and signing keys.
  - id: migrations
    page: "https://github.com/sergiodxa/monorepo/tree/main/apps/auth-saas/database/tenant-migrations"
    highlight: "table[aria-labelledby='folders-and-files']"
    alt: The database/tenant-migrations folder on GitHub, a numbered list of SQL migrations each tenant's object applies to itself.
  - id: conformance
    page: "https://github.com/sergiodxa/monorepo/blob/main/docs/adr/auth-saas/ADR-047-oauth-2-1-and-security-bcp-conformance.md"
    highlight: "article.markdown-body table"
    alt: A table of OAuth 2.1 and Security BCP requirements beside where each holds in the code.
  - id: phone
    page: "https://github.com/sergiodxa/monorepo/tree/main/apps/auth-saas"
    viewport: phone
    alt: The auth-saas folder on GitHub on a phone.
---

auth-saas is an identity platform: every tenant is an OpenID Connect and OAuth 2 provider with its own users, clients, signing keys, branding and hostname, and every tenant runs in its own Cloudflare Durable Object over that object's SQLite database. A D1 control plane holds tenants, members, hostnames and subscriptions; custom domains come through Cloudflare for SaaS, and billing is per tenant through Polar.

It has no public deployment. The identity provider answering at auth.sergiodxa.com is a separate, single-tenant app, so this case study shows auth-saas through its source and its design records on GitHub, which is where a developer would read it anyway. What it shows is the collection's security packages under one roof: JWTs, passkeys, password policy, TOTP, SAML, SCIM and signed outbound webhooks composed into one provider, with storage split between a tenant's own object and the platform.

## The brief

An identity provider sold to many customers has to get isolation right before anything else. A tenant's users and signing keys are the product, so one tenant must never read another's rows, and one noisy tenant must not slow the rest. It has to speak a long list of standards correctly: authorization code with PKCE, refresh rotation, discovery, JWKS, userinfo, and the newer pieces that OAuth 2.1 and the security best-current-practice expect. It needs hosted sign-in pages that work in any browser, enterprise connections, provisioning, a management API with machine credentials, attack protection, and metering for billing. And on Workers it has to do all of that with tight CPU limits and no long-running process.

auth-saas answers isolation structurally. The README's services table lays out the split: a `TENANT` Durable Object per tenant, `PLATFORM_DB` in D1 for the control plane, a KV cache for hostname resolution, Analytics Engine for usage, Cloudflare's email sending, rate limiters per route class, and static assets for the hosted pages.

![The README's table of Cloudflare services](/showcase/auth-saas/services.webp "Each Cloudflare service has one job, with a Durable Object per tenant at the centre.")

## A tenant to a Durable Object

`app/models/tenant/object.ts`, exported from `bootstrap/worker.ts` as `Tenant`, keeps one tenant's settings, subjects, clients, sessions and signing keys in the object's own SQLite, reachable by no query that could reach another tenant's. Isolation stops being a `WHERE tenant_id = ?` clause that every query must remember; a query cannot reach another tenant's rows because it cannot reach another tenant's database.

The architecture record behind it, ADR-001, makes the case for how the Worker and the object talk. The Worker serves HTTP: it resolves the hostname, runs the router and middleware, and renders the pages. The object exposes typed RPC methods, one per protocol step, so a token exchange is one call to `exchangeCode(input)` where a query-shaped store would need six round trips, and the record puts `/userinfo` at no round trip at all, verified against cached keys in the Worker.

![A table comparing round trips](/showcase/auth-saas/round-trips.webp "One RPC method per protocol step keeps a token exchange to a single round trip.")

The object exposes those operations directly, `beginAuthorization`, `pushAuthorizationRequest`, `exchangeCode`, `exchangeToken`, `introspectToken`, `revokeToken` and `refreshTokens` among them. The methods return their result with a cost envelope: a wrapper counts the rows every statement read and wrote and the call's duration, and folds them into the result, so the Worker can attribute the work to the tenant.

```ts
async #withCost<T>(fn: () => Promise<T>): Promise<WithCost<T>> {
	this.#counters.rowsRead = 0;
	this.#counters.rowsWritten = 0;

	let startedAt = performance.now();
	let result = await fn();
	let durationMs = performance.now() - startedAt;

	return Object.assign(result as object, {
		cost: {
			rowsRead: this.#counters.rowsRead,
			rowsWritten: this.#counters.rowsWritten,
			durationMs,
		},
	}) as WithCost<T>;
}
```

Beside the object, one store per table holds the tenant's data access: account linking, API keys, audit events, clients, connections, consent, credentials, device authorization, DPoP proofs, organizations, passkeys, SAML connections, SCIM, sessions, signing keys, subjects, TOTP, webhooks and more. Each reads and writes through [@sdxc/data-table-sqlstorage](/api/data-table-sqlstorage), while the control plane uses [@sdxc/data-table-d1](/api/data-table-d1).

![The app/models/tenant folder](/showcase/auth-saas/models.webp "A tenant's data lives in one store per table, all inside the tenant's object.")

## Migrations each tenant applies to itself

A new tenant is provisioned on an empty database, so every tenant schema change ships as a numbered SQL file in `database/tenant-migrations/`, forty of them from `0001-init.sql` to `0040-token-exchange.sql`. The object applies whatever is pending when it boots, with no deployment step per tenant. Durable Object SQLite coalesces every write of one event-loop turn into one commit and has no `BEGIN`, so multi-step changes are written to be safe without a transaction.

![The tenant-migrations folder](/showcase/auth-saas/migrations.webp "Forty numbered migrations, applied by each tenant's object when it boots.")

## Hostname to tenant in the Worker

`bootstrap/worker.ts` sends every request to one of four places: static assets, the platform router on the platform host, the management API router on its own `api.` host, or a tenant's object. It resolves a tenant from Cloudflare for SaaS host metadata where it can, and from a KV-cached control-plane lookup otherwise. A suspended tenant still resolves, and is answered inside its own object, which is where authorization and entitlements are enforced, since that is the runtime that receives the traffic.

The tenant router, `app/initializers/tenant-router.ts`, maps the protocol endpoints a tenant answers: discovery, JWKS, `/userinfo`, token, registration, `/authorize`, the hosted `/u/*` pages, `/device` and SCIM, each imported on first use behind its rate limits through [@sdxc/rate-limit](/api/rate-limit).

## The protocol surface, held to OAuth 2.1

Tokens are minted and verified with [@sdxc/jwt](/api/jwt). Beyond the authorization code flow, refresh rotation and discovery, a tenant answers the device authorization grant, pushed authorization requests and signed request objects, DPoP-bound tokens (RFC 9449), token exchange for narrower tokens (RFC 8693), introspection and revocation, and identifies its issuer on every authorization response (RFC 9207).

ADR-047, accepted, lists each OAuth 2.1 and Security BCP requirement beside where it holds in the code: only `response_type=code`, PKCE with `S256` on every request and `plain` refused, exact redirect matching, 60-second single-use codes where a replay revokes the token family, refresh tokens that rotate on every use with reuse ending the session, and the `iss` parameter against mix-up attacks.

![A table of OAuth 2.1 requirements](/showcase/auth-saas/conformance.webp "Every OAuth 2.1 requirement is mapped to the function that enforces it.")

## Sign-in pages, connections and a management API

The hosted pages under `/u/*` cover sign-in, sign-up, magic links, consent, device codes, password reset, second factor and step-up. They are server-rendered from [Form](/api/ui/form), [TextField](/api/ui/text-field), [Card](/api/ui/card) and [Alert](/api/ui/alert), with passkeys through [@sdxc/passkey](/api/passkey), password rules through [@sdxc/password-policy](/api/password-policy), TOTP enrolment QR codes through [@sdxc/qr](/api/qr) and a Turnstile guard through [@sdxc/captcha](/api/captcha). Exporting password hashes demands a fresh second factor.

Enterprise customers connect SAML identity providers through [@sdxc/saml](/api/saml) and provision users and groups over SCIM through [@sdxc/scim](/api/scim), paged by cursor. Outbound events are signed through [@sdxc/webhooks](/api/webhooks).

The management API runs on its own `api.` host, described with [@sdxc/openapi](/api/openapi), and verifies every credential, machine or human, against the platform tenant's own object and issuer, so the platform is a tenant of itself. An MCP server exposes the same operations as tools, rebuilding each call as a management request and forwarding the caller's verified token. Plans resolve to entitlements through [@sdxc/flags](/api/flags), and a daily cron reports monthly-active usage from Analytics Engine through [@sdxc/billing](/api/billing).

The README and the design records read as well on a phone as on a desktop, which is how most people will meet an app with no public deployment.

![The auth-saas folder on a phone](/showcase/auth-saas/phone.webp "The source and README on GitHub, on a phone.")

## Where to start reading

- [`bootstrap/worker.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/auth-saas/bootstrap/worker.ts) — how one Worker routes a request to the platform, the management API or a tenant's object.
- [`app/models/tenant/object.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/auth-saas/app/models/tenant/object.ts) — the tenant Durable Object, its RPC methods and their cost envelope.
- [`app/initializers/tenant-router.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/auth-saas/app/initializers/tenant-router.ts) — every protocol endpoint a tenant answers, each behind its rate limits.
- [`docs/adr/auth-saas/`](https://github.com/sergiodxa/monorepo/tree/main/docs/adr/auth-saas) — the design records, from per-tenant objects to OAuth 2.1 conformance.
