# @pkg/oidc-provider

A host-agnostic OAuth 2.0 / OpenID Connect provider (authorize, token, userinfo,
introspect, revoke, discovery, JWKS, RP-initiated logout) with passkey (WebAuthn)
authentication, a management API, and server-rendered UI.

The same provider runs inside a Cloudflare Durable Object (the multi-tenant
`apps/auth-saas` platform) or on a plain Worker with D1 (self-hosted) — the way
WordPress core is independent of WordPress.com. The host only differs in the
`remix/data-table` `DatabaseAdapter` it injects; everything the provider needs at
request time (issuer, signing keys, clients, subjects) lives in its own database.

See [ADR-011](../../docs/adr/ADR-011-oidc-provider-engine-package.md).

## Usage

```ts
import { createOidcProvider } from "@pkg/oidc-provider";

let provider = createOidcProvider({
	database, // a remix/data-table DatabaseAdapter
	internalSecret, // HMAC secret shared with the control plane for the management API
	analytics, // optional AnalyticsSink; omitted => no-op
	migrations, // "auto" (default) | "manual"
});

await provider.migrate(); // apply schema migrations (journaled, idempotent)
await provider.ensureSigningKeys(); // generate the ES256 key on first boot
let response = await provider.fetch(request);
await provider.cleanup(); // expire sessions/codes/challenges/tokens (run on a schedule)
```

## Self-hosted worker (Cloudflare + D1)

```ts
import { createOidcProvider, type OidcProvider } from "@pkg/oidc-provider";
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";

let provider: OidcProvider | null = null;

export default {
	async fetch(request, env, ctx) {
		if (!provider) {
			provider = createOidcProvider({
				database: createD1DatabaseAdapter(env.DB),
				internalSecret: await env.INTERNAL_SECRET.get(),
				// no analytics, no platform — a single-tenant OIDC provider
			});
			// migrations: "auto" applies pending migrations before the first request
		}
		return provider.fetch(request);
	},
} satisfies ExportedHandler<Env>;
```

A self-hosted install writes its issuer into `tenant_meta` once (via the management
`POST /api/setup` endpoint, authenticated with an internal token), then serves a
complete single-tenant IdP from its own D1.

Client assets: the WebAuthn client entries in `src/client/` are built by the host
(see `apps/auth-saas/vite.config.client.ts`) into `assets/tenant/*.js`, matching
the `clientEntry()` URLs the server components reference.
