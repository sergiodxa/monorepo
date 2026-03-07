---
title: How to Implement OIDC Discovery Endpoints
excerpt: Create well-known endpoints for OpenID Connect discovery and JWKS.
tech: "@edgefirst-dev/jwt@1.0.0"
---

When building an OpenID Connect provider, clients need a way to discover your server's capabilities and endpoints. Instead of hardcoding URLs and configurations, OIDC defines a standard discovery mechanism using well-known URLs. This allows clients to automatically configure themselves by fetching a single JSON document.

The discovery mechanism consists of two main endpoints: `/.well-known/openid-configuration` for server metadata, and `/.well-known/jwks.json` for the public keys used to verify tokens. Together, these endpoints enable zero-configuration client setup and dynamic key rotation.

## Create the OpenID Configuration Endpoint

The `/.well-known/openid-configuration` endpoint returns a JSON document describing your OpenID Provider. Clients fetch this document to discover supported features, endpoints, and configuration options.

```ts {% path="app/controllers/discover/oidc.ts" %}
export async function handleOIDCDiscovery(request: Request) {
	let issuer = new URL(request.url).origin;

	let configuration = {
		// Required fields
		issuer: issuer,
		authorization_endpoint: `${issuer}/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		jwks_uri: `${issuer}/.well-known/jwks.json`,
		response_types_supported: ["code"],
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["ES256"],
	};

	return new Response(JSON.stringify(configuration), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

The `issuer` field is critical: it must exactly match the `iss` claim in tokens you issue. Most implementations derive it from the request URL, ensuring consistency across different deployment environments.

## Add Optional Configuration Fields

The OIDC Discovery spec defines several required fields, but you should add optional fields based on your provider's capabilities.

```ts {% path="app/controllers/discover/oidc.ts" %}
let configuration = {
	// Required fields
	issuer: issuer,
	authorization_endpoint: `${issuer}/authorize`,
	token_endpoint: `${issuer}/oauth/token`,
	jwks_uri: `${issuer}/.well-known/jwks.json`,
	response_types_supported: ["code"],
	subject_types_supported: ["public"],
	id_token_signing_alg_values_supported: ["ES256"],

	// Recommended fields
	userinfo_endpoint: `${issuer}/userinfo`,
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

	// Grant types and authentication methods
	grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
	token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],

	// Response modes
	response_modes_supported: ["query", "fragment", "form_post"],

	// PKCE support
	code_challenge_methods_supported: ["S256", "plain"],

	// Session management
	end_session_endpoint: `${issuer}/oidc/logout`,

	// Token management
	revocation_endpoint: `${issuer}/oauth/revoke`,
	revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
	introspection_endpoint: `${issuer}/oauth/introspect`,
	introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

	// Advanced options
	request_parameter_supported: false,
	request_uri_parameter_supported: false,
	acr_values_supported: ["urn:passkey"],
};
```

Be accurate about what you support. Advertising capabilities you don't actually implement will cause client failures. For example, if you only support PKCE with S256, don't include `"plain"` in `code_challenge_methods_supported`.

## Create the OAuth 2.0 Metadata Endpoint

OAuth 2.0 defines a similar but distinct metadata endpoint at `/.well-known/oauth-authorization-server`. While OIDC clients use the openid-configuration endpoint, pure OAuth clients might look for this one instead.

```ts {% path="app/controllers/discover/oauth.ts" %}
export async function handleOAuthMetadata(request: Request) {
	let issuer = new URL(request.url).origin;

	let metadata = {
		issuer: issuer,
		authorization_endpoint: `${issuer}/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		jwks_uri: `${issuer}/.well-known/jwks.json`,

		response_types_supported: ["code"],
		response_modes_supported: ["query", "fragment", "form_post"],
		grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
		token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],

		code_challenge_methods_supported: ["S256", "plain"],
		scopes_supported: ["openid", "profile", "email", "offline_access"],

		revocation_endpoint: `${issuer}/oauth/revoke`,
		revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

		introspection_endpoint: `${issuer}/oauth/introspect`,
		introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

		token_endpoint_auth_signing_alg_values_supported: ["ES256"],
		service_documentation: `${issuer}/docs`,
		ui_locales_supported: ["en"],
	};

	return new Response(JSON.stringify(metadata), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

The OAuth metadata omits OIDC specific fields like `userinfo_endpoint` and `claims_supported`, but includes useful additions like `service_documentation` and `ui_locales_supported`.

## Create the JWKS Endpoint

The JSON Web Key Set endpoint at `/.well-known/jwks.json` publishes your public keys. Clients use these keys to verify the signatures on tokens you issue. This endpoint is critical for token validation and enables key rotation without client coordination.

```ts {% path="app/controllers/discover/jwks.ts" %}
import { JWK } from "@edgefirst-dev/jwt";

export async function handleJWKS(db: Database) {
	let signingKeys = await getSigningKeys(db);

	if (signingKeys.length === 0) {
		return new Response(JSON.stringify({ keys: [] }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	}

	let jwks = JWK.toJSON(signingKeys);

	return new Response(JSON.stringify(jwks), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

The response contains a `keys` array where each element is a JWK (JSON Web Key) object. For ES256 keys, a typical JWK looks like this:

```json
{
	"keys": [
		{
			"kty": "EC",
			"crv": "P-256",
			"x": "base64url-encoded-x-coordinate",
			"y": "base64url-encoded-y-coordinate",
			"kid": "key-identifier-123",
			"use": "sig",
			"alg": "ES256"
		}
	]
}
```

The `kid` (key ID) field is essential. When you issue a token, include the `kid` in the JWT header. Clients then use this ID to select the correct key from your JWKS for verification.

## Support Key Rotation

One of the main benefits of JWKS is seamless key rotation. You can have multiple active keys, with one designated for signing new tokens while older keys remain available for verification.

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
	// Return the most recently created active key for signing
	return keys[0];
}
```

When rotating keys, follow this process: create a new key, add it to JWKS, wait for caches to clear, start signing with the new key, and eventually remove old keys. The cache time on your JWKS endpoint determines the minimum rotation window.

## Configure Caching

Discovery endpoints are fetched frequently, so caching is important for performance. The `Cache-Control: public, max-age=3600` header tells clients and CDNs to cache the response for one hour.

```ts
headers: {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600",
}
```

Choose your cache duration carefully: too short and you create excessive load on your server, too long and you delay propagation of configuration changes.

One hour is a reasonable default. If you need to push urgent changes (like revoking a compromised key), consider adding a purge mechanism for your CDN cache.

## Handle Dynamic Issuer Configuration

For multi-tenant deployments where each tenant has their own issuer URL, make the issuer configurable:

```ts {% path="app/controllers/discover/oidc.ts" %}
export async function handleOIDCDiscovery(request: Request, db: Database) {
	// Try to get configured issuer, fall back to request host
	let issuer = await getConfiguredIssuer(db);
	if (!issuer) {
		issuer = new URL(request.url).host;
	}

	let baseUrl = `https://${issuer}`;

	let configuration = {
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/authorize`,
		// ... rest of configuration
	};

	return new Response(JSON.stringify(configuration), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

This approach lets tenants use custom domains while ensuring the issuer in discovery matches the issuer in tokens.

## Test Your Discovery Endpoints

Before deploying, verify your endpoints return valid responses. Use curl to fetch the configuration:

```bash
curl -s https://your-provider.com/.well-known/openid-configuration | jq .
```

Check that all required fields are present, all URLs are absolute and use HTTPS, the `issuer` exactly matches your token's `iss` claim, and all advertised capabilities are actually implemented.

For JWKS, verify the keys can be used for verification:

```bash
curl -s https://your-provider.com/.well-known/jwks.json | jq .
```

Confirm that each key has a `kid`, the `alg` matches your tokens, and `use` is `"sig"` for signing keys.

## Consume Discovery Endpoints from Clients

Clients consume these endpoints during initialization. Here's how a client might use discovery:

```ts {% path="app/lib/oidc-client.ts" %}
async function configureOIDCClient(issuerUrl: string) {
	// Fetch provider configuration
	let configResponse = await fetch(`${issuerUrl}/.well-known/openid-configuration`);
	let config = await configResponse.json();

	// Fetch public keys for token verification
	let jwksResponse = await fetch(config.jwks_uri);
	let jwks = await jwksResponse.json();

	return {
		authorizationEndpoint: config.authorization_endpoint,
		tokenEndpoint: config.token_endpoint,
		userinfoEndpoint: config.userinfo_endpoint,
		endSessionEndpoint: config.end_session_endpoint,
		publicKeys: jwks.keys,
		supportedScopes: config.scopes_supported,
		supportedResponseTypes: config.response_types_supported,
	};
}
```

This dynamic configuration means clients can work with any compliant provider without code changes.

## Final Thoughts

OIDC discovery endpoints are the foundation of interoperable authentication. By implementing `/.well-known/openid-configuration` and `/.well-known/jwks.json`, you enable automatic client configuration and secure token verification. Be honest about your capabilities, keep your keys rotated, and cache appropriately.

For the complete picture of building an OAuth2/OIDC provider, see [building an OAuth2/OIDC provider from scratch](/tutorials/build-an-oauth2-oidc-provider-from-scratch). For verifying authorization codes with PKCE, check out [implementing PKCE code challenge verification](/tutorials/implement-pkce-code-challenge-verification).
