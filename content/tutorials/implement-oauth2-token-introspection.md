---
title: How to Implement OAuth 2.0 Token Introspection
excerpt: Build a token introspection endpoint per RFC 7662 to validate tokens from resource servers.
tech: jose@5.0.0 bcryptjs@3.0.0
---

When you issue access tokens as JWTs, resource servers can validate them locally by verifying the signature and checking claims. But what happens when you need to check if a token has been revoked, or when the token is opaque rather than a JWT? Token introspection solves this by providing a standard endpoint where resource servers can query the authorization server about a token's current state.

RFC 7662 defines the OAuth 2.0 Token Introspection specification. It establishes a simple protocol where clients send a token to the authorization server and receive back metadata about that token, including whether it is currently active.

## Define the Request Schema

Start by defining what parameters the introspection endpoint accepts. RFC 7662 specifies a `token` parameter (required) and a `token_type_hint` parameter (optional):

```ts {% path="lib/schemas/introspect.ts" %}
import * as s from "remix/data-schema";

let IntrospectSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"])),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});
```

The `token` field contains the actual token to introspect. The `token_type_hint` helps the authorization server optimize its lookup by checking the hinted token type first. The `client_id` and `client_secret` fields support form body authentication as an alternative to HTTP Basic Authentication.

## Parse HTTP Basic Authentication

Clients typically authenticate to the introspection endpoint using HTTP Basic Authentication. The client ID and secret are base64 encoded in the `Authorization` header:

```ts {% path="lib/parse-basic-auth.ts" %}
export default function parseBasicAuth(
	header: string | null,
): { clientId: string; clientSecret: string } | null {
	if (!header || !header.startsWith("Basic ")) return null;

	try {
		let encoded = header.slice(6);
		let decoded = atob(encoded);
		let [clientId, clientSecret] = decoded.split(":");
		if (!clientId || !clientSecret) return null;
		return {
			clientId: decodeURIComponent(clientId),
			clientSecret: decodeURIComponent(clientSecret),
		};
	} catch {
		return null;
	}
}
```

The function extracts the base64 encoded portion after "Basic ", decodes it, and splits on the colon separator. The `decodeURIComponent` calls handle percent encoded characters that might appear in client IDs or secrets per RFC 6749.

## Build the Introspection Endpoint

Now build the main introspection endpoint. The endpoint handles both authentication methods, validates the client credentials, and returns appropriate responses:

```ts {% path="controllers/oauth/introspect.ts" %}
import { ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

import action from "~/lib/action";
import parseBasicAuth from "~/lib/parse-basic-auth";
import { reject } from "~/lib/reject";
import Client from "~/models/client";
import Secret from "~/models/client/secret";
import Session from "~/models/session";
import SigningKey from "~/models/signing-key";
import TenantMeta from "~/models/tenant-meta";
import AccessToken from "~/values/access-token";

export default action(async ({ db, formData, request, logger }) => {
	let log = logger.action("/oauth/introspect");

	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData) as Record<string, unknown>;

	// Support both Basic Auth and form body authentication
	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	let result = await validate(body, IntrospectSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters");
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { token, token_type_hint, client_id, client_secret } = result.data;

	log.info("Token introspection request", {
		clientId: client_id,
		tokenTypeHint: token_type_hint,
	});

	// Client authentication is required for introspection
	if (!client_id || !client_secret) {
		log.info("Client authentication missing");
		return reject("invalid_client", "Client authentication required", 401);
	}

	let [client, issuer] = await Promise.all([Client.show(db, client_id), TenantMeta.getIssuer(db)]);

	if (!client) {
		log.info("Client not found", { clientId: client_id });
		return reject("invalid_client", "Client not found", 401);
	}

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.info("Invalid client credentials", { clientId: client_id });
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	// Continue with token validation...
});
```

Client authentication happens before any token lookup. This prevents unauthenticated parties from learning whether arbitrary tokens exist in your system.

## Handle the Inactive Token Response

RFC 7662 requires that the introspection endpoint return `{ "active": false }` for any token that cannot be validated. This includes expired tokens, revoked tokens, malformed tokens, and tokens the authorization server does not recognize:

```ts {% path="controllers/oauth/introspect.ts" %}
let headers = new Headers();
headers.set("Cache-Control", "no-store");

// If issuer is not configured, we cannot validate tokens
if (!issuer) {
	log.info("Issuer not configured, token inactive", { clientId: client_id });
	return ok({ active: false }, { headers });
}
```

The `Cache-Control: no-store` header is important. Introspection responses must never be cached because token status can change at any time.

## Introspect Refresh Tokens

If the token type hint suggests a refresh token (or no hint is provided), check if the token matches a valid session:

```ts {% path="controllers/oauth/introspect.ts" %}
if (token_type_hint !== "access_token") {
	let session = await Session.show(db, token);
	if (session && new Date(session.expires_at) > new Date()) {
		log.info("Refresh token introspected successfully", {
			clientId: client_id,
			sessionId: session.id,
			subjectId: session.subject_id,
		});

		return ok(
			{
				active: true,
				sub: session.subject_id,
				client_id: session.client_id,
				exp: Math.floor(new Date(session.expires_at).getTime() / 1000),
				iat: Math.floor(new Date(session.created_at).getTime() / 1000),
				iss: `https://${issuer}`,
				aud: session.client_id,
				token_type: "Bearer",
			},
			{ headers },
		);
	}
}
```

When a refresh token is valid, the response includes standard JWT claims (`sub`, `exp`, `iat`, `iss`, `aud`) plus the `token_type` field. These claims let the resource server make authorization decisions without needing to decode the token itself.

## Introspect Access Tokens

Access tokens are typically JWTs that can be verified cryptographically. The introspection endpoint verifies the signature and extracts claims:

```ts {% path="controllers/oauth/introspect.ts" %}
try {
	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		log.info("No signing keys configured, token inactive", {
			clientId: client_id,
		});
		return ok({ active: false }, { headers });
	}

	let accessToken = await AccessToken.verify(token, signingKeys, {
		issuer: `https://${issuer}`,
	});

	log.info("Access token introspected successfully", {
		clientId: client_id,
		subjectId: accessToken.subject,
		scope: accessToken.scope,
	});

	return ok(
		{
			active: true,
			sub: accessToken.subject,
			client_id: accessToken.audience as string,
			exp: Math.floor(accessToken.expiresIn / 1000),
			iat: Math.floor(accessToken.issuedAt.getTime() / 1000),
			iss: accessToken.issuer,
			aud: accessToken.audience,
			token_type: "Bearer",
			scope: accessToken.scope,
		},
		{ headers },
	);
} catch {
	log.info("Token invalid or expired", { clientId: client_id });
	return ok({ active: false }, { headers });
}
```

The `try/catch` block is essential. Any verification failure (expired token, invalid signature, malformed JWT) results in an inactive response, not an error. RFC 7662 is explicit about this: the endpoint returns `{ "active": false }` rather than error codes for unrecognized tokens.

## Create the Access Token Value Object

The access token verification uses a value object that wraps JWT operations:

```ts {% path="values/access-token.ts" %}
import { JWT } from "@edgefirst-dev/jwt";

const ACCESS_TOKEN_TTL = 60 * 60 * 1000; // 1 hour

export default class AccessToken extends JWT {
	override get id() {
		return this.parser.string("jti");
	}

	override get audience(): string | string[] | null {
		let aud = this.payload.aud;
		if (Array.isArray(aud)) return aud;
		if (typeof aud === "string") return aud;
		return null;
	}

	override get expiresIn() {
		return this.parser.number("exp");
	}

	override get issuedAt() {
		return new Date(this.parser.number("iat") * 1000);
	}

	override get issuer() {
		return this.parser.string("iss");
	}

	override get subject() {
		return this.parser.string("sub");
	}

	get scope() {
		return this.parser.string("scope");
	}

	static generate(
		issuer: string,
		audience: string | string[],
		subjectId: string,
		scope?: string[],
	) {
		let now = Math.floor(Date.now() / 1000);
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: audience,
			exp: expiresAt,
			iat: now,
			iss: issuer,
			jti: crypto.randomUUID(),
			nbf: now,
			sub: subjectId,
			...(scope && { scope: scope.join(" ") }),
		});
	}

	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
```

This value object provides type safe access to JWT claims and encapsulates token generation logic. The `scope` claim follows OAuth 2.0 conventions: a space separated list of scope values.

## Implement Secure Client Secret Verification

Client credentials must be verified securely. Use bcrypt for password hashing and implement timing attack prevention:

```ts {% path="models/client/secret.ts" %}
import bcrypt from "bcryptjs";

const TIMING_SAFE_DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

export default class Secret {
	static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
		let secrets = await db.findMany(Secret.table, {
			where: { client_id: clientId },
		});
		let now = new Date();

		let validSecrets = secrets.filter((secret) => {
			if (secret.expires_at && new Date(secret.expires_at) < now) {
				return false;
			}
			return true;
		});

		// Prevent timing attacks by always performing a comparison
		if (validSecrets.length === 0) {
			await bcrypt.compare(plainSecret, TIMING_SAFE_DUMMY_HASH);
			return false;
		}

		let comparisons = await Promise.all(
			validSecrets.map(async (secret) => ({
				id: secret.id,
				isMatch: await bcrypt.compare(plainSecret, secret.secret_hash),
			})),
		);

		let match = comparisons.find((c) => c.isMatch);

		if (match) {
			await db.update(
				Secret.table,
				{ id: match.id },
				{
					last_used_at: now.toISOString(),
				},
			);
			return true;
		}

		return false;
	}
}
```

Two security measures are important here. First, the dummy hash comparison when no secrets exist prevents attackers from detecting whether a client has any secrets configured. Second, all valid secrets are compared in parallel to prevent timing attacks that might reveal which position the valid secret occupies.

## Create the Error Response Helper

When client authentication fails or the request is malformed, return OAuth 2.0 error responses:

```ts {% path="lib/reject.ts" %}
import { json } from "@pkg/http/response";

export function reject(error: string, description: string, status: number = 400) {
	return json(
		{ error, error_description: description },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
```

Common error codes for the introspection endpoint include `invalid_request` (malformed request), `invalid_client` (authentication failure), and `unauthorized_client` (client not authorized to introspect).

## Call the Introspection Endpoint

Resource servers call the introspection endpoint when they receive a token:

```ts {% path="lib/introspect-token.ts" %}
async function introspectToken(
	token: string,
	clientId: string,
	clientSecret: string,
	introspectionUrl: string,
): Promise<{ active: boolean; sub?: string; scope?: string }> {
	let credentials = btoa(`${clientId}:${clientSecret}`);

	let response = await fetch(introspectionUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${credentials}`,
		},
		body: new URLSearchParams({ token }),
	});

	if (!response.ok) {
		throw new Error(`Introspection failed: ${response.status}`);
	}

	return response.json();
}
```

The resource server should cache introspection results briefly (a few seconds) to avoid hammering the authorization server on every request. However, be careful not to cache for too long, or revoked tokens might still be accepted.

## Final Thoughts

Token introspection provides a standardized way for resource servers to validate tokens without sharing signing keys. The authorization server maintains full control over token lifecycle: it can revoke tokens immediately and all resource servers will see the revocation on their next introspection request.

For high traffic scenarios, consider adding a short lived cache layer between your resource servers and the introspection endpoint. Even a 5 second cache can dramatically reduce load while keeping revocation latency acceptable for most applications.
