---
title: How to Build an OAuth 2.0 Token Introspection Endpoint
excerpt: Build a token introspection endpoint per RFC 7662 to validate tokens from resource servers.
tech: jose@5.0.0 bcryptjs@3.0.0
---

When a resource server receives an opaque token, it cannot verify the token locally. It needs a standard way to ask the authorization server whether the token is still active.

In this tutorial, you will build an RFC 7662 introspection endpoint that authenticates the caller, checks refresh tokens, verifies JWT access tokens, and returns the expected OAuth response shape.

## Define the Introspection Input

```ts {% path="app/lib/schemas/introspect.ts" %}
import * as s from "remix/data-schema";

export let IntrospectSchema = s.object({
	token: s.string(),
	token_type_hint: s.optional(s.enum_(["access_token", "refresh_token"])),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});
```

The endpoint accepts the token plus an optional `token_type_hint`. It also accepts `client_id` and `client_secret` so callers can authenticate in the request body when they are not using HTTP Basic authentication.

## Parse HTTP Basic Authentication

```ts {% path="app/lib/parse-basic-auth.ts" %}
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

This helper lets the route accept both authentication styles without duplicating parsing logic. It returns `null` for missing or malformed headers so the route can fall back to form fields.

## Return OAuth Errors

```ts {% path="app/lib/reject.ts" %}
import { json } from "@pkg/http/response";

export function reject(error: string, description: string, status: number = 400) {
	return json(
		{ error, error_description: description },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
```

Introspection returns OAuth errors only for malformed requests and client authentication failures. Unknown or expired tokens still return HTTP 200 (OK) with `{ active: false }`.

## Verify Client Secrets Securely

```ts {% path="app/models/client/secret.ts" %}
import bcrypt from "bcryptjs";

let TIMING_SAFE_DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

export default class Secret {
	static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
		let secrets = await db.findMany(Secret.table, {
			where: { client_id: clientId },
		});
		let now = new Date();

		let validSecrets = secrets.filter((secret) => {
			if (secret.expires_at && new Date(secret.expires_at) < now) return false;
			return true;
		});

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

		let match = comparisons.find((comparison) => comparison.isMatch);
		if (!match) return false;

		await db.update(Secret.table, { id: match.id }, { last_used_at: now.toISOString() });

		return true;
	}
}
```

The dummy hash keeps the failure path consistent when a client has no stored secrets. Comparing all non expired secrets in parallel also avoids leaking which secret matched first.

## Verify Access Tokens

```ts {% path="app/values/access-token.ts" %}
import { createLocalJWKSet, jwtVerify, type JWK } from "jose";

interface SigningKeyRecord {
	publicJwk: JWK;
}

interface VerifyOptions {
	issuer: string;
}

export default class AccessToken {
	static async verify(token: string, signingKeys: Array<SigningKeyRecord>, options: VerifyOptions) {
		let keySet = createLocalJWKSet({
			keys: signingKeys.map((signingKey) => signingKey.publicJwk),
		});

		let { payload } = await jwtVerify(token, keySet, {
			issuer: options.issuer,
		});

		return {
			audience: payload.aud ?? null,
			clientId:
				typeof payload.client_id === "string"
					? payload.client_id
					: typeof payload.aud === "string"
						? payload.aud
						: null,
			expiresAt: payload.exp ?? 0,
			issuedAt: payload.iat ?? 0,
			issuer: payload.iss ?? options.issuer,
			scope: typeof payload.scope === "string" ? payload.scope : undefined,
			subject: payload.sub ?? "",
		};
	}
}
```

This wrapper keeps JWT verification out of the route module. The route only needs normalized claims and can treat verification failures as inactive tokens.

## Create the Introspection Route

```ts {% path="app/routes/oauth.introspect.ts" %}
import { ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

import action from "~/lib/action";
import parseBasicAuth from "~/lib/parse-basic-auth";
import { reject } from "~/lib/reject";
import { IntrospectSchema } from "~/lib/schemas/introspect";
import Client from "~/models/client";
import Secret from "~/models/client/secret";
import TenantMeta from "~/models/tenant-meta";

export default action(async ({ db, formData, request, logger }) => {
	let log = logger.action("/oauth/introspect");
	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData) as Record<string, unknown>;

	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	let result = await validate(body, IntrospectSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { token, token_type_hint, client_id, client_secret } = result.data;
	if (!client_id || !client_secret) {
		return reject("invalid_client", "Client authentication required", 401);
	}

	let [client, issuer] = await Promise.all([Client.show(db, client_id), TenantMeta.getIssuer(db)]);

	if (!client) return reject("invalid_client", "Client not found", 401);

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	let headers = new Headers({ "Cache-Control": "no-store" });
	if (!issuer) return ok({ active: false }, { headers });

	log.info("Token introspection request", {
		clientId: client_id,
		tokenTypeHint: token_type_hint,
	});

	return ok({ active: false }, { headers });
});
```

Start with the authentication path and the inactive fallback. This gives you a valid RFC 7662 endpoint before adding token specific lookups.

## Check Refresh Tokens First

```ts {% path="app/routes/oauth.introspect.ts" %}
import Session from "~/models/session";

// ... previous code

if (token_type_hint !== "access_token") {
	let session = await Session.show(db, token);

	if (session && new Date(session.expires_at) > new Date()) {
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

// ... previous code
```

Check refresh tokens before JWT verification when the caller sends `refresh_token` or no hint at all. A valid session maps cleanly to the introspection response fields.

## Verify JWT Access Tokens

```ts {% path="app/routes/oauth.introspect.ts" %}
import SigningKey from "~/models/signing-key";
import AccessToken from "~/values/access-token";

// ... previous code

try {
	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) return ok({ active: false }, { headers });

	let accessToken = await AccessToken.verify(token, signingKeys, {
		issuer: `https://${issuer}`,
	});

	return ok(
		{
			active: true,
			sub: accessToken.subject,
			client_id: accessToken.clientId,
			exp: accessToken.expiresAt,
			iat: accessToken.issuedAt,
			iss: accessToken.issuer,
			aud: accessToken.audience,
			token_type: "Bearer",
			scope: accessToken.scope,
		},
		{ headers },
	);
} catch {
	return ok({ active: false }, { headers });
}

// ... previous code
```

Any JWT verification failure becomes an inactive response. That includes expired tokens, malformed tokens, and tokens signed with keys your server no longer trusts.

## Return the Complete Route

```ts {% path="app/routes/oauth.introspect.ts" %}
import { ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

import action from "~/lib/action";
import parseBasicAuth from "~/lib/parse-basic-auth";
import { reject } from "~/lib/reject";
import { IntrospectSchema } from "~/lib/schemas/introspect";
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

	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	let result = await validate(body, IntrospectSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { token, token_type_hint, client_id, client_secret } = result.data;
	if (!client_id || !client_secret) {
		return reject("invalid_client", "Client authentication required", 401);
	}

	let [client, issuer] = await Promise.all([Client.show(db, client_id), TenantMeta.getIssuer(db)]);
	if (!client) return reject("invalid_client", "Client not found", 401);

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	let headers = new Headers({ "Cache-Control": "no-store" });
	if (!issuer) return ok({ active: false }, { headers });

	log.info("Token introspection request", {
		clientId: client_id,
		tokenTypeHint: token_type_hint,
	});

	if (token_type_hint !== "access_token") {
		let session = await Session.show(db, token);

		if (session && new Date(session.expires_at) > new Date()) {
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

	try {
		let signingKeys = await SigningKey.getAll(db);
		if (signingKeys.length === 0) return ok({ active: false }, { headers });

		let accessToken = await AccessToken.verify(token, signingKeys, {
			issuer: `https://${issuer}`,
		});

		return ok(
			{
				active: true,
				sub: accessToken.subject,
				client_id: accessToken.clientId,
				exp: accessToken.expiresAt,
				iat: accessToken.issuedAt,
				iss: accessToken.issuer,
				aud: accessToken.audience,
				token_type: "Bearer",
				scope: accessToken.scope,
			},
			{ headers },
		);
	} catch {
		return ok({ active: false }, { headers });
	}
});
```

This final route follows the RFC flow closely. Authenticate the caller first, then try the token lookup, and fall back to `{ active: false }` when the token cannot be validated.

## Call the Introspection Endpoint

```ts {% path="app/lib/introspect-token.ts" %}
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

This is the client side of the protocol. Resource servers can cache successful responses briefly, but a long cache window delays revocation.

## Final Thoughts

Token introspection is useful when you need revocation checks or opaque tokens. The trade off is a network hop on each validation, so short lived caching often makes sense when the revocation window can tolerate it.
