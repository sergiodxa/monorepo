---
title: How to Build Internal Service Authentication with HMAC Signed JWTs
excerpt: Create secure service to service authentication using short lived HMAC signed tokens.
tech: "@cloudflare/workers-types@4.0.0"
---

When building distributed systems, you often need services to communicate securely with each other. While OAuth2 access tokens work well for user facing APIs, internal service communication needs something simpler and faster. You do not want to hit a database or call an external service just to validate that your own backend services are talking to each other.

HMAC signed JWTs solve this problem elegantly. Both services share a secret key, one service creates a signed token, and the other verifies it without any network calls. The token is self contained, cryptographically secure, and can include metadata about the request. This pattern is particularly useful for platform to Durable Object communication, microservice architectures, and internal API calls where you need to prove the request originated from a trusted service.

## Understand HMAC Signatures

HMAC (Hash based Message Authentication Code) combines a secret key with a hash function to create a signature. Unlike asymmetric algorithms like RS256 or ES256, HMAC uses the same key for both signing and verification. This makes it fast and simple, perfect for internal services that can securely share a secret.

The security of HMAC comes from two properties: only someone with the secret key can create a valid signature, and any change to the signed data produces a completely different signature. An attacker who intercepts a token cannot modify it without invalidating the signature, and they cannot create new tokens without knowing the secret.

## Sign Data with HMAC SHA256

Start with a utility function that signs data using the Web Crypto API. This works in Cloudflare Workers, Node.js, and browsers.

```ts {% path="app/lib/crypto-utils.ts" %}
export async function hmacSign(input: string, secret: string): Promise<string> {
	if (!secret || secret.length === 0) {
		throw new Error("HMAC secret is required");
	}

	let encoder = new TextEncoder();
	let key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	let signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));

	return base64UrlEncode(new Uint8Array(signature));
}
```

The function imports the secret as an HMAC key, signs the input data, and returns the signature as a base64url encoded string. Base64url encoding is important for JWTs because it produces URL safe characters without padding.

## Encode and Decode Base64url

JWTs use base64url encoding, which replaces characters that have special meaning in URLs. Add these helper functions:

```ts {% path="app/lib/crypto-utils.ts" %}
export function base64UrlEncode(input: string | Uint8Array): string {
	let str: string;
	if (typeof input === "string") {
		str = btoa(unescape(encodeURIComponent(input)));
	} else {
		str = btoa(String.fromCharCode(...input));
	}
	return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64UrlDecode(input: string): string {
	let str = input.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return decodeURIComponent(escape(atob(str)));
}
```

The encode function handles both strings and byte arrays, converting them to base64 and then replacing `+` with `-`, `/` with `_`, and removing padding. The decode function reverses this process.

## Prevent Timing Attacks with Constant Time Comparison

When verifying signatures, you must compare them in constant time. A naive string comparison leaks information through timing: comparing `"abc"` with `"xyz"` returns faster than comparing `"abc"` with `"abd"` because the first fails immediately while the second matches two characters before failing.

```ts {% path="app/lib/crypto-utils.ts" %}
export function constantTimeCompare(a: string, b: string): boolean {
	let result = a.length ^ b.length;
	let maxLength = Math.max(a.length, b.length);
	for (let i = 0; i < maxLength; i++) {
		result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}
	return result === 0;
}
```

This function XORs every character position, accumulating differences in `result`. It always processes all characters regardless of where they differ, taking the same amount of time whether strings match or not. The length check at the start is also constant time because XOR produces 0 only for equal values.

## Create Internal Authentication Tokens

Now combine these primitives to create HMAC signed JWTs for internal authentication:

```ts {% path="app/lib/internal-auth.ts" %}
import { base64UrlEncode, base64UrlDecode, constantTimeCompare, hmacSign } from "./crypto-utils";

export async function createInternalToken(secret: string): Promise<string> {
	let header = { alg: "HS256", typ: "JWT" };
	let payload = {
		iss: "auth-saas-platform",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 300,
		purpose: "internal-api",
	};

	let encodedHeader = base64UrlEncode(JSON.stringify(header));
	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signingInput = `${encodedHeader}.${encodedPayload}`;

	let signature = await hmacSign(signingInput, secret);

	return `${signingInput}.${signature}`;
}
```

The function creates a standard JWT with three parts: header, payload, and signature. The header declares the algorithm (`HS256` for HMAC SHA256) and type (`JWT`). The payload includes standard claims:

- `iss` (issuer): Identifies the service that created the token
- `iat` (issued at): Unix timestamp when the token was created
- `exp` (expiration): Unix timestamp when the token expires
- `purpose`: A custom claim to identify the token's intended use

The token expires after 5 minutes (300 seconds). Short expiration times minimize the damage if a token is compromised. For internal service calls that complete in milliseconds, 5 minutes provides plenty of margin while limiting exposure.

## Verify Internal Tokens

The verification function checks the signature, parses the payload, and validates all claims:

```ts {% path="app/lib/internal-auth.ts" %}
export async function verifyInternalToken(token: string, secret: string): Promise<boolean> {
	let parts = token.split(".");
	if (parts.length !== 3) return false;

	let encodedHeader = parts[0];
	let encodedPayload = parts[1];
	let signature = parts[2];

	if (!encodedHeader || !encodedPayload || !signature) return false;

	// Verify signature using constant time comparison
	let signingInput = `${encodedHeader}.${encodedPayload}`;
	let expectedSignature = await hmacSign(signingInput, secret);

	if (!constantTimeCompare(signature, expectedSignature)) return false;

	// Parse and validate payload
	try {
		let parsed: unknown;
		try {
			parsed = JSON.parse(base64UrlDecode(encodedPayload));
		} catch {
			return false;
		}

		// Validate payload structure
		if (typeof parsed !== "object" || parsed === null) return false;

		let payload = parsed as Record<string, unknown>;

		// Check issuer
		if (payload.iss !== "auth-saas-platform") return false;

		// Check purpose
		if (payload.purpose !== "internal-api") return false;

		// Check expiration
		let now = Math.floor(Date.now() / 1000);
		if (typeof payload.exp !== "number" || payload.exp < now) return false;

		return true;
	} catch {
		return false;
	}
}
```

The verification follows a strict order: structure validation, signature verification, then claim validation. Signature verification uses `constantTimeCompare` to prevent timing attacks. The function returns `false` for any validation failure rather than throwing exceptions, making it easy to use in middleware.

## Use Tokens in Middleware

Create middleware that verifies internal tokens on protected routes:

```ts {% path="app/tenant/middleware/management-auth.ts" %}
import { env } from "cloudflare:workers";

import { verifyInternalToken } from "~/lib/internal-auth";

export default () => {
	return async (context, next) => {
		let log = context.logger.middleware("management-auth");

		// Check for internal token (from platform dashboard)
		let internalToken = context.request.headers.get("x-internal-token");
		if (internalToken) {
			let isValid = await verifyInternalToken(internalToken, env.INTERNAL_SECRET);
			if (isValid) {
				log.info("Internal request authenticated via signed token");
				context.managementClient = null;
				return next();
			}
			log.info("Invalid internal token provided");
		}

		// Fall back to other authentication methods...
		return unauthorizedResponse();
	};
};
```

The middleware extracts the token from a custom header (`x-internal-token`), verifies it against the shared secret, and either allows the request or falls through to other authentication methods. Using a custom header rather than the `Authorization` header avoids conflicts with user facing authentication.

## Send Tokens from the Platform Service

When making internal requests, create a fresh token and include it in the headers:

```ts {% path="app/services/tenant-api.ts" %}
import { env } from "cloudflare:workers";

import { createInternalToken } from "~/lib/internal-auth";

export async function callTenantApi(tenantId: string, endpoint: string) {
	let token = await createInternalToken(env.INTERNAL_SECRET);

	let response = await fetch(`https://tenant-${tenantId}.internal/${endpoint}`, {
		headers: {
			"x-internal-token": token,
			"Content-Type": "application/json",
		},
	});

	return response.json();
}
```

Each request gets a fresh token with a new `iat` and `exp`. This means you never need to handle token refresh or storage. The overhead of creating a new token is minimal since HMAC signing is very fast.

## Add Custom Claims for Request Context

You can extend the token payload with additional claims for specific use cases:

```ts {% path="app/lib/internal-auth.ts" %}
interface InternalTokenOptions {
	tenantId?: string;
	action?: string;
	requestId?: string;
}

export async function createInternalToken(
	secret: string,
	options: InternalTokenOptions = {},
): Promise<string> {
	let header = { alg: "HS256", typ: "JWT" };
	let payload = {
		iss: "auth-saas-platform",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 300,
		purpose: "internal-api",
		...options,
	};

	let encodedHeader = base64UrlEncode(JSON.stringify(header));
	let encodedPayload = base64UrlEncode(JSON.stringify(payload));
	let signingInput = `${encodedHeader}.${encodedPayload}`;

	let signature = await hmacSign(signingInput, secret);

	return `${signingInput}.${signature}`;
}
```

Now you can include context about the request:

```ts
let token = await createInternalToken(env.INTERNAL_SECRET, {
	tenantId: "tenant-123",
	action: "create-user",
	requestId: crypto.randomUUID(),
});
```

The receiving service can extract these claims after verification to understand the request context without additional parameters.

## When to Use This Pattern

This pattern works well for several scenarios:

**Platform to Durable Object communication**: When your main application needs to call methods on Durable Objects, internal tokens prove the request comes from your platform rather than an external attacker.

**Microservice to microservice calls**: In a distributed system, services can authenticate each other without a central auth server. Each service shares the same secret and can verify tokens independently.

**Background job authorization**: When a job runner needs to call APIs on behalf of the system, it can use internal tokens rather than impersonating a user or creating service accounts.

**Admin operations**: Operations triggered by your dashboard or CLI can use internal tokens to bypass normal user authentication while still providing audit trails through the token claims.

## Security Considerations

The security of this system depends entirely on keeping the shared secret safe. Store it in environment variables or a secrets manager, never in code. Rotate the secret periodically by supporting multiple valid secrets during the transition period.

Short token lifetimes (5 minutes or less) limit the window for replay attacks. If you need even stronger protection, include a nonce or request hash in the token and track used tokens until they expire.

For communication between services you do not control, consider using asymmetric algorithms (RS256, ES256) instead. HMAC requires sharing the secret with every service that needs to verify tokens, which becomes a liability as your system grows.

## Final Thoughts

HMAC signed JWTs provide a simple, fast, and secure way to authenticate internal service communication. The combination of shared secrets, short expiration times, and self contained tokens eliminates the need for database lookups or network calls during verification.

For user facing authentication where you need public key verification, see [creating type safe JWT wrapper classes](/tutorials/create-type-safe-jwt-wrapper-classes). For external API authentication with stored credentials, explore [API key authentication with SHA 256](/tutorials/implement-api-key-authentication-with-sha-256).
