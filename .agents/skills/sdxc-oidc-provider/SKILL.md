---
name: sdxc-oidc-provider
description: "@sdxc/oidc-provider is a host-agnostic OAuth 2.0 / OpenID Connect authorization server with passkey (WebAuthn) authentication and a management API, created with `createOidcProvider({ database, internalSecret })` and driven by `provider.fetch(request)`. Use when standing up or debugging an OIDC issuer — authorize, token, userinfo, introspect, revoke, discovery, JWKS, RP-initiated logout — injecting a `remix/data-table` driver, or signing `X-Internal-Token` management calls."
---

# @sdxc/oidc-provider

A complete OIDC/OAuth2 authorization server — authorize, token, userinfo, introspect, revoke,
discovery, JWKS, RP-initiated logout — with passkey (WebAuthn) authentication, a management API,
and server-rendered UI, built on `remix/router` and `remix/data-table`. The public surface is
`createOidcProvider(config)`, the `OidcProvider` it returns (`fetch`, `migrate`,
`ensureSigningKeys`, `cleanup`), and the `createInternalToken` / `verifyInternalToken` pair that
defines the management-API token contract. It never imports Durable Object or Cloudflare APIs:
the host injects a `DatabaseDriver` and an HMAC secret, and everything needed at request time
(issuer, signing keys, clients, subjects) lives in its own database. `provider.fetch` is pure
Fetch, so it runs on Workers, Durable Objects, Bun, and Node.

Full API, options and examples: [packages/oidc-provider/README.md](packages/oidc-provider/README.md)

## When to reach for it

- An OAuth2/OIDC issuer is needed and the endpoints, discovery document and JWKS should not be hand-rolled
- Passkey registration and sign-in have to back the authorization flow
- The same provider must run both on a plain Worker with D1 and inside a Durable Object, differing only in the injected database adapter
- A control plane needs to call the provider's management API and must sign the `X-Internal-Token` header the same way the provider verifies it

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/oidc-provider": "workspace:*" } }
```

```ts
import type { OidcProvider } from "@sdxc/oidc-provider";

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { createOidcProvider } from "@sdxc/oidc-provider";

let provider: OidcProvider | null = null;

export default {
	async fetch(request, env) {
		provider ??= createOidcProvider({
			database: createD1DatabaseAdapter(env.DB),
			internalSecret: await env.INTERNAL_SECRET.get(),
			// migrations default to "auto": applied before the first request
		});
		return provider.fetch(request);
	},
} satisfies ExportedHandler<Env>;
```

## Suggestions

- Inside a Durable Object pass `migrations: "manual"` and run `migrate()` plus `ensureSigningKeys()` in `ctx.blockConcurrencyWhile`, so the instance never serves a request against an unmigrated schema or a keyless signer. `"auto"` is fine for a plain Worker.
- `cleanup()` is not run by `fetch`. Wire it to a cron trigger or an alarm, or expired sessions, authorization codes, WebAuthn challenges and verification tokens accumulate.
- A fresh database carries no issuer and cannot sign tokens until one is provisioned over the management API (`POST /api/setup` with an internal token). The `internalSecret` on both sides must match, or every management call is rejected.
- Stored passwords and client secrets are self-describing scrypt hashes, re-hashed at the moment a correct value is presented, so raising the cost parameters needs no schema change and no migration pass.

## Related

- `@sdxc/data-table-d1` — the `DatabaseDriver` to inject for a self-hosted Worker; skill `sdxc-data-table-d1`
- `@sdxc/data-table-sqlstorage` — the driver to inject when the provider runs inside a Durable Object; skill `sdxc-data-table-sqlstorage`
- `@sdxc/crypto` — the password hashing, digests and random tokens the provider is built on; skill `sdxc-crypto`
