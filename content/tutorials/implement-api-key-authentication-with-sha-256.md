---
title: How to Implement API Key Authentication with SHA-256
excerpt: Secure your API by hashing keys with SHA-256 and verifying them against stored hashes.
tech: drizzle-orm@0.30.0
---

When building an API, you need a way to authenticate requests from external clients. API keys are a common solution: you generate a unique key for each client, and they include it in every request. Unlike [JWTs which are self-contained](/articles/jwt-vs-opaque-tokens), API keys are opaque tokens that require server-side validation. The challenge is storing these keys securely. If your database is compromised, you don't want attackers to have direct access to valid API keys.

The solution is to hash API keys using SHA-256 before storing them. You store only the hash in your database, and when a request comes in, you hash the provided key and compare it to the stored hash. This way, even if someone gains access to your database, they can't use the hashes to authenticate.

## Hash an API Key with SHA-256

First, create a function to hash strings using the Web Crypto API. This works in Cloudflare Workers, Node.js, and modern browsers.

```ts {% path="app/lib/api-key.ts" %}
async function hashKey(key: string): Promise<string> {
	let encoder = new TextEncoder();
	let data = encoder.encode(key);
	let hashBuffer = await crypto.subtle.digest("SHA-256", data);
	let hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

This function encodes the key as bytes, computes the SHA-256 hash, and converts the result to a hexadecimal string. The output is always 64 characters long, regardless of input length. This same hashing approach is used for [HMAC signing in webhook verification](/articles/webhook-signing-hmac-for-notification-security).

## Generate a Secure API Key

When creating a new API key for a client, generate a cryptographically random value. Include a prefix to make keys identifiable and easier to debug.

```ts {% path="app/lib/api-key.ts" %}
export async function generateApiKey(prefix: string): Promise<{
	key: string;
	keyHash: string;
	keyPrefix: string;
}> {
	// Generate a random 32-byte key
	let randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);
	let key = `${prefix}_${Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`;

	let keyHash = await hashKey(key);
	let keyPrefix = key.slice(0, prefix.length + 9); // prefix + "_" + 8 chars

	return { key, keyHash, keyPrefix };
}
```

This function returns three values: the full `key` to give to the client (shown only once), the `keyHash` to store in your database, and the `keyPrefix` to display in your UI for identification. The prefix lets users recognize which key is which without exposing the full key. Pass a prefix like `"myapp"` to generate keys like `myapp_a1b2c3...`.

## Extract the API Key from Requests

Clients typically send API keys in the `Authorization` header using the Bearer scheme. Create a function to extract the key from incoming requests.

```ts {% path="app/lib/api-key.ts" %}
function extractApiKey(request: Request): string | null {
	let authHeader = request.headers.get("Authorization");
	if (!authHeader) return null;

	let match = authHeader.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}
```

This function handles the standard `Authorization: Bearer <key>` format. It returns `null` if the header is missing or malformed, which you can treat as an authentication failure.

## Verify API Keys Against the Database

Now combine everything into a verification function. This hashes the provided key and looks it up in your database.

```ts {% path="app/lib/api-key.ts" %}
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { apiKeys, teams } from "../db/schema";
import type { SelectApiKey, SelectTeam } from "../db/schema";

export async function verifyApiKey(
	request: Request,
): Promise<{ apiKey: SelectApiKey; team: SelectTeam } | null> {
	let key = extractApiKey(request);
	if (!key) return null;

	let keyHash = await hashKey(key);

	let apiKey = await db.query.apiKeys.findFirst({
		where(fields, operators) {
			return operators.eq(fields.keyHash, keyHash);
		},
	});

	if (!apiKey) return null;

	// Check if key is expired
	if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
		return null;
	}

	// Get the associated team
	let team = await db.query.teams.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, apiKey.teamId);
		},
	});

	if (!team) return null;

	// Update lastUsedAt asynchronously (don't block the request)
	db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey.id)).run();

	return { apiKey, team };
}
```

The function performs several checks: it verifies the key exists, checks expiration, and loads the associated team. The `lastUsedAt` update runs asynchronously so it doesn't slow down the response.

## Check API Key Scopes

API keys often have limited permissions, similar to how [OAuth2 scopes](/articles/oauth2-scopes-explained) restrict token access. Add a helper to check if a key has the required scope for an operation.

```ts {% path="app/lib/api-key.ts" %}
export function hasScope(apiKey: SelectApiKey, requiredScope: ApiKeyScope): boolean {
	return apiKey.scopes.includes(requiredScope);
}
```

Use this in your route handlers to enforce fine-grained permissions. For example, a key might have read access but not write access. For more on [using scopes to authorize actions in your API](/tutorials/use-scope-to-authorize-actions-in-your-api), see the dedicated tutorial.

## Create Standard API Responses

Consistent error and success responses make your API easier to use. Create helper functions for common response patterns.

```ts {% path="app/lib/api-key.ts" %}
export function apiError(code: string, message: string, status: number): Response {
	return Response.json(
		{
			error: {
				code,
				message,
			},
		},
		{ status },
	);
}

export function apiSuccess<T>(data: T, status = 200): Response {
	return Response.json(
		{
			data,
			meta: {
				requestId: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
			},
		},
		{ status },
	);
}
```

These helpers ensure every response follows the same structure. The `meta` object in success responses includes a request ID for debugging and a timestamp for auditing.

## Use the Authentication in Route Handlers

With all the pieces in place, use them in your API routes to protect endpoints.

```ts {% path="app/routes/api.monitors.ts" %}
import { verifyApiKey, hasScope, apiError, apiSuccess } from "../lib/api-key";

export async function loader({ request }: Route.LoaderArgs) {
	let auth = await verifyApiKey(request);

	if (!auth) {
		return apiError("UNAUTHORIZED", "Invalid or missing API key", 401);
	}

	if (!hasScope(auth.apiKey, "monitors:read")) {
		return apiError("FORBIDDEN", "API key lacks required scope", 403);
	}

	let monitors = await getMonitorsForTeam(auth.team.id);

	return apiSuccess({ monitors });
}
```

This pattern authenticates the request, checks permissions, and returns appropriate errors or data. The consistent response format makes it easy for clients to handle both success and failure cases.

## Final Thoughts

Hashing API keys with SHA-256 protects your users even if your database is compromised. The key is never stored in plain text, only shown once when generated, and verified by comparing hashes. Combined with expiration dates and scopes, this approach gives you a secure and flexible authentication system for your API.

For more complex authentication needs involving user authorization, consider [building an OAuth2/OIDC provider](/tutorials/build-an-oauth2-oidc-provider-from-scratch) that issues [access and refresh tokens](/articles/oauth2-tokens-explained).
