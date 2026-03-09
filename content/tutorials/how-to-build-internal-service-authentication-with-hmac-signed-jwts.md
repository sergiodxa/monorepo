---
title: How to Build Internal Service Authentication with HMAC Signed JWTs
excerpt: Create secure service to service authentication using short lived HMAC signed tokens.
tech: "@cloudflare/workers-types@4.0.0"
---

Internal services often need authentication that is fast and fully offline. If your platform calls tenant Workers, Durable Objects, or private APIs, you usually want the receiving service to verify the request without a database lookup or a call to a token issuer.

This tutorial builds that flow with HMAC signed JWTs. You will create the crypto helpers, issue short lived tokens, verify them in middleware, and send extra request context as claims.

## Create the Crypto Helpers

```ts {% path="app/lib/crypto-utils.ts" %}
let textEncoder = new TextEncoder();
let textDecoder = new TextDecoder();

export function base64UrlEncode(input: string | Uint8Array): string {
	let bytes = typeof input === "string" ? textEncoder.encode(input) : input;
	let binary = "";

	for (let byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64UrlDecode(input: string): string {
	let padded = input.replace(/-/g, "+").replace(/_/g, "/");

	while (padded.length % 4 !== 0) {
		padded += "=";
	}

	let binary = atob(padded);
	let bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return textDecoder.decode(bytes);
}

export function constantTimeCompare(a: string, b: string): boolean {
	let result = a.length ^ b.length;
	let maxLength = Math.max(a.length, b.length);

	for (let i = 0; i < maxLength; i++) {
		result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}

	return result === 0;
}

export async function hmacSign(input: string, secret: string): Promise<string> {
	let key = await crypto.subtle.importKey(
		"raw",
		textEncoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	let signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(input));

	return base64UrlEncode(new Uint8Array(signature));
}
```

JWTs need base64url encoding for the header, payload, and signature. `constantTimeCompare` avoids leaking signature differences through timing, and `hmacSign` gives you the `HS256` signature for the final token.

## Create the Token Helpers

```ts {% path="app/lib/internal-auth.ts" %}
import { base64UrlDecode, base64UrlEncode, constantTimeCompare, hmacSign } from "./crypto-utils";

interface CreateInternalTokenOptions {
	tenantId?: string;
	action?: string;
	requestId?: string;
}

interface InternalTokenPayload {
	iss: string;
	purpose: string;
	iat: number;
	exp: number;
	tenantId?: string;
	action?: string;
	requestId?: string;
}

let INTERNAL_TOKEN_ISSUER = "auth-saas-platform";
let INTERNAL_TOKEN_PURPOSE = "internal-api";
let INTERNAL_TOKEN_TTL = 60 * 5;

export async function createInternalToken(
	secret: string,
	options: CreateInternalTokenOptions = {},
): Promise<string> {
	let now = Math.floor(Date.now() / 1000);
	let header = { alg: "HS256", typ: "JWT" };
	let payload: InternalTokenPayload = {
		iss: INTERNAL_TOKEN_ISSUER,
		purpose: INTERNAL_TOKEN_PURPOSE,
		iat: now,
		exp: now + INTERNAL_TOKEN_TTL,
		...options,
	};

	let encodedHeader = base64UrlEncode(JSON.stringify(header));
	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signingInput = `${encodedHeader}.${encodedPayload}`;
	let signature = await hmacSign(signingInput, secret);

	return `${signingInput}.${signature}`;
}

export async function verifyInternalToken(
	token: string,
	secret: string,
): Promise<InternalTokenPayload | null> {
	let parts = token.split(".");
	if (parts.length !== 3) return null;

	let encodedHeader = parts[0];
	let encodedPayload = parts[1];
	let signature = parts[2];
	if (!encodedHeader || !encodedPayload || !signature) return null;

	let signingInput = `${encodedHeader}.${encodedPayload}`;
	let expectedSignature = await hmacSign(signingInput, secret);
	if (!constantTimeCompare(signature, expectedSignature)) return null;

	let parsed: unknown;

	try {
		parsed = JSON.parse(base64UrlDecode(encodedPayload));
	} catch {
		return null;
	}

	if (typeof parsed !== "object" || parsed === null) return null;

	let payload = parsed as Record<string, unknown>;
	let now = Math.floor(Date.now() / 1000);

	if (payload.iss !== INTERNAL_TOKEN_ISSUER) return null;
	if (payload.purpose !== INTERNAL_TOKEN_PURPOSE) return null;
	if (typeof payload.iat !== "number") return null;
	if (typeof payload.exp !== "number") return null;
	if (payload.exp <= now) return null;

	return payload as InternalTokenPayload;
}
```

This file gives you both sides of the flow. `createInternalToken` builds a short lived JWT, and `verifyInternalToken` returns the parsed payload only when the structure, signature, and claims are valid.

## Protect Internal Routes

```ts {% path="app/tenant/middleware/management-auth.ts" %}
import { env } from "cloudflare:workers";

import { verifyInternalToken } from "~/lib/internal-auth";

export default function managementAuth() {
	return async function middleware(context, next) {
		let log = context.logger.middleware("management-auth");
		let internalToken = context.request.headers.get("x-internal-token");

		if (!internalToken) {
			return new Response("Unauthorized", { status: 401 });
		}

		let payload = await verifyInternalToken(internalToken, env.INTERNAL_SECRET);

		if (!payload) {
			log.info("Rejected internal request with invalid token");
			return new Response("Unauthorized", { status: 401 });
		}

		log.info("Authenticated internal request", {
			issuer: payload.iss,
			action: payload.action,
			requestId: payload.requestId,
		});

		context.internalAuth = payload;

		return next();
	};
}
```

The middleware reads the token from `x-internal-token` and verifies it with the shared secret. When verification succeeds, you can store the payload on the request context and reuse the claims later in the route module.

## Send Tokens from the Calling Service

```ts {% path="app/services/tenant-api.ts" %}
import { env } from "cloudflare:workers";

import { createInternalToken } from "~/lib/internal-auth";

export async function callTenantApi(tenantId: string, endpoint: string) {
	let token = await createInternalToken(env.INTERNAL_SECRET, {
		tenantId,
		action: endpoint,
		requestId: crypto.randomUUID(),
	});

	let response = await fetch(`https://tenant-${tenantId}.internal/${endpoint}`, {
		headers: {
			"content-type": "application/json",
			"x-internal-token": token,
		},
	});

	return response.json();
}
```

Create a new token for every request. That keeps the flow stateless, and the short expiration limits replay risk if one token leaks.

## Read Claims in the Receiving Service

```ts {% path="app/routes/api.users-create.ts" %}
import type { Route } from "./+types/api.users-create";

export async function action({ context }: Route.ActionArgs) {
	let internalAuth = context.internalAuth;

	if (!internalAuth) {
		return new Response("Unauthorized", { status: 401 });
	}

	return Response.json({
		ok: true,
		tenantId: internalAuth.tenantId,
		action: internalAuth.action,
		requestId: internalAuth.requestId,
	});
}
```

Custom claims let the receiving service understand why the request exists without extra headers or query params. They also improve audit logs because the middleware and the route module can use the same request metadata.

## Final Thoughts

HMAC signed JWTs work well when the same team controls both services and can safely share one secret. They give you fast verification and simple deployment, but the trade-off is that every verifier must know the signing key. If that becomes a problem, move to an asymmetric signing scheme instead.

For user facing authentication where you need public key verification, see [creating type safe JWT wrapper classes](/tutorials/create-type-safe-jwt-wrapper-classes). For external API authentication with stored credentials, explore [API key authentication with SHA 256](/tutorials/implement-api-key-authentication-with-sha-256).
