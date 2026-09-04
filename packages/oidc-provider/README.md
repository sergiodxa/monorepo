# @sdxc/oidc-provider

A host-agnostic OAuth 2.0 / OpenID Connect provider with passkey authentication.

## Overview

This package is a complete OIDC/OAuth2 authorization server — authorize, token,
userinfo, introspect, revoke, discovery, JWKS, RP-initiated logout — with passkey
(WebAuthn) authentication, a management API, and server-rendered UI. It is built on
[`remix/router`](https://github.com/remix-run/remix) and `remix/data-table`.

The same provider runs inside a Cloudflare Durable Object (the multi-tenant
`apps/auth-saas` platform) or on a plain Worker with D1 (self-hosted), the way
WordPress core is independent of WordPress.com. It never imports Durable Object or
Cloudflare APIs: the host injects a `remix/data-table` `DatabaseDriver` and an
HMAC secret, and everything the provider needs at request time (issuer, signing
keys, clients, subjects) lives in its own database.

The internal-token helpers (`createInternalToken` / `verifyInternalToken`) ship
from this package so the control plane and the provider share one definition of the
platform↔tenant management-API contract. See
[ADR-011](/docs/adr/ADR-011-oidc-provider-engine-package.md).

## Usage

### Self-hosted (Cloudflare Worker + D1)

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { createOidcProvider, type OidcProvider } from "@sdxc/oidc-provider";

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

### Platform tenant (Durable Object)

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { createOidcProvider, type OidcProvider } from "@sdxc/oidc-provider";
import { DurableObject } from "cloudflare:workers";

export class Tenant extends DurableObject<Env> {
	#provider: OidcProvider;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.#provider = createOidcProvider({
			database: createSQLStorageDatabaseAdapter(ctx.storage.sql),
			internalSecret: env.INTERNAL_SECRET,
			analytics: {
				trackAuthentication: (tenantId, subjectId) => track(tenantId, subjectId),
				trackRegistration: (tenantId, subjectId) => track(tenantId, subjectId),
			},
			migrations: "manual", // run inside blockConcurrencyWhile below
		});
		ctx.blockConcurrencyWhile(async () => {
			await this.#provider.migrate();
			await this.#provider.ensureSigningKeys();
		});
	}

	override fetch(request: Request) {
		return this.#provider.fetch(request);
	}

	override async alarm() {
		await this.#provider.cleanup();
	}
}
```

## API

### `createOidcProvider(config: OidcProviderConfig): OidcProvider`

Creates a provider instance bound to injected storage and secrets.

**Parameters:**

- `config.database`: A `remix/data-table` `DatabaseDriver`. Use
  [`@sdxc/data-table-d1`](/packages/data-table-d1) for a self-hosted Worker or
  [`@sdxc/data-table-sqlstorage`](/packages/data-table-sqlstorage) for a Durable Object.
- `config.internalSecret`: HMAC secret shared with the control plane; used to verify
  internal tokens on the management API.
- `config.analytics`: Optional `AnalyticsSink` for authentication/registration
  events. Defaults to a no-op sink.
- `config.migrations`: `"auto"` (default) applies pending migrations before the first
  request; `"manual"` leaves it to the host (call `migrate()` yourself, e.g. inside
  `blockConcurrencyWhile`).

**Returns:**

- An `OidcProvider`.

**Example:**

```typescript
let provider = createOidcProvider({ database, internalSecret });
let response = await provider.fetch(request);
```

### `OidcProvider`

The provider instance returned by `createOidcProvider`.

#### `provider.fetch(request: Request): Promise<Response>`

Handles one request against the full OIDC surface. Pure Fetch, so it works on
Workers, Durable Objects, Bun, and Node.

#### `provider.migrate(): Promise<{ applied: string[] }>`

Applies pending schema migrations, journaled in an `oidc_migrations` table.
Idempotent — safe to run on every cold start. Returns the ids applied in this run.

#### `provider.ensureSigningKeys(): Promise<void>`

Generates the initial ES256 signing key if none exists. Idempotent; call once at boot.

#### `provider.cleanup(): Promise<void>`

Deletes expired sessions, authorization codes, WebAuthn challenges, and email
verification tokens, plus unverified subjects older than seven days. Run on a
schedule (a cron trigger or a Durable Object alarm).

### `createInternalToken(secret: string): Promise<string>`

Creates a short-lived HMAC-signed token the control plane sends to the provider's
management API (as the `X-Internal-Token` header).

**Parameters:**

- `secret`: The shared HMAC secret (must match the provider's `internalSecret`).

**Returns:**

- A signed token string.

**Example:**

```typescript
let token = await createInternalToken(env.INTERNAL_SECRET);
await stub.fetch(url, { headers: { "X-Internal-Token": token } });
```

### `verifyInternalToken(token: string, secret: string): Promise<boolean>`

Verifies a token produced by `createInternalToken`. Used internally by the provider's
management-auth middleware; exported for tests and custom hosts.

**Parameters:**

- `token`: The token from the `X-Internal-Token` header.
- `secret`: The shared HMAC secret.

**Returns:**

- `true` when the token is valid and unexpired.

### Types

#### `OidcProviderConfig`

```typescript
interface OidcProviderConfig {
	database: DatabaseDriver;
	internalSecret: string;
	analytics?: AnalyticsSink;
	migrations?: "auto" | "manual";
}
```

#### `AnalyticsSink`

```typescript
interface AnalyticsSink {
	trackAuthentication(tenantId: string, subjectId: string): void;
	trackRegistration(tenantId: string, subjectId: string): void;
}
```

## Pattern: Provisioning a fresh instance

A new instance (self-hosted or a platform tenant) needs its issuer written into
`tenant_meta` before it can sign tokens. The control plane does this over the
management API with an internal token:

```typescript
let token = await createInternalToken(env.INTERNAL_SECRET);
await fetch(new URL("/api/setup", issuer), {
	method: "POST",
	headers: { "Content-Type": "application/json", "X-Internal-Token": token },
	body: JSON.stringify({ tenant_id: tenantId, issuer: "sso.example.com", region: "wnam" }),
});
```

## Pattern: Serving client assets

The WebAuthn client entries live in `src/client/` and are referenced by the
server-rendered components via `clientEntry("/assets/tenant/<name>.js#Export")`. The
host builds them into its own `assets/tenant/` directory — see
`apps/auth-saas/vite.config.client.ts` for the Vite config that globs the package's
`src/client/**` into that output.

## Pattern: Upgrading stored credential hashes

Subject passwords and client secrets are stored as scrypt hashes in the
self-describing `$scrypt$ln=...,r=...,p=...$<salt>$<key>` format, so the cost parameters
travel with each value and can be raised without a schema change.

Raising the cost leaves every stored hash behind it, and there is no way to re-derive
one without the plaintext. So a correct password or secret is re-hashed at the moment
it is presented and written back in the same request that accepted it —
`Credential.verify` and `Secret.verify` do this themselves, so no caller can forget.
Nothing else changes: the rehash replaces only the stored hash, leaving `updated_at`
to mean "when the password last changed".

That makes the upgrade driven by logins, not by deploys. Hashes below the current cost
disappear as their owners authenticate, and a query on the recorded `i=` parameter says
how many are left.

A stored value too damaged to read as a hash counts as a mismatch rather than an error,
so a corrupt row denies access instead of reaching the caller as a failure to classify.

## Related Packages

- [`@sdxc/crypto`](/packages/crypto) - Password hashing, digests, and random tokens used throughout the provider
- [`@sdxc/data-table-sqlstorage`](/packages/data-table-sqlstorage) - Adapter to run the provider in a Durable Object
- [`@sdxc/data-table-d1`](/packages/data-table-d1) - Adapter to run the provider on a self-hosted Worker with D1

## Tips

1. **Use `migrations: "manual"` in a Durable Object** - Run `migrate()` inside `blockConcurrencyWhile` so the DO never serves a request against an unmigrated schema; `"auto"` is fine for a plain Worker.
2. **Call `ensureSigningKeys()` at boot** - Without a signing key the token and JWKS endpoints cannot operate.
3. **Schedule `cleanup()`** - Wire it to a cron trigger or a DO alarm; it is not run automatically by `fetch`.
4. **Keep `internalSecret` consistent** - The control plane's `createInternalToken` and the provider's `internalSecret` must use the same secret, or management-API calls will be rejected.
5. **Set the issuer before serving** - A fresh database has no issuer; provision it via `POST /api/setup` (or a seed) before expecting tokens to sign.
6. **Do not drop the legacy hash path on a schedule** - It can only be removed once no stored hash is still in the old format, and that depends on users signing in, not on a release.
