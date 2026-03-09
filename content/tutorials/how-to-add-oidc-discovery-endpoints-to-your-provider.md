---
title: How to Add OIDC Discovery Endpoints to Your Provider
excerpt: Publish OIDC metadata, OAuth metadata, and JWKS endpoints for your provider.
tech: "@edgefirst-dev/jwt@1.0.0"
---

OpenID Connect clients expect to bootstrap themselves from well known endpoints. If your provider does not publish them, every client has to hardcode your URLs, supported grants, and signing keys.

This tutorial adds the three endpoints most clients need: `/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, and `/.well-known/jwks.json`. The result is a provider that clients can configure automatically and keep working through key rotation.

## Create a Shared JSON Response Helper

```ts {% path="app/lib/json.ts" %}
interface JsonResponseOptions {
	status?: number;
}

let CACHE_CONTROL = "public, max-age=3600";

export function json(data: unknown, options: JsonResponseOptions = {}) {
	return new Response(JSON.stringify(data), {
		status: options.status ?? 200,
		headers: {
			"Cache-Control": CACHE_CONTROL,
			"Content-Type": "application/json",
		},
	});
}
```

All three endpoints return cacheable JSON. A small helper keeps the examples focused on the metadata instead of repeating headers.

## Publish the OIDC Metadata Document

```ts {% path="app/controllers/discover/oidc.ts" %}
import { json } from "~/lib/json";

export async function handleOIDCDiscovery(request: Request) {
	let issuer = new URL(request.url).origin;

	return json({
		issuer,
		authorization_endpoint: `${issuer}/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		userinfo_endpoint: `${issuer}/userinfo`,
		jwks_uri: `${issuer}/.well-known/jwks.json`,
		end_session_endpoint: `${issuer}/oidc/logout`,
		response_types_supported: ["code"],
		response_modes_supported: ["query", "form_post"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["ES256"],
		scopes_supported: ["openid", "profile", "email", "offline_access"],
		claims_supported: [
			"sub",
			"iss",
			"aud",
			"exp",
			"iat",
			"auth_time",
			"nonce",
			"name",
			"preferred_username",
			"email",
			"email_verified",
			"picture",
		],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
		revocation_endpoint: `${issuer}/oauth/revoke`,
		revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
		introspection_endpoint: `${issuer}/oauth/introspect`,
		introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
	});
}
```

This is the document most OIDC clients load first. Keep every advertised capability honest. If you only support `S256` for PKCE, do not list `plain`.

## Publish the JWKS Document

```ts {% path="app/controllers/discover/jwks.ts" %}
import { JWK } from "@edgefirst-dev/jwt";
import { json } from "~/lib/json";
import { getSigningKeys } from "~/models/signing-key";

export async function handleJWKS(db: Database) {
	let signingKeys = await getSigningKeys(db);

	if (signingKeys.length === 0) {
		return json({ keys: [] });
	}

	let jwks = JWK.toJSON(signingKeys);

	return json(jwks);
}
```

The JWKS endpoint publishes the public half of your signing keys. Clients match the JWT header `kid` to one of these keys during verification.

## Add the OAuth Metadata Endpoint

```ts {% path="app/controllers/discover/oauth.ts" %}
import { json } from "~/lib/json";

export async function handleOAuthMetadata(request: Request) {
	let issuer = new URL(request.url).origin;

	return json({
		issuer,
		authorization_endpoint: `${issuer}/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		jwks_uri: `${issuer}/.well-known/jwks.json`,
		response_types_supported: ["code"],
		response_modes_supported: ["query", "form_post"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
		code_challenge_methods_supported: ["S256"],
		scopes_supported: ["openid", "profile", "email", "offline_access"],
		revocation_endpoint: `${issuer}/oauth/revoke`,
		revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
		introspection_endpoint: `${issuer}/oauth/introspect`,
		introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
	});
}
```

Pure OAuth clients may never request the OIDC document. Publishing both endpoints keeps your authorization server usable for both client types.

## Keep Old Keys Available During Rotation

```ts {% path="app/models/signing-key.ts" %}
export async function getSigningKeys(db: Database) {
	let keys = await db.query.signingKeys.findMany({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.status, "active"),
				operators.lte(fields.activatedAt, new Date()),
			);
		},
		orderBy(fields, operators) {
			return operators.desc(fields.createdAt);
		},
	});

	return keys;
}

export async function getCurrentSigningKey(db: Database) {
	let keys = await getSigningKeys(db);
	return keys[0];
}
```

Rotation works because the JWKS can publish more than one active key. Sign new tokens with the newest key, but leave older public keys in the document until issued tokens have expired and caches have cleared.

## Support a Configured Issuer

```ts {% path="app/controllers/discover/oidc.ts" %}
import { json } from "~/lib/json";
import { getConfiguredIssuer } from "~/models/issuer";

// ... previous code

export async function handleOIDCDiscovery(request: Request, db: Database) {
	let configuredIssuer = await getConfiguredIssuer(db);
	let issuer = configuredIssuer ?? new URL(request.url).origin;

	return json({
		issuer,
		authorization_endpoint: `${issuer}/authorize`,
		// ... previous code
	});
}
```

This matters for custom domains and multi tenant setups. The `issuer` in discovery must exactly match the `iss` claim you put in tokens.

## Verify the Endpoints

```bash {% path="scripts/verify-oidc-discovery.sh" %}
curl -s https://your-provider.com/.well-known/openid-configuration | jq .
curl -s https://your-provider.com/.well-known/oauth-authorization-server | jq .
curl -s https://your-provider.com/.well-known/jwks.json | jq .
```

Check that every URL is absolute, every advertised feature is implemented, and each JWK includes a stable `kid`. The quickest way to break client discovery is to publish metadata that does not match your real server behavior.

## Final Thoughts

You now have the discovery surface an OIDC provider needs for client bootstrap and token verification. From here, you can extend the provider with [PKCE code challenge verification](/tutorials/implement-pkce-code-challenge-verification) or continue with [building an OAuth2/OIDC provider from scratch](/tutorials/build-an-oauth2-oidc-provider-from-scratch).
